import { defineRouting } from 'next-intl/routing';

export const locales = ['en', 'ar', 'ku'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  localePrefix: 'as-needed', // /app/dashboard (en), /ar/app/dashboard (ar)
  localeDetection: true,
});
