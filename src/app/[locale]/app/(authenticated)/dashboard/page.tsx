import { getDashboardStats } from '@/lib/actions/businesses';
import { getInvoices } from '@/lib/actions/invoices';
import { getExpenses } from '@/lib/actions/expenses';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import { getIncomingContactRequests } from '@/lib/actions/connections';
import { getLocale } from 'next-intl/server';
import { getLocalizedPath } from '@/lib/utils/locale';

export default async function DashboardPage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(getLocalizedPath(locale, '/login'));

  // Get user's businesses
  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) {
    redirect(getLocalizedPath(locale, '/app/onboarding'));
  }

  const defaultBusinessId = memberships[0].business_id;

  const [stats, invoices, expenses, incomingRequests] = await Promise.all([
    getDashboardStats(defaultBusinessId),
    getInvoices(defaultBusinessId),
    getExpenses(defaultBusinessId),
    getIncomingContactRequests()
  ]);

  return (
    <DashboardClient 
      defaultBusinessId={defaultBusinessId}
      initialStats={stats}
      initialInvoices={invoices.slice(0, 5)} // recent 5
      initialExpenses={expenses.slice(0, 5)} // recent 5
      incomingRequests={incomingRequests}
    />
  );
}
