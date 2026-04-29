'use client';

import { useEffect, useState, useRef } from 'react';
import { Bell, BellRing, UserPlus, Check, X, MessageSquare, Receipt, AlertCircle } from 'lucide-react';
import { getIncomingContactRequests, handleContactRequest } from '@/lib/actions/connections';
import { getNotifications, markAsRead } from '@/lib/actions/notifications';
import { cn, formatDate } from '@/lib/utils';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const PING_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playPing = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(PING_SOUND_URL);
    }
    audioRef.current.play().catch(e => console.log('Audio play blocked by browser', e));
  };

  const showBrowserNotification = (title: string, body: string, link?: string) => {
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "granted") {
      const notif = new Notification(title, {
        body,
        icon: '/zenqar-icon.png',
        tag: 'zenqar-notification',
      });
      notif.onclick = () => {
        window.focus();
        if (link) router.push(link);
        notif.close();
      };
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  };

  const fetchNotifications = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch business ID from profile/membership
    const { data: membership } = await supabase
      .from('business_memberships')
      .select('business_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) return;

    const [dbNotifs, contactRequests] = await Promise.all([
      getNotifications(membership.business_id),
      getIncomingContactRequests()
    ]);

    const combined = [
      ...(contactRequests || []).map(c => ({ ...c, type: 'contact_request' })),
      ...(dbNotifs || []).map(n => ({ ...n, is_db: true }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    setNotifications(combined);
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    fetchNotifications();

    const supabase = createClient();
    
    const channel = supabase
      .channel('notifications_changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications' 
      }, (payload: any) => {
        fetchNotifications();
        playPing();
        if (payload.new) {
          showBrowserNotification(payload.new.title, payload.new.message, payload.new.link);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      await fetchNotifications();
      router.refresh();
    }
    setLoading(null);
  };

  const count = notifications.filter(n => !n.is_read).length;

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
            <div className="flex items-center gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  playPing();
                  showBrowserNotification("Test Notification", "Zenqar sounds and notifications are active!", "/app/dashboard");
                }}
                className="text-[10px] text-white/40 hover:text-white transition-colors uppercase font-bold"
              >
                Test
              </button>
              {count > 0 && <span className="text-[10px] text-zenqar-400 font-bold uppercase tracking-widest">{count} NEW</span>}
            </div>
          </div>
          
          <div className="max-h-96 overflow-y-auto space-y-2 custom-scrollbar">
            {notifications.filter(n => !n.is_read).length === 0 ? (
              <div className="p-4 text-center text-xs text-white/40 italic">No new notifications</div>
            ) : (
              notifications.filter(n => !n.is_read).map((notif: any) => (
                <div key={notif.id}>
                  {notif.type === 'contact_request' ? (
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
                      href={notif.link || '#'}
                      onClick={async () => {
                        setIsOpen(false);
                        if (notif.id) await markAsRead(notif.id);
                        fetchNotifications();
                      }}
                      className="block p-3 rounded-xl bg-white/5 border border-white/5 hover:border-zenqar-500/30 transition-colors group"
                    >
                      <div className="flex gap-3">
                        <div className="w-8 h-8 shrink-0 rounded-lg bg-white/10 flex items-center justify-center mt-0.5 group-hover:bg-white/20 transition-colors">
                          {notif.type.includes('invoice') ? <Receipt className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-blue-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-bold">{notif.title}</p>
                          <p className="text-[10px] text-white/50 mt-0.5 line-clamp-2">{notif.message}</p>
                          <p className="text-[9px] text-white/20 mt-1 uppercase font-black tracking-widest">{formatDate(notif.created_at)}</p>
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
