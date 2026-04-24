import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Global Environment Helper for Cloudflare Workers (OpenNext)
 * This utility ensures that environment variables are correctly read from 
 * Cloudflare Worker bindings at runtime, with a fallback to process.env for local development.
 */

export function getServerEnv() {
  // 1. Try Cloudflare Context (Standard OpenNext)
  try {
    const cf = getCloudflareContext();
    if (cf && cf.env && Object.keys(cf.env).length > 0) {
      return cf.env;
    }
    // If cf.env exists but is a proxy (empty keys), return it anyway
    if (cf && cf.env) return cf.env;
  } catch (e) {}

  // 2. Try globalThis (Direct Worker global)
  // In some environments, bindings are attached directly to the global object
  const g = globalThis as any;
  if (g.ADMIN_SECRET || g.SUPABASE_SERVICE_ROLE_KEY) {
    return g;
  }

  // 3. Fallback to process.env (Node.js / Local / Patched Edge)
  return process.env;
}

export function getSupabaseUrl() {
  const env = getServerEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    // Only throw at runtime when requested
    if (process.env.NODE_ENV === 'production') {
      console.error('[ENV] NEXT_PUBLIC_SUPABASE_URL is missing from runtime!');
    }
  }
  return url;
}

export function getSupabaseAnonKey() {
  const env = getServerEnv();
  return env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function getSupabaseServiceRoleKey() {
  const env = getServerEnv();
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

export function getAdminSecret() {
  const env = getServerEnv();
  return env.ADMIN_SECRET;
}

export function getAppUrl() {
  const env = getServerEnv();
  return env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}
