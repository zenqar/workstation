import { getDashboardStats } from '@/lib/actions/businesses';
import { getInvoices } from '@/lib/actions/invoices';
import { getExpenses } from '@/lib/actions/expenses';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // We need to know which business to fetch stats for. 
  // We'll pass the initial server-fetched data to the client component,
  // but since we don't know the "active" business on the server (it's in localStorage),
  // we'll fetch the user's businesses and default to the first one, 
  // then let the client fetch if it mismatches.
  
  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) {
    redirect('/signup');
  }

  const defaultBusinessId = memberships[0].business_id;

  const [stats, invoices, expenses] = await Promise.all([
    getDashboardStats(defaultBusinessId),
    getInvoices(defaultBusinessId),
    getExpenses(defaultBusinessId)
  ]);

  return (
    <DashboardClient 
      defaultBusinessId={defaultBusinessId}
      initialStats={stats}
      initialInvoices={invoices.slice(0, 5)} // recent 5
      initialExpenses={expenses.slice(0, 5)} // recent 5
    />
  );
}
