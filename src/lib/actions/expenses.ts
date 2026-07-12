'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
  contact_id:   z.string().uuid().nullable().optional().or(z.literal('')),
  category:     z.string().min(1),
  description:  z.string().min(1),
  amount:       z.number().positive(),
  currency:     z.enum(['IQD', 'USD']),
  expense_date: z.string(),
  note:         z.string().nullable().optional(),
  receipt_url:  z.string().max(500).nullable().optional(),
});

function expenseErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}

export async function createExpense(
  businessId: string,
  data: z.infer<typeof ExpenseSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user, role } = await requireBusinessUser(businessId);

    if (!['owner', 'admin', 'accountant', 'staff'].includes(role)) {
      return { error: 'Permission denied' };
    }

    const parsed = ExpenseSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    const d = parsed.data;
    const admin = await createAdminClient();

    const { data: account } = await admin
      .from('accounts')
      .select('id, currency, is_active')
      .eq('id', d.account_id)
      .eq('business_id', businessId)
      .maybeSingle();
    if (!account || !account.is_active) return { error: 'Select an active account from this business.' };
    if (account.currency !== d.currency) return { error: `The selected account uses ${account.currency}, not ${d.currency}.` };

    if (d.contact_id) {
      const { data: contact } = await admin
        .from('contacts')
        .select('id')
        .eq('id', d.contact_id)
        .eq('business_id', businessId)
        .maybeSingle();
      if (!contact) return { error: 'The selected supplier does not belong to this business.' };
    }

    const { data: expenseId, error } = await admin.rpc('record_expense', {
      p_business_id:  businessId,
      p_account_id:   d.account_id,
      p_contact_id:   d.contact_id || null,
      p_category:     d.category,
      p_description:  d.description,
      p_amount:       d.amount,
      p_currency:     d.currency,
      p_expense_date: d.expense_date,
      p_note:         d.note ?? null,
      p_receipt_url:  d.receipt_url ?? null,
      p_created_by:   user.id,
    });

    if (error) throw error;

    revalidatePath('/[locale]/app/expenses', 'layout');
    revalidatePath('/[locale]/app/accounts', 'layout');
    revalidatePath('/[locale]/app/dashboard', 'layout');
    return { data: { id: expenseId } };
  } catch (err: unknown) {
    console.error('[createExpense]', err);
    return { error: expenseErrorMessage(err, 'Could not create expense') };
  }
}

export async function getExpenses(businessId: string) {
  try {
    const { role } = await requireBusinessUser(businessId);
    if (!role) return [];

    const admin = await createAdminClient();
    const { data, error } = await admin
      .from('expenses')
      .select('*, account:accounts(id, name, currency), contact:contacts(id, name)')
      .eq('business_id', businessId)
      .order('expense_date', { ascending: false });
    if (error) {
      console.error('[getExpenses] error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[getExpenses] runtime error:', err);
    return [];
  }
}

export async function deleteExpense(businessId: string, expenseId: string): Promise<ActionResult> {
  try {
    const { role } = await requireBusinessUser(businessId);
    if (!['owner', 'admin', 'accountant'].includes(role)) return { error: 'Permission denied' };

    const admin = await createAdminClient();
    const { error } = await admin
      .from('expenses')
      .delete()
      .eq('id', expenseId)
      .eq('business_id', businessId);

    if (error) throw error;
    
    revalidatePath('/[locale]/app/expenses', 'layout');
    revalidatePath('/[locale]/app/dashboard', 'layout');
    return {};
  } catch (err: unknown) {
    console.error('[deleteExpense]', err);
    return { error: expenseErrorMessage(err, 'Could not delete expense') };
  }
}
