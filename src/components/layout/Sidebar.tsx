'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { cn } from '@/lib/utils';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Wallet, 
  CreditCard, 
  Receipt, 
  BarChart3, 
  Settings,
  LifeBuoy
} from 'lucide-react';
import type { Profile } from '@/lib/types';

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('nav');
  const { activeBusiness } = useBusiness();

  const navigation = [
    { name: t('dashboard'), href: `/${locale}/app/dashboard`, icon: LayoutDashboard },
    { name: t('invoices'), href: `/${locale}/app/invoices`, icon: FileText },
    { name: t('contacts'), href: `/${locale}/app/contacts`, icon: Users },
    { name: t('accounts'), href: `/${locale}/app/accounts`, icon: Wallet },
    { name: t('payments'), href: `/${locale}/app/payments`, icon: CreditCard },
    { name: t('expenses'), href: `/${locale}/app/expenses`, icon: Receipt },
    // { name: t('reports'), href: `/${locale}/app/reports`, icon: BarChart3 }, // Not yet implemented
    { name: t('support') || 'Support', href: `/${locale}/app/support`, icon: LifeBuoy },
    { name: t('settings'), href: `/${locale}/app/settings`, icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full bg-dark-bg/50">
      {/* Traffic Lights for Mac feel */}
      <div className="flex gap-1.5 px-6 pt-6 pb-2">
        <div className="w-3 h-3 rounded-full bg-[#FF5F57] shadow-inner" />
        <div className="w-3 h-3 rounded-full bg-[#FEBC2E] shadow-inner" />
        <div className="w-3 h-3 rounded-full bg-[#28C840] shadow-inner" />
      </div>

      {/* Brand */}
      <div className="p-6 flex items-center gap-3 pt-4">
        <div className="w-9 h-9 rounded-xl bg-zenqar-gradient flex items-center justify-center shadow-glow border border-white/20">
          <span className="text-white font-black text-base">Z</span>
        </div>
        <span className="font-bold text-xl text-white tracking-tight font-outfit">Zenqar</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto pb-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'nav-item group',
                isActive && 'active'
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 flex-shrink-0",
                isActive ? "text-zenqar-400" : "text-white/40 group-hover:text-white/80"
              )} />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User profile brief */}
      <div className="p-4 border-t border-white/5 mt-auto bg-white/[0.02]">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-xs font-medium text-white/80">
            {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-bold text-white truncate font-outfit">
              {profile?.full_name || 'User'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/30 truncate">
              {activeBusiness?.name || 'Loading...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
