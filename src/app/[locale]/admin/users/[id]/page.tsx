import { createAdminClient } from '@/lib/supabase/admin';
import { 
  Users, 
  Mail, 
  Shield, 
  MessageSquare, 
  ArrowLeft, 
  Send,
  Trash2,
  Key,
  Clock,
  History
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cn } from '@/lib/utils';
import { sendAdminUserMessage } from '../actions';

export default async function UserDetailsPage(props: { params: Promise<{ id: string, locale: string }> }) {
  const { id, locale } = await props.params;
  const admin = await createAdminClient();

  // Fetch user data from auth.admin
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(id);
  const user = userData?.user;

  if (userError || !user) notFound();

  // Fetch direct messages for this user
  const { data: messages } = await admin
    .from('support_messages')
    .select('*')
    .eq('recipient_user_id', id)
    .order('created_at', { ascending: true });

  // Fetch user's business memberships
  const { data: memberships } = await admin
    .from('business_memberships')
    .select('*, businesses(name, industry)')
    .eq('user_id', id);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link 
          href={`/${locale}/admin/users`}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{user.email}</h1>
          <p className="text-white/40 text-sm font-mono mt-1">{user.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Messaging Interface */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 flex flex-col h-[500px]">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/5">
              <MessageSquare className="w-5 h-5 text-zenqar-400" />
              <h2 className="text-lg font-semibold text-white">Direct User Messaging</h2>
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
                  <p>No direct messages yet. Start a secure conversation with this user.</p>
                </div>
              )}
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
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-zenqar-400" />
              Business Memberships
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {memberships && memberships.length > 0 ? memberships.map((m) => (
                <div key={m.id} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{m.businesses?.name}</p>
                    <p className="text-xs text-white/40">{m.businesses?.industry}</p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-zenqar-400 bg-zenqar-400/10 px-2 py-0.5 rounded border border-zenqar-400/20">
                    {m.role}
                  </span>
                </div>
              )) : (
                <p className="text-white/30 text-sm italic col-span-2">This user is not a member of any business.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Account Info & Actions */}
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Account Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Joined</span>
                <span className="text-white/80">{new Date(user.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Last Login</span>
                <span className="text-white/80">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Phone</span>
                <span className="text-white/80">{user.phone || 'Not linked'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Role</span>
                <span className="text-white/80 text-emerald-400 font-bold uppercase tracking-widest text-[10px]">User</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Account Actions</h3>
            <div className="space-y-2">
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
                <button type="submit" className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group">
                  <span className="text-sm text-white/70 group-hover:text-white">Reset Password</span>
                  <Key className="w-4 h-4 text-white/20 group-hover:text-zenqar-400" />
                </button>
              </form>
              
              <button className="w-full flex items-center justify-between p-3 rounded-xl bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 transition-colors group">
                <span className="text-sm text-red-400">Suspend Account</span>
                <Clock className="w-4 h-4 text-red-500/30 group-hover:text-red-400" />
              </button>
            </div>
          </div>

          <div className="glass-card p-6 border-red-500/20">
            <h2 className="text-lg font-semibold text-red-400 mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Danger Zone
            </h2>
            <p className="text-xs text-white/50 mb-4">
              Deleting this user will permanently remove their authentication record. This cannot be undone.
            </p>
            <form action={async () => {
              'use server';
              const admin = await createAdminClient();
              await admin.auth.admin.deleteUser(user.id);
            }}>
              <button type="submit" className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded shadow-lg shadow-red-500/20 transition-all">
                PERMANENTLY DELETE USER
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
