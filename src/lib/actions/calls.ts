'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult } from '@/lib/types';

const SessionDescriptionSchema = z.object({
  type: z.enum(['offer', 'answer']),
  sdp: z.string().min(1).max(250_000),
});

type VoiceCallRecord = {
  id: string;
  caller_id: string;
  callee_id: string;
  caller_name: string;
  callee_name: string;
  status: 'ringing' | 'active' | 'declined' | 'missed' | 'cancelled' | 'ended' | 'failed';
  offer: { type: 'offer'; sdp: string };
  answer: { type: 'answer'; sdp: string } | null;
  created_at: string;
  expires_at: string;
};

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  return { supabase, user };
}

async function getConnectedContact(contactId: string) {
  const parsedContactId = z.string().uuid().safeParse(contactId);
  if (!parsedContactId.success) throw new Error('Invalid contact');
  const { supabase, user } = await getUser();
  const { data: contact } = await supabase.from('contacts')
    .select('id, business_id, connected_business_id, connected_user_id, connection_status, name')
    .eq('id', parsedContactId.data)
    .maybeSingle();
  if (!contact?.connected_user_id || !contact.connected_business_id || contact.connection_status !== 'connected') throw new Error('This contact is not connected for secure calling.');
  const { data: membership } = await supabase.from('business_memberships').select('id')
    .eq('business_id', contact.business_id).eq('user_id', user.id).eq('status', 'active').maybeSingle();
  if (!membership) throw new Error('Access denied');
  if (contact.connected_user_id === user.id) throw new Error('You cannot call yourself.');
  const admin = await createAdminClient();
  const { data: recipientMembership } = await admin.from('business_memberships').select('id')
    .eq('business_id', contact.connected_business_id)
    .eq('user_id', contact.connected_user_id)
    .eq('status', 'active')
    .maybeSingle();
  if (!recipientMembership) throw new Error('This contact is no longer available for secure calling.');
  const { data: reverseContact } = await admin.from('contacts').select('id')
    .eq('business_id', contact.connected_business_id)
    .eq('connected_business_id', contact.business_id)
    .eq('connection_status', 'connected')
    .limit(1)
    .maybeSingle();
  if (!reverseContact) throw new Error('This business connection needs to be accepted again before calling.');
  return { user, contact };
}

