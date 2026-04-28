import { createAdminClient } from '@/lib/supabase/admin';
import { 
  Users, 
  Building2, 
  MessageSquare, 
  ArrowLeft, 
  Send,
  Trash2,
  Key,
  ShieldCheck,
  Activity,
  FileText,
  CreditCard,
  History,
  ExternalLink,
  Search,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cn } from '@/lib/utils';
import { sendAdminUserMessage } from '../actions';

const IQD_RATE = 1500; // Fallback rate

export default async function UserWatchdogPage(props: { params: Promise<{ id: string, locale: string }> }) {
  const { id, locale } = await props.params;
  const admin = await createAdminClient();

  // 1. Fetch Basic User Data
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(id);
  const user = userData?.user;
  if (userError || !user) notFound();

  // 2. Fetch User's Business Ecosystem
  const { data: memberships } = await admin
    .from('business_memberships')
    .select('*, businesses(*)')
    .eq('user_id', id);

  // 3. Fetch Aggregate Data across all businesses
  const businessIds = memberships?.map(m => m.business_id) || [];
  
  const [
    { data: invoices },
    { data: accounts },
    { data: auditLogs },
    { data: b2bMessages },
    { data: supportMessages }
  ] = await Promise.all([
    admin.from('invoices').select('*, businesses(name)').in('business_id', businessIds),
    admin.from('accounts').select('*').in('business_id', businessIds),
    admin.from('audit_logs').select('*, businesses(name)').eq('actor_user_id', id).order('created_at', { ascending: false }).limit(20),
    admin.from('messages').select('*, sender:sender_id(email), receiver:receiver_id(email)').or(`sender_id.eq.${id},receiver_id.eq.${id}`).order('created_at', { ascending: false }).limit(20),
    admin.from('support_messages').select('*').eq('recipient_user_id', id).order('created_at', { ascending: true })
  ]);

  // 4. Calculations
  const statsByBusiness = memberships?.map(m => {
    const bizInvoices = invoices?.filter(inv => inv.business_id === m.business_id) || [];
    const bizAccounts = accounts?.filter(acc => acc.business_id === m.business_id) || [];
    
    const iqdTotal = bizInvoices.reduce((sum, inv) => sum + (inv.currency === 'IQD' ? Number(inv.total) : Number(inv.total) * IQD_RATE), 0);
    const usdTotal = bizInvoices.reduce((sum, inv) => sum + (inv.currency === 'USD' ? Number(inv.total) : Number(inv.total) / IQD_RATE), 0);
    
    const iqdBalance = bizAccounts.reduce((sum, acc) => sum + (acc.currency === 'IQD' ? Number(acc.balance) : Number(acc.balance) * IQD_RATE), 0);
    const usdBalance = bizAccounts.reduce((sum, acc) => sum + (acc.currency === 'USD' ? Number(acc.balance) : Number(acc.balance) / IQD_RATE), 0);

    return {
      business: m.businesses,
      role: m.role,
      invoiceCount: bizInvoices.length,
      iqdInvoiced: iqdTotal,
      usdInvoiced: usdTotal,
      iqdBalance: iqdBalance,
      usdBalance: usdBalance
    };
  }) || [];

  const totalIqdBalance = statsByBusiness.reduce((sum, s) => sum + s.iqdBalance, 0);
  const totalUsdBalance = statsByBusiness.reduce((sum, s) => sum + s.usdBalance, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link 
            href={`/${locale}/admin/users`}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{user.email}</h1>
              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20">Watchdog Mode</span>
            </div>
            <p className="text-white/40 text-xs font-mono mt-1">UUID: {user.id}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">Combined IQD Balance</p>
            <p className="text-lg font-bold text-white tabular-nums">{totalIqdBalance.toLocaleString()} IQD</p>
          </div>
          <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">Combined USD Balance</p>
            <p className="text-lg font-bold text-emerald-400 tabular-nums">${totalUsdBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: User Info & Quick Actions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-sm font-black text-white/40 uppercase tracking-widest">Account Overview</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg text-white/40">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase font-bold">Member Since</p>
                  <p className="text-xs text-white font-medium">{new Date(user.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg text-white/40">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase font-bold">Last Active</p>
                  <p className="text-xs text-white font-medium">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg text-white/40">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-white/30 uppercase font-bold">Active Networks</p>
                  <p className="text-xs text-white font-medium">{memberships?.length || 0} Businesses</p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 space-y-3">
            <h2 className="text-sm font-black text-white/40 uppercase tracking-widest mb-2">Platform Controls</h2>
            <form action={async () => {
              'use server';
              const admin = await createAdminClient();
              const { getAppUrl } = await import('@/lib/env/server');
              const appUrl = await getAppUrl();
              await admin.auth.admin.generateLink({
                type: 'recovery',
                email: user.email!,
                options: { redirectTo: `${appUrl}/${locale}/auth/callback?next=/${locale}/reset-password` },
              });
            }}>
              <button type="submit" className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-xs font-bold text-white group">
                Reset Password <Key className="w-4 h-4 text-white/20 group-hover:text-zenqar-400" />
              </button>
            </form>
            
            <button className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-xs font-bold text-white group">
              Manage Roles <ShieldCheck className="w-4 h-4 text-white/20 group-hover:text-blue-400" />
            </button>
            
            <div className="pt-4 mt-4 border-t border-white/5">
              <button className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl border border-red-500/20 transition-all">
                Terminate Access
              </button>
            </div>
          </div>
        </div>

        {/* Main Watchdog Feed */}
        <div className="lg:col-span-3 space-y-6">
          {/* Business Breakdown */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Business Network Analysis</h2>
              <Building2 className="w-4 h-4 text-white/20" />
            </div>
            <div className="divide-y divide-white/5">
              {statsByBusiness.map((s) => (
                <div key={s.business.id} className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 hover:bg-white/[0.01] transition-colors">
                  <div className="md:col-span-1">
                    <Link href={`/${locale}/admin/businesses/${s.business.id}`} className="flex items-center gap-2 group">
                      <h3 className="font-bold text-white group-hover:text-zenqar-400 transition-colors">{s.business.name}</h3>
                      <ExternalLink className="w-3 h-3 text-white/20 group-hover:text-white" />
                    </Link>
                    <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mt-1">{s.role} • {s.business.industry}</p>
                    <div className={cn(
                      "mt-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest",
                      s.business.verification_status === 'verified' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-white/40 border-white/10"
                    )}>
                      {s.business.verification_status === 'verified' ? 'Verified' : 'Unverified'}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Invoiced Volume</p>
                    <p className="text-sm font-bold text-white tabular-nums">{s.iqdInvoiced.toLocaleString()} IQD</p>
                    <p className="text-[11px] text-white/40 tabular-nums">${s.usdInvoiced.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Wallet Balances</p>
                    <p className="text-sm font-bold text-emerald-400 tabular-nums">{s.iqdBalance.toLocaleString()} IQD</p>
                    <p className="text-[11px] text-emerald-400/50 tabular-nums">${s.usdBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD</p>
                  </div>

                  <div className="text-right flex flex-col justify-center">
                    <div className="text-xs text-white/50 font-bold">{s.invoiceCount} Invoices</div>
                    <Link href={`/${locale}/admin/businesses/${s.business.id}`} className="mt-2 text-[10px] text-zenqar-400 font-black uppercase tracking-widest hover:underline">Auditing Profile</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Audit Logs */}
            <div className="glass-card flex flex-col h-[500px]">
              <div className="p-4 border-b border-white/5 flex items-center gap-2 bg-white/[0.02]">
                <History className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Activity Audit</h2>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {auditLogs && auditLogs.length > 0 ? auditLogs.map(log => (
                  <div key={log.id} className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-start gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1" />
                    <div>
                      <p className="text-white/80"><span className="font-bold text-white">{log.action}</span> on {log.entity_type}</p>
                      <p className="text-[10px] text-white/30 mt-1">{log.businesses?.name} • {new Date(log.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                )) : (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                    <History className="w-12 h-12 mb-2" />
                    <p className="text-sm italic">No audit records found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Private Chats (Watchdog Mode) */}
            <div className="glass-card flex flex-col h-[500px]">
              <div className="p-4 border-b border-white/5 flex items-center gap-2 bg-white/[0.02]">
                <MessageSquare className="w-4 h-4 text-zenqar-400" />
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Intercepted Chats</h2>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                {b2bMessages && b2bMessages.length > 0 ? b2bMessages.map(msg => (
                  <div key={msg.id} className={cn(
                    "flex flex-col gap-1 max-w-[90%]",
                    msg.sender_id === id ? "ml-auto items-end" : "mr-auto items-start"
                  )}>
                    <div className={cn(
                      "p-2.5 rounded-xl text-xs",
                      msg.sender_id === id ? "bg-zenqar-600/10 text-white border border-zenqar-500/20" : "bg-white/5 text-white/70 border border-white/10"
                    )}>
                      {msg.content}
                    </div>
                    <span className="text-[9px] text-white/20 uppercase font-black tracking-widest">
                      {msg.sender_id === id ? 'User' : msg.sender?.email?.split('@')[0] || 'Peer'} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )) : (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                    <MessageSquare className="w-12 h-12 mb-2" />
                    <p className="text-sm italic">No peer-to-peer messages</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Admin Direct Support Channel */}
          <div className="glass-card p-6 border-blue-500/10 bg-blue-500/[0.02]">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-zenqar-400" />
              <h2 className="text-lg font-bold text-white">Direct Support Channel</h2>
              <span className="ml-auto text-[10px] font-black text-zenqar-400 uppercase tracking-widest">Encrypted Direct Link</span>
            </div>
            
            <div className="flex flex-col h-[300px]">
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2 custom-scrollbar">
                {supportMessages?.map(msg => (
                  <div key={msg.id} className={cn(
                    "max-w-[80%] p-3 rounded-2xl text-xs shadow-lg",
                    msg.sender_type === 'admin' 
                      ? "ml-auto bg-zenqar-600/20 text-white border border-zenqar-500/30 rounded-tr-none" 
                      : "mr-auto bg-white/5 text-white/80 border border-white/10 rounded-tl-none"
                  )}>
                    {msg.message}
                  </div>
                ))}
              </div>
              <form 
                action={async (formData) => {
                  'use server';
                  const message = formData.get('message') as string;
                  if (!message.trim()) return;
                  await sendAdminUserMessage(id, message);
                }}
                className="flex gap-2"
              >
                <input 
                  name="message"
                  type="text" 
                  placeholder="Send a secure message to this user..." 
                  className="input-glass flex-1 text-xs"
                  autoComplete="off"
                />
                <button type="submit" className="btn-primary py-2">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
