import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const env = (await getServerEnv()) as any;
    
    return NextResponse.json({
      status: 'ok',
      diagnostics: {
        hasSupabaseUrl: !!env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceRoleKey: !!env.SUPABASE_SERVICE_ROLE_KEY,
        hasAdminSecret: !!env.ADMIN_SECRET,
        runtime: process.env.NEXT_RUNTIME || 'unknown',
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
    }, { status: 500 });
  }
}
