import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import MouseGlowEffect from '@/components/MouseGlowEffect';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n/routing';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const siteDescription = 'Free invoicing and bookkeeping software for small businesses. Track expenses, cash flow, payments, contacts, and reports in one secure workspace.';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const canonicalLocale = locales.includes(locale as (typeof locales)[number]) ? locale : 'en';
  return {
    metadataBase: new URL('https://zenqar.com'),
    title: { default: 'Zenqar — Free Invoicing and Bookkeeping Software', template: '%s | Zenqar' },
    description: siteDescription,
    applicationName: 'Zenqar',
    authors: [{ name: 'Zenqar Engineering' }, { name: 'Robin-Kevin Vettik' }],
    creator: 'Zenqar Engineering',
    publisher: 'Zenqar',
    keywords: ['free bookkeeping software', 'free invoicing software', 'expense tracking', 'cash flow dashboard', 'invoice scanner', 'small business accounting', 'IQD invoicing', 'USD invoicing'],
    alternates: { canonical: `/${canonicalLocale}`, languages: Object.fromEntries(locales.map(code => [code, `/${code}`])) },
    openGraph: { title: 'Zenqar — Free Invoicing and Bookkeeping Software', description: siteDescription, url: `/${canonicalLocale}`, siteName: 'Zenqar', locale: canonicalLocale, type: 'website', images: [{ url: '/zenqar-wordmark.png', width: 1200, height: 630, alt: 'Zenqar bookkeeping workspace' }] },
    twitter: { card: 'summary_large_image', title: 'Zenqar — Free Invoicing and Bookkeeping Software', description: siteDescription, images: ['/zenqar-wordmark.png'] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
    category: 'business',
  };
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
        <main className="relative z-10">
          {children}
        </main>
      </div>
    </NextIntlClientProvider>
  );
}
