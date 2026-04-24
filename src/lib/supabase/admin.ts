import { createClient } from '@supabase/supabase-js';

// Try to import Cloudflare context for environment variables
let getContext: any;
try {
  getContext = require('@opennextjs/cloudflare').getContext;
} catch (e) {
  // Not in a Cloudflare environment that supports getContext
}

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
  // Try to get env from Cloudflare context first, then fallback to process.env
  let env: any = {};
  try {
    env = getContext?.()?.env || {};
  } catch (e) {
    // getContext failed
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL. Please ensure it is set in Cloudflare Variables.');
  }
  
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Check your Worker (not Pages) settings in Cloudflare.');
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
