import { getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import { Shield, Home, LogOut } from 'lucide-react';
import { getLocalizedPath } from '@/lib/utils/locale';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  const locale = await getLocale();

  return (
    <div className="min-h-screen flex bg-dark-bg">
      {/* Sidebar Navigation */}
      <aside className="w-64 glass-card rounded-none border-y-0 border-l-0 border-r border-white/5 flex flex-col hidden md:flex sticky top-0 h-screen">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-red-400" />
          </div>
          <span className="font-bold text-white tracking-tight">Zenqar Admin</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <Link href={getLocalizedPath(locale, '/admin')} className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors">
            <Home className="w-4 h-4" /> Overview
          </Link>
          <Link href={getLocalizedPath(locale, '/admin/businesses')} className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors">
            <Building2 className="w-4 h-4" /> Businesses
          </Link>
          <Link href={getLocalizedPath(locale, '/admin/users')} className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors">
            <Users className="w-4 h-4" /> Users
          </Link>
        </nav>

        <div className="p-4 border-t border-white/5">
          <Link href={getLocalizedPath(locale, '/app/dashboard')} className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-white/50 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" /> Exit Admin
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen max-w-[100vw] md:max-w-[calc(100vw-16rem)]">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-40 w-full glass-card rounded-none border-t-0 border-x-0 border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-red-400" />
            <span className="font-bold text-white tracking-tight">Admin</span>
          </div>
          <Link href={getLocalizedPath(locale, '/app/dashboard')} className="text-sm text-white/50">Exit</Link>
        </header>

        <div className="flex-1 w-full p-6 md:p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
