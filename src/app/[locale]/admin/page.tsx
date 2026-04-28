import { getTranslations } from 'next-intl/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shield, Users, Building2, Activity, Key, ChevronRight } from 'lucide-react';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

export default async function AdminDashboard(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const t = await getTranslations();
  const supabase = await createAdminClient();

  // Get total users
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  const totalUsers = usersError ? 0 : (users?.users.length || 0);

  // Get businesses
  const { data: businesses, count: businessCount } = await supabase
    .from('businesses')
    .select('id, name, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(5);

  // Get recent invoices as activity
  const { data: recentInvoices } = await supabase
    .from('invoices')
    .select('id, total, currency, created_at, business:business_id(name)')
    .order('created_at', { ascending: false })
    .limit(5);

  // Get businesses pending verification
  const { data: pendingBusinesses } = await supabase
    .from('businesses')
    .select('id, name, legal_name, tax_id_number, business_registration_number, industry, website, created_at')
    .eq('verification_status', 'pending')
    .order('created_at', { ascending: false });

  // Get duplicate business names
  const { data: allBusinesses } = await supabase.from('businesses').select('id, name, created_at');
  const nameCounts = allBusinesses?.reduce((acc, b) => {
    const n = b.name.toLowerCase();
    acc[n] = (acc[n] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  
  const duplicateNames = Object.keys(nameCounts).filter(n => nameCounts[n] > 1);
  const flaggedBusinesses = allBusinesses?.filter(b => duplicateNames.includes(b.name.toLowerCase()));

  return (
    <div className="space-y-8 animate-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2 flex items-center gap-3">
          <Shield className="w-8 h-8 text-zenqar-400" />
          Platform Admin
        </h1>
        <p className="text-white/50 text-sm">Monitor platform activity, users, and businesses.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
        <div className="glass-card p-6 relative overflow-hidden group">
          <div className="mouse-light"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/50">Total Users</p>
              <h3 className="text-2xl font-bold text-white tabular-nums">{totalUsers}</h3>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 relative overflow-hidden group">
          <div className="mouse-light"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/50">Total Businesses</p>
              <h3 className="text-2xl font-bold text-white tabular-nums">{businessCount || 0}</h3>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 relative overflow-hidden group">
          <div className="mouse-light"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-xl text-green-400 border border-green-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/50">System Status</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="status-dot live"></span>
                <span className="text-sm font-medium text-green-400">Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-children">
        <div className="glass-card p-6 relative overflow-hidden flex flex-col h-full">
          <div className="mouse-light"></div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Recent Users</h2>
            <Link href={`/${locale}/admin/users`} className="text-xs text-zenqar-400 hover:underline">View All Users</Link>
          </div>
          <div className="space-y-4 flex-1">
            {(!usersError ? users?.users.slice(0, 5) : [])?.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                <div>
                  <p className="text-sm font-medium text-white">{u.email}</p>
                  <p className="text-xs text-white/40 font-mono mt-0.5">{u.id.substring(0, 12)}...</p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={async () => {
                    'use server';
                    const admin = await createAdminClient();
                    const { getAppUrl } = await import('@/lib/env/server');
                    const appUrl = await getAppUrl();
                    await admin.auth.admin.generateLink({
                      type: 'recovery',
                      email: u.email!,
                      options: { redirectTo: `${appUrl}/${locale}/auth/callback?next=/${locale}/reset-password` },
                    });
                  }}>
                    <button type="submit" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors" title="Reset Password">
                      <Key className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 relative overflow-hidden flex flex-col h-full">
          <div className="mouse-light"></div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Platform Activity</h2>
            <Link href={`/${locale}/admin/businesses`} className="text-xs text-zenqar-400 hover:underline">View All Businesses</Link>
          </div>
          <div className="space-y-4 flex-1">
            {recentInvoices?.map((inv: any) => (
              <Link href={`/${locale}/admin/businesses/${inv.business_id}`} key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/20 group-hover:text-zenqar-400 transition-colors">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{inv.business?.name}</p>
                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest mt-0.5">New Invoice • {new Date(inv.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white tabular-nums">
                    {Number(inv.total ?? 0).toLocaleString()} {inv.currency}
                  </p>
                  <ChevronRight className="w-4 h-4 text-white/10 ml-auto mt-1" />
                </div>
              </Link>
            ))}
            {(!recentInvoices || recentInvoices.length === 0) && (
              <div className="h-full flex items-center justify-center py-8">
                <p className="text-white/20 italic text-sm">No recent activity detected</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 stagger-children">
        {/* Verification Requests */}
        {pendingBusinesses && pendingBusinesses.length > 0 && (
          <div className="glass-card p-6 relative overflow-hidden border-yellow-500/20">
            <div className="mouse-light"></div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-yellow-400" />
                <h2 className="text-lg font-semibold text-white">Pending KYC Verifications ({pendingBusinesses.length})</h2>
              </div>
            </div>
            <div className="space-y-4">
              {pendingBusinesses.map((b: any) => (
                <div key={b.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 gap-4 group hover:bg-white/[0.08] transition-all">
                  <Link href={`/${locale}/admin/businesses/${b.id}`} className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white group-hover:text-zenqar-400 transition-colors">{b.legal_name || b.name}</p>
                      <ChevronRight className="w-3 h-3 text-white/20" />
                    </div>
                    <div className="text-[10px] text-white/40 space-y-0.5 uppercase font-bold tracking-widest">
                      <p>Tax ID: {b.tax_id_number} • Industry: {b.industry}</p>
                    </div>
                  </Link>
                  <div className="flex gap-2">
                    <form 
                      action={async () => {
                        'use server';
                        const admin = await createAdminClient();
                        await admin.from('businesses').update({ verification_status: 'verified' }).eq('id', b.id);
                        revalidatePath(`/${locale}/admin`);
                      }}>
                      <button type="submit" className="btn-primary bg-emerald-500 hover:bg-emerald-600 text-xs px-3 py-1.5 border-none">
                        Approve
                      </button>
                    </form>
                    <form 
                      action={async () => {
                        'use server';
                        const admin = await createAdminClient();
                        await admin.from('businesses').update({ 
                          verification_status: 'rejected',
                          verification_notes: 'Missing or invalid documentation. Please review your details and resubmit.'
                        }).eq('id', b.id);
                        revalidatePath(`/${locale}/admin`);
                      }}>
                      <button type="submit" className="btn-secondary text-red-400 hover:bg-red-500/10 border-red-500/20 text-xs px-3 py-1.5">
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Flagged Businesses */}
        {flaggedBusinesses && flaggedBusinesses.length > 0 && (
          <div className="glass-card p-6 relative overflow-hidden border-orange-500/30">
            <div className="mouse-light"></div>
            <div className="flex items-center gap-3 mb-6">
              <Activity className="w-5 h-5 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">Flagged Businesses (Duplicate Names)</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {flaggedBusinesses.map((b: any) => (
                <Link href={`/${locale}/admin/businesses/${b.id}`} key={b.id} className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-colors">
                  <p className="text-sm font-bold text-orange-400">{b.name}</p>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-[10px] text-orange-400/60 uppercase font-bold tabular-nums">ID: {b.id.substring(0, 8)}</p>
                    <ChevronRight className="w-3 h-3 text-orange-400/40" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
