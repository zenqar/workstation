/**
 * FX Rate Service
 * Fetches USD→IQD exchange rate from configured provider.
 * Falls back to latest DB snapshot, then hardcoded default.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { getServerEnv } from '@/lib/env/server';

export interface FxRate {
  rate: number;
  source: string;
  fetchedAt: string;
}

// Module-level cache
let _cached: FxRate | null = null;
let _cachedAt: number | null = null;

async function getConfig() {
  const env = await getServerEnv();
  return {
    FALLBACK_RATE: Number(env.FX_FALLBACK_RATE ?? 1310),
    CACHE_MINUTES: Number(env.FX_CACHE_MINUTES ?? 60),
    PROVIDER: env.FX_PROVIDER ?? 'mock',
    API_KEY: env.FX_API_KEY,
    API_URL: env.FX_API_URL,
  };
}

async function isCacheValid(): Promise<boolean> {
  if (!_cached || !_cachedAt) return false;
  const config = await getConfig();
  const ageMs = Date.now() - _cachedAt;
  return ageMs < config.CACHE_MINUTES * 60 * 1000;
}

async function fetchFromExternalApi(): Promise<number | null> {
  const config = await getConfig();
  const provider = config.PROVIDER;

  if (provider === 'mock') {
    return null; // skip to DB snapshot
  }

  const apiKey = config.API_KEY;
  const apiUrl = config.API_URL;

  if (!apiKey || !apiUrl) return null;

  try {
    let url = apiUrl;
    if (provider === 'exchangerate_api') {
      url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;
      const res = await fetch(url, { next: { revalidate: config.CACHE_MINUTES * 60 } });
      const json = await res.json();
      return json?.conversion_rates?.IQD ?? null;
    }

    if (provider === 'fixer') {
      url = `http://data.fixer.io/api/latest?access_key=${apiKey}&base=USD&symbols=IQD`;
      const res = await fetch(url, { next: { revalidate: config.CACHE_MINUTES * 60 } });
      const json = await res.json();
      return json?.rates?.IQD ?? null;
    }
  } catch (err) {
    console.warn('[FX] External API failed:', err);
  }

  return null;
}

async function fetchFromDatabase(): Promise<number | null> {
  try {
    const supabase = await createAdminClient();
    const { data } = await supabase
      .from('fx_rate_snapshots')
      .select('rate')
      .eq('from_currency', 'USD')
      .eq('to_currency', 'IQD')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    return data?.rate ?? null;
  } catch {
    return null;
  }
}

async function persistRate(rate: number, source: string): Promise<void> {
  try {
    const supabase = await createAdminClient();
    await supabase.from('fx_rate_snapshots').insert({
      from_currency: 'USD',
      to_currency:   'IQD',
      rate,
      source,
    });
  } catch {
    // Non-critical
  }
}

/**
 * Returns the current USD→IQD exchange rate.
 * Tries: memory cache → external API → DB snapshot → hardcoded fallback
 */
export async function getCurrentFxRate(): Promise<FxRate> {
  // 1. Memory cache
  if (await isCacheValid() && _cached) {
    return _cached;
  }

  // 2. External API
  const apiRate = await fetchFromExternalApi();
  const config = await getConfig();
  
  if (apiRate !== null) {
    const result: FxRate = {
      rate:      apiRate,
      source:    config.PROVIDER ?? 'api',
      fetchedAt: new Date().toISOString(),
    };
    await persistRate(apiRate, result.source);
    _cached   = result;
    _cachedAt = Date.now();
    return result;
  }

  // 3. Database snapshot
  const dbRate = await fetchFromDatabase();
  if (dbRate !== null) {
    const result: FxRate = {
      rate:      dbRate,
      source:    'database',
      fetchedAt: new Date().toISOString(),
    };
    _cached   = result;
    _cachedAt = Date.now();
    return result;
  }

  // 4. Hardcoded fallback
  const fallback: FxRate = {
    rate:      config.FALLBACK_RATE,
    source:    'fallback',
    fetchedAt: new Date().toISOString(),
  };
  _cached   = fallback;
  _cachedAt = Date.now();
  return fallback;
}
