import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AccountsClient from './AccountsClient';
import { getAccountsWithBalances } from '@/lib/actions/accounts';

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) redirect('/signup');

  const defaultBusinessId = memberships[0].business_id;
  const initialAccounts = await getAccountsWithBalances(defaultBusinessId);

  return (
    <AccountsClient 
      defaultBusinessId={defaultBusinessId}
      initialAccounts={initialAccounts}
    />
  );
}
