import { createAdminClient } from '@/lib/supabase/admin';
import { 
  Building2, 
  Users, 
  FileText, 
  CreditCard, 
  ArrowLeft, 
  ShieldCheck, 
  Clock, 
  MessageSquare,
  Send,
  Trash2,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cn } from '@/lib/utils';
import DeleteBusinessButton from './DeleteBusinessButton';
import { sendAdminSupportMessage } from './actions';

export default async function BusinessDetailsPage(props: { params: Promise<{ id: string, locale: string }> }) {
  const { id, locale } = await props.params;
  const admin = await createAdminClient();

  // Fetch business data
  const [
    { data: business },
    { data: memberships },
    { data: invoices },
    { data: messages },
    { data: accounts }
  ] = await Promise.all([
    admin.from('businesses').select('*').eq('id', id).single(),
    admin.from('business_memberships').select('*, profiles(full_name, email)').eq('business_id', id),
    admin.from('invoices').select('id, total, status, currency'),
    admin.from('support_messages').select('*').eq('business_id', id).order('created_at', { ascending: true }),
    admin.from('accounts').select('id, name, currency, balance') // Balance might be computed or stored
  ]);

  if (!business) notFound();

  const totalInvoiced = invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0;
  const activeMembers = memberships?.filter(m => m.status === 'active').length || 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link 
          href={`/${locale}/admin/businesses`}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white tracking-tight">{business.name}</h1>
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border",
                business.verification_status === 'verified' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-white/40 border-white/10"
              )}>
                {business.verification_status || 'unverified'}
              </span>
              
              {business.verification_status !== 'verified' && (
                <form action={async () => {
                  'use server';
                  const admin = await createAdminClient();
                  await admin.from('businesses').update({ 
                    verification_status: 'verified',
                    verified_at: new Date().toISOString()
                  }).eq('id', id);
                  revalidatePath(`/admin/businesses/${id}`);
                }}>
                  <button type="submit" className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/30 transition-all">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verify Business
                  </button>
                </form>
              )}
            </div>
          </div>
          <p className="text-white/40 text-sm font-mono mt-1">{business.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-6 relative overflow-hidden group">
          <div className="mouse-light"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/50">Team Members</p>
              <h3 className="text-2xl font-bold text-white tabular-nums">{memberships?.length || 0}</h3>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 relative overflow-hidden group">
          <div className="mouse-light"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/50">Total Invoices</p>
              <h3 className="text-2xl font-bold text-white tabular-nums">{invoices?.length || 0}</h3>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 relative overflow-hidden group">
          <div className="mouse-light"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/50">Business Wallets</p>
              <h3 className="text-2xl font-bold text-white tabular-nums">{accounts?.length || 0}</h3>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 relative overflow-hidden group">
          <div className="mouse-light"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-400 border border-yellow-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/50">Registration</p>
              <h3 className="text-lg font-bold text-white truncate">{business.industry || 'N/A'}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Business Info & Chat */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 flex flex-col h-[500px]">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/5">
              <MessageSquare className="w-5 h-5 text-zenqar-400" />
              <h2 className="text-lg font-semibold text-white">Secure Support Channel</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
              {messages && messages.length > 0 ? (
                messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={cn(
                      "max-w-[80%] p-3 rounded-2xl text-sm",
                      msg.sender_type === 'admin' 
                        ? "ml-auto bg-zenqar-600/20 text-white border border-zenqar-500/30" 
                        : "mr-auto bg-white/5 text-white/80 border border-white/10"
                    )}
                  >
                    <p>{msg.message}</p>
                    <p className="text-[10px] opacity-40 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-white/30">
                  <MessageSquare className="w-12 h-12 mb-4 opacity-10" />
                  <p>No messages yet. Send a secure message to start a conversation with this business.</p>
                </div>
              )}
            </div>

            <form 
              action={async (formData) => {
                'use server';
                const message = formData.get('message') as string;
                if (!message.trim()) return;
                await sendAdminSupportMessage(id, message);
              }}
              className="flex gap-2"
            >
              <input 
                name="message"
                type="text" 
                placeholder="Type your message..." 
                className="input-glass flex-1"
                autoComplete="off"
              />
              <button type="submit" className="btn-primary">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Team Members</h2>
            <div className="space-y-3">
              {memberships?.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold uppercase">
                      {(m.profiles?.full_name || m.email || '?')[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{m.profiles?.full_name || 'Pending Invite'}</p>
                      <p className="text-xs text-white/40">{m.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zenqar-400 bg-zenqar-400/10 px-2 py-0.5 rounded border border-zenqar-400/20">
                      {m.role}
                    </span>
                    <p className="text-[10px] text-white/30 mt-1">{m.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Danger Zone & Extra Info */}
        <div className="space-y-6">
          <div className="glass-card p-6 border-red-500/20">
            <h2 className="text-lg font-semibold text-red-400 mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Danger Zone
            </h2>
            <p className="text-sm text-white/50 mb-6">
              Deleting a network is permanent. All wallets, transactions, and team access will be destroyed instantly.
            </p>
            <DeleteBusinessButton businessId={id} businessName={business.name} />
          </div>

          <div className="glass-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Platform Audit</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Created At</span>
                <span className="text-white/80">{new Date(business.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Default Currency</span>
                <span className="text-white/80 font-bold">{business.default_currency}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Legal Name</span>
                <span className="text-white/80">{business.legal_name || 'Not Provided'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Tax ID</span>
                <span className="text-white/80">{business.tax_id_number || 'Not Provided'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Country</span>
                <span className="text-white/80">{business.country}</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 bg-zenqar-600/5 border-zenqar-500/20">
            <h3 className="text-sm font-bold text-zenqar-400 uppercase tracking-widest mb-4">Quick Audit Summary</h3>
            <div className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white tabular-nums">
                  {totalInvoiced.toLocaleString()}
                </span>
                <span className="text-sm text-white/40 uppercase">{business.default_currency}</span>
              </div>
              <p className="text-xs text-white/40 leading-relaxed">
                This business has processed a total volume of {totalInvoiced.toLocaleString()} across {invoices?.length || 0} invoices.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