export async function createVoiceCall(contactId: string, rawOffer: unknown): Promise<ActionResult<VoiceCallRecord>> {
  try {
    const offer = SessionDescriptionSchema.parse(rawOffer);
    if (offer.type !== 'offer') return { error: 'Invalid call offer' };
    const { user, contact } = await getConnectedContact(contactId);
    const admin = await createAdminClient();
    const now = new Date().toISOString();

    await admin.from('voice_call_candidates').delete().lt('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
    await admin.from('voice_calls').update({
      status: 'missed',
      ended_at: now,
      offer: null,
      answer: null,
    })
      .eq('status', 'ringing')
      .lt('expires_at', now);
    await admin.from('voice_calls').update({
      status: 'failed',
      ended_at: now,
      offer: null,
      answer: null,
    })
      .eq('status', 'active')
      .lt('expires_at', now);

    const { data: existing } = await admin.from('voice_calls').select('id')
      .or(`caller_id.eq.${user.id},callee_id.eq.${user.id},caller_id.eq.${contact.connected_user_id},callee_id.eq.${contact.connected_user_id}`)
      .in('status', ['ringing', 'active']).limit(1).maybeSingle();
    if (existing) return { error: 'You or this contact is already in another call.' };

    const { data: profiles } = await admin.from('profiles').select('id, full_name').in('id', [user.id, contact.connected_user_id]);
    const callerName = profiles?.find(profile => profile.id === user.id)?.full_name || 'Zenqar contact';
    const calleeName = profiles?.find(profile => profile.id === contact.connected_user_id)?.full_name || contact.name || 'Zenqar contact';
    const { data, error } = await admin.from('voice_calls').insert({
      caller_id: user.id,
      callee_id: contact.connected_user_id,
      caller_business_id: contact.business_id,
      callee_business_id: contact.connected_business_id,
      contact_id: contact.id,
      caller_name: callerName,
      callee_name: calleeName,
      offer,
    }).select('id, caller_id, callee_id, caller_name, callee_name, status, offer, answer, created_at, expires_at').single();
    if (error?.code === '23505') return { error: 'You or this contact is already in another call.' };
    if (error) throw error;
    return { data: data as VoiceCallRecord };
  } catch (error) {
    console.error('[createVoiceCall]', error);
    return { error: error instanceof Error ? error.message : 'Could not start the call.' };
  }
}

export async function acceptVoiceCall(callId: string, rawAnswer: unknown): Promise<ActionResult<VoiceCallRecord>> {
  try {
    const answer = SessionDescriptionSchema.parse(rawAnswer);
    if (answer.type !== 'answer') return { error: 'Invalid call answer' };
    const parsedCallId = z.string().uuid().parse(callId);
    const { user } = await getUser();
    const admin = await createAdminClient();
    const { data: call } = await admin.from('voice_calls').select('*').eq('id', parsedCallId).eq('callee_id', user.id).maybeSingle();
    if (!call || call.status !== 'ringing') return { error: 'This call is no longer available.' };
    const { data: membership } = await admin.from('business_memberships').select('id')
      .eq('business_id', call.callee_business_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!membership) return { error: 'This call is no longer available.' };
    if (new Date(call.expires_at).getTime() <= Date.now()) {
      const { data: expiredCall } = await admin.from('voice_calls')
        .update({ status: 'missed', ended_at: new Date().toISOString(), offer: null, answer: null })
        .eq('id', call.id)
        .eq('status', 'ringing')
        .select('id')
        .maybeSingle();
      if (expiredCall) await admin.from('voice_call_candidates').delete().eq('call_id', call.id);
      return { error: 'This call has expired.' };
    }
    const acceptedAt = new Date().toISOString();
    const { data, error } = await admin.from('voice_calls').update({
      answer,
      status: 'active',
      answered_at: acceptedAt,
      callee_heartbeat_at: acceptedAt,
      expires_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
    }).eq('id', call.id)
      .eq('status', 'ringing')
      .gt('expires_at', acceptedAt)
      .select('id, caller_id, callee_id, caller_name, callee_name, status, offer, answer, created_at, expires_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return { error: 'This call is no longer available.' };
    return { data: data as VoiceCallRecord };
  } catch (error) {
    console.error('[acceptVoiceCall]', error);
    return { error: error instanceof Error ? error.message : 'Could not answer the call.' };
  }
}

export async function declineVoiceCall(callId: string): Promise<ActionResult> {
  try {
    const parsedCallId = z.string().uuid().parse(callId);
    const { user } = await getUser();
    const admin = await createAdminClient();
    const { data: declined, error } = await admin.from('voice_calls').update({ status: 'declined', ended_at: new Date().toISOString(), offer: null, answer: null })
      .eq('id', parsedCallId).eq('callee_id', user.id).eq('status', 'ringing')
      .select('id').maybeSingle();
    if (error) throw error;
    if (!declined) return { error: 'This call is no longer available.' };
    await admin.from('voice_call_candidates').delete().eq('call_id', parsedCallId);
    return {};
  } catch (error) {
    console.error('[declineVoiceCall]', error);
    return { error: error instanceof Error ? error.message : 'Could not decline the call.' };
  }
}

export async function endVoiceCall(callId: string, reason: 'ended' | 'cancelled' | 'missed' | 'failed' = 'ended'): Promise<ActionResult> {
  try {
    const parsed = z.object({ callId: z.string().uuid(), reason: z.enum(['ended', 'cancelled', 'missed', 'failed']) }).parse({ callId, reason });
    const { user } = await getUser();
    const admin = await createAdminClient();
    const { data: call } = await admin.from('voice_calls').select('caller_id, callee_id, status, expires_at').eq('id', parsed.callId).maybeSingle();
    if (!call || ![call.caller_id, call.callee_id].includes(user.id)) return { error: 'Call not found.' };
    if (['declined', 'missed', 'cancelled', 'ended', 'failed'].includes(call.status)) return {};

    const isCaller = call.caller_id === user.id;
    const isExpired = new Date(call.expires_at).getTime() <= Date.now();
    let nextStatus: 'declined' | 'missed' | 'cancelled' | 'ended' | 'failed';

    if (call.status === 'ringing') {
      if (parsed.reason === 'missed') {
        if (!isCaller && !isExpired) return { error: 'Permission denied' };
        nextStatus = 'missed';
      } else if (isCaller && parsed.reason === 'failed') {
        // A caller-side setup/signaling failure must close the still-ringing
        // row, but cannot race an answer because the update below is pinned to
        // the status observed here.
        nextStatus = 'failed';
      } else if (isCaller && (parsed.reason === 'cancelled' || parsed.reason === 'ended')) {
        nextStatus = 'cancelled';
      } else if (!isCaller && parsed.reason === 'ended') {
        nextStatus = 'declined';
      } else {
        return { error: 'Permission denied' };
      }
    } else if (call.status === 'active') {
      if (parsed.reason !== 'ended' && parsed.reason !== 'failed') return { error: 'Permission denied' };
      nextStatus = parsed.reason;
    } else {
      return {};
    }

    // This status predicate makes the state transition atomic. If an answer,
    // decline, or another hang-up won the race, this update becomes a no-op and
    // cannot overwrite the newer terminal/active state.
    const { data: endedCall, error } = await admin.from('voice_calls')
      .update({ status: nextStatus, ended_at: new Date().toISOString(), offer: null, answer: null })
      .eq('id', parsed.callId)
      .eq('status', call.status)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (endedCall) await admin.from('voice_call_candidates').delete().eq('call_id', parsed.callId);
    return {};
  } catch (error) {
    console.error('[endVoiceCall]', error);
    return { error: error instanceof Error ? error.message : 'Could not end the call.' };
  }
}

export async function heartbeatVoiceCall(callId: string): Promise<ActionResult> {
  try {
    const parsedCallId = z.string().uuid().parse(callId);
    const { user } = await getUser();
    const admin = await createAdminClient();
    const { data: call } = await admin.from('voice_calls')
      .select('caller_id, callee_id, caller_business_id, callee_business_id, status, caller_heartbeat_at, callee_heartbeat_at')
      .eq('id', parsedCallId)
      .maybeSingle();
    if (!call || call.status !== 'active' || ![call.caller_id, call.callee_id].includes(user.id)) return { error: 'Call not found.' };

    const businessId = call.caller_id === user.id ? call.caller_business_id : call.callee_business_id;
    const { data: membership } = await admin.from('business_memberships').select('id')
      .eq('business_id', businessId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!membership) return { error: 'Call not found.' };

    const now = Date.now();
    const otherHeartbeat = call.caller_id === user.id ? call.callee_heartbeat_at : call.caller_heartbeat_at;
    const update: Record<string, string> = {
      [call.caller_id === user.id ? 'caller_heartbeat_at' : 'callee_heartbeat_at']: new Date(now).toISOString(),
    };
    if (otherHeartbeat && now - new Date(otherHeartbeat).getTime() <= 90_000) {
      update.expires_at = new Date(now + 3 * 60 * 1000).toISOString();
    }
    const { error } = await admin.from('voice_calls').update(update).eq('id', parsedCallId).eq('status', 'active');
    if (error) throw error;
    return {};
  } catch (error) {
    console.error('[heartbeatVoiceCall]', error);
    return { error: error instanceof Error ? error.message : 'Could not keep the call active.' };
  }
}
