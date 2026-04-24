'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult, BusinessContext } from '@/lib/types';
import { z } from 'zod';

// ── Get current user's businesses ──────────────────────────────
export async function getUserBusinesses() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('business_memberships')
    .select('role, status, business:businesses(*)')
    .eq('user_id', user.id)
    .eq('status', 'active');

  return (data || []).map((m) => ({
    business: m.business as NonNullable<typeof m.business>,
    role: m.role,
  }));
}

// ── Get full business context for the active business ──────────
export async function getBusinessContext(businessId: string): Promise<BusinessContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: membership }, { data: business }, { data: settings }] = await Promise.all([
    supabase.from('business_memberships').select('*').eq('business_id', businessId).eq('user_id', user.id).eq('status', 'active').single(),
    supabase.from('businesses').select('*').eq('id', businessId).single(),
    supabase.from('business_settings').select('*').eq('business_id', businessId).single(),
  ]);

  if (!membership || !business) return null;
  return { business, membership, role: membership.role, settings: settings ?? null };
}

// ── Update business settings ───────────────────────────────────
const BusinessUpdateSchema = z.object({
  name:          z.string().min(1),
  legal_name:    z.string().nullable().optional(),
  email:         z.string().email().nullable().optional().or(z.literal('')),
  phone:         z.string().nullable().optional(),
  website:       z.string().nullable().optional(),
  address_line1: z.string().nullable().optional(),
  city:          z.string().nullable().optional(),
  country:       z.string().nullable().optional(),
  tax_number:    z.string().nullable().optional(),
  invoice_prefix:     z.string().min(1).max(10),
  default_currency:   z.enum(['IQD', 'USD']),
  default_language:   z.enum(['en', 'ar', 'ku']),
});

export async function updateBusiness(businessId: string, data: z.infer<typeof BusinessUpdateSchema>): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: mem } = await supabase.from('business_memberships').select('role')
    .eq('business_id', businessId).eq('user_id', user.id).eq('status', 'active').single();
  if (!mem || !['owner', 'admin'].includes(mem.role)) return { error: 'Permission denied' };

  const parsed = BusinessUpdateSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from('businesses').update({ ...parsed.data, email: parsed.data.email || null })
    .eq('id', businessId);
  if (error) return { error: 'Failed to update business' };
  revalidatePath('/app/settings/business');
  return {};
}

// ── Update business settings (invoice/payout config) ──────────
const SettingsSchema = z.object({
  invoice_due_days:         z.number().int().min(0).max(365),
  invoice_footer_note:      z.string().nullable().optional(),
  invoice_tax_label:        z.string(),
  invoice_tax_rate:         z.number().min(0).max(100),
  show_tax_on_invoice:      z.boolean(),
  show_discount_on_invoice: z.boolean(),
  payout_bank_name:         z.string().nullable().optional(),
  payout_account_name:      z.string().nullable().optional(),
  payout_account_number:    z.string().nullable().optional(),
  payout_iban:              z.string().nullable().optional(),
  payout_swift:             z.string().nullable().optional(),
  payout_notes:             z.string().nullable().optional(),
});

export async function updateBusinessSettings(businessId: string, data: z.infer<typeof SettingsSchema>): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: mem } = await supabase.from('business_memberships').select('role')
    .eq('business_id', businessId).eq('user_id', user.id).eq('status', 'active').single();
  if (!mem || !['owner', 'admin'].includes(mem.role)) return { error: 'Permission denied' };

  const parsed = SettingsSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from('business_settings').update(parsed.data).eq('business_id', businessId);
  if (error) return { error: 'Failed to update settings' };
  revalidatePath('/app/settings');
  return {};
}

// ── Invite team member ─────────────────────────────────────────
export async function inviteTeamMember(businessId: string, email: string, role: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: mem } = await supabase.from('business_memberships').select('role')
    .eq('business_id', businessId).eq('user_id', user.id).eq('status', 'active').single();
  if (!mem || !['owner', 'admin'].includes(mem.role)) return { error: 'Permission denied' };

  const validRoles = ['admin', 'accountant', 'staff', 'viewer'];
  if (!validRoles.includes(role)) return { error: 'Invalid role' };
  if (!z.string().email().safeParse(email).success) return { error: 'Invalid email' };

  // Check if already a member
  const { data: existing } = await supabase.from('business_memberships')
    .select('id').eq('business_id', businessId).eq('email', email).single();
  if (existing) return { error: 'This email is already a team member' };

  // Check if user exists by email (look up profile)
  const admin = await createAdminClient();
  const { data: users } = await admin.auth.admin.listUsers();
  const existingUser = users?.users?.find((u) => u.email === email);

  const { error } = await supabase.from('business_memberships').insert({
    business_id: businessId,
    user_id:     existingUser?.id ?? null,
    email,
    role,
    status:      existingUser ? 'active' : 'pending',
    invited_by:  user.id,
    invited_at:  new Date().toISOString(),
  });

  if (error) return { error: 'Failed to invite team member' };
  revalidatePath('/app/settings/team');
  return {};
}

