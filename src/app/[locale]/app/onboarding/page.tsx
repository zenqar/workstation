import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getLocalizedPath } from '@/lib/utils/locale';
import { Building2, ArrowRight, CheckCircle } from 'lucide-react';

export default async function OnboardingPage() {
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(getLocalizedPath(locale, '/login'));
  }

  // If the user already has an active business, send them to the dashboard
  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (memberships && memberships.length > 0) {
    redirect(getLocalizedPath(locale, '/app/dashboard'));
  }

  // Pull the pending business name from user metadata if set during signup
  const pendingBusinessName = user.user_metadata?.pending_business_name as string | undefined;

  async function createBusiness(formData: FormData) {
    'use server';
    const name = (formData.get('businessName') as string)?.trim();
    const innerLocale = await getLocale();
    const innerSupabase = await createClient();
    const { data: { user: innerUser } } = await innerSupabase.auth.getUser();

    if (!innerUser || !name) {
      redirect(getLocalizedPath(innerLocale, '/app/onboarding'));
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = await createAdminClient();

    const { data: business, error: bizError } = await admin
      .from('businesses')
      .insert({ name, created_by: innerUser!.id })
      .select()
      .single();

    if (bizError || !business) {
      console.error('[Onboarding] Failed to create business:', bizError);
      redirect(getLocalizedPath(innerLocale, '/app/onboarding?error=create-failed'));
    }

    const { error: memError } = await admin.from('business_memberships').insert({
      business_id: business.id,
      user_id:     innerUser!.id,
      role:        'owner',
      status:      'active',
    });

    if (memError) {
      console.error('[Onboarding] Failed to create membership:', memError);
    }

    redirect(getLocalizedPath(innerLocale, '/app/dashboard'));
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-dark-bg relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-zenqar-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-primary-gradient flex items-center justify-center shadow-glow mx-auto mb-6">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Set Up Your Business</h1>
          <p className="text-white/50 mt-2 text-sm leading-relaxed">
            Welcome to Zenqar! You are logged in as <span className="text-white/80">{user.email}</span>.
            <br />
            Create your business workspace to get started.
          </p>
        </div>

        {/* Feature list */}
        <div className="flex flex-col gap-2 mb-6">
          {['Invoicing & payments', 'Contacts & accounts', 'Expenses & bookkeeping'].map((f) => (
            <div key={f} className="flex items-center gap-3 text-sm text-white/60">
              <CheckCircle className="w-4 h-4 text-zenqar-400 flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="glass-card p-8">
          <form action={createBusiness} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70 ml-1">Business Name</label>
              <input
                name="businessName"
                type="text"
                required
                minLength={2}
                defaultValue={pendingBusinessName || ''}
                placeholder="e.g. Zenqar Tech Solutions"
                className="input-glass"
                autoFocus
              />
              <p className="text-xs text-white/30 ml-1">You can change this later in settings.</p>
            </div>

            <button type="submit" className="btn-primary w-full group">
              Create Workspace
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          Already have a business?{' '}
          <a href={getLocalizedPath(locale, '/login')} className="text-zenqar-400 hover:underline">
            Sign in with a different account
          </a>
        </p>
      </div>
    </div>
  );
}
