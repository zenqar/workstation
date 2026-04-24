'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight } from 'lucide-react';

export default function VerifySearch({ locale }: { locale: string }) {
  const [token, setToken] = useState('');
  const router = useRouter();

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = token.trim();
    if (cleanToken) {
      router.push(`/${locale}/verify/${cleanToken}`);
    }
  };

  return (
    <form onSubmit={handleVerify} className="w-full max-w-md mx-auto relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-zenqar-500/20 to-zenqar-400/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
      <div className="relative flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden focus-within:border-zenqar-500/50 focus-within:ring-1 focus-within:ring-zenqar-500/50 transition-all">
        <div className="pl-4 pr-2">
          <Search className="w-5 h-5 text-white/40" />
        </div>
        <input 
          type="text" 
          placeholder="Paste invoice unique code..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="bg-transparent border-none outline-none text-white text-sm w-full py-4 placeholder:text-white/30"
          required
        />
        <div className="pr-2">
          <button 
            type="submit" 
            className="bg-zenqar-500 hover:bg-zenqar-400 text-white p-2 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!token.trim()}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </form>
  );
}
