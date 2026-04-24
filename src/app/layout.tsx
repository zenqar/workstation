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
  // The true root shell of the application
  return (
    <html className={`${inter.variable} ${notoKufi.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
