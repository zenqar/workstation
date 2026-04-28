'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult, Invoice, InvoiceFormData } from '@/lib/types';
import { z } from 'zod';
import { notify } from './notifications';

// ============================================================
// Validation
// ============================================================

const InvoiceItemSchema = z.object({
  description: z.string().min(1, 'Item description required'),
  quantity:    z.number().positive('Quantity must be positive'),
  unit_price:  z.number().min(0, 'Price must be non-negative'),
});

const InvoiceSchema = z.object({
  customer_mode:  z.enum(['existing', 'custom']).default('existing'),
  contact_id:     z.string().uuid().nullable().optional().or(z.literal('')),
  custom_customer_name: z.string().nullable().optional(),
  custom_customer_type: z.string().nullable().optional(),
  save_to_contacts: z.boolean().default(false),
  currency:       z.enum(['IQD', 'USD']),
  issue_date:     z.string(),
  due_date:       z.string().nullable().optional(),
  payment_terms:  z.string().nullable().optional(),
  discount_percent: z.number().min(0).max(100).default(0),
  tax_rate:       z.number().min(0).max(100).default(0),
  notes:          z.string().nullable().optional(),
  internal_notes: z.string().nullable().optional(),
  items:          z.array(InvoiceItemSchema).min(1, 'At least one line item required'),
  is_external:    z.boolean().default(false),
  external_source: z.string().nullable().optional(),
  external_id:    z.string().nullable().optional(),
  payment_account_ids: z.array(z.string().uuid()).optional().default([]),
});

// ============================================================
// Helper: require authenticated user in a business
// ============================================================

async function requireBusinessUser(businessId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: membership } = await supabase
    .from('business_memberships')
    .select('role, status')
    .eq('business_id', businessId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (!membership) throw new Error('Access denied');
  return { supabase, user, role: membership.role };
}

// ============================================================
// Helper: calculate invoice totals
// ============================================================

function calculateTotals(items: InvoiceFormData['items'], discountPct: number, taxRate: number) {
  const subtotal        = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const discountAmount  = (subtotal * discountPct) / 100;
  const taxable         = subtotal - discountAmount;
  const taxAmount       = (taxable * taxRate) / 100;
  const total           = taxable + taxAmount;
  return { subtotal, discountAmount, taxAmount, total };
}

// ============================================================
// Create Invoice
// ============================================================

export async function createInvoice(
  businessId: string,
  data: InvoiceFormData
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user, role } = await requireBusinessUser(businessId);

  if (!['owner', 'admin', 'accountant', 'staff'].includes(role)) {
    return { error: 'You do not have permission to create invoices' };
  }

  const parsed = InvoiceSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const d = parsed.data;
  const { subtotal, discountAmount, taxAmount, total } = calculateTotals(
    d.items, d.discount_percent, d.tax_rate
  );

    const admin = await createAdminClient();

    // Get next invoice number atomically using admin client
    const { data: numData, error: numError } = await admin
      .rpc('get_next_invoice_number', { p_business_id: businessId });

    if (numError || !numData) {
      console.error('[createInvoice] RPC error:', numError);
      return { error: 'Failed to generate invoice number' };
    }

  let finalContactId = d.contact_id || null;
  let customCustomerName = d.custom_customer_name || null;
  let customCustomerType = d.custom_customer_type || null;

  if (d.customer_mode === 'custom' && customCustomerName) {
    if (d.save_to_contacts) {
      // Create official contact
      const { data: newContact, error: contactError } = await admin
        .from('contacts')
        .insert({
          business_id: businessId,
          type: 'customer',
          name: customCustomerName,
          company_name: d.custom_customer_type === 'business' ? customCustomerName : null,
          created_by: user.id
        })
        .select('id')
        .single();
      
      if (!contactError && newContact) {
        finalContactId = newContact.id;
        customCustomerName = null; 
        customCustomerType = null;
      }
    } else {
      finalContactId = null; 
    }
  }

  // Insert invoice
  const { data: invoice, error: invoiceError } = await admin
    .from('invoices')
    .insert({
      business_id: businessId,
      invoice_number: numData,
      contact_id: finalContactId,
      custom_customer_name: customCustomerName,
      custom_customer_type: customCustomerType,
      currency: d.currency,
      issue_date: d.issue_date,
      due_date: d.due_date,
      payment_terms: d.payment_terms,
      subtotal,
      discount_amount: discountAmount,
      discount_percent: d.discount_percent,
      tax_amount: taxAmount,
      tax_rate: d.tax_rate,
      total,
      notes: d.notes,
      internal_notes: d.internal_notes,
      status: 'draft',
      created_by: user.id,
      is_external: d.is_external,
      external_source: d.external_source,
      external_id: d.external_id,
      payment_account_ids: d.payment_account_ids,
    })
    .select('id')
    .single();

  if (invoiceError || !invoice) {
    console.error('[createInvoice] DB error:', invoiceError);
    return { 
      error: invoiceError 
        ? `${invoiceError.message}${invoiceError.details ? ': ' + invoiceError.details : ''}` 
        : 'Failed to create invoice (no data returned)' 
    };
  }

  // Insert line items
  if (d.items && d.items.length > 0) {
    const itemInserts = d.items.map((item, idx) => ({
      invoice_id:  invoice.id,
      business_id: businessId,
      description: item.description,
      quantity:    item.quantity,
      unit_price:  item.unit_price,
      sort_order:  idx,
    }));

    const { error: itemsError } = await admin
      .from('invoice_items')
      .insert(itemInserts);

    if (itemsError) {
      console.error('[createInvoice] Items error:', itemsError);
      return { error: `Invoice created but items failed: ${itemsError.message}` };
    }
  }

  revalidatePath('/[locale]/app/invoices', 'layout');
  revalidatePath('/[locale]/app/accounts', 'layout');
  revalidatePath('/[locale]/app/dashboard', 'layout');
  
  return { data: { id: invoice.id } };
}

