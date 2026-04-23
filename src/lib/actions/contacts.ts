'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
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
  const { supabase, user, role } = await requireBusinessUser(businessId);
  if (!['owner', 'admin', 'accountant', 'staff'].includes(role)) return { error: 'Permission denied' };

  const parsed = ContactSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const d = parsed.data;
  const { data: contact, error } = await supabase
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

  if (error) return { error: 'Failed to create contact' };

  revalidatePath('/app/contacts');
  return { data: { id: contact.id } };
}

export async function updateContact(
  businessId: string,
  contactId: string,
  data: z.infer<typeof ContactSchema>
): Promise<ActionResult> {
  const { supabase, role } = await requireBusinessUser(businessId);
  if (!['owner', 'admin', 'accountant', 'staff'].includes(role)) return { error: 'Permission denied' };

  const parsed = ContactSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const d = parsed.data;
  const { error } = await supabase
    .from('contacts')
    .update({ ...d, email: d.email || null })
    .eq('id', contactId)
    .eq('business_id', businessId);

  if (error) return { error: 'Failed to update contact' };
  revalidatePath(`/app/contacts/${contactId}`);
  revalidatePath('/app/contacts');
  return {};
}

export async function deleteContact(businessId: string, contactId: string): Promise<ActionResult> {
  const { supabase, role } = await requireBusinessUser(businessId);
  if (!['owner', 'admin', 'accountant'].includes(role)) return { error: 'Permission denied' };

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId)
    .eq('business_id', businessId);

  if (error) return { error: 'Failed to delete contact' };
  revalidatePath('/app/contacts');
  return {};
}

export async function getContacts(businessId: string, type?: string) {
  const supabase = await createClient();
  let query = supabase
    .from('contacts')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name');

  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getContact(businessId: string, contactId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .eq('business_id', businessId)
    .single();
  if (error) throw error;
  return data;
}
