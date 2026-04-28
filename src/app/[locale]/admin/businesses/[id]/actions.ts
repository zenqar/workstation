'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function deleteBusinessNetwork(businessId: string) {
  const admin = await createAdminClient();

  // 1. Double check and delete the business. 
  // Foreign keys have ON DELETE CASCADE on:
  // - business_memberships
  // - business_settings
  // - contacts
  // - accounts
  // - invoices
  // - expenses
  // - support_messages
  
  const { error } = await admin.from('businesses').delete().eq('id', businessId);
  
  if (error) {
    console.error('Failed to delete business:', error);
    throw new Error('Failed to delete business network: ' + error.message);
  }

  revalidatePath('/admin/businesses');
  redirect('/en/admin/businesses');
}

export async function sendAdminSupportMessage(businessId: string, message: string) {
  const admin = await createAdminClient();

  const { error } = await admin.from('support_messages').insert({
    business_id: businessId,
    sender_type: 'admin',
    message: message,
    is_read: false
  });

  if (error) {
    console.error('Failed to send support message:', error);
    return { error: error.message };
  }

  revalidatePath(`/admin/businesses/${businessId}`);
  return { success: true };
}
