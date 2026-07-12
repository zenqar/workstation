import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const VOICE_BUCKET = 'chat-voice';
const SIGNED_URL_LIFETIME_SECONDS = 5 * 60;
const MessageIdSchema = z.string().uuid();

function jsonResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, private',
      Pragma: 'no-cache',
    },
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const parsedParams = MessageIdSchema.safeParse((await params).id);
    if (!parsedParams.success) return jsonResponse({ error: 'Voice message not found' }, 404);

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const admin = await createAdminClient();
    const { data: message, error: messageError } = await admin
      .from('messages')
      .select('id, sender_id, receiver_id, sender_business_id, receiver_business_id, message_type, attachment_path')
      .eq('id', parsedParams.data)
      .maybeSingle();

    if (messageError) {
      console.error('[voice-message] Playback lookup failed:', messageError);
      return jsonResponse({ error: 'Could not load voice message' }, 500);
    }

    const businessIds = message
      ? [message.sender_business_id, message.receiver_business_id].filter((id): id is string => Boolean(id))
      : [];
    let isParticipant = Boolean(
      message
      && businessIds.length === 0
      && (message.sender_id === user.id || message.receiver_id === user.id),
    );
    if (message && businessIds.length) {
      const { data: membership } = await admin.from('business_memberships').select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('business_id', businessIds)
        .limit(1)
        .maybeSingle();
      isParticipant = Boolean(membership);
    }
    const expectedPathPattern = message
      ? new RegExp(
          `^${escapeRegExp(message.sender_id)}/${escapeRegExp(message.receiver_id)}/[0-9a-f-]{16,}\\.(webm|ogg|m4a|mp4|mp3)$`,
          'i',
        )
      : null;
    if (
      !message ||
      !isParticipant ||
      message.message_type !== 'voice' ||
      !message.attachment_path ||
      !expectedPathPattern?.test(message.attachment_path)
    ) {
      // A single 404 response avoids exposing whether another user's message exists.
      return jsonResponse({ error: 'Voice message not found' }, 404);
    }

    const { data: signedUrl, error: signedUrlError } = await admin.storage
      .from(VOICE_BUCKET)
      .createSignedUrl(message.attachment_path, SIGNED_URL_LIFETIME_SECONDS);

    if (signedUrlError || !signedUrl?.signedUrl) {
      console.error('[voice-message] Could not sign playback URL:', signedUrlError);
      return jsonResponse({ error: 'Could not load voice message' }, 500);
    }

    return jsonResponse({
      url: signedUrl.signedUrl,
      expiresIn: SIGNED_URL_LIFETIME_SECONDS,
    });
  } catch (error) {
    console.error('[voice-message] Unexpected playback error:', error);
    return jsonResponse({ error: 'Could not load voice message' }, 500);
  }
}
