import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

import { getSupabaseUrl, getSupabaseAnonKey, getAdminSecret } from './lib/env/server';
import { getLocalizedPath } from './lib/utils/locale';

const intlMiddleware = createMiddleware(routing);

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/admin/login',
  '/api/env-check',
];

// Routes that require platform admin role
const ADMIN_PATHS = ['/admin'];

function isPublicPath(pathname: string): boolean {
  // Remove locale prefix if present
  const withoutLocale = pathname.replace(/^\/(en|ar|ku)/, '') || '/';
  return (
    PUBLIC_PATHS.some((p) => withoutLocale === p || withoutLocale.startsWith(p + '/')) ||
    withoutLocale.startsWith('/verify/')
  );
}

function isAdminPath(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/(en|ar|ku)/, '') || '/';
  // Allow /admin/login to be public, but protect everything else under /admin
  return withoutLocale.startsWith('/admin') && withoutLocale !== '/admin/login';
}

function getLocaleFromPathname(pathname: string): string {
  const match = pathname.match(/^\/(en|ar|ku)/);
  return match ? match[1] : 'en';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = getLocaleFromPathname(pathname);

  // Run intl middleware first for locale handling
  const intlResponse = intlMiddleware(request);

  // Create a mutable response to set Supabase cookies
  const response = intlResponse || NextResponse.next({
    request: { headers: request.headers },
  });

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
  if (!isPublicPath(pathname) && !user) {
    const target = getLocalizedPath(locale, '/login');
    const loginUrl = new URL(target, request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check admin routes
  if (isAdminPath(pathname) && user) {
    const adminSecret = request.cookies.get('zenqar_admin_verified')?.value;
    const expectedAdminSecret = await getAdminSecret();
    if (adminSecret !== expectedAdminSecret) {
      // Check DB for platform admin status
      const { data: adminRecord } = await supabase
        .from('platform_admins')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!adminRecord) {
        return NextResponse.redirect(new URL(getLocalizedPath(locale, '/app/dashboard'), request.url));
      }
    }
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
    // Match all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
