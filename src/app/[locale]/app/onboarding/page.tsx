import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getLocalizedPath } from '@/lib/utils/locale';
import { Building2, ArrowRight, CheckCircle, LogOut, AlertCircle } from 'lucide-react';
import { signOut } from '@/lib/actions/auth';

export default async function OnboardingPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(getLocalizedPath(locale, '/login'));
  }

  // If the user already has an active business, go straight to dashboard
  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (memberships && memberships.length > 0) {
    redirect(getLocalizedPath(locale, '/app/dashboard'));
  }

  const pendingBusinessName = user.user_metadata?.pending_business_name as string | undefined;
  const errorMessage = searchParams.error === 'create-failed'
    ? 'Failed to create business. Please try again.'
    : searchParams.error === 'name-required'
    ? 'Business name is required.'
    : null;

  // Server action — pass locale via hidden form field to avoid getLocale() inside action
  async function createBusiness(formData: FormData) {
    'use server';
    const name = (formData.get('businessName') as string)?.trim();
    const actionLocale = (formData.get('locale') as string) || 'en';

    if (!name || name.length < 2) {
      redirect(getLocalizedPath(actionLocale, '/app/onboarding?error=name-required'));
    }

    const innerSupabase = await createClient();
    const { data: { user: innerUser } } = await innerSupabase.auth.getUser();

    if (!innerUser) {
      redirect(getLocalizedPath(actionLocale, '/login'));
    }

    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const admin = await createAdminClient();

      const { data: business, error: bizError } = await admin
        .from('businesses')
        .insert({ name, created_by: innerUser.id })
        .select()
        .single();

      if (bizError || !business) {
        console.error('[Onboarding] Business insert error:', bizError);
        redirect(getLocalizedPath(actionLocale, '/app/onboarding?error=create-failed'));
      }

      const { error: memError } = await admin.from('business_memberships').insert({
        business_id: business.id,
        user_id:     innerUser.id,
        role:        'owner',
        status:      'active',
      });

      if (memError) {
        console.error('[Onboarding] Membership insert error:', memError);
        redirect(getLocalizedPath(actionLocale, '/app/onboarding?error=create-failed'));
      }
    } catch (e) {
      console.error('[Onboarding] Unexpected error:', e);
      redirect(getLocalizedPath(actionLocale, '/app/onboarding?error=create-failed'));
    }

    redirect(getLocalizedPath(actionLocale, '/app/dashboard'));
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-dark-bg relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-zenqar-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Sign out button — top right */}
      <div className="absolute top-6 right-6 z-20">
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white/80 transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
            title="Sign out and use a different account"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </form>
      </div>

      <div className="w-full max-w-md relative z-10 animate-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary-gradient flex items-center justify-center shadow-glow mx-auto mb-5">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Set Up Your Business</h1>
          <p className="text-white/50 mt-2 text-sm leading-relaxed">
            Signed in as{' '}
            <span className="text-white/80 font-medium">{user.email}</span>
          </p>
          <p className="text-white/30 mt-1 text-xs">
            Create your workspace — you can invite your team later.
          </p>
        </div>

        {/* Feature list */}
        <div className="flex flex-col gap-2 mb-6">
          {[
            'Create & send invoices in IQD or USD',
            'Track expenses and payments',
            'Manage contacts and accounts',
          ].map((f) => (
            <div key={f} className="flex items-center gap-3 text-sm text-white/50">
              <CheckCircle className="w-4 h-4 text-zenqar-400 flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <div className="glass-card p-8">
          <form action={createBusiness} className="space-y-5">
            {/* Pass locale via form so server action doesn't need getLocale() */}
            <input type="hidden" name="locale" value={locale} />

            <div className="space-y-2">
              <label htmlFor="businessName" className="text-sm font-medium text-white/70 ml-1">
                Business Name <span className="text-red-400">*</span>
              </label>
              <input
                id="businessName"
                name="businessName"
                type="text"
                required
                minLength={2}
                maxLength={100}
                defaultValue={pendingBusinessName || ''}
                placeholder="e.g. Zenqar Tech Solutions"
                className="input-glass"
                autoFocus
              />
              <p className="text-xs text-white/30 ml-1">
                You can update this anytime in Settings.
              </p>
            </div>

            <button type="submit" className="btn-primary w-full group">
              Create My Workspace
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-white/25 mt-6">
          Wrong account?{' '}
          <form action={signOut} className="inline">
            <button type="submit" className="text-zenqar-400 hover:underline bg-transparent border-0 cursor-pointer text-xs">
              Sign out
            </button>
          </form>
          {' '}and use a different one.
        </p>
      </div>
    </div>
  );
}
