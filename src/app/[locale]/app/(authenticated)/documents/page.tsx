import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getLocalizedPath } from '@/lib/utils/locale';
import { getAccountsWithBalances } from '@/lib/actions/accounts';
import { getContacts } from '@/lib/actions/contacts';
import NewExpenseClient from '../expenses/new/NewExpenseClient';
import { pickActiveMembership } from '@/lib/auth/active-business';

export default async function DocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(getLocalizedPath(locale, '/login'));

  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('business_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active');

  const membership = await pickActiveMembership(memberships);
  if (!membership) redirect(getLocalizedPath(locale, '/app/onboarding'));
  if (!['owner', 'admin', 'accountant', 'staff'].includes(membership.role)) {
    redirect(getLocalizedPath(locale, '/app/expenses'));
  }

  const [accounts, contacts] = await Promise.all([
    getAccountsWithBalances(membership.business_id),
    getContacts(membership.business_id),
  ]);

  return (
    <NewExpenseClient
      accounts={accounts}
      contacts={contacts}
      defaultBusinessId={membership.business_id}
      scannerFirst
    />
  );
}
