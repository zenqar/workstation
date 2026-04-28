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

  const { data, error } = await supabase
    .from('business_memberships')
    .select('role, status, business:businesses(*)')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (error) {
    console.error('[getUserBusinesses] Error fetching businesses:', error);
    return [];
  }

  // Filter out any where the business join failed (e.g., RLS blocked it)
  const validMemberships = (data || []).filter(m => m.business !== null);

  return validMemberships.map((m) => ({
    business: m.business as NonNullable<typeof m.business>,
    role: m.role,
  }));
}

// ── Get full business context for the active business ──────────
export async function getBusinessContext(businessId: string): Promise<BusinessContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: membership }, { data: business }, { data: settings }, { data: accounts }, { data: fx }] = await Promise.all([
    supabase.from('business_memberships').select('*').eq('business_id', businessId).eq('user_id', user.id).eq('status', 'active').maybeSingle(),
    supabase.from('businesses').select('*').eq('id', businessId).single(),
    supabase.from('business_settings').select('*').eq('business_id', businessId).maybeSingle(),
    supabase.from('accounts').select('*').eq('business_id', businessId).eq('is_active', true),
    supabase.from('fx_rate_snapshots').select('rate').order('fetched_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (!membership || !business) return null;
  return { 
    business, 
    membership, 
    role: membership.role, 
    settings: settings ?? null, 
    accounts: accounts ?? [],
    fxRate: fx?.rate ?? 1310 
  };
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
  invoice_prefix:     z.string().min(1).max(10).optional(),
  default_currency:   z.enum(['IQD', 'USD']).optional(),
  default_language:   z.enum(['en', 'ar', 'ku']).optional(),
});

export async function updateBusiness(businessId: string, data: z.infer<typeof BusinessUpdateSchema>): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: mem } = await supabase.from('business_memberships').select('role')
    .eq('business_id', businessId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
  
  const { data: profile } = await supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single();
  const isPlatformAdmin = !!profile?.is_platform_admin;

  if (!isPlatformAdmin && (!mem || !['owner', 'admin'].includes(mem.role))) return { error: 'Permission denied' };

  const parsed = BusinessUpdateSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from('businesses').update({ ...parsed.data, email: parsed.data.email || null })
    .eq('id', businessId);
  if (error) return { error: 'Failed to update business' };
  revalidatePath('/app/settings/business');
  return {};
}

// ── Submit KYC Verification Request ────────────────────────────
const VerificationSchema = z.object({
  legal_name: z.string().min(1),
  tax_id_number: z.string().min(1),
  business_registration_number: z.string().min(1),
  incorporation_date: z.string().min(1),
  industry: z.string().min(1),
  website: z.string().nullable().optional(),
});

export async function submitVerificationRequest(businessId: string, data: z.infer<typeof VerificationSchema>): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: mem } = await supabase.from('business_memberships').select('role')
    .eq('business_id', businessId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
  
  const { data: profile } = await supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single();
  const isPlatformAdmin = !!profile?.is_platform_admin;

  if (!isPlatformAdmin && (!mem || !['owner', 'admin'].includes(mem.role))) return { error: 'Permission denied' };

  const parsed = VerificationSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Only allow if unverified or rejected
  const { data: b } = await supabase.from('businesses').select('verification_status').eq('id', businessId).single();
  if (b?.verification_status === 'verified' || b?.verification_status === 'pending') {
    return { error: `Cannot submit. Current status is ${b?.verification_status}` };
  }

  const { error } = await supabase.from('businesses').update({
    ...parsed.data,
    verification_status: 'pending',
    verification_notes: null, // Clear any past rejection notes
  }).eq('id', businessId);

  if (error) return { error: 'Failed to submit verification request' };
  revalidatePath('/app/settings/business');
  return {};
}

