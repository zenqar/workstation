import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SettingsClient from './SettingsClient';
import { getBusinessContext, getTeamMembers } from '@/lib/actions/businesses';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) redirect('/signup');

  const defaultBusinessId = memberships[0].business_id;
  const businessContext = await getBusinessContext(defaultBusinessId);
  const teamMembers = await getTeamMembers(defaultBusinessId);

  return (
    <SettingsClient 
      defaultBusinessId={defaultBusinessId}
      initialContext={businessContext}
      initialTeam={teamMembers}
      user={user}
      profile={profile}
    />
  );
}
