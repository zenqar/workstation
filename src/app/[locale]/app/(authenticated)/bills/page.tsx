import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getLocalizedPath } from '@/lib/utils/locale';
import { pickActiveMembership } from '@/lib/auth/active-business';
import { getSupplierBills } from '@/lib/actions/bills';
import { getAccountsWithBalances } from '@/lib/actions/accounts';
import BillsClient from './BillsClient';

export default async function BillsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(getLocalizedPath(locale, '/login'));

  const { data: memberships } = await supabase.from('business_memberships').select('business_id, role')
    .eq('user_id', user.id).eq('status', 'active');
  const membership = await pickActiveMembership(memberships);
  if (!membership) redirect(getLocalizedPath(locale, '/app/onboarding'));

  const [bills, accounts] = await Promise.all([
    getSupplierBills(membership.business_id),
    getAccountsWithBalances(membership.business_id),
  ]);
  return <BillsClient defaultBusinessId={membership.business_id} initialBills={bills} initialAccounts={accounts} />;
}
