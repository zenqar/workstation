import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = getLocaleFromPathname(pathname);

  // 1. Admin Authorization Check (Cookie-based as per user preference)
  // This allows reaching /admin without a Supabase session if they have the secret.
  if (isAdminPath(pathname)) {
    const adminSecret = request.cookies.get('zenqar_admin_verified')?.value;
    const expectedAdminSecret = await getAdminSecret();
    if (adminSecret === expectedAdminSecret && expectedAdminSecret) {
      // Valid admin cookie, allow through
      return intlMiddleware(request) || NextResponse.next();
    }
  }

  // 2. Intl Handling
  const intlResponse = intlMiddleware(request);
  const response = intlResponse || NextResponse.next({
    request: { headers: request.headers },
  });

  // 3. Supabase Auth Check
  const supabaseUrl = await getSupabaseUrl();
  const supabaseAnonKey = await getSupabaseAnonKey();

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
    console.error('[Middleware Error]', error);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
