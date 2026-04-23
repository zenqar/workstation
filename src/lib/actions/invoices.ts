'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult, Invoice, InvoiceFormData } from '@/lib/types';
import { z } from 'zod';

// ============================================================
// Validation
// ============================================================

const InvoiceItemSchema = z.object({
  description: z.string().min(1, 'Item description required'),
  quantity:    z.number().positive('Quantity must be positive'),
  unit_price:  z.number().min(0, 'Price must be non-negative'),
});

const InvoiceSchema = z.object({
  contact_id:     z.string().uuid().nullable().optional(),
  currency:       z.enum(['IQD', 'USD']),
  issue_date:     z.string(),
  due_date:       z.string().nullable().optional(),
  payment_terms:  z.string().nullable().optional(),
  discount_percent: z.number().min(0).max(100).default(0),
  tax_rate:       z.number().min(0).max(100).default(0),
  notes:          z.string().nullable().optional(),
  internal_notes: z.string().nullable().optional(),
  items:          z.array(InvoiceItemSchema).min(1, 'At least one line item required'),
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

  // Get next invoice number atomically
  const { data: numData, error: numError } = await supabase
    .rpc('get_next_invoice_number', { p_business_id: businessId });

  if (numError || !numData) {
    return { error: 'Failed to generate invoice number' };
  }

  // Insert invoice
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .insert({
      business_id:      businessId,
      invoice_number:   numData,
      contact_id:       d.contact_id,
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
      created_by:       user.id,
    })
    .select('id')
    .single();

  if (invError || !invoice) {
    return { error: 'Failed to create invoice' };
  }

  // Insert line items
  const itemInserts = d.items.map((item, idx) => ({
    invoice_id:  invoice.id,
    business_id: businessId,
    description: item.description,
    quantity:    item.quantity,
    unit_price:  item.unit_price,
    sort_order:  idx,
  }));

  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(itemInserts);

  if (itemsError) {
    return { error: 'Failed to save invoice items' };
  }

  revalidatePath(`/app/invoices`);
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

  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      contact_id:       d.contact_id,
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

const PaymentSchema = z.object({
  account_id:   z.string().uuid(),
  amount:       z.number().positive('Amount must be positive'),
  currency:     z.enum(['IQD', 'USD']),
  payment_date: z.string(),
  reference:    z.string().nullable().optional(),
  note:         z.string().nullable().optional(),
});

export async function recordPayment(
  businessId: string,
  invoiceId: string,
  data: {
    account_id: string;
    amount: number;
    currency: 'IQD' | 'USD';
    payment_date: string;
    reference?: string;
    note?: string;
  }
): Promise<ActionResult<{ paymentId: string }>> {
  const { supabase, user, role } = await requireBusinessUser(businessId);

  if (!['owner', 'admin', 'accountant', 'staff'].includes(role)) {
    return { error: 'Permission denied' };
  }

  const parsed = PaymentSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const { data: paymentId, error } = await supabase.rpc(
    'record_payment_and_update_invoice',
    {
      p_business_id:  businessId,
      p_invoice_id:   invoiceId,
      p_account_id:   d.account_id,
      p_amount:       d.amount,
      p_currency:     d.currency,
      p_payment_date: d.payment_date,
      p_reference:    d.reference ?? null,
      p_note:         d.note ?? null,
      p_created_by:   user.id,
    }
  );

  if (error) return { error: error.message || 'Failed to record payment' };

  revalidatePath(`/app/invoices/${invoiceId}`);
  revalidatePath('/app/payments');
  revalidatePath('/app/accounts');
  revalidatePath('/app/dashboard');
  return { data: { paymentId } };
}

// ============================================================
// Get Invoices (list)
// ============================================================

export async function getInvoices(businessId: string, status?: string) {
  const supabase = await createClient();
  let query = supabase
    .from('invoices')
    .select(`
      *,
      contact:contacts(id, name, company_name)
    `)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status as Invoice['status']);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ============================================================
// Get Single Invoice
// ============================================================

export async function getInvoice(businessId: string, invoiceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      contact:contacts(*),
      invoice_items(*)
    `)
    .eq('id', invoiceId)
    .eq('business_id', businessId)
    .single();

  if (error) throw error;
  return data;
}