// ── Update business settings (invoice/payout config) ──────────
const SettingsSchema = z.object({
  invoice_due_days:         z.number().int().min(0).max(365).optional().default(30),
  invoice_footer_note:      z.string().nullable().optional(),
  invoice_tax_label:        z.string().optional().default('Tax'),
  invoice_tax_rate:         z.number().min(0).max(100).optional().default(0),
  show_tax_on_invoice:      z.boolean().optional().default(false),
  show_discount_on_invoice: z.boolean().optional().default(true),
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
    .eq('business_id', businessId).eq('user_id', user.id).eq('status', 'active').maybeSingle();

  const { data: profile } = await supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single();
  const isPlatformAdmin = !!profile?.is_platform_admin;

  if (!isPlatformAdmin && (!mem || !['owner', 'admin'].includes(mem.role))) return { error: 'Permission denied' };

  const parsed = SettingsSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from('business_settings').upsert({ business_id: businessId, ...parsed.data });
  if (error) return { error: 'Failed to update settings: ' + error.message };
  revalidatePath('/app/settings');
  return {};
}

// ── Invite team member ─────────────────────────────────────────
export async function inviteTeamMember(businessId: string, email: string, role: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: mem } = await supabase.from('business_memberships').select('role')
    .eq('business_id', businessId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
  
  const { data: profile } = await supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single();
  const isPlatformAdmin = !!profile?.is_platform_admin;

  if (!isPlatformAdmin && (!mem || !['owner', 'admin'].includes(mem.role))) return { error: 'Permission denied' };

  const validRoles = ['admin', 'accountant', 'staff', 'viewer'];
  if (!validRoles.includes(role)) return { error: 'Invalid role' };
  if (!z.string().email().safeParse(email).success) return { error: 'Invalid email' };

  // Check if already a member (use maybeSingle to avoid error when no row exists)
  const { data: existing } = await supabase.from('business_memberships')
    .select('id').eq('business_id', businessId).eq('email', email).maybeSingle();
  if (existing) return { error: 'This email is already a team member' };

  // Check if user exists by email (look up profile)
  let existingUser = null;
  try {
    const admin = await createAdminClient();
    const { data: users } = await admin.auth.admin.listUsers();
    existingUser = users?.users?.find((u) => u.email === email);
  } catch (err) {
    console.warn('[inviteTeamMember] Admin client failed, falling back to pending status:', err);
  }

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
    .eq('business_id', businessId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
  
  const { data: profile } = await supabase.from('profiles').select('is_platform_admin').eq('id', user.id).single();
  const isPlatformAdmin = !!profile?.is_platform_admin;

  if (!isPlatformAdmin && (!mem || !['owner', 'admin'].includes(mem.role))) return { error: 'Permission denied' };

  const { error } = await supabase.from('business_memberships').delete()
    .eq('id', membershipId).eq('business_id', businessId).neq('role', 'owner');
  if (error) return { error: 'Failed to remove team member' };
  revalidatePath('/app/settings/team');
  return {};
}

// ── Get team members ───────────────────────────────────────────
export async function getTeamMembers(businessId: string) {
  const supabase = await createClient();
  // Select without avatar_url first; column may not exist on all DB instances
  const { data, error } = await supabase
    .from('business_memberships')
    .select('*, profile:profiles(id, full_name, email)')
    .eq('business_id', businessId)
    .order('joined_at');
  if (error) {
    console.error('[getTeamMembers] Error fetching team:', error);
    return [];
  }
  return data ?? [];
}

// ── Dashboard stats ────────────────────────────────────────────
export async function getDashboardStats(businessId: string) {
  try {
    const supabase = await createClient();
    
    // Automatically try to refresh FX rate if stale
    const { refreshFxRate } = await import('./fx');
    await refreshFxRate();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const [invoicesRes, paymentsRes, expensesRes, balancesRes, fxRes] = await Promise.all([
      supabase.from('invoices').select('id, status, total, currency, due_date').eq('business_id', businessId),
      supabase.from('payments').select('amount, currency, payment_date').eq('business_id', businessId).gte('payment_date', monthStart),
      supabase.from('expenses').select('amount, currency, expense_date').eq('business_id', businessId).gte('expense_date', monthStart),
      supabase.from('accounts').select('balance, currency').eq('business_id', businessId),
      supabase.from('fx_rate_snapshots').select('rate, fetched_at').order('fetched_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const invoices = invoicesRes.data || [];
    const payments = paymentsRes.data || [];
    const expenses = expensesRes.data || [];
    const accounts = balancesRes.data || [];
    const fx = fxRes.data;

    const fxRate = fx?.rate ?? 1310;
    const totalIqd = accounts.filter((a: any) => a.currency === 'IQD').reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
    const totalUsd = accounts.filter((a: any) => a.currency === 'USD').reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

    return {
      totalBalanceIqd: totalIqd,
      totalBalanceUsd: totalUsd,
      estimatedTotalIqd: totalIqd + totalUsd * fxRate,
      fxRate,
      fxRateUpdatedAt: fx?.fetched_at ?? null,
      unpaidInvoicesCount: invoices.filter((i) => ['issued', 'sent', 'partially_paid'].includes(i.status)).length,
      overdueInvoicesCount: invoices.filter((i) => 
        i.status === 'overdue' || 
        (['issued', 'sent', 'partially_paid'].includes(i.status) && i.due_date && new Date(i.due_date) < new Date(new Date().setHours(0,0,0,0)))
      ).length,
      invoicesThisMonth: invoices.filter((i) => i.status !== 'draft' && i.status !== 'cancelled').length,
      paymentsThisMonth: payments.length,
      paymentsAmountIqd: payments.filter((p) => p.currency === 'IQD').reduce((s, p) => s + p.amount, 0),
      paymentsAmountUsd: payments.filter((p) => p.currency === 'USD').reduce((s, p) => s + p.amount, 0),
      expensesThisMonth: expenses.length,
      expensesAmountIqd: expenses.filter((e) => e.currency === 'IQD').reduce((s, e) => s + e.amount, 0),
      expensesAmountUsd: expenses.filter((e) => e.currency === 'USD').reduce((s, e) => s + e.amount, 0),
    };
  } catch (error) {
    console.error('[getDashboardStats] Error:', error);
    return {
      totalBalanceIqd: 0,
      totalBalanceUsd: 0,
      estimatedTotalIqd: 0,
      fxRate: 1310,
      fxRateUpdatedAt: null,
      unpaidInvoicesCount: 0,
      overdueInvoicesCount: 0,
      invoicesThisMonth: 0,
      paymentsThisMonth: 0,
      paymentsAmountIqd: 0,
      paymentsAmountUsd: 0,
      expensesThisMonth: 0,
      expensesAmountIqd: 0,
      expensesAmountUsd: 0,
    };
  }
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
