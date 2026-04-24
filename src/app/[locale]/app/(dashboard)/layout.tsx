import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserBusinesses } from '@/lib/actions/businesses';
import AppShell from '@/components/layout/AppShell';
import { getLocale } from 'next-intl/server';
import { getLocalizedPath } from '@/lib/utils/locale';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(getLocalizedPath(locale, '/login'));

  const businesses = await getUserBusinesses();

  // If user has no businesses, redirect to onboarding
  if (!businesses || businesses.length === 0) {
    redirect(getLocalizedPath(locale, '/app/onboarding?error=no-businesses-found'));
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <AppShell
      user={user}
      profile={profile}
      businesses={businesses as any}
    >
      {children}
    </AppShell>
  );
}
