import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { getLocalizedPath } from '@/lib/utils/locale';

export default async function AppPage() {
  const locale = await getLocale();
  redirect(getLocalizedPath(locale, '/app/dashboard'));
}
