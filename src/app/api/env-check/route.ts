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
        // Diagnostic info
        runtime: process.env.NEXT_RUNTIME || 'unknown',
        deployment: env.CF_PAGES ? 'cloudflare-pages' : 'other',
        envKeysFound: Object.keys(env).filter(k => 
          k.includes('SUPABASE') || k.includes('SECRET') || k.includes('NEXT_PUBLIC')
        ).length
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
    }, { status: 500 });
  }
}
