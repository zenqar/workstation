import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserBusinesses } from '@/lib/actions/businesses';
import AppShell from '@/components/layout/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const businesses = await getUserBusinesses();

  // If user has no businesses, redirect to create one
  if (!businesses || businesses.length === 0) {
    redirect('/signup');
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
