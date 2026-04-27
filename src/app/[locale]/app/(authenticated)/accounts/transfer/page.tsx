import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { getLocalizedPath } from '@/lib/utils/locale';
import TransferFundsClient from './TransferFundsClient';
import { getAccountsWithBalances } from '@/lib/actions/accounts';

export default async function TransferFundsPage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(getLocalizedPath(locale, '/login'));

  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('business_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) redirect(getLocalizedPath(locale, '/signup'));

  const defaultBusinessId = memberships[0].business_id;
  const role = memberships[0].role;
  
  if (!['owner', 'admin', 'accountant'].includes(role)) {
    redirect(getLocalizedPath(locale, '/app/accounts'));
  }

  const accounts = await getAccountsWithBalances(defaultBusinessId);

  return (
    <TransferFundsClient 
      defaultBusinessId={defaultBusinessId}
      accounts={accounts}
    />
  );
}
