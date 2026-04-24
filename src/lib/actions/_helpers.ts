'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Shared helper: asserts the current user is an active member of a business.
 * Throws if unauthenticated or not a member.
 */
export async function requireBusinessUser(businessId: string) {
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
