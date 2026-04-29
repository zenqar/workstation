'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ar', name: 'العربية', flag: '🇮🇶' },
  { code: 'ku', name: 'Kurdî', flag: '☀️' },
  { code: 'et', name: 'Eesti', flag: '🇪🇪' },
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find(l => l.code === locale) || LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const switchLanguage = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale as any });
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border",
          isOpen 
            ? "bg-white/10 border-white/20 text-white" 
            : "hover:bg-white/5 border-transparent text-white/60 hover:text-white"
        )}
      >
        <span className="text-lg leading-none">{currentLang.flag}</span>
        <span className="text-xs font-bold uppercase tracking-widest hidden lg:inline">{currentLang.code}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 glass-card border border-white/10 p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-2 py-1.5 mb-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Select Language</p>
          </div>
          <div className="space-y-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => switchLanguage(lang.code)}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-all",
                  locale === lang.code 
                    ? "bg-zenqar-500/20 text-zenqar-400 font-bold" 
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg leading-none">{lang.flag}</span>
                  <span>{lang.name}</span>
                </div>
                {locale === lang.code && <Check className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
