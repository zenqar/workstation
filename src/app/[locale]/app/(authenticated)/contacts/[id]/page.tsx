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
    // 1. Invoices issued BY me TO them
    // 2. Invoices issued BY them TO me (if connected)
    
    let invoices: any[] = [];
    
    // Outgoing
    const { data: outgoing } = await supabase
      .from('invoices')
      .select('*, business:businesses(name)')
      .eq('contact_id', id)
      .eq('business_id', businessId);
      
    invoices = [...(outgoing || [])];
    
    // Incoming (if connected)
    if (contact.connected_business_id) {
      // Find the contact in their business that represents US
      const { data: reverseContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('business_id', contact.connected_business_id)
        .eq('connected_business_id', businessId)
        .maybeSingle();

      if (reverseContact) {
        console.log(`[ContactPage] Found reverse contact ${reverseContact.id} in business ${contact.connected_business_id}`);
        const { data: incoming } = await supabase
          .from('invoices')
          .select('*, business:businesses(name)')
          .eq('business_id', contact.connected_business_id)
          .eq('contact_id', reverseContact.id);
          
        if (incoming) {
          console.log(`[ContactPage] Found ${incoming.length} incoming invoices`);
          invoices = [...invoices, ...incoming];
        }
      } else {
        console.log(`[ContactPage] No reverse contact found for business ${businessId} in ${contact.connected_business_id}`);
      }
    }

    invoices.sort((a, b) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime());

    return (
      <ContactDetailsClient 
        contact={contact}
        invoices={invoices || []}
        businessId={businessId}
        currentUserId={user.id}
      />
    );
  } catch (error) {
    console.error('[ContactDetailsPage] Error:', error);
    notFound();
  }
}
