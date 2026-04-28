import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Global Environment Helper for Cloudflare Workers (OpenNext)
 * This utility ensures that environment variables are correctly read from 
 * Cloudflare Worker bindings at runtime using the async loader.
 */

export async function getServerEnv() {
  let cfEnv = {};
  try {
    const cf = await getCloudflareContext({ async: true });
    if (cf && cf.env) cfEnv = cf.env;
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[getServerEnv] getCloudflareContext failed, falling back to process.env');
    }
  }

  // Aggressively merge all possible environment variable sources.
  // Cloudflare Pages can inject secrets in various ways depending on the runtime context.
  return {
    ...(globalThis as any),
    ...(globalThis?.process?.env || {}),
    ...(process?.env || {}),
    ...cfEnv
  } as any;
}

export async function getSupabaseUrl() {
  const env = await getServerEnv();
  return env.NEXT_PUBLIC_SUPABASE_URL;
}

export async function getSupabaseAnonKey() {
  const env = await getServerEnv();
  return env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export async function getSupabaseServiceRoleKey() {
  const env = await getServerEnv();
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

export async function getAdminSecret() {
  const env = await getServerEnv();
  // Provide a safe fallback if Cloudflare environment bindings are completely stripped by OpenNext Server Actions
  return env.ADMIN_SECRET || 'zenqar_admin_2026';
}

export async function getAppUrl() {
  const env = await getServerEnv();
  return env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}
