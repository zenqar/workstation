import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const env = getServerEnv();
    
    return NextResponse.json({
      status: 'ok',
      diagnostics: {
        hasSupabaseUrl: !!env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceRoleKey: !!env.SUPABASE_SERVICE_ROLE_KEY,
        hasAdminSecret: !!env.ADMIN_SECRET,
        // Detailed check
        serviceRoleKeyLength: env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
        adminSecretLength: env.ADMIN_SECRET?.length || 0,
        runtime: process.env.NEXT_RUNTIME || 'unknown',
        envKeysFound: Object.keys(env).length || 'hidden (proxy)',
        allKeys: Object.keys(env).filter(k => !k.startsWith('__'))
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
    }, { status: 500 });
  }
}
