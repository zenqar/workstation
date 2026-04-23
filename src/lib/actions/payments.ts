'use server';

import { createClient } from '@/lib/supabase/server';

export async function getPayments(businessId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payments')
    .select('*, account:accounts(id, name, currency), invoice:invoices(id, invoice_number, contact_id, contact:contacts(id, name))')
    .eq('business_id', businessId)
    .order('payment_date', { ascending: false });
  if (error) throw error;
  return data;
}
