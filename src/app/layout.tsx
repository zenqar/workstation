import './globals.css';
import { Inter, Noto_Kufi_Arabic } from 'next/font/google';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // This is the true root shell. 
  // Locale-specific attributes (lang, dir) will be managed in [locale]/layout.tsx 
  // by wrapping in a div or using a client-side effect if needed, 
  // but for SEO and hydration, we'll keep it simple here.
  return (
    <html className={`${inter.variable} ${notoKufi.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