// ============================================================
// Update Invoice (draft only)
// ============================================================

export async function updateInvoice(
  businessId: string,
  invoiceId: string,
  data: InvoiceFormData
): Promise<ActionResult> {
  const { supabase, role } = await requireBusinessUser(businessId);

  if (!['owner', 'admin', 'accountant', 'staff'].includes(role)) {
    return { error: 'Permission denied' };
  }

  // Verify it's still a draft
  const { data: existing } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', invoiceId)
    .eq('business_id', businessId)
    .single();

  if (!existing) return { error: 'Invoice not found' };
  if (existing.status !== 'draft') return { error: 'Only draft invoices can be edited' };

  const parsed = InvoiceSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const { subtotal, discountAmount, taxAmount, total } = calculateTotals(
    d.items, d.discount_percent, d.tax_rate
  );

  let finalContactId = d.contact_id || null;
  let customCustomerName = d.custom_customer_name || null;
  let customCustomerType = d.custom_customer_type || null;

  if (d.customer_mode === 'custom' && customCustomerName) {
    if (d.save_to_contacts) {
      // Create official contact
      const { data: { user } } = await supabase.auth.getUser();
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          business_id: businessId,
          type: 'customer',
          name: customCustomerName,
          company_name: d.custom_customer_type === 'business' ? customCustomerName : null,
          created_by: user?.id
        })
        .select('id')
        .single();
      
      if (!contactError && newContact) {
        finalContactId = newContact.id;
        customCustomerName = null;
        customCustomerType = null;
      }
    } else {
      finalContactId = null;
    }
  }

  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      contact_id:       finalContactId,
      custom_customer_name: customCustomerName,
      custom_customer_type: customCustomerType,
      currency:         d.currency,
      issue_date:       d.issue_date,
      due_date:         d.due_date,
      payment_terms:    d.payment_terms,
      subtotal,
      discount_amount:  discountAmount,
      discount_percent: d.discount_percent,
      tax_amount:       taxAmount,
      tax_rate:         d.tax_rate,
      total,
      notes:            d.notes,
      internal_notes:   d.internal_notes,
      payment_account_ids: d.payment_account_ids,
    })
    .eq('id', invoiceId)
    .eq('business_id', businessId)
    .eq('status', 'draft');

  if (updateError) return { error: 'Failed to update invoice' };

  // Replace all items
  await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);

  const itemInserts = d.items.map((item, idx) => ({
    invoice_id:  invoiceId,
    business_id: businessId,
    description: item.description,
    quantity:    item.quantity,
    unit_price:  item.unit_price,
    sort_order:  idx,
  }));

  await supabase.from('invoice_items').insert(itemInserts);

  revalidatePath(`/app/invoices/${invoiceId}`);
  return {};
}

// ============================================================
// Issue Invoice
// ============================================================

