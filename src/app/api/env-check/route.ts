import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Restrict to development/staging only — never expose in production
  const env = (await getServerEnv()) as any;
  const isProduction = (env.NODE_ENV || process.env.NODE_ENV) === 'production';

  if (isProduction) {
    // In production, require a secret query param to allow diagnostics
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const adminSecret = env.ADMIN_SECRET;
    if (!adminSecret || token !== adminSecret) {
      return NextResponse.json({ status: 'forbidden' }, { status: 403 });
    }
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
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: 'Diagnostics failed to run',
    }, { status: 500 });
  }
}
