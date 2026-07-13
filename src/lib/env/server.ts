import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

type ServerEnvironment = Record<string, string | undefined>;

/**
 * Global Environment Helper for Cloudflare Workers (OpenNext)
 * This utility ensures that environment variables are correctly read from 
 * Cloudflare Worker bindings at runtime using the async loader.
 */

export async function getServerEnv() {
  let cfEnv: ServerEnvironment = {};
  try {
    const cf = await getCloudflareContext({ async: true });
    if (cf && cf.env) cfEnv = cf.env as unknown as ServerEnvironment;
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[getServerEnv] getCloudflareContext failed, falling back to process.env');
    }
  }

  // Aggressively merge all possible environment variable sources.
  // Cloudflare Pages can inject secrets in various ways depending on the runtime context.
  return {
    ...(process.env || {}),
    ...cfEnv
  } as ServerEnvironment;
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
  return env.ADMIN_SECRET?.trim();
}

export async function getAppUrl() {
  const env = await getServerEnv();
  if (process.env.NODE_ENV === 'production') return 'https://zenqar.com';
  return (env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export async function getOpenRouterApiKey() {
  const env = await getServerEnv();
  return env.OPENROUTER_API_KEY;
}

export async function getOpenRouterModel() {
  const env = await getServerEnv();
  return env.OPENROUTER_MODEL || 'nvidia/nemotron-nano-12b-v2-vl:free';
}

export async function getOpenRouterChatModel() {
  const env = await getServerEnv();
  return env.OPENROUTER_CHAT_MODEL || 'tencent/hy3:free';
}
