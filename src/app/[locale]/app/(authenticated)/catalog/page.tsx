import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getLocalizedPath } from '@/lib/utils/locale';
import { getCatalogItems } from '@/lib/actions/catalog';
import CatalogClient from './CatalogClient';
import { pickActiveMembership } from '@/lib/auth/active-business';

export default async function CatalogPage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(getLocalizedPath(locale, '/login'));
  const { data: memberships } = await supabase.from('business_memberships').select('business_id,role').eq('user_id', user.id).eq('status', 'active');
  const membership = await pickActiveMembership(memberships);
  if (!membership) redirect(getLocalizedPath(locale, '/app/onboarding'));
  const items = await getCatalogItems(membership.business_id);
  return <CatalogClient defaultBusinessId={membership.business_id} initialItems={items} />;
}
