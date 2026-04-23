'use client';

import { useState } from 'react';
import Link from 'next/link';
import { forgotPassword } from '@/lib/actions/auth';
import { Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await forgotPassword(new FormData(e.currentTarget));
    if (result?.error) { setError(result.error); setLoading(false); }
    else { setSent(true); setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary-gradient flex items-center justify-center shadow-glow mb-4">
            <span className="text-white font-bold text-xl">Z</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Reset password</h1>
          <p className="text-sm text-white/40 mt-1 text-center">
            {sent ? 'Check your email for the reset link.' : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="glass-card p-6 flex flex-col gap-4">
            {error && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-white/60 font-medium">Email Address</label>
              <input name="email" type="email" required placeholder="you@company.com" className="input-glass" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Mail className="w-4 h-4" />}
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <div className="glass-card p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-white/70 text-sm">A password reset link has been sent to your email. Check your inbox and spam folder.</p>
          </div>
        )}

        <p className="text-center text-sm text-white/40 mt-4">
          <Link href="/login" className="text-zenqar-400 hover:text-zenqar-300 transition-colors flex items-center justify-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
