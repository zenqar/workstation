'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult } from '@/lib/types';
import { z } from 'zod';

async function requireBusinessUser(businessId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: membership } = await supabase
    .from('business_memberships')
    .select('role, status')
    .eq('business_id', businessId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();
  if (!membership) throw new Error('Access denied');
  return { supabase, user, role: membership.role };
}

const ContactSchema = z.object({
  type:         z.enum(['customer', 'supplier', 'both']),
  name:         z.string().min(1, 'Name is required'),
  company_name: z.string().nullable().optional(),
  email:        z.string().email().nullable().optional().or(z.literal('')),
  phone:        z.string().nullable().optional(),
  address:      z.string().nullable().optional(),
  city:         z.string().nullable().optional(),
  country:      z.string().nullable().optional(),
  notes:        z.string().nullable().optional(),
});

export async function createContact(
  businessId: string,
  data: z.infer<typeof ContactSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const { user, role } = await requireBusinessUser(businessId);
    if (!['owner', 'admin', 'accountant', 'staff'].includes(role)) return { error: 'Permission denied' };

    const parsed = ContactSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    const d = parsed.data;
    const admin = await createAdminClient();
    
    const { data: contact, error } = await admin
      .from('contacts')
      .insert({
        business_id:  businessId,
        type:         d.type,
        name:         d.name,
        company_name: d.company_name ?? null,
        email:        d.email || null,
        phone:        d.phone ?? null,
        address:      d.address ?? null,
        city:         d.city ?? null,
        country:      d.country ?? null,
        notes:        d.notes ?? null,
        created_by:   user.id,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[createContact] DB error:', error);
      return { error: error.message };
    }

    revalidatePath('/[locale]/app/contacts', 'layout');
    return { data: { id: contact.id } };
  } catch (err: any) {
    console.error('[createContact] Runtime error:', err);
    return { error: err.message || 'An unexpected error occurred' };
  }
}

export async function updateContact(
  businessId: string,
  contactId: string,
  data: z.infer<typeof ContactSchema>
): Promise<ActionResult> {
  try {
    const { role } = await requireBusinessUser(businessId);
    if (!['owner', 'admin', 'accountant', 'staff'].includes(role)) return { error: 'Permission denied' };

    const parsed = ContactSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    const d = parsed.data;
    const admin = await createAdminClient();
    const { error } = await admin
      .from('contacts')
      .update({ ...d, email: d.email || null })
      .eq('id', contactId)
      .eq('business_id', businessId);

    if (error) throw error;
    
    revalidatePath(`/[locale]/app/contacts/${contactId}`, 'layout');
    revalidatePath('/[locale]/app/contacts', 'layout');
    return {};
  } catch (err: any) {
    console.error('[updateContact]', err);
    return { error: err.message };
  }
}

export async function deleteContact(businessId: string, contactId: string): Promise<ActionResult> {
  try {
    const { role } = await requireBusinessUser(businessId);
    if (!['owner', 'admin', 'accountant'].includes(role)) return { error: 'Permission denied' };

    const admin = await createAdminClient();
    const { error } = await admin
      .from('contacts')
      .delete()
      .eq('id', contactId)
      .eq('business_id', businessId);

    if (error) throw error;
    
    revalidatePath('/[locale]/app/contacts', 'layout');
    return {};
  } catch (err: any) {
    console.error('[deleteContact]', err);
    return { error: err.message };
  }
}

export async function getContacts(businessId: string, type?: string) {
  try {
    const { role } = await requireBusinessUser(businessId);
    if (!role) return [];

    const admin = await createAdminClient();
    let query = admin
      .from('contacts')
      .select('*')
      .eq('business_id', businessId)
      .order('name');

    if (type) query = query.eq('type', type);
    const { data, error } = await query;
    
    if (error) {
      console.error('[getContacts] error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[getContacts] runtime error:', err);
    return [];
  }
}

export async function getContact(businessId: string, contactId: string) {
  try {
    const { role } = await requireBusinessUser(businessId);
    if (!role) return null;

    const admin = await createAdminClient();
    const { data, error } = await admin
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (error) {
      console.error('[getContact] error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[getContact] runtime error:', err);
    return null;
  }
}
