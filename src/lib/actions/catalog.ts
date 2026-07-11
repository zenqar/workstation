'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireBusinessUser } from './_helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult, CatalogItem } from '@/lib/types';

const CatalogItemSchema = z.object({
  item_type: z.enum(['product', 'service']),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullable().optional(),
  sku: z.string().trim().max(80).nullable().optional(),
  unit: z.string().trim().min(1).max(40),
  sales_price: z.number().nonnegative(),
  purchase_cost: z.number().nonnegative(),
  currency: z.enum(['IQD', 'USD']),
  tax_rate: z.number().min(0).max(100),
});

export async function getCatalogItems(businessId: string): Promise<CatalogItem[]> {
  try {
    await requireBusinessUser(businessId);
    const admin = await createAdminClient();
    const { data, error } = await admin.from('catalog_items').select('*').eq('business_id', businessId).eq('is_active', true).order('name');
    if (error) throw error;
    return (data || []) as CatalogItem[];
  } catch (error) {
    console.error('[getCatalogItems]', error);
    return [];
  }
}

export async function saveCatalogItem(businessId: string, values: z.infer<typeof CatalogItemSchema>, itemId?: string): Promise<ActionResult<CatalogItem>> {
  try {
    const { user, role } = await requireBusinessUser(businessId);
    if (!['owner', 'admin', 'accountant', 'staff'].includes(role)) return { error: 'Permission denied' };
    const parsed = CatalogItemSchema.safeParse(values);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const admin = await createAdminClient();
    const payload = { ...parsed.data, description: parsed.data.description || null, sku: parsed.data.sku || null };
    const query = itemId
      ? admin.from('catalog_items').update(payload).eq('id', itemId).eq('business_id', businessId)
      : admin.from('catalog_items').insert({ ...payload, business_id: businessId, created_by: user.id });
    const { data, error } = await query.select().single();
    if (error) throw error;
    revalidatePath('/[locale]/app/catalog', 'layout');
    revalidatePath('/[locale]/app/invoices/new', 'page');
    return { data: data as CatalogItem };
  } catch (error) {
    console.error('[saveCatalogItem]', error);
    return { error: error instanceof Error ? error.message : 'Could not save catalog item' };
  }
}

export async function archiveCatalogItem(businessId: string, itemId: string): Promise<ActionResult> {
  try {
    const { role } = await requireBusinessUser(businessId);
    if (!['owner', 'admin', 'accountant'].includes(role)) return { error: 'Permission denied' };
    const admin = await createAdminClient();
    const { error } = await admin.from('catalog_items').update({ is_active: false }).eq('id', itemId).eq('business_id', businessId);
    if (error) throw error;
    revalidatePath('/[locale]/app/catalog', 'layout');
    return {};
  } catch (error) {
    console.error('[archiveCatalogItem]', error);
    return { error: error instanceof Error ? error.message : 'Could not archive catalog item' };
  }
}
