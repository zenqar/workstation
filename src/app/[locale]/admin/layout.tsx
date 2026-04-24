import { getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import { Shield, Home, LogOut } from 'lucide-react';
import { getLocalizedPath } from '@/lib/utils/locale';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  const locale = await getLocale();

  return (
    <div className="min-h-screen flex flex-col bg-dark-bg">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full glass-card rounded-none border-t-0 border-x-0 border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-red-400" />
            </div>
            <span className="font-bold text-white tracking-tight">Zenqar Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              href={getLocalizedPath(locale, '/app/dashboard')} 
              className="text-sm text-white/50 hover:text-white flex items-center gap-2 transition-colors"
            >
              <Home className="w-4 h-4" /> Return to App
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
