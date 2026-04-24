/**
 * Locale Utility Helpers
 */

export const locales = ['en', 'ar', 'ku'];
export const defaultLocale = 'en';

/**
 * Prepends the locale to a path if it's not the default or if localePrefix is 'always'.
 * Zenqar uses locale-based paths for all routes.
 */
export function getLocalizedPath(locale: string, path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // If the path already starts with the locale, don't prepend it again
  for (const l of locales) {
    if (cleanPath.startsWith(`/${l}/`) || cleanPath === `/${l}`) {
      return cleanPath;
    }
  }

  return `/${locale}${cleanPath}`;
}