export async function issueInvoice(
  businessId: string,
  invoiceId: string
): Promise<ActionResult> {
  const { supabase, user, role } = await requireBusinessUser(businessId);

  if (!['owner', 'admin', 'accountant'].includes(role)) {
    return { error: 'You do not have permission to issue invoices' };
  }

  const { error } = await supabase.rpc('issue_invoice', {
    p_invoice_id: invoiceId,
    p_issued_by:  user.id,
  });

  if (error) return { error: error.message || 'Failed to issue invoice' };

  revalidatePath(`/app/invoices/${invoiceId}`);
  revalidatePath('/app/invoices');
  return {};
}

// ============================================================
// Cancel Invoice
// ============================================================

export async function cancelInvoice(
  businessId: string,
  invoiceId: string
): Promise<ActionResult> {
  const { supabase, role } = await requireBusinessUser(businessId);

  if (!['owner', 'admin', 'accountant'].includes(role)) {
    return { error: 'Permission denied' };
  }

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'cancelled' })
    .eq('id', invoiceId)
    .eq('business_id', businessId)
    .not('status', 'eq', 'draft');

  if (error) return { error: 'Failed to cancel invoice' };

  revalidatePath(`/app/invoices/${invoiceId}`);
  revalidatePath('/app/invoices');
  return {};
}

// ============================================================
// Record Payment
// ============================================================

const PaymentEntrySchema = z.object({
  account_id:   z.string().uuid(),
  amount:       z.number().positive('Amount must be positive'),
});

const MultiPaymentSchema = z.object({
  payments:     z.array(PaymentEntrySchema).min(1),
  currency:     z.enum(['IQD', 'USD']),
  payment_date: z.string(),
  reference:    z.string().nullable().optional(),
  note:         z.string().nullable().optional(),
});

export async function recordPayment(
  businessId: string,
  invoiceId: string,
  data: {
    payments: { account_id: string; amount: number }[];
    currency: 'IQD' | 'USD';
    payment_date: string;
    reference?: string;
    note?: string;
  }
): Promise<ActionResult> {
  const { supabase, user, role } = await requireBusinessUser(businessId);

  if (!['owner', 'admin', 'accountant', 'staff'].includes(role)) {
    return { error: 'Permission denied' };
  }

  const parsed = MultiPaymentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  
  for (const entry of d.payments) {
    const { error } = await supabase.rpc(
      'record_payment_and_update_invoice',
      {
        p_business_id:  businessId,
        p_invoice_id:   invoiceId,
        p_account_id:   entry.account_id,
        p_amount:       entry.amount,
        p_currency:     d.currency,
        p_payment_date: d.payment_date,
        p_reference:    d.reference ?? null,
        p_note:         d.note ?? null,
        p_created_by:   user.id,
      }
    );

    if (error) {
      console.error('[recordPayment] Error recording part of payment:', error);
      return { error: `Partial success: Failed at one of the entries: ${error.message}` };
    }
  }

  // Finalize confirmation timestamp
  const admin = await createAdminClient();
  await admin.from('invoices').update({ 
    payment_confirmed_at: new Date().toISOString() 
  }).eq('id', invoiceId);

  revalidatePath(`/app/invoices/${invoiceId}`);
  revalidatePath('/app/payments');
  revalidatePath('/app/accounts');
  revalidatePath('/app/dashboard');
  return {};
}

export async function payIncomingInvoice(
  businessId: string,
  invoiceId: string,
  data: {
    payments: { account_id: string; amount: number }[];
    currency: 'IQD' | 'USD';
    payment_date: string;
    reference?: string;
    note?: string;
  }
): Promise<ActionResult> {
  const { supabase, user, role } = await requireBusinessUser(businessId);

  if (!['owner', 'admin', 'accountant'].includes(role)) {
    return { error: 'Permission denied' };
  }

  const parsed = MultiPaymentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;

  for (const entry of d.payments) {
    const { error } = await supabase.rpc(
      'pay_incoming_invoice',
      {
        p_invoice_id:         invoiceId,
        p_payer_business_id:  businessId,
        p_payer_account_id:   entry.account_id,
        p_amount:             entry.amount,
        p_payment_date:       d.payment_date,
        p_reference:          d.reference ?? null,
        p_note:               d.note ?? null,
        p_created_by:         user.id,
      }
    );

    if (error) return { error: `Partial success: ${error.message}` };
  }

  revalidatePath(`/app/invoices/${invoiceId}`);
  revalidatePath('/app/payments');
  revalidatePath('/app/accounts');
  revalidatePath('/app/dashboard');
  return {};
}

