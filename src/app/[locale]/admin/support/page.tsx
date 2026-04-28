import { createAdminClient } from '@/lib/supabase/admin';
import { MessageSquare, Building2, ChevronRight, Clock } from 'lucide-react';
import Link from 'next/link';

export default async function AdminSupportInbox(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const admin = await createAdminClient();

  // Fetch all support messages with business info
  const { data: messages } = await admin
    .from('support_messages')
    .select('*, businesses(id, name)')
    .order('created_at', { ascending: false });

  // Group messages by business
  const businessConversations = messages?.reduce((acc, msg) => {
    const bId = msg.business_id;
    if (!acc[bId]) {
      acc[bId] = {
        business: msg.businesses,
        lastMessage: msg,
        unreadCount: msg.is_read ? 0 : (msg.sender_type === 'business' ? 1 : 0)
      };
    } else {
      if (!msg.is_read && msg.sender_type === 'business') {
        acc[bId].unreadCount++;
      }
    }
    return acc;
  }, {} as Record<string, any>);

  const conversations = Object.values(businessConversations || {});

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
                key={conv.business.id} 
                href={`/${locale}/admin/businesses/${conv.business.id}`}
                className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 group-hover:text-zenqar-400 transition-colors">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white">{conv.business.name}</h3>
                      {conv.unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-zenqar-500 text-white text-[10px] font-black">
                          {conv.unreadCount} NEW
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
