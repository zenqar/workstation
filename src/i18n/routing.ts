import { defineRouting } from 'next-intl/routing';

export const locales = ['en', 'ar', 'ku'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  localePrefix: 'always', // All routes will include the locale prefix for consistency
  localeDetection: true,
});
