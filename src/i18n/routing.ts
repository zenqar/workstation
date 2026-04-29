import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const locales = ['en', 'ar', 'ku', 'et'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  localePrefix: 'always', // All routes will include the locale prefix for consistency
  localeDetection: true,
});

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
