import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
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
  return ADMIN_PATHS.some((p) => withoutLocale.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Run intl middleware first for locale handling
  const intlResponse = intlMiddleware(request);

  // Create a mutable response to set Supabase cookies
  const response = intlResponse || NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    if (adminSecret !== process.env.ADMIN_SECRET) {
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

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
