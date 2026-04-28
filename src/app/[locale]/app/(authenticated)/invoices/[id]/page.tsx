import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { getLocalizedPath } from '@/lib/utils/locale';
import InvoiceDetailsClient from './InvoiceDetailsClient';
import { getInvoice } from '@/lib/actions/invoices';
import { getAccountsWithBalances } from '@/lib/actions/accounts';

export default async function InvoicePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id, locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(getLocalizedPath(locale, '/login'));

  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('business_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) redirect(getLocalizedPath(locale, '/signup'));

  const businessId = memberships[0].business_id;

  try {
    const [invoice, accounts, businessContext] = await Promise.all([
      getInvoice(businessId, id),
      getAccountsWithBalances(businessId),
      getBusinessContext(businessId)
    ]);

    if (!invoice) notFound();

    return (
      <InvoiceDetailsClient 
        invoice={invoice}
        accounts={accounts}
        businessId={businessId}
        fxRate={businessContext?.fxRate || 1310}
      />
    );
  } catch (error) {
    console.error('[InvoiceDetailsPage] Error:', error);
    notFound();
  }
}
