import { createAdminClient } from '@/lib/supabase/admin';
import { Users, Search, AlertCircle, Key, MessageSquare } from 'lucide-react';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AdminUsersPage(props: { params: Promise<{ locale: string }>, searchParams: Promise<{ q?: string }> }) {
  const { locale } = await props.params;
  const searchParams = await props.searchParams;
  const query = searchParams.q || '';
  const admin = await createAdminClient();

  const { data: usersData, error } = await admin.auth.admin.listUsers();
  
  let filteredUsers = usersData?.users || [];
  if (query) {
    const qLower = query.toLowerCase();
    filteredUsers = filteredUsers.filter(u => 
      u.email?.toLowerCase().includes(qLower) || 
      u.phone?.toLowerCase().includes(qLower) ||
      (u.id && u.id.toLowerCase().includes(qLower))
    );
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-zenqar-400" />
            User Management
          </h1>
          <p className="text-white/50 text-sm mt-1">View, search, and manage platform users.</p>
        </div>
        <form className="relative" action={`/${locale}/admin/users`}>
          <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="search" 
            name="q"
            defaultValue={query}
            placeholder="Search email or ID..." 
            className="input-glass pl-9 w-full md:w-64"
          />
        </form>
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          Failed to load users. Ensure your Admin Secret is valid.
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-6 py-4 font-semibold text-white/60">User / Email</th>
                  <th className="px-6 py-4 font-semibold text-white/60">Joined</th>
                  <th className="px-6 py-4 font-semibold text-white/60">Last Sign In</th>
                  <th className="px-6 py-4 font-semibold text-white/60 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-white/40">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <Link href={`/${locale}/admin/users/${u.id}`} className="group/link">
                          <div className="font-medium text-white group-hover/link:text-zenqar-400 transition-colors">{u.email || 'No email'}</div>
                          <div className="text-xs text-white/40 mt-1 font-mono">{u.id}</div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-white/70">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-white/70">
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/${locale}/admin/users/${u.id}`} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-zenqar-400 transition-all shadow-glow-sm" title="Message User">
                            <MessageSquare className="w-4 h-4" />
                          </Link>
                          <Link href={`/${locale}/admin/users/${u.id}`} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all shadow-glow-sm" title="User Settings">
                            <Search className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  );
}
