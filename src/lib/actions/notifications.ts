'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult, Notification } from '@/lib/types';

export async function getNotifications(businessId: string): Promise<Notification[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(50);

  return data || [];
}

export async function markAsRead(notificationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) return { error: 'Failed to update notification' };
  revalidatePath('/', 'layout');
  return {};
}

export async function markAllAsRead(businessId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('business_id', businessId)
    .eq('is_read', false);

  if (error) return { error: 'Failed to update notifications' };
  revalidatePath('/', 'layout');
  return {};
}

// Admin helper to create notification
export async function notify(
  businessId: string,
  type: string,
  title: string,
  message: string,
  link?: string,
  userId?: string
) {
  const admin = await createAdminClient();
  await admin.rpc('create_notification', {
    p_business_id: businessId,
    p_user_id:     userId || null,
    p_type:        type,
    p_title:       title,
    p_message:     message,
    p_link:        link || null
  });
}
