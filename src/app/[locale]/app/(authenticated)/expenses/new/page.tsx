import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { getLocalizedPath } from '@/lib/utils/locale';
import NewExpenseClient from './NewExpenseClient';
import { getAccountsWithBalances } from '@/lib/actions/accounts';
import { getContacts } from '@/lib/actions/contacts';
import { pickActiveMembership } from '@/lib/auth/active-business';

export default async function NewExpensePage() {
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

  const membership = (await pickActiveMembership(memberships))!;
  const defaultBusinessId = membership.business_id;
  const role = membership.role;
  
  if (!['owner', 'admin', 'accountant', 'staff'].includes(role)) {
    redirect(getLocalizedPath(locale, '/app/expenses'));
  }

  const [accounts, contacts] = await Promise.all([
    getAccountsWithBalances(defaultBusinessId),
    getContacts(defaultBusinessId)
  ]);

  return (
    <NewExpenseClient 
      accounts={accounts}
      contacts={contacts}
      defaultBusinessId={defaultBusinessId}
    />
  );
}
