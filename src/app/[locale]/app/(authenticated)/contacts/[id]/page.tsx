import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import ContactDetailsClient from './ContactDetailsClient';
import { getContact } from '@/lib/actions/contacts';
import { getLocalizedPath } from '@/lib/utils/locale';

export default async function ContactPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
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
    const contact = await getContact(businessId, id);
    if (!contact) notFound();

    // Fetch invoices for this contact
    const { data: invoices } = await supabase
      .from('invoices')
      .select('*')
      .eq('contact_id', id)
      .eq('business_id', businessId)
      .order('issue_date', { ascending: false });

    return (
      <ContactDetailsClient 
        contact={contact}
        invoices={invoices || []}
      />
    );
  } catch (error) {
    console.error('[ContactDetailsPage] Error:', error);
    notFound();
  }
}
