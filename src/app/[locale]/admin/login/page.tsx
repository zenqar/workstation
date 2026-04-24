import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Shield } from 'lucide-react';
import { getAdminSecret } from '@/lib/env/server';

export default function AdminLoginPage({ searchParams }: any) {
  const error = searchParams?.error;

  async function login(formData: FormData) {
    'use server';
    const secret = formData.get('secret') as string;
    
    // Use the centralized helper to get the secret from Cloudflare bindings
    const expectedSecret = getAdminSecret();

    if (!expectedSecret) {
      console.error('[AdminLogin] CRITICAL: ADMIN_SECRET is not found in the environment!');
    }

    if (secret !== expectedSecret) {
      redirect('/admin/login?error=Invalid secret');
    }

    const cookieStore = await cookies();
    cookieStore.set('zenqar_admin_verified', secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    redirect('/admin');
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
