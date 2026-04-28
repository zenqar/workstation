'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function sendAdminUserMessage(userId: string, message: string) {
  const admin = await createAdminClient();

  const { error } = await admin.from('support_messages').insert({
    recipient_user_id: userId,
    sender_type: 'admin',
    message: message,
    is_read: false
  });

  if (error) {
    console.error('Failed to send user message:', error);
    return { error: error.message };
  }

  revalidatePath('/admin/users');
  return { success: true };
}

export async function deleteUserAccount(userId: string) {
  const admin = await createAdminClient();

  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    console.error('Failed to delete user:', error);
    return { error: error.message };
  }

  revalidatePath('/admin/users');
  return { success: true };
}
