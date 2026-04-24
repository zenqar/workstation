import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import MouseGlowEffect from '@/components/MouseGlowEffect';

export const metadata: Metadata = {
  title: {
    default: 'Zenqar — Smart Invoicing & Bookkeeping',
    template: '%s | Zenqar',
  },
  description: 'Zenqar is a modern, multilingual bookkeeping and invoicing platform for Iraqi and Kurdish businesses.',
  metadataBase: new URL('https://zenqar.com'),
};

export default async function LocaleLayout({ 
  children,
  params
}: { 
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
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
        <main className="relative z-10">
          {children}
        </main>
      </div>
    </NextIntlClientProvider>
  );
}
