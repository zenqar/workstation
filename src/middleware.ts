import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

import { getSupabaseUrl, getSupabaseAnonKey, getAdminSecret } from './lib/env/server';

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Run intl middleware first for locale handling
  const intlResponse = intlMiddleware(request);

  // Create a mutable response to set Supabase cookies
  const response = intlResponse || NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl = await getSupabaseUrl();
  const supabaseAnonKey = await getSupabaseAnonKey();

  // If Supabase config is missing, we can't run auth middleware
  // We'll skip it to avoid a 500 error, but the app will likely fail later
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Middleware] Supabase configuration is missing!');
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

  // Refresh the session — important for SSR
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected routes
  if (!isPublicPath(pathname) && !user) {
    const loginUrl = new URL('/login', request.url);
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
        return NextResponse.redirect(new URL('/app/dashboard', request.url));
      }
    }
  }

  // Redirect authenticated users away from auth pages
  if (user && ['/login', '/signup', '/forgot-password'].some(
    (p) => pathname === p || pathname.endsWith(p)
  )) {
    return NextResponse.redirect(new URL('/app/dashboard', request.url));
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
