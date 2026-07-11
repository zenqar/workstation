import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Restrict to development/staging only — never expose in production
  const env = await getServerEnv();
  const isProduction = (env.NODE_ENV || process.env.NODE_ENV) === 'production';

  if (isProduction) {
    return new NextResponse(null, { status: 404 });
  }

  try {
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
  } catch {
    return NextResponse.json({
      status: 'error',
      error: 'Diagnostics failed to run',
    }, { status: 500 });
  }
}
