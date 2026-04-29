'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from './notifications';
import { revalidatePath } from 'next/cache';

export async function sendMessage(contactId: string, content: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data: contact } = await supabase
      .from('contacts')
      .select('id, business_id, connected_business_id, connected_user_id, name')
      .eq('id', contactId)
      .single();

    if (!contact || !contact.connected_user_id) {
      throw new Error('Contact not connected');
    }

    const admin = await createAdminClient();
    
    // Insert message
    const { data: msg, error: msgError } = await admin
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: contact.connected_user_id,
        content: content.trim()
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
        `New message from ${contact.name}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
        `/app/contacts/${contact.id}`
      );
    }

    return { success: true, message: msg };
  } catch (err: any) {
    console.error('[sendMessage] Error:', err);
    return { error: err.message };
  }
}
