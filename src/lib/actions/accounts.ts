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
    .from('business_memberships').select('role, status')
    .eq('business_id', businessId).eq('user_id', user.id).eq('status', 'active').single();
  if (!membership) throw new Error('Access denied');
  return { supabase, user, role: membership.role };
}

const AccountSchema = z.object({
  name:           z.string().min(1, 'Account name required'),
  account_type:   z.enum(['cash', 'bank', 'wallet', 'other']),
  currency:       z.enum(['IQD', 'USD']),
  display_detail: z.string().nullable().optional(),
  bank_name:      z.string().nullable().optional(),
});

export async function createAccount(businessId: string, data: z.infer<typeof AccountSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const { user, role } = await requireBusinessUser(businessId);
    if (!['owner', 'admin', 'accountant'].includes(role)) return { error: 'Permission denied' };

    const parsed = AccountSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    const admin = await createAdminClient();
    const { data: account, error } = await admin.from('accounts').insert({
      business_id: businessId, created_by: user.id, ...parsed.data,
    }).select('id').single();

    if (error) throw error;
    revalidatePath('/[locale]/app/accounts', 'layout');
    return { data: { id: account.id } };
  } catch (err: any) {
    console.error('[createAccount]', err);
    return { error: err.message };
  }
}

export async function updateAccount(businessId: string, accountId: string, data: z.infer<typeof AccountSchema>): Promise<ActionResult> {
  try {
    const { role } = await requireBusinessUser(businessId);
    if (!['owner', 'admin', 'accountant'].includes(role)) return { error: 'Permission denied' };

    const parsed = AccountSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    const admin = await createAdminClient();
    const { error } = await admin.from('accounts').update(parsed.data)
      .eq('id', accountId).eq('business_id', businessId);
    if (error) throw error;
    revalidatePath(`/[locale]/app/accounts/${accountId}`, 'layout');
    revalidatePath('/[locale]/app/accounts', 'layout');
    return {};
  } catch (err: any) {
    console.error('[updateAccount]', err);
    return { error: err.message };
  }
}

export async function getAccounts(businessId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('accounts').select('*').eq('business_id', businessId).order('name');
    if (error) { console.error('[getAccounts] error:', error); return []; }
    return data || [];
  } catch (err) { console.error('[getAccounts] runtime error:', err); return []; }
}

export async function getAccountWithBalance(businessId: string, accountId: string) {
  try {
    const supabase = await createClient();
    const [{ data: account }, { data: balanceData }] = await Promise.all([
      supabase.from('accounts').select('*').eq('id', accountId).eq('business_id', businessId).single(),
      supabase.rpc('get_account_balance', { p_account_id: accountId }),
    ]);
    if (!account) return null;
    return { ...account, balance: balanceData ?? 0 };
  } catch (err) { console.error('[getAccountWithBalance] runtime error:', err); return null; }
}

export async function getAccountsWithBalances(businessId: string) {
  try {
    const supabase = await createClient();
    const { data: accounts, error } = await supabase
      .from('accounts').select('*').eq('business_id', businessId).order('name');
    if (error) { console.error('[getAccountsWithBalances] error:', error); return []; }
    const withBalances = await Promise.all(
      (accounts || []).map(async (acc) => {
        const { data: bal } = await supabase.rpc('get_account_balance', { p_account_id: acc.id });
        return { ...acc, balance: bal ?? 0 };
      })
    );
    return withBalances;
  } catch (err) { console.error('[getAccountsWithBalances] runtime error:', err); return []; }
}

export async function transferFunds(
  businessId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  currency: 'IQD' | 'USD',
  transferDate: string,
  description?: string
): Promise<ActionResult> {
  const { supabase, user, role } = await requireBusinessUser(businessId);
  if (!['owner', 'admin', 'accountant'].includes(role)) return { error: 'Permission denied' };

  const { error } = await supabase.rpc('transfer_between_accounts', {
    p_business_id:     businessId,
    p_from_account_id: fromAccountId,
    p_to_account_id:   toAccountId,
    p_amount:          amount,
    p_currency:        currency,
    p_transfer_date:   transferDate,
    p_description:     description ?? 'Internal transfer',
    p_created_by:      user.id,
  });

  if (error) return { error: error.message || 'Transfer failed' };
  revalidatePath('/app/accounts');
  revalidatePath('/app/dashboard');
  return {};
}

export async function getAccountTransactions(businessId: string, accountId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('money_transactions').select('*')
      .eq('account_id', accountId).eq('business_id', businessId)
      .order('transaction_date', { ascending: false }).limit(100);
    if (error) { console.error('[getAccountTransactions] error:', error); return []; }
    return data || [];
  } catch (err) { console.error('[getAccountTransactions] runtime error:', err); return []; }
}
