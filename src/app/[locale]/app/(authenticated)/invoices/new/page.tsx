import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { getLocalizedPath } from '@/lib/utils/locale';
import NewInvoiceClient from './NewInvoiceClient';
import { getContacts } from '@/lib/actions/contacts';
import { getBusinessContext } from '@/lib/actions/businesses';

export default async function NewInvoicePage() {
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
  
  if (!['owner', 'admin', 'accountant', 'staff'].includes(role)) {
    redirect(getLocalizedPath(locale, '/app/invoices'));
  }

  const [contacts, businessContext] = await Promise.all([
    getContacts(defaultBusinessId),
    getBusinessContext(defaultBusinessId)
  ]);

  return (
    <NewInvoiceClient 
      defaultBusinessId={defaultBusinessId}
      initialContacts={contacts}
      initialContext={businessContext}
    />
  );
}