// ============================================================
// Get Invoices (list)
// ============================================================

export async function getInvoices(businessId: string, status?: string) {
  try {
    const { role } = await requireBusinessUser(businessId);
    if (!role) return [];

    const admin = await createAdminClient();
    
    // Find all contacts that are connected to this business (meaning this business is the customer)
    const { data: connectedContacts } = await admin.from('contacts').select('id').eq('connected_business_id', businessId);
    const connectedContactIds = (connectedContacts || []).map(c => c.id);

    let filterStr = `business_id.eq.${businessId}`;
    if (connectedContactIds.length > 0) {
      filterStr = `business_id.eq.${businessId},contact_id.in.(${connectedContactIds.join(',')})`;
    }

    let query = admin
      .from('invoices')
      .select(`
        *,
        contact:contacts(id, name, company_name)
      `)
      .or(filterStr)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status as any);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[getInvoices] error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[getInvoices] runtime error:', err);
    return [];
  }
}

// ============================================================
// Get Single Invoice
// ============================================================

export async function getInvoice(businessId: string, invoiceId: string) {
  try {
    const { role } = await requireBusinessUser(businessId);
    if (!role) return null;

    const admin = await createAdminClient();
    const { data, error } = await admin
      .from('invoices')
      .select(`
        *,
        contact:contacts(*),
        invoice_items(*)
      `)
      .eq('id', invoiceId)
      .single();

    if (error || !data) {
      console.error('[getInvoice] error:', error);
      return null;
    }

    // Verify access: either we issued it, or it was issued to us via a connected contact
    if (data.business_id !== businessId && data.contact?.connected_business_id !== businessId) {
      return null;
    }

    return data;
  } catch (err) {
    console.error('[getInvoice] runtime error:', err);
    return null;
  }
}

// ============================================================
// Public Workflow Actions (Customer interactions)
// ============================================================

export async function acceptInvoicePublic(token: string): Promise<ActionResult> {
  const admin = await createAdminClient();
  const { data: invoice, error: fetchError } = await admin
    .from('invoices')
    .select('id, status, business_id, invoice_number')
    .eq('verification_token', token)
    .single();

  if (fetchError || !invoice) return { error: 'Invoice not found' };
  if (invoice.status !== 'sent') return { error: 'Invoice cannot be accepted in its current state' };

  const { error: updateError } = await admin
    .from('invoices')
    .update({ 
      status: 'accepted',
      accepted_at: new Date().toISOString()
    })
    .eq('id', invoice.id);

  if (updateError) return { error: 'Failed to accept invoice' };
  
  // Notify the issuing business
  await notify(
    invoice.business_id,
    'invoice_accepted',
    'Invoice Accepted',
    `Invoice ${invoice.invoice_number || 'N/A'} was accepted by the customer.`,
    `/app/invoices/${invoice.id}`
  );

  revalidatePath('/[locale]/verify/[token]', 'page');
  revalidatePath('/[locale]/app/(authenticated)/invoices/[id]', 'page');
  return {};
}

export async function claimPaymentPublic(token: string, note?: string): Promise<ActionResult> {
  const admin = await createAdminClient();
  const { data: invoice, error: fetchError } = await admin
    .from('invoices')
    .select('id, status, business_id, invoice_number')
    .eq('verification_token', token)
    .single();

  if (fetchError || !invoice) return { error: 'Invoice not found' };
  if (!['sent', 'accepted'].includes(invoice.status)) return { error: 'Payment cannot be claimed at this stage' };

  const { error: updateError } = await admin
    .from('invoices')
    .update({ 
      status: 'payment_claimed',
      payment_claimed_at: new Date().toISOString()
    })
    .eq('id', invoice.id);

  if (updateError) return { error: 'Failed to mark as paid' };
  
  // Notify the issuing business
  await notify(
    invoice.business_id,
    'invoice_payment_claimed',
    'Payment Claimed',
    `The customer claimed they paid Invoice ${invoice.invoice_number || 'N/A'}. Please confirm.`,
    `/app/invoices/${invoice.id}`
  );

  revalidatePath('/[locale]/verify/[token]', 'page');
  revalidatePath('/[locale]/app/(authenticated)/invoices/[id]', 'page');
  return {};
}
