'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult } from '@/lib/types';

async function requireBusinessUser(businessId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: membership } = await supabase.from('business_memberships').select('role')
    .eq('business_id', businessId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
  if (!membership) throw new Error('Access denied');
  return { user, role: membership.role };
}

const BillSchema = z.object({
  contact_id: z.string().uuid().nullable().optional(),
  supplier_name: z.string().max(200).default(''),
  invoice_number: z.string().max(100).nullable().optional(),
  category: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  currency: z.enum(['IQD', 'USD']),
  issue_date: z.iso.date(),
  due_date: z.iso.date().nullable().optional(),
  subtotal: z.number().nonnegative(),
  tax_amount: z.number().nonnegative(),
  total: z.number().positive(),
  notes: z.string().max(1000).nullable().optional(),
  attachment_path: z.string().max(500).nullable().optional(),
});

export async function createSupplierBill(businessId: string, input: z.infer<typeof BillSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const { user, role } = await requireBusinessUser(businessId);
    if (!['owner', 'admin', 'accountant', 'staff'].includes(role)) return { error: 'Permission denied' };
    const parsed = BillSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    const admin = await createAdminClient();
    if (parsed.data.contact_id) {
      const { data: contact } = await admin.from('contacts').select('id').eq('id', parsed.data.contact_id)
        .eq('business_id', businessId).maybeSingle();
      if (!contact) return { error: 'The selected supplier does not belong to this business.' };
    }

    const { data, error } = await admin.from('supplier_bills').insert({
      ...parsed.data,
      business_id: businessId,
      created_by: user.id,
    }).select('id').single();
    if (error) {
      if (error.code === '23505') return { error: 'This supplier invoice number is already in the bills inbox.' };
      throw error;
    }

    revalidatePath('/[locale]/app/bills', 'layout');
    revalidatePath('/[locale]/app/dashboard', 'layout');
    return { data };
  } catch (error) {
    console.error('[createSupplierBill]', error);
    return { error: error instanceof Error ? error.message : 'Could not save supplier bill.' };
  }
}

export async function getSupplierBills(businessId: string) {
  try {
    await requireBusinessUser(businessId);
    const admin = await createAdminClient();
    const { data, error } = await admin.from('supplier_bills')
      .select('*, contact:contacts(id, name)')
      .eq('business_id', businessId)
      .order('due_date', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  } catch (error) {
    console.error('[getSupplierBills]', error);
    return [];
  }
}

export async function paySupplierBill(
  businessId: string,
  billId: string,
  accountId: string,
  paymentDate: string,
  note?: string,
): Promise<ActionResult<{ expenseId: string }>> {
  try {
    const { user, role } = await requireBusinessUser(businessId);
    if (!['owner', 'admin', 'accountant'].includes(role)) return { error: 'Permission denied' };
    const parsed = z.object({ billId: z.string().uuid(), accountId: z.string().uuid(), paymentDate: z.iso.date() })
      .safeParse({ billId, accountId, paymentDate });
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    const admin = await createAdminClient();
    const { data, error } = await admin.rpc('pay_supplier_bill', {
      p_business_id: businessId,
      p_bill_id: parsed.data.billId,
      p_account_id: parsed.data.accountId,
      p_payment_date: parsed.data.paymentDate,
      p_note: note || null,
      p_created_by: user.id,
    });
    if (error) throw error;
    revalidatePath('/[locale]/app/bills', 'layout');
    revalidatePath('/[locale]/app/expenses', 'layout');
    revalidatePath('/[locale]/app/accounts', 'layout');
    revalidatePath('/[locale]/app/dashboard', 'layout');
    return { data: { expenseId: data } };
  } catch (error) {
    console.error('[paySupplierBill]', error);
    return { error: error instanceof Error ? error.message : 'Could not pay bill.' };
  }
}
