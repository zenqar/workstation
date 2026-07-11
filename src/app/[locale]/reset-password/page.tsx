'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useLocale } from 'next-intl';
import { resetPassword } from '@/lib/actions/auth';

export default function ResetPasswordPage() {
  const locale = useLocale();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const result = await resetPassword(new FormData(event.currentTarget));
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-gradient shadow-glow"><KeyRound className="h-5 w-5 text-white" /></div><h1 className="text-2xl font-bold text-white">Choose a new password</h1><p className="mt-1 text-sm text-white/40">Use at least eight characters. Your recovery session is protected and expires automatically.</p></div>
        <form onSubmit={submit} className="glass-card flex flex-col gap-4 p-6">
          <input type="hidden" name="locale" value={locale} />
          {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
          <label className="space-y-1.5 text-sm font-medium text-white/60">New password<div className="relative"><input required minLength={8} name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="input-glass pr-10" /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-3 text-white/30 hover:text-white/60">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>
          <label className="space-y-1.5 text-sm font-medium text-white/60">Confirm new password<input required minLength={8} name="confirmPassword" type="password" autoComplete="new-password" className="input-glass" /></label>
          <button disabled={loading} className="btn-primary mt-1 w-full"><KeyRound className="h-4 w-4" />{loading ? 'Updating…' : 'Update password'}</button>
        </form>
        <p className="mt-4 text-center text-sm text-white/40"><Link href={`/${locale}/login`} className="text-zenqar-400 hover:text-zenqar-300">Return to sign in</Link></p>
      </div>
    </div>
  );
}
