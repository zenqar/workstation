import type { Metadata } from 'next';
import LandingClient from './LandingClient';
import { locales } from '@/i18n/routing';
import { getLandingSeo } from '@/lib/seo/landing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const canonicalLocale = locales.includes(locale as (typeof locales)[number]) ? locale : 'en';
  const seo = getLandingSeo(canonicalLocale);

  return {
    title: { absolute: seo.title },
    description: seo.description,
    keywords: seo.keywords,
    alternates: {
      canonical: `/${canonicalLocale}`,
      languages: Object.fromEntries(locales.map((code) => [code, `/${code}`])),
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: `/${canonicalLocale}`,
      siteName: 'Zenqar',
      locale: canonicalLocale,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    category: 'business',
  };
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const seo = getLandingSeo(locale);
  const structuredData = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Zenqar',
    url: `https://zenqar.com/${locale}`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
    description: seo.description,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: seo.features,
    contributor: { '@type': 'Person', name: 'Robin-Kevin Vettik', jobTitle: 'Lead Engineer, AI Document Scanning', affiliation: [{ '@type': 'Organization', name: 'Robillionair', url: 'https://robillionair.com' }, { '@type': 'Organization', name: 'Xelvon AI Models' }] },
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} /><LandingClient /></>;
}
