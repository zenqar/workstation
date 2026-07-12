import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerEnv } from '@/lib/env/server';

export const dynamic = 'force-dynamic';

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.cloudflare.com:3478'] },
];

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

function withoutPort53(server: RTCIceServer): RTCIceServer | null {
  const urls = (Array.isArray(server.urls) ? server.urls : [server.urls]).filter(url => !/:53(?:\?|$)/.test(url));
  if (!urls.length) return null;
  return { ...server, urls };
}

const IceRequestSchema = z.union([
  z.object({ kind: z.literal('call'), id: z.string().uuid() }),
  z.object({ kind: z.literal('contact'), id: z.string().uuid() }),
]);

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return response({ error: 'Unauthorized' }, 401);
  const admin = await createAdminClient();

  const url = new URL(request.url);
  const callId = url.searchParams.get('callId');
  const contactId = url.searchParams.get('contactId');
  const parsed = IceRequestSchema.safeParse(callId
    ? { kind: 'call', id: callId }
    : { kind: 'contact', id: contactId });
  if (!parsed.success || (callId && contactId)) return response({ error: 'A valid call or contact is required' }, 400);

  if (parsed.data.kind === 'call') {
    const { data: call } = await supabase.from('voice_calls').select('id, status, expires_at')
      .eq('id', parsed.data.id)
      .in('status', ['ringing', 'active'])
      .maybeSingle();
    if (!call || new Date(call.expires_at).getTime() <= Date.now()) {
      return response({ error: 'Call not found' }, 404);
    }
  } else {
    const { data: contact } = await supabase.from('contacts')
      .select('business_id, connected_business_id, connected_user_id, connection_status')
      .eq('id', parsed.data.id)
      .maybeSingle();
    if (!contact?.connected_user_id || !contact.connected_business_id || contact.connection_status !== 'connected' || contact.connected_user_id === user.id) {
      return response({ error: 'Connected contact not found' }, 404);
    }
    const { data: membership } = await supabase.from('business_memberships').select('id')
      .eq('business_id', contact.business_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!membership) return response({ error: 'Connected contact not found' }, 404);
    const { data: recipientMembership } = await admin.from('business_memberships').select('id')
      .eq('business_id', contact.connected_business_id)
      .eq('user_id', contact.connected_user_id)
      .eq('status', 'active')
      .maybeSingle();
    if (!recipientMembership) return response({ error: 'Connected contact not found' }, 404);
    const { data: reverseContact } = await admin.from('contacts').select('id')
      .eq('business_id', contact.connected_business_id)
      .eq('connected_business_id', contact.business_id)
      .eq('connection_status', 'connected')
      .limit(1)
      .maybeSingle();
    if (!reverseContact) return response({ error: 'Connected contact not found' }, 404);
  }

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentRequests, error: rateLimitError } = await admin.from('voice_call_ice_requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', oneMinuteAgo);
  if (!rateLimitError && (recentRequests || 0) >= 20) return response({ error: 'Too many call connection requests' }, 429);
  if (rateLimitError) console.warn('[calls/ice] TURN rate-limit check unavailable', rateLimitError.message);
  else {
    await admin.from('voice_call_ice_requests').insert({ user_id: user.id });
    await admin.from('voice_call_ice_requests').delete().lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  }

  const env = await getServerEnv();
  const keyId = env.CLOUDFLARE_TURN_KEY_ID;
  const apiToken = env.CLOUDFLARE_TURN_KEY_API_TOKEN || env.CLOUDFLARE_TURN_API_TOKEN;
  if (!keyId || !apiToken) {
    return response({ iceServers: FALLBACK_ICE_SERVERS, turnConfigured: false });
  }

  try {
    const turnResponse = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: 3600 }),
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!turnResponse.ok) {
      const details = await turnResponse.text();
      console.error('[calls/ice] Cloudflare TURN rejected the request', turnResponse.status, details.slice(0, 300));
      return response({ iceServers: FALLBACK_ICE_SERVERS, turnConfigured: false });
    }

    const payload = await turnResponse.json() as { iceServers?: RTCIceServer[] };
    const iceServers = (payload.iceServers || []).map(withoutPort53).filter((server): server is RTCIceServer => Boolean(server));
    if (!iceServers.length) throw new Error('Cloudflare returned no usable ICE servers');
    return response({ iceServers, turnConfigured: true });
  } catch (error) {
    console.error('[calls/ice] TURN credential generation failed', error);
    return response({ iceServers: FALLBACK_ICE_SERVERS, turnConfigured: false });
  }
}
