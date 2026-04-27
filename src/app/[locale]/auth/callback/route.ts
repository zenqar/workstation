import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env/server';

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  let next = searchParams.get('next') ?? `/${locale}/app/dashboard`;
  
  // Security: Prevent open redirect vulnerabilities by ensuring 'next' is an internal path
  // Reject protocol-relative URLs (//evil.com) and non-local paths
  if (!next.startsWith('/') || next.startsWith('//')) {
    next = `/${locale}/app/dashboard`;
  } else {
    // Ensure the path is localized
    const { getLocalizedPath } = await import('@/lib/utils/locale');
    next = getLocalizedPath(locale, next);
  }

  if (code) {
    const cookieStore = await cookies();
    const supabaseUrl = await getSupabaseUrl();
    const supabaseAnonKey = await getSupabaseAnonKey();

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(`${origin}/${locale}/login?error=Configuration missing`);
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Point 8: Check if user has business membership
      const { data: memberships } = await supabase
        .from('business_memberships')
        .select('id')
        .limit(1);

      if (!memberships || memberships.length === 0) {
        return NextResponse.redirect(`${origin}/${locale}/app/onboarding`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/${locale}/login?error=Auth verification failed`);
}
