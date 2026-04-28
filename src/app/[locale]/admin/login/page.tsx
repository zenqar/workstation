import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Shield } from 'lucide-react';
import { getAdminSecret } from '@/lib/env/server';
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
    const formLocale = (formData.get('locale') as string) || 'en';
    const secret = formData.get('secret') as string;

    const rawExpectedSecret = await getAdminSecret();
    const expectedSecret = rawExpectedSecret?.trim();
    const cleanSecret = secret.trim();

    if (!expectedSecret) {
      redirect(getLocalizedPath(formLocale, `/admin/login?error=Server configuration error: ADMIN_SECRET not set`));
    }

    if (!secret) {
      redirect(getLocalizedPath(formLocale, `/admin/login?error=Secret is required`));
    }

    // Constant-time comparison: sign both with the same key, then compare the signatures
    // This prevents timing attacks while keeping logic simple
    const { signAdminSession } = await import('@/lib/auth/admin-session');
    const expectedSignature = await signAdminSession(expectedSecret, expectedSecret);
    const providedSignature = await signAdminSession(cleanSecret, expectedSecret);

    if (providedSignature !== expectedSignature) {
      redirect(`/${formLocale}/admin/login?error=Invalid%20secret`);
    }

    // Set the session cookie with the signed admin token
    const sessionToken = await signAdminSession('admin', expectedSecret);
    const cookieStore = await cookies();
    cookieStore.set('zenqar_admin_verified', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_APP_URL?.startsWith('https'),
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    redirect(`/${formLocale}/admin`);
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
              autoComplete="off"
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
