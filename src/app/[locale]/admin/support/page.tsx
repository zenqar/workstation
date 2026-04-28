import { createAdminClient } from '@/lib/supabase/admin';
import { MessageSquare, Building2, ChevronRight, Clock } from 'lucide-react';
import Link from 'next/link';

export default async function AdminSupportInbox(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const admin = await createAdminClient();

  // Fetch all support messages with business and user info
  const { data: messages } = await admin
    .from('support_messages')
    .select('*, businesses(id, name), auth_users:recipient_user_id(id, email)')
    .order('created_at', { ascending: false });

  // Group messages by conversation (Business or Direct User)
  const conversationsMap = messages?.reduce((acc, msg) => {
    const key = msg.business_id || `user_${msg.recipient_user_id}`;
    if (!acc[key]) {
      acc[key] = {
        id: key,
        title: msg.businesses?.name || msg.auth_users?.email || 'System Message',
        isUser: !msg.business_id,
        link: msg.business_id 
          ? `/${locale}/admin/businesses/${msg.business_id}` 
          : `/${locale}/admin/users/${msg.recipient_user_id}`,
        lastMessage: msg,
        unreadCount: msg.is_read ? 0 : (msg.sender_type !== 'admin' ? 1 : 0)
      };
    } else {
      if (!msg.is_read && msg.sender_type !== 'admin') {
        acc[key].unreadCount++;
      }
    }
    return acc;
  }, {} as Record<string, any>);

  const conversations = Object.values(conversationsMap || {});

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-zenqar-400" />
          Global Support Inbox
        </h1>
        <p className="text-white/50 text-sm mt-1">Manage all incoming business support requests.</p>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="divide-y divide-white/5">
          {conversations.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/40">No support conversations found.</p>
            </div>
          ) : (
            conversations.map((conv: any) => (
              <Link 
                key={conv.id} 
                href={conv.link}
                className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 group-hover:text-zenqar-400 transition-colors">
                    {conv.isUser ? <Users className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white">{conv.title}</h3>
                      {conv.unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-zenqar-500 text-white text-[10px] font-black">
                          {conv.unreadCount} NEW
                        </span>
                      )}
                      {conv.isUser && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[8px] font-black uppercase text-blue-400 tracking-widest">
                          Direct User
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/50 truncate max-w-md mt-1">
                      {conv.lastMessage.sender_type === 'admin' ? 'You: ' : ''}
                      {conv.lastMessage.message}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div className="hidden sm:block">
                    <div className="flex items-center gap-1 text-[10px] text-white/30 uppercase font-bold tracking-widest">
                      <Clock className="w-3 h-3" />
                      {new Date(conv.lastMessage.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white transition-colors" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
