import { getLocale, getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getLocalizedPath } from '@/lib/utils/locale';
import { Building2, ArrowRight } from 'lucide-react';

export default async function OnboardingPage() {
  const locale = await getLocale();
  const t = await getTranslations('onboarding');
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(getLocalizedPath(locale, '/login'));
  }

  // Double check if they already have a business
  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (memberships && memberships.length > 0) {
    redirect(getLocalizedPath(locale, '/app/dashboard'));
  }

  async function createBusiness(formData: FormData) {
    'use server';
    const name = formData.get('businessName') as string;
    const locale = await getLocale();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !name) return;

    // Use admin client for bypass RLS on initial business creation if needed, 
    // or just rely on public insert if RLS allows it for authenticated users.
    // Given our previous setup, we use admin for the first business.
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = await createAdminClient();

    const { data: business, error: bizError } = await admin
      .from('businesses')
      .insert({ name, created_by: user.id })
      .select()
      .single();

    if (bizError || !business) {
      console.error('Onboarding Error:', bizError);
      return;
    }

    await admin.from('business_memberships').insert({
      business_id: business.id,
      user_id: user.id,
      role: 'owner',
      status: 'active'
    });

    redirect(getLocalizedPath(locale, '/app/dashboard'));
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-dark-bg relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-zenqar-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-600/10 blur-[100px] rounded-full" />

      <div className="w-full max-w-md relative z-10 animate-in">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-primary-gradient flex items-center justify-center shadow-glow mx-auto mb-6">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Create your Business</h1>
          <p className="text-white/50 mt-2">Let&apos;s set up your workspace to get started with Zenqar.</p>
        </div>

        <div className="glass-card p-8">
          <form action={createBusiness} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70 ml-1">Business Name</label>
              <input
                name="businessName"
                type="text"
                required
                defaultValue={user.user_metadata?.pending_business_name || ''}
                placeholder="e.g. Zenqar Tech Solutions"
                className="input-glass"
              />
            </div>

            <button type="submit" className="btn-primary w-full group">
              Get Started
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
