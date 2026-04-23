import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ExpensesClient from './ExpensesClient';
import { getExpenses } from '@/lib/actions/expenses';

export default async function ExpensesPage() {
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
  const initialExpenses = await getExpenses(defaultBusinessId);

  return (
    <ExpensesClient 
      defaultBusinessId={defaultBusinessId}
      initialExpenses={initialExpenses}
    />
  );
}
