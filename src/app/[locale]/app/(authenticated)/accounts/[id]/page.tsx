import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { getLocalizedPath } from '@/lib/utils/locale';
import AccountDetailsClient from './AccountDetailsClient';
import { getAccountWithBalance, getAccountTransactions } from '@/lib/actions/accounts';

export default async function AccountPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id, locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(getLocalizedPath(locale, '/login'));

  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('business_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) redirect(getLocalizedPath(locale, '/signup'));

  const businessId = memberships[0].business_id;

  try {
    const [account, transactions] = await Promise.all([
      getAccountWithBalance(businessId, id),
      getAccountTransactions(businessId, id)
    ]);

    if (!account) notFound();

    return (
      <AccountDetailsClient 
        account={account}
        transactions={transactions}
        businessId={businessId}
      />
    );
  } catch (error) {
    console.error('[AccountDetailsPage] Error:', error);
    notFound();
  }
}
