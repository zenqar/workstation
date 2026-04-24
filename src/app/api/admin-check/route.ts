import { NextResponse } from 'next/server';
import { debugAdminConfig } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = debugAdminConfig();
    
    return NextResponse.json({
      status: 'ok',
      diagnostics: {
        ...config,
        message: config.hasServiceKey 
          ? 'SUPABASE_SERVICE_ROLE_KEY is present.' 
          : 'SUPABASE_SERVICE_ROLE_KEY is MISSING in the current runtime environment.'
      },
      runtime: process.env.NEXT_RUNTIME || 'unknown',
      nodeVersion: process.version,
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
    }, { status: 500 });
  }
}
