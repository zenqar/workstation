'use client';

import { useEffect, useState, useRef } from 'react';
import { Bell, UserPlus, Check, X, MessageSquare } from 'lucide-react';
import { getIncomingContactRequests, handleContactRequest } from '@/lib/actions/connections';
import { cn } from '@/lib/utils';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = async () => {
    // 1. Fetch Contact Requests
    const contactData = await getIncomingContactRequests();
    
    // 2. Fetch Unread Support Messages
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    let supportData: any[] = [];
    if (user) {
      const { data } = await supabase
        .from('support_messages')
        .select('id, message, created_at, business_id')
        .eq('is_read', false)
        .eq('sender_type', 'admin')
        .or(`recipient_user_id.eq.${user.id}`);
      
      if (data) supportData = data;
    }

    // Combine them
    const combined = [
      ...(contactData || []).map(c => ({ ...c, type: 'contact' })),
      ...supportData.map(s => ({ ...s, type: 'support' }))
    ];
    
    setNotifications(combined);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onHandleRequest = async (id: string, action: 'accept' | 'reject') => {
    setLoading(id);
    const res = await handleContactRequest(id, action);
    if (res?.error) alert(res.error);
    else {
      await fetchRequests();
      router.refresh();
    }
    setLoading(null);
  };

  const count = notifications.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2 rounded-xl transition-all group",
          isOpen ? "bg-white/10 text-white" : "hover:bg-white/5 text-white/60 hover:text-white"
        )}
      >
        <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
        {count > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-zenqar-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-dark-bg animate-pulse">
            {count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 glass-card shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 border-white/10">
          <div className="px-3 py-2 border-b border-white/5 mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {count > 0 && <span className="text-[10px] text-zenqar-400 font-bold uppercase tracking-widest">{count} NEW</span>}
          </div>
          
          <div className="max-h-96 overflow-y-auto space-y-2 custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-xs text-white/40 italic">No new notifications</div>
            ) : (
              notifications.map((notif: any) => (
                <div key={`${notif.type}-${notif.id}`}>
                  {notif.type === 'contact' ? (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-zenqar-500/30 transition-colors">
                      <div className="flex gap-3">
                        <div className="w-8 h-8 shrink-0 rounded-lg bg-zenqar-500/20 flex items-center justify-center mt-0.5">
                          <UserPlus className="w-4 h-4 text-zenqar-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-medium truncate">{notif.sender_business?.name}</p>
                          <p className="text-[10px] text-white/40 mt-0.5">Wants to connect</p>
                          <div className="flex gap-2 mt-2">
                            <button 
                              onClick={() => onHandleRequest(notif.id, 'reject')}
                              disabled={!!loading}
                              className="flex-1 py-1 rounded-lg text-[10px] font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20"
                            >
                              Ignore
                            </button>
                            <button 
                              onClick={() => onHandleRequest(notif.id, 'accept')}
                              disabled={!!loading}
                              className="flex-1 py-1 rounded-lg text-[10px] font-bold text-white bg-zenqar-600 hover:bg-zenqar-500 transition-colors flex items-center justify-center"
                            >
                              {loading === notif.id ? '...' : 'Accept'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Link 
                      href={`/${useLocale()}/app/support`}
                      onClick={() => setIsOpen(false)}
                      className="block p-3 rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/30 transition-colors group"
                    >
                      <div className="flex gap-3">
                        <div className="w-8 h-8 shrink-0 rounded-lg bg-blue-500/20 flex items-center justify-center mt-0.5 group-hover:bg-blue-500/30 transition-colors">
                          <MessageSquare className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-bold">New Support Message</p>
                          <p className="text-[10px] text-white/50 mt-0.5 truncate">{notif.message}</p>
                          <p className="text-[9px] text-white/20 mt-1 uppercase font-black tracking-widest">Just now</p>
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
