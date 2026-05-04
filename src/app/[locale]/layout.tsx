import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import MouseGlowEffect from '@/components/MouseGlowEffect';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n/routing';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: {
    default: 'Zenqar — Free Accounting and Invoicing Software',
    template: '%s | Zenqar',
  },
  description: 'Zenqar is free accounting and invoicing software for modern businesses. Create invoices, track cash flow, manage reporting, and organize finance workflows in one elegant workspace.',
  keywords: 'free accounting software, free invoicing software, bookkeeping software, cash flow dashboard, reporting software, business finance platform',
  openGraph: {
    title: 'Zenqar — Free Accounting and Invoicing Software',
    description: 'Free accounting and invoicing software with a modern dashboard, glassmorphism interface, reporting, and cash flow visibility.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
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
  
  if (!locales.includes(locale as any)) {
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
        <main className="relative z-10">
          {children}
        </main>
      </div>
    </NextIntlClientProvider>
  );
}
