import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Shield } from 'lucide-react';
import { getAdminSecret } from '@/lib/env/server';
import { getLocale } from 'next-intl/server';
import { getLocalizedPath } from '@/lib/utils/locale';

export default async function AdminLoginPage(props: { 
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const error = searchParams.error;
  const locale = params.locale;

  async function login(formData: FormData) {
    'use server';
    const formLocale = formData.get('locale') as string || 'en';
    const secret = formData.get('secret') as string;

    // Use the centralized helper to get the secret from Cloudflare bindings
    const expectedSecret = await getAdminSecret();

    // Always use verifyAdminToken for constant-time comparison to prevent timing attacks.
    // Use a generic error message regardless of whether the secret is missing or wrong
    // to avoid revealing internal system state.
    const { signAdminToken, verifyAdminToken } = await import('@/lib/utils/admin');

    if (!expectedSecret) {
      console.error('[AdminLogin] CRITICAL: ADMIN_SECRET is not configured.');
      redirect(getLocalizedPath(formLocale, `/admin/login?error=Invalid secret`));
    }

    // Sign the provided secret and compare using constant-time HMAC verify
    const providedSignature = await signAdminToken(secret, expectedSecret!);
    const isValid = await verifyAdminToken(providedSignature, secret, expectedSecret!);

    if (!isValid || secret !== expectedSecret) {
      redirect(getLocalizedPath(formLocale, `/admin/login?error=Invalid secret`));
    }

    // Sign the session token to store in cookie
    const signature = await signAdminToken('admin', expectedSecret!);

    const cookieStore = await cookies();
    cookieStore.set('zenqar_admin_verified', signature, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    redirect(getLocalizedPath(formLocale, '/admin'));
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="glass-card max-w-md w-full p-8 relative overflow-hidden">
        <div className="mouse-light"></div>
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Access</h1>
          <p className="text-white/50 text-sm mt-2">Enter the platform admin secret to continue</p>
        </div>

        <form action={login} className="space-y-4">
          <div>
            <input type="hidden" name="locale" value={locale} />
            <input
              type="password"
              name="secret"
              placeholder="Admin Secret"
              required
              className="input-glass"
            />
            {error && <p className="text-red-400 text-xs mt-2 ml-1">{error}</p>}
          </div>
          <button type="submit" className="btn-primary w-full bg-red-600 hover:bg-red-500 shadow-none border-red-500/50 text-white">
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
