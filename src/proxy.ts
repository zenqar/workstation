import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
 
export const runtime = 'edge';

import { getSupabaseUrl, getSupabaseAnonKey, getAdminSecret } from './lib/env/server';
import { getLocalizedPath } from './lib/utils/locale';

const intlMiddleware = createMiddleware(routing);

// Routes that don't require Supabase authentication
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/admin/login',
  '/api/env-check',
];

function isPublicPath(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/(en|ar|ku)/, '') || '/';
  return (
    PUBLIC_PATHS.some((p) => withoutLocale === p || withoutLocale.startsWith(p + '/')) ||
    withoutLocale.startsWith('/verify/') ||
    withoutLocale.startsWith('/auth/callback')
  );
}

function isAdminPath(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/(en|ar|ku)/, '') || '/';
  return withoutLocale.startsWith('/admin') && withoutLocale !== '/admin/login';
}

function getLocaleFromPathname(pathname: string): string {
  const match = pathname.match(/^\/(en|ar|ku)/);
  return match ? match[1] : 'en';
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = getLocaleFromPathname(pathname);

  // 1. Admin Authorization Check (Cookie-based as per user preference)
  // This allows reaching /admin without a Supabase session if they have the secret.
  if (isAdminPath(pathname)) {
    try {
      const adminSignature = request.cookies.get('zenqar_admin_verified')?.value;
      const expectedAdminSecret = await getAdminSecret();
      
      if (adminSignature && expectedAdminSecret) {
        const { verifyAdminSession } = await import('./lib/auth/admin-session');
        const isValid = await verifyAdminSession(adminSignature, 'admin', expectedAdminSecret);
        if (isValid) {
          return intlMiddleware(request) || NextResponse.next();
        }
      }
    } catch (e) {
      console.error('[Proxy Admin Check Error]', e);
    }
    
    // Invalid or missing admin signature
    const target = getLocalizedPath(locale, '/admin/login');
    return NextResponse.redirect(new URL(target, request.url));
  }

  // 2. Intl Handling
  const intlResponse = intlMiddleware(request);
  const response = intlResponse || NextResponse.next({
    request: { headers: request.headers },
  });

  // 3. Supabase Auth Check
  let supabaseUrl: string | undefined;
  let supabaseAnonKey: string | undefined;

  try {
    supabaseUrl = await getSupabaseUrl();
    supabaseAnonKey = await getSupabaseAnonKey();
  } catch (e) {
    console.error('[Proxy Env Error]', e);
    return response;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    // Redirect unauthenticated users away from protected routes
    // Exception: /app/onboarding is protected but shouldn't loop back
    if (!isPublicPath(pathname) && !user) {
      const target = getLocalizedPath(locale, '/login');
      const loginUrl = new URL(target, request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Redirect authenticated users away from auth pages
    const withoutLocale = pathname.replace(/^\/(en|ar|ku)/, '') || '/';
    if (user && ['/login', '/signup', '/forgot-password'].includes(withoutLocale)) {
      return NextResponse.redirect(new URL(getLocalizedPath(locale, '/app/dashboard'), request.url));
    }
    
  } catch (error) {
    console.error('[Proxy Error]', error);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
