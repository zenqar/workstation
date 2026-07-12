import { NextResponse } from 'next/server';
import { z } from 'zod';

import { notify } from '@/lib/actions/notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const VOICE_BUCKET = 'chat-voice';
const MAX_VOICE_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_VOICE_BYTES + 128 * 1024;
const ALLOWED_MIMES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'] as const;
const ALLOWED_MIME_SET = new Set<string>(ALLOWED_MIMES);
const VoiceRequestSchema = z.object({
  contactId: z.string().uuid(),
  durationSeconds: z.coerce.number().finite().min(1).max(60).transform(Math.round),
});

type AllowedMime = (typeof ALLOWED_MIMES)[number];

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function normalizeMime(rawMime: string) {
  return rawMime.split(';', 1)[0].trim().toLowerCase();
}

function hasExpectedSignature(bytes: Uint8Array, mime: AllowedMime) {
  if (mime === 'audio/webm') {
    return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  }
  if (mime === 'audio/ogg') {
    return bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
  }
  if (mime === 'audio/mp4') {
    return bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  }
  return (
    (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
    (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  );
}

function extensionForMime(mime: AllowedMime) {
  if (mime === 'audio/ogg') return 'ogg';
  if (mime === 'audio/mp4') return 'm4a';
  if (mime === 'audio/mpeg') return 'mp3';
  return 'webm';
}

async function ensurePrivateVoiceBucket(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
) {
  const { data: existingBucket, error: getBucketError } = await admin.storage.getBucket(VOICE_BUCKET);

  if (!existingBucket) {
    const { error: createBucketError } = await admin.storage.createBucket(VOICE_BUCKET, {
      public: false,
      fileSizeLimit: MAX_VOICE_BYTES,
      allowedMimeTypes: [...ALLOWED_MIMES],
    });

    const alreadyExists =
      createBucketError &&
      (createBucketError.status === 409 || /already exists|duplicate/i.test(createBucketError.message));
    if (createBucketError && !alreadyExists) {
      console.error('[voice-message] Could not create storage bucket:', createBucketError);
      throw new RequestError('Voice storage is not configured', 503);
    }
    if (getBucketError && createBucketError) {
      console.warn('[voice-message] Bucket lookup raced with bucket creation:', getBucketError.message);
    }
  }

  // This is intentionally enforced at runtime as well as in the migration so
  // an accidentally public bucket cannot expose uploaded recordings.
  const { error: updateBucketError } = await admin.storage.updateBucket(VOICE_BUCKET, {
    public: false,
    fileSizeLimit: MAX_VOICE_BYTES,
    allowedMimeTypes: [...ALLOWED_MIMES],
  });
  if (updateBucketError) {
    console.error('[voice-message] Could not secure storage bucket:', updateBucketError);
    throw new RequestError('Voice storage is not configured', 503);
  }
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;

  try {
    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      throw new RequestError('Voice message must be 4 MB or smaller', 413);
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new RequestError('Unauthorized', 401);

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new RequestError('Invalid voice message upload', 400);
    }

    const fileEntry = formData.get('file');
    if (!(fileEntry instanceof File)) throw new RequestError('Audio file is required', 400);
    if (fileEntry.size < 4) throw new RequestError('Voice message is empty', 400);
    if (fileEntry.size > MAX_VOICE_BYTES) throw new RequestError('Voice message must be 4 MB or smaller', 413);

    const parsed = VoiceRequestSchema.safeParse({
      contactId: formData.get('contact_id'),
      durationSeconds: formData.get('duration_seconds'),
    });
    if (!parsed.success) throw new RequestError('Invalid contact or recording duration', 400);

    const mime = normalizeMime(fileEntry.type);
    if (!ALLOWED_MIME_SET.has(mime)) {
      throw new RequestError('Use a WebM, Ogg, MP4, or MP3 voice recording', 415);
    }

    const fileBuffer = await fileEntry.arrayBuffer();
    const signature = new Uint8Array(fileBuffer, 0, Math.min(16, fileBuffer.byteLength));
    if (!hasExpectedSignature(signature, mime as AllowedMime)) {
      throw new RequestError('The uploaded file is not a valid audio recording', 415);
    }

    const admin = await createAdminClient();
    const { data: contact, error: contactError } = await admin
      .from('contacts')
      .select('id, business_id, connected_business_id, connected_user_id, connection_status')
      .eq('id', parsed.data.contactId)
      .maybeSingle();

    if (contactError) {
      console.error('[voice-message] Contact lookup failed:', contactError);
      throw new RequestError('Unable to verify contact', 500);
    }
    if (
      !contact?.connected_user_id ||
      !contact.connected_business_id ||
      contact.connection_status !== 'connected' ||
      contact.connected_user_id === user.id
    ) {
      throw new RequestError('Contact is not connected', 403);
    }

    const { data: membership, error: membershipError } = await admin
      .from('business_memberships')
      .select('id')
      .eq('business_id', contact.business_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (membershipError) {
      console.error('[voice-message] Membership lookup failed:', membershipError);
      throw new RequestError('Unable to verify business access', 500);
    }
    if (!membership) throw new RequestError('Access denied', 403);

    const { data: recipientMembership } = await admin.from('business_memberships').select('id')
      .eq('business_id', contact.connected_business_id)
      .eq('user_id', contact.connected_user_id)
      .eq('status', 'active')
      .maybeSingle();
    if (!recipientMembership) throw new RequestError('Contact is no longer available', 403);
    const { data: reverseContactForAccess } = await admin.from('contacts').select('id')
      .eq('business_id', contact.connected_business_id)
      .eq('connected_business_id', contact.business_id)
      .eq('connection_status', 'connected')
      .limit(1)
      .maybeSingle();
    if (!reverseContactForAccess) throw new RequestError('This business connection needs to be accepted again', 403);

    await ensurePrivateVoiceBucket(admin);

    uploadedPath = `${user.id}/${contact.connected_user_id}/${crypto.randomUUID()}.${extensionForMime(mime as AllowedMime)}`;
    const { error: uploadError } = await admin.storage
      .from(VOICE_BUCKET)
      .upload(uploadedPath, fileBuffer, {
        cacheControl: '3600',
        contentType: mime,
        upsert: false,
      });
    if (uploadError) {
      console.error('[voice-message] Storage upload failed:', uploadError);
      throw new RequestError('Could not upload voice message', 500);
    }

    const { data: message, error: messageError } = await admin
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: contact.connected_user_id,
        business_id: contact.business_id,
        sender_business_id: contact.business_id,
        receiver_business_id: contact.connected_business_id,
        content: 'Voice message',
        message_type: 'voice',
        attachment_path: uploadedPath,
        attachment_mime: mime,
        attachment_duration_seconds: parsed.data.durationSeconds,
      })
      .select()
      .single();

    if (messageError) {
      console.error('[voice-message] Message insert failed:', messageError);
      await admin.storage.from(VOICE_BUCKET).remove([uploadedPath]);
      uploadedPath = null;
      throw new RequestError('Could not save voice message', 500);
    }

    if (contact.connected_business_id) {
      try {
        const { data: reverseContact } = await admin
          .from('contacts')
          .select('id')
          .eq('business_id', contact.connected_business_id)
          .eq('connected_business_id', contact.business_id)
          .eq('connection_status', 'connected')
          .limit(1)
          .maybeSingle();

        await notify(
          contact.connected_business_id,
          'message_new',
          'New Voice Message',
          'You received a new voice message from a connected business.',
          reverseContact?.id ? `/app/contacts/${reverseContact.id}` : '/app/contacts',
        );
      } catch (notificationError) {
        // The message is already safely stored. A notification failure must not
        // make the client retry and create a duplicate recording.
        console.error('[voice-message] Notification failed:', notificationError);
      }
    }

    return NextResponse.json(
      { success: true, message },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof RequestError) return errorResponse(error.message, error.status);
    console.error('[voice-message] Unexpected upload error:', error);
    return errorResponse('Could not send voice message', 500);
  }
}
