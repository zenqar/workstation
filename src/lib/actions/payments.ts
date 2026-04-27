'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

export async function getPayments(businessId: string) {
  try {
    const { role } = await requireBusinessUser(businessId);
    if (!role) return [];

    const admin = await createAdminClient();
    const { data, error } = await admin
      .from('payments')
      .select('*, account:accounts(id, name, currency), invoice:invoices(id, invoice_number, contact_id, contact:contacts(id, name))')
      .eq('business_id', businessId)
      .order('payment_date', { ascending: false });
    
    if (error) {
      console.error('[getPayments] error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[getPayments] runtime error:', err);
    return [];
  }
}
