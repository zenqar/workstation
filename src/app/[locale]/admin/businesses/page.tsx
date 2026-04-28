import { createAdminClient } from '@/lib/supabase/admin';
import { Building2, Search, AlertCircle, ShieldCheck, Clock, Activity } from 'lucide-react';
import { redirect } from 'next/navigation';
import { cn } from '@/lib/utils';

export default async function AdminBusinessesPage(props: { searchParams: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  const query = searchParams.q || '';
  const admin = await createAdminClient();

  let dbQuery = admin.from('businesses').select('*').order('created_at', { ascending: false });
  if (query) {
    dbQuery = dbQuery.or(`name.ilike.%${query}%,legal_name.ilike.%${query}%,id.eq.${query}`);
  }

  const { data: businesses, error } = await dbQuery;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-zenqar-400" />
            Business Ecosystem
          </h1>
          <p className="text-white/50 text-sm mt-1">Manage and audit all platform businesses.</p>
        </div>
        <form className="relative" action="/en/admin/businesses">
          <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="search" 
            name="q"
            defaultValue={query}
            placeholder="Search name or ID..." 
            className="input-glass pl-9 w-full md:w-64"
          />
        </form>
      </div>

      {error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          Failed to load businesses.
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-6 py-4 font-semibold text-white/60">Business Info</th>
                  <th className="px-6 py-4 font-semibold text-white/60">Verification Status</th>
                  <th className="px-6 py-4 font-semibold text-white/60">Location</th>
                  <th className="px-6 py-4 font-semibold text-white/60">Created At</th>
                  <th className="px-6 py-4 font-semibold text-white/60 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(!businesses || businesses.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-white/40">
                      No businesses found.
                    </td>
                  </tr>
                ) : (
                  businesses.map((b) => (
                    <tr key={b.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white">{b.name}</div>
                        {b.legal_name && <div className="text-xs text-white/50 mt-1">{b.legal_name}</div>}
                        <div className="text-xs text-white/30 font-mono mt-1">ID: {b.id.substring(0,8)}...</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border flex items-center w-max gap-1",
                          b.verification_status === 'verified' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                          b.verification_status === 'pending' && "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
                          b.verification_status === 'rejected' && "bg-red-500/10 text-red-400 border-red-500/20",
                          b.verification_status === 'unverified' && "bg-white/5 text-white/40 border-white/10"
                        )}>
                          {b.verification_status === 'verified' && <ShieldCheck className="w-3 h-3" />}
                          {b.verification_status === 'pending' && <Clock className="w-3 h-3" />}
                          {b.verification_status === 'unverified' && <Activity className="w-3 h-3" />}
                          {b.verification_status || 'unverified'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-white/70">
                        {b.city ? `${b.city}, ${b.country}` : b.country}
                      </td>
                      <td className="px-6 py-4 text-white/70">
                        {new Date(b.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <form action={async () => {
                            'use server';
                            const client = await createAdminClient();
                            await client.from('businesses').delete().eq('id', b.id);
                            redirect('/en/admin/businesses');
                          }}>
                            <button type="submit" className="btn-secondary text-red-400 hover:bg-red-500/10 border-red-500/20 text-xs px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              Delete Network
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
