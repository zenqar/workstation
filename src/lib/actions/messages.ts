'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from './notifications';

type MessageAttachment = {
  path: string;
  mime: 'audio/webm' | 'audio/ogg' | 'audio/mp4' | 'audio/mpeg';
  durationSeconds: number;
};

async function getMessageRecipient(contactId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, business_id, connected_business_id, connected_user_id, name')
    .eq('id', contactId)
    .single();
  if (!contact?.connected_user_id) throw new Error('Contact not connected');

  const { data: membership } = await supabase
    .from('business_memberships')
    .select('id')
    .eq('business_id', contact.business_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!membership) throw new Error('Access denied');

  return { user, contact };
}

export async function sendMessage(contactId: string, content: string) {
  try {
    const cleanContent = content.trim();
    if (!cleanContent || cleanContent.length > 4000) throw new Error('Message must be between 1 and 4,000 characters');
    const { user, contact } = await getMessageRecipient(contactId);

    const admin = await createAdminClient();
    
    // Insert message
    const { data: msg, error: msgError } = await admin
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: contact.connected_user_id,
        content: cleanContent,
        message_type: 'text',
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Notify recipient business
    if (contact.connected_business_id) {
      await notify(
        contact.connected_business_id,
        'message_new',
        'New Message',
        `New message from ${contact.name}: "${cleanContent.substring(0, 50)}${cleanContent.length > 50 ? '...' : ''}"`,
        `/app/contacts/${contact.id}`
      );
    }

    return { success: true, message: msg };
  } catch (err: unknown) {
    console.error('[sendMessage] Error:', err);
    return { error: err instanceof Error ? err.message : 'Failed to send message' };
  }
}

export async function sendVoiceMessage(contactId: string, attachment: MessageAttachment) {
  try {
    const { user, contact } = await getMessageRecipient(contactId);
    const allowedMimes = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg']);
    const expectedPrefix = `${user.id}/${contact.connected_user_id}/`;
    if (!attachment.path.startsWith(expectedPrefix) || !allowedMimes.has(attachment.mime)) throw new Error('Invalid voice attachment');
    const durationSeconds = Math.round(attachment.durationSeconds);
    if (durationSeconds < 1 || durationSeconds > 60) throw new Error('Voice messages must be between 1 and 60 seconds');

    const admin = await createAdminClient();
    const { data: msg, error } = await admin.from('messages').insert({
      sender_id: user.id,
      receiver_id: contact.connected_user_id,
      content: 'Voice message',
      message_type: 'voice',
      attachment_path: attachment.path,
      attachment_mime: attachment.mime,
      attachment_duration_seconds: durationSeconds,
    }).select().single();
    if (error) throw error;

    if (contact.connected_business_id) {
      await notify(contact.connected_business_id, 'message_new', 'New Voice Message', `New voice message from ${contact.name}`, `/app/contacts/${contact.id}`);
    }
    return { success: true, message: msg };
  } catch (error) {
    console.error('[sendVoiceMessage]', error);
    return { error: error instanceof Error ? error.message : 'Failed to send voice message' };
  }
}
