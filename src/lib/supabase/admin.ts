import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client — uses the service role key.
 * NEVER expose this to the browser. Use only in:
 * - Server Actions
 * - API Route Handlers
 * - Admin panel server code
 *
 * This client bypasses RLS. Use with extreme care.
 */
export function createAdminClient() {
  // In Cloudflare Workers, env variables might be in process.env or a global context
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    console.error('Environment Diagnostic: NEXT_PUBLIC_SUPABASE_URL is missing');
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL. Please ensure it is set in Cloudflare Variables.');
  }
  
  if (!key) {
    console.error('Environment Diagnostic: SUPABASE_SERVICE_ROLE_KEY is missing');
    // Provide a more detailed error to help the user find the right setting
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Check your Worker (not Pages) settings in Cloudflare.');
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
