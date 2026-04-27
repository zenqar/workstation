import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { getLocalizedPath } from '@/lib/utils/locale';
import InvoicesClient from './InvoicesClient';
import { getInvoices } from '@/lib/actions/invoices';

export default async function InvoicesPage() {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(getLocalizedPath(locale, '/login'));

  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) redirect(getLocalizedPath(locale, '/signup'));

  const defaultBusinessId = memberships[0].business_id;
  const initialInvoices = await getInvoices(defaultBusinessId);

  return (
    <InvoicesClient 
      defaultBusinessId={defaultBusinessId}
      initialInvoices={initialInvoices}
    />
  );
}
