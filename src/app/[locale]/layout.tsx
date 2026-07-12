import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import MouseGlowEffect from '@/components/MouseGlowEffect';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n/routing';

export const metadata: Metadata = {
  metadataBase: new URL('https://zenqar.com'),
  title: { default: 'Zenqar', template: '%s | Zenqar' },
  applicationName: 'Zenqar',
  authors: [{ name: 'Zenqar Engineering' }, { name: 'Robin-Kevin Vettik' }],
  creator: 'Zenqar Engineering',
  publisher: 'Zenqar',
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ 
  children,
  params
}: { 
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound();
  }

  const messages = await getMessages();
  const isRtl = ['ar', 'ku'].includes(locale);

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <div 
        id="locale-root"
        lang={locale}
        dir={isRtl ? 'rtl' : 'ltr'}
        className="min-h-screen relative overflow-x-hidden bg-dark-bg"
      >
        <div className="vignette pointer-events-none" aria-hidden="true" />
        <MouseGlowEffect />
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