// ── Remove team member ─────────────────────────────────────────
export async function removeTeamMember(businessId: string, membershipId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: mem } = await supabase.from('business_memberships').select('role')
    .eq('business_id', businessId).eq('user_id', user.id).eq('status', 'active').single();
  if (!mem || !['owner', 'admin'].includes(mem.role)) return { error: 'Permission denied' };

  const { error } = await supabase.from('business_memberships').delete()
    .eq('id', membershipId).eq('business_id', businessId).neq('role', 'owner');
  if (error) return { error: 'Failed to remove team member' };
  revalidatePath('/app/settings/team');
  return {};
}

// ── Get team members ───────────────────────────────────────────
export async function getTeamMembers(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('business_memberships')
    .select('*, profile:profiles(id, full_name, email, avatar_url)')
    .eq('business_id', businessId)
    .order('joined_at');
  if (error) throw error;
  return data;
}

// ── Dashboard stats ────────────────────────────────────────────
export async function getDashboardStats(businessId: string) {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const [invoicesRes, paymentsRes, expensesRes, balancesRes, fxRes] = await Promise.all([
    supabase.from('invoices').select('id, status, total, currency, due_date').eq('business_id', businessId),
    supabase.from('payments').select('amount, currency, payment_date').eq('business_id', businessId).gte('payment_date', monthStart),
    supabase.from('expenses').select('amount, currency, expense_date').eq('business_id', businessId).gte('expense_date', monthStart),
    supabase.rpc('get_business_balances', { p_business_id: businessId }),
    supabase.from('fx_rate_snapshots').select('rate, fetched_at').order('fetched_at', { ascending: false }).limit(1).single(),
  ]);

  const invoices = invoicesRes.data || [];
  const payments = paymentsRes.data || [];
  const expenses = expensesRes.data || [];
  const balances = balancesRes.data || [];
  const fx = fxRes.data;

  const fxRate = fx?.rate ?? 1310;
  const totalIqd = (balances.find((b: { currency: string; total_balance: number }) => b.currency === 'IQD')?.total_balance) ?? 0;
  const totalUsd = (balances.find((b: { currency: string; total_balance: number }) => b.currency === 'USD')?.total_balance) ?? 0;

  return {
    totalBalanceIqd: totalIqd,
    totalBalanceUsd: totalUsd,
    estimatedTotalIqd: totalIqd + totalUsd * fxRate,
    fxRate,
    fxRateUpdatedAt: fx?.fetched_at ?? null,
    unpaidInvoicesCount: invoices.filter((i) => ['issued', 'sent', 'partially_paid'].includes(i.status)).length,
    overdueInvoicesCount: invoices.filter((i) => i.status === 'overdue').length,
    invoicesThisMonth: invoices.filter((i) => i.status !== 'draft' && i.status !== 'cancelled').length,
    paymentsThisMonth: payments.length,
    paymentsAmountIqd: payments.filter((p) => p.currency === 'IQD').reduce((s, p) => s + p.amount, 0),
    paymentsAmountUsd: payments.filter((p) => p.currency === 'USD').reduce((s, p) => s + p.amount, 0),
    expensesThisMonth: expenses.length,
    expensesAmountIqd: expenses.filter((e) => e.currency === 'IQD').reduce((s, e) => s + e.amount, 0),
    expensesAmountUsd: expenses.filter((e) => e.currency === 'USD').reduce((s, e) => s + e.amount, 0),
  };
}

// ── Update user profile / language ────────────────────────────
export async function updateProfile(data: { full_name?: string; preferred_language?: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase.from('profiles').update(data).eq('id', user.id);
  if (error) return { error: 'Failed to update profile' };
  revalidatePath('/app/settings/language');
  return {};
}
