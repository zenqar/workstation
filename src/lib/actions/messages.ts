'use server';

import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import { notify } from './notifications';

const ContactIdSchema = z.string().uuid();
const VOICE_BUCKET = 'chat-voice';
const MAX_VOICE_BYTES = 4 * 1024 * 1024;
const ALLOWED_VOICE_MIMES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
]);

type MessageAttachment = {
  path: string;
  mime: 'audio/webm' | 'audio/ogg' | 'audio/mp4' | 'audio/mpeg';
  durationSeconds: number;
};

type ConnectedContact = {
  id: string;
  business_id: string;
  connected_business_id: string;
  connected_user_id: string;
  connection_status: 'connected';
  name: string;
};

async function getMessageRecipient(contactId: string) {
  const parsedContactId = ContactIdSchema.safeParse(contactId);
  if (!parsedContactId.success) throw new Error('Invalid contact');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // The admin client is used only after authentication; membership and contact
  // authorization are both checked explicitly before any privileged mutation.
  const admin = await createAdminClient();
  const { data: contact, error: contactError } = await admin
    .from('contacts')
    .select('id, business_id, connected_business_id, connected_user_id, connection_status, name')
    .eq('id', parsedContactId.data)
    .maybeSingle();

  if (contactError) throw new Error('Unable to verify contact');
  if (
    !contact?.connected_user_id ||
    !contact.connected_business_id ||
    contact.connection_status !== 'connected' ||
    contact.connected_user_id === user.id
  ) {
    throw new Error('Contact is not connected');
  }

  const { data: membership, error: membershipError } = await admin
    .from('business_memberships')
    .select('id')
    .eq('business_id', contact.business_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) throw new Error('Unable to verify business access');
  if (!membership) throw new Error('Access denied');

  const { data: recipientMembership } = await admin.from('business_memberships').select('id')
    .eq('business_id', contact.connected_business_id)
    .eq('user_id', contact.connected_user_id)
    .eq('status', 'active')
    .maybeSingle();
  if (!recipientMembership) throw new Error('Contact is no longer available');
  const { data: reverseContact } = await admin.from('contacts').select('id')
    .eq('business_id', contact.connected_business_id)
    .eq('connected_business_id', contact.business_id)
    .eq('connection_status', 'connected')
    .limit(1)
    .maybeSingle();
  if (!reverseContact) throw new Error('This business connection needs to be accepted again');

  return { user, contact: contact as ConnectedContact, admin };
}

async function getRecipientContactLink(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  contact: ConnectedContact,
) {
  if (!contact.connected_business_id) return '/app/contacts';

  const { data: reverseContact } = await admin
    .from('contacts')
    .select('id')
    .eq('business_id', contact.connected_business_id)
    .eq('connected_business_id', contact.business_id)
    .eq('connection_status', 'connected')
    .limit(1)
    .maybeSingle();

  return reverseContact?.id ? `/app/contacts/${reverseContact.id}` : '/app/contacts';
}

async function notifyRecipient(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  contact: ConnectedContact,
  title: string,
  message: string,
) {
  if (!contact.connected_business_id) return;
  const link = await getRecipientContactLink(admin, contact);
  await notify(contact.connected_business_id, 'message_new', title, message, link);
}

function hasExpectedVoiceSignature(bytes: Uint8Array, mime: string) {
  if (mime === 'audio/webm') {
    return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  }
  if (mime === 'audio/ogg') {
    return bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
  }
  if (mime === 'audio/mp4') {
    return bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  }
  if (mime === 'audio/mpeg') {
    return (
      (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
      (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    );
  }
  return false;
}

export async function sendMessage(contactId: string, content: string) {
  try {
    const cleanContent = content.trim();
    if (!cleanContent || cleanContent.length > 4000) {
      throw new Error('Message must be between 1 and 4,000 characters');
    }

    const { user, contact, admin } = await getMessageRecipient(contactId);
    const { data: message, error: messageError } = await admin
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: contact.connected_user_id,
        business_id: contact.business_id,
        sender_business_id: contact.business_id,
        receiver_business_id: contact.connected_business_id,
        content: cleanContent,
        message_type: 'text',
      })
      .select()
      .single();

    if (messageError) throw messageError;

    await notifyRecipient(
      admin,
      contact,
      'New Message',
      `New message from ${contact.name}: "${cleanContent.substring(0, 50)}${cleanContent.length > 50 ? '...' : ''}"`,
    );

    return { success: true, message };
  } catch (error: unknown) {
    console.error('[sendMessage] Error:', error);
    return { error: error instanceof Error ? error.message : 'Failed to send message' };
  }
}

/**
 * Compatibility path for older clients that uploaded directly to Storage.
 * New clients should POST the audio file to /api/chat/voice-message instead.
 */
export async function sendVoiceMessage(contactId: string, attachment: MessageAttachment) {
  try {
    const { user, contact, admin } = await getMessageRecipient(contactId);
    const mime = attachment.mime.split(';', 1)[0].toLowerCase();
    const durationSeconds = Math.round(attachment.durationSeconds);
    const escapedSenderId = user.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedReceiverId = contact.connected_user_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pathPattern = new RegExp(
      `^${escapedSenderId}/${escapedReceiverId}/[0-9a-f-]{16,}\\.(webm|ogg|m4a|mp4|mp3)$`,
      'i',
    );

    if (!pathPattern.test(attachment.path) || !ALLOWED_VOICE_MIMES.has(mime)) {
      throw new Error('Invalid voice attachment');
    }
    if (durationSeconds < 1 || durationSeconds > 60) {
      throw new Error('Voice messages must be between 1 and 60 seconds');
    }

    // Do not trust a caller-supplied object path or MIME. Download and verify
    // the private object before recording it as a message.
    const { data: voiceFile, error: downloadError } = await admin.storage
      .from(VOICE_BUCKET)
      .download(attachment.path);
    if (downloadError || !voiceFile) throw new Error('Voice upload could not be verified');
    if (voiceFile.size < 4 || voiceFile.size > MAX_VOICE_BYTES) throw new Error('Invalid voice attachment size');

    const storedMime = voiceFile.type.split(';', 1)[0].toLowerCase();
    if (storedMime && storedMime !== mime) throw new Error('Voice attachment type mismatch');
    const bytes = new Uint8Array(await voiceFile.arrayBuffer());
    if (!hasExpectedVoiceSignature(bytes.subarray(0, 16), mime)) {
      throw new Error('Invalid voice attachment data');
    }

    const { data: message, error } = await admin
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: contact.connected_user_id,
        business_id: contact.business_id,
        sender_business_id: contact.business_id,
        receiver_business_id: contact.connected_business_id,
        content: 'Voice message',
        message_type: 'voice',
        attachment_path: attachment.path,
        attachment_mime: mime,
        attachment_duration_seconds: durationSeconds,
      })
      .select()
      .single();
    if (error) throw error;

    await notifyRecipient(
      admin,
      contact,
      'New Voice Message',
      `New voice message from ${contact.name}`,
    );
    return { success: true, message };
  } catch (error) {
    console.error('[sendVoiceMessage]', error);
    return { error: error instanceof Error ? error.message : 'Failed to send voice message' };
  }
}
