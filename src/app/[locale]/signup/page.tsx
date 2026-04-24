'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signUp } from '@/lib/actions/auth';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const params = useParams();
  const locale = params.locale as string;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    if (fd.get('password') !== fd.get('confirmPassword')) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }
    const result = await signUp(fd);
    if (result?.error) { 
      const msg = typeof result.error === 'string' 
        ? result.error 
        : JSON.stringify(result.error);
      setError(msg); 
      setLoading(false); 
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary-gradient flex items-center justify-center shadow-glow mb-4">
            <span className="text-white font-bold text-xl">Z</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-sm text-white/40 mt-1">Start your Zenqar journey today</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-white/60 font-medium">Full Name</label>
            <input name="fullName" type="text" required placeholder="Your name" className="input-glass" autoComplete="name" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-white/60 font-medium">Business Name</label>
            <input name="businessName" type="text" required placeholder="Your company name" className="input-glass" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-white/60 font-medium">Email</label>
            <input name="email" type="email" required placeholder="you@company.com" className="input-glass" autoComplete="email" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-white/60 font-medium">Password</label>
            <div className="relative">
              <input name="password" type={showPassword ? 'text' : 'password'} required placeholder="Min. 8 characters" className="input-glass pr-10" autoComplete="new-password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center text-white/30 hover:text-white/60 transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-white/60 font-medium">Confirm Password</label>
            <input name="confirmPassword" type="password" required placeholder="••••••••" className="input-glass" autoComplete="new-password" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-xs text-white/30 text-center">By signing up you agree to our Terms of Service.</p>
        </form>

        <p className="text-center text-sm text-white/40 mt-4">
          Already have an account?{' '}
          <Link href={`/${locale}/login`} className="text-zenqar-400 hover:text-zenqar-300 transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
