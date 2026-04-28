'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const FX_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

export async function refreshFxRate() {
  try {
    const admin = await createAdminClient();

    // Check if we updated recently (e.g. last 6 hours)
    const { data: latest } = await admin
      .from('fx_rate_snapshots')
      .select('fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    if (latest && new Date(latest.fetched_at) > sixHoursAgo) {
      console.log('[FX] Rate is still fresh, skipping fetch.');
      return null;
    }

    console.log('[FX] Fetching latest market rate...');
    const response = await fetch(FX_API_URL);
    if (!response.ok) throw new Error('Failed to fetch from FX API');
    
    const data = await response.json();
    const officialRate = data.rates.IQD;
    
    if (!officialRate) throw new Error('IQD rate not found in API response');

    // Add 10% "Street Markup" as requested
    const streetRate = Math.round(officialRate * 1.10);

    console.log(`[FX] Official: ${officialRate}, Street (Official + 10%): ${streetRate}`);

    const { error } = await admin.from('fx_rate_snapshots').insert({
      from_currency: 'USD',
      to_currency: 'IQD',
      rate: streetRate,
      source: 'exchangerate-api (Street Markup +10%)',
      fetched_at: new Date().toISOString()
    });

    if (error) throw error;

    revalidatePath('/app/dashboard');
    return streetRate;
  } catch (err) {
    console.error('[FX] Error refreshing rate:', err);
    return null;
  }
}
