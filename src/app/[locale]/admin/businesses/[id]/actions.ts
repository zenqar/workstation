'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function deleteBusinessNetwork(businessId: string) {
  const admin = await createAdminClient();

  try {
    console.log(`Starting robust deletion for business: ${businessId}`);
    
    // Manually delete related records in order to ensure clean wipe
    // and avoid any potential trigger/FK issues in complex schemas
    await admin.from('invoice_items').delete().eq('business_id', businessId);
    await admin.from('invoices').delete().eq('business_id', businessId);
    await admin.from('money_transactions').delete().eq('business_id', businessId);
    await admin.from('accounts').delete().eq('business_id', businessId);
    await admin.from('expenses').delete().eq('business_id', businessId);
    await admin.from('contacts').delete().eq('business_id', businessId);
    await admin.from('business_memberships').delete().eq('business_id', businessId);
    await admin.from('business_settings').delete().eq('business_id', businessId);
    await admin.from('support_messages').delete().eq('business_id', businessId);
    
    // Finally delete the business itself
    const { error } = await admin.from('businesses').delete().eq('id', businessId);
    
    if (error) {
      console.error('Final business deletion failed:', error);
      throw new Error(error.message);
    }

    console.log(`Successfully deleted business: ${businessId}`);
    revalidatePath('/admin/businesses');
  } catch (err: any) {
    // If it's a redirect error, rethrow it so Next.js can handle it
    if (err.digest?.includes('NEXT_REDIRECT')) throw err;
    
    console.error('Robust delete failed:', err);
    throw new Error('Deletion failed: ' + (err.message || 'Unknown error'));
  }

  // Redirect MUST be outside try/catch
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
