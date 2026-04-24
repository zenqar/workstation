import { getTranslations } from 'next-intl/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Shield, Users, Building2, Activity, Key, ChevronRight } from 'lucide-react';
import { redirect } from 'next/navigation';

export default async function AdminDashboard() {
  const t = await getTranslations();
  const supabase = await createAdminClient();

  // Get total users
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  const totalUsers = users?.users.length || 0;

  // Get businesses
  const { data: businesses, count: businessCount } = await supabase
    .from('businesses')
    .select('id, name, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(5);

  // Get recent invoices as activity
  const { data: recentInvoices } = await supabase
    .from('invoices')
    .select('id, amount, currency, created_at, business:business_id(name)')
    .order('created_at', { ascending: false })
    .limit(5);

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
        <div className="glass-card p-6 relative overflow-hidden">
          <div className="mouse-light"></div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Recent Users</h2>
          </div>
          <div className="space-y-4">
            {users?.users.slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                <div>
                  <p className="text-sm font-medium text-white">{u.email}</p>
                  <p className="text-xs text-white/40">Last Sign In: {new Date(u.last_sign_in_at || u.created_at).toLocaleDateString()}</p>
                </div>
                <form action={async () => {
                  'use server';
                  const admin = await createAdminClient();
                  await admin.auth.admin.generateLink({
                    type: 'recovery',
                    email: u.email!,
                  });
                  // In a real app, we'd send an email here or show the link
                }}>
                  <button className="btn-secondary text-xs px-3 py-1.5" title="Send Password Reset">
                    <Key className="w-3 h-3" /> Reset
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 relative overflow-hidden">
          <div className="mouse-light"></div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Recent Invoices</h2>
          </div>
          <div className="space-y-4">
            {recentInvoices?.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div>
                  <p className="text-sm font-medium text-white">{inv.business?.name}</p>
                  <p className="text-xs text-white/40">{new Date(inv.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white tabular-nums">
                    {inv.amount.toLocaleString()} {inv.currency}
                  </p>
                </div>
              </div>
            ))}
            {(!recentInvoices || recentInvoices.length === 0) && (
              <div className="empty-state py-8">
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
