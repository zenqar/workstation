import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/routing';

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.map(locale => ({
    url: `https://zenqar.com/${locale}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: locale === 'en' ? 1 : 0.9,
    alternates: { languages: Object.fromEntries(locales.map(code => [code, `https://zenqar.com/${code}`])) },
  }));
}
