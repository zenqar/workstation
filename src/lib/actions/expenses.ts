'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import { z } from 'zod';

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

const ExpenseSchema = z.object({
  account_id:   z.string().uuid(),
  contact_id:   z.string().uuid().nullable().optional(),
  category:     z.string().min(1),
  description:  z.string().min(1),
  amount:       z.number().positive(),
  currency:     z.enum(['IQD', 'USD']),
  expense_date: z.string(),
  note:         z.string().nullable().optional(),
  receipt_url:  z.string().nullable().optional(),
});

export async function createExpense(
  businessId: string,
  data: z.infer<typeof ExpenseSchema>
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user, role } = await requireBusinessUser(businessId);

  if (!['owner', 'admin', 'accountant', 'staff'].includes(role)) {
    return { error: 'Permission denied' };
  }

  const parsed = ExpenseSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const d = parsed.data;
  const { data: expenseId, error } = await supabase.rpc('record_expense', {
    p_business_id:  businessId,
    p_account_id:   d.account_id,
    p_contact_id:   d.contact_id ?? null,
    p_category:     d.category,
    p_description:  d.description,
    p_amount:       d.amount,
    p_currency:     d.currency,
    p_expense_date: d.expense_date,
    p_note:         d.note ?? null,
    p_receipt_url:  d.receipt_url ?? null,
    p_created_by:   user.id,
  });

  if (error) return { error: error.message || 'Failed to create expense' };

  revalidatePath('/app/expenses');
  revalidatePath('/app/accounts');
  revalidatePath('/app/dashboard');
  return { data: { id: expenseId } };
}

export async function getExpenses(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('expenses')
    .select('*, account:accounts(id, name, currency), contact:contacts(id, name)')
    .eq('business_id', businessId)
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function deleteExpense(businessId: string, expenseId: string): Promise<ActionResult> {
  const { supabase, role } = await requireBusinessUser(businessId);
  if (!['owner', 'admin', 'accountant'].includes(role)) return { error: 'Permission denied' };

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('business_id', businessId);

  if (error) return { error: 'Failed to delete expense' };
  revalidatePath('/app/expenses');
  revalidatePath('/app/dashboard');
  return {};
}
