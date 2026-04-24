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
  if (!user) redirect(getLocalizedPath(locale, '/login'));

  // If the user already has a business, go straight to dashboard
  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (memberships && memberships.length > 0) {
    redirect(getLocalizedPath(locale, '/app/dashboard'));
  }

  const pendingBusinessName = user.user_metadata?.pending_business_name as string | undefined;

  const errorCode = searchParams.error;
  const errorMessage =
    errorCode === 'biz-failed'   ? 'Could not create your business. Please try again.' :
    errorCode === 'mem-failed'   ? 'Business created but membership setup failed. Please contact support.' :
    errorCode === 'name-required'? 'Please enter a business name.' :
    errorCode === 'auth-error'   ? 'Authentication error. Please sign out and sign in again.' :
    null;

  // Server action — uses the regular authenticated client.
  // The "memberships: self-owner bootstrap" RLS policy (migration 004) allows
  // an authenticated user to insert their first 'owner' membership.
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
      redirect(getLocalizedPath(actionLocale, '/login?error=auth-error'));
    }

    // Step 1 & 2: Atomically insert business and membership via RPC
    const { data: businessId, error: rpcError } = await innerSupabase
      .rpc('create_business_with_owner', { p_name: name });

    if (rpcError || !businessId) {
      console.error('[Onboarding] RPC failed:', JSON.stringify(rpcError));
      const errMsg = rpcError?.message ? encodeURIComponent(rpcError.message) : 'unknown';
      redirect(getLocalizedPath(actionLocale, `/app/onboarding?error=biz-failed&msg=${errMsg}`));
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
          <p className="text-white/50 mt-2 text-sm">
            Signed in as <span className="text-white/80 font-medium">{user.email}</span>
          </p>
          <p className="text-white/30 mt-1 text-xs">You can invite your team after setup.</p>
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

        {/* Error banner */}
        {errorMessage && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p>{errorMessage}</p>
              {errorCode === 'mem-failed' && (
                <p className="text-xs mt-1 text-red-400/70">
                  Error code: mem-failed — your business was created but membership setup failed.
                  Please sign out and sign back in.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <div className="glass-card p-8">
          <form action={createBusiness} className="space-y-5">
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
              <p className="text-xs text-white/30 ml-1">You can change this anytime in Settings.</p>
            </div>

            <button type="submit" className="btn-primary w-full group">
              Create My Workspace
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>
        </div>

        <div className="text-center text-xs text-white/25 mt-6">
          Wrong account?{' '}
          <form action={signOut} className="inline-flex">
            <button
              type="submit"
              className="text-zenqar-400 hover:underline bg-transparent border-0 cursor-pointer text-xs p-0 m-0 leading-none"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
