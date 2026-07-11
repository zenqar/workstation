'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/types';
import { z } from 'zod';

const EmailSchema = z.string().trim().email().transform(value => value.toLowerCase());

export async function quickConnectContact(businessId: string, rawEmail: string): Promise<ActionResult<{ contactId: string; status: 'pending' | 'connected' }>> {
  try {
    const email = EmailSchema.parse(rawEmail);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Unauthorized' };
    if (user.email?.toLowerCase() === email) return { error: 'Use the email of another Zenqar user.' };
    const { data: membership } = await supabase.from('business_memberships').select('role').eq('business_id', businessId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
    if (!membership || !['owner', 'admin', 'accountant', 'staff'].includes(membership.role)) return { error: 'Permission denied' };

    const admin = await createAdminClient();
    const { data: profile } = await admin.from('profiles').select('id,full_name,email').ilike('email', email).maybeSingle();
    if (!profile) return { error: 'No Zenqar account uses that email yet. Add them as a normal contact or invite them to join Zenqar.' };

    const { data: existing } = await admin.from('contacts').select('id,connection_status').eq('business_id', businessId).ilike('email', email).maybeSingle();
    if (existing?.connection_status === 'connected') return { data: { contactId: existing.id, status: 'connected' } };

    let contactId = existing?.id;
    if (contactId) {
      const { error } = await admin.from('contacts').update({ connection_status: 'pending', name: profile.full_name || email.split('@')[0] }).eq('id', contactId);
      if (error) throw error;
    } else {
      const { data: contact, error } = await admin.from('contacts').insert({ business_id: businessId, type: 'both', name: profile.full_name || email.split('@')[0], email, connection_status: 'pending', created_by: user.id }).select('id').single();
      if (error) throw error;
      contactId = contact.id;
    }

    const { data: pending } = await admin.from('contact_requests').select('id').eq('sender_business_id', businessId).ilike('receiver_email', email).eq('status', 'pending').maybeSingle();
    if (!pending) {
      const { error } = await admin.from('contact_requests').insert({ sender_business_id: businessId, sender_user_id: user.id, receiver_email: email, status: 'pending' });
      if (error) throw error;
    }

    revalidatePath('/[locale]/app/contacts', 'layout');
    revalidatePath('/[locale]/app/dashboard', 'layout');
    return { data: { contactId: contactId!, status: 'pending' } };
  } catch (error) {
    console.error('[quickConnectContact]', error);
    return { error: error instanceof Error ? error.message : 'Could not send connection request' };
  }
}

export async function getIncomingContactRequests() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('contact_requests')
    .select('*, sender_business:businesses(*)')
    .ilike('receiver_email', user.email || '')
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
      .ilike('receiver_email', user.email || '')
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
  } catch (err: unknown) {
    console.error('[handleContactRequest] error:', err);
    return { error: err instanceof Error ? err.message : 'Could not update connection request' };
  }
}
