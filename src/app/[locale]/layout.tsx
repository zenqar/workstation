import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Noto_Kufi_Arabic } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import '../globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoKufi = Noto_Kufi_Arabic({
  subsets: ['arabic'],
  variable: '--font-noto-kufi',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Zenqar — Smart Invoicing & Bookkeeping',
    template: '%s | Zenqar',
  },
  description: 'Zenqar is a modern, multilingual bookkeeping and invoicing platform for Iraqi and Kurdish businesses. Manage invoices, track payments, and monitor your cash flow.',
  keywords: ['invoicing', 'bookkeeping', 'Iraq', 'Kurdistan', 'IQD', 'accounting', 'Zenqar'],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL.startsWith('http')
        ? process.env.NEXT_PUBLIC_APP_URL
        : `https://${process.env.NEXT_PUBLIC_APP_URL}`
      : 'https://zenqar.com'
  ),
  openGraph: {
    type: 'website',
    siteName: 'Zenqar',
    title: 'Zenqar — Smart Invoicing & Bookkeeping',
    description: 'Modern invoicing and bookkeeping for Iraqi businesses.',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  // RTL for Arabic and Kurdish (Sorani)
  const isRtl = ['ar', 'ku'].includes(locale);

  return (
    <html
      lang={locale}
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`${inter.variable} ${notoKufi.variable}`}
    >
      <body>
        <div className="vignette" aria-hidden="true" />
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
