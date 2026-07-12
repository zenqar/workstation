'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { signOut } from '@/lib/actions/auth';
import { LogOut, ChevronDown, Check, Building2, Menu, X } from 'lucide-react';
import type { Profile } from '@/lib/types';
import Sidebar from './Sidebar';
import { useParams } from 'next/navigation';
import NotificationBell from './NotificationBell';
import LanguageSwitcher from './LanguageSwitcher';

export default function TopBar({ profile }: { profile: Profile | null }) {
  const t = useTranslations('common');
  const { businesses, activeBusiness, setActiveBusinessId } = useBusiness();
  const [showBusinessDropdown, setShowBusinessDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const params = useParams();
  const locale = params.locale as string;

  useEffect(() => {
    if (!showMobileMenu && !showBusinessDropdown) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMobileMenu(false);
        setShowBusinessDropdown(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showMobileMenu, showBusinessDropdown]);

  return (
    <>
      <header className="app-chrome h-16 flex-shrink-0 border-b border-border bg-dark-bg/80 backdrop-blur-md flex items-center justify-between px-3 md:px-6 z-20">
        <div className="flex items-center gap-4">
          <button 
            className="md:hidden p-2 -ml-2 text-white/70 hover:text-white"
            onClick={() => setShowMobileMenu(true)}
            aria-label="Open navigation"
            aria-expanded={showMobileMenu}
          >
            <Menu className="w-5 h-5" />
          </button>
          
          {/* Business Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowBusinessDropdown(!showBusinessDropdown)}
              className="flex min-w-0 items-center gap-2 px-2 sm:px-3 py-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors"
              aria-haspopup="menu"
              aria-expanded={showBusinessDropdown}
            >
              <Building2 className="w-4 h-4 text-white/50" />
              <span className="max-w-[110px] truncate text-sm font-bold text-white/90 font-outfit tracking-tight sm:max-w-[220px]">
                {activeBusiness?.name || 'Select business'}
              </span>
              <ChevronDown className="w-4 h-4 text-white/50" />
            </button>

            {showBusinessDropdown && (
              <div className="absolute top-full start-0 mt-1 w-64 glass-card-elevated border border-white/10 py-2 z-50 animate-in shadow-xl" role="menu">
                <div className="px-3 pb-2 mb-2 border-b border-white/10">
                  <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Your Businesses</p>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {businesses.map((b) => (
                    <button
                      key={b.business.id}
                      onClick={() => {
                        setActiveBusinessId(b.business.id);
                        setShowBusinessDropdown(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-white/5 text-white/80 hover:text-white transition-colors"
                    >
                      <span className="truncate pr-4">{b.business.name}</span>
                      {activeBusiness?.id === b.business.id && (
                        <Check className="w-4 h-4 text-zenqar-400 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="px-3 pt-2 mt-2 border-t border-white/10">
                  <Link 
                    href={`/${locale}/app/onboarding`} 
                    className="flex items-center gap-2 text-sm text-zenqar-400 hover:text-zenqar-300 py-1"
                  >
                    + Create new business
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <NotificationBell />
          <div className="w-px h-6 bg-white/5 mx-1" />
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-2 text-sm font-medium text-white/60 hover:text-white transition-colors px-3 py-1.5 rounded-xl hover:bg-white/5"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t('logout')}</span>
            </button>
          </form>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="app-chrome md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setShowMobileMenu(false)}
          />
          <div className="relative w-64 max-w-[80%] h-full bg-dark-bg border-r border-white/10 shadow-2xl flex flex-col animate-slide-in">
            <button onClick={() => setShowMobileMenu(false)} className="absolute end-3 top-3 z-10 rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Close navigation"><X className="h-5 w-5" /></button>
            <Sidebar profile={profile} onNavigate={() => setShowMobileMenu(false)} />
          </div>
        </div>
      )}

      {/* Close dropdown on outside click (simple approach for now) */}
      {showBusinessDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowBusinessDropdown(false)} 
        />
      )}
    </>
  );
}
