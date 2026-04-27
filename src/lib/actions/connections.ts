'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/types';

export async function getIncomingContactRequests() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('contact_requests')
    .select('*, sender_business:businesses(*)')
    .eq('receiver_email', user.email)
    .eq('status', 'pending');

  if (error) {
    console.error('[getIncomingContactRequests] error:', error);
    return [];
  }
  return data || [];
}

export async function handleContactRequest(requestId: string, action: 'accept' | 'reject'): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };

    // Verify request belongs to user
    const { data: request } = await supabase
      .from('contact_requests')
      .select('*')
      .eq('id', requestId)
      .eq('receiver_email', user.email)
      .single();

    if (!request) return { error: 'Request not found' };

    const status = action === 'accept' ? 'accepted' : 'rejected';

    const { error } = await supabase
      .from('contact_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) throw error;

    revalidatePath('/app/dashboard');
    revalidatePath('/app/contacts');
    return {};
  } catch (err: any) {
    console.error('[handleContactRequest] error:', err);
    return { error: err.message };
  }
}
