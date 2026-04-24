import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PaymentsClient from './PaymentsClient';
import { getPayments } from '@/lib/actions/payments';

export default async function PaymentsPage() {
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
  const initialPayments = await getPayments(defaultBusinessId);

  return (
    <PaymentsClient 
      defaultBusinessId={defaultBusinessId}
      initialPayments={initialPayments}
    />
  );
}
