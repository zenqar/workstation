'use client';

import { useEffect, useState, useRef } from 'react';
import { Bell, UserPlus, Check, X } from 'lucide-react';
import { getIncomingContactRequests, handleContactRequest } from '@/lib/actions/connections';
import { cn } from '@/lib/utils';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';

export default function NotificationBell() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchRequests = async () => {
    const data = await getIncomingContactRequests();
    setRequests(data);
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 60000);
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

  const count = requests.length;

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
          <div className="px-3 py-2 border-b border-white/5 mb-2">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
          </div>
          
          <div className="max-h-96 overflow-y-auto space-y-2">
            {requests.length === 0 ? (
              <div className="p-4 text-center text-xs text-white/40">No new notifications</div>
            ) : (
              requests.map((req) => (
                <div key={req.id} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-zenqar-500/30 transition-colors">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 shrink-0 rounded-lg bg-zenqar-500/20 flex items-center justify-center mt-0.5">
                      <UserPlus className="w-4 h-4 text-zenqar-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium truncate">{req.sender_business?.name}</p>
                      {req.sender_business?.legal_name && req.sender_business?.legal_name !== req.sender_business?.name && (
                        <p className="text-[10px] text-white/40 truncate">{req.sender_business.legal_name}</p>
                      )}
                      <p className="text-[10px] text-white/40 mt-0.5">Wants to connect</p>
                      
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => onHandleRequest(req.id, 'reject')}
                          disabled={!!loading}
                          className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          Ignore
                        </button>
                        <button 
                          onClick={() => onHandleRequest(req.id, 'accept')}
                          disabled={!!loading}
                          className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white bg-zenqar-600 hover:bg-zenqar-500 transition-colors flex items-center justify-center"
                        >
                          {loading === req.id ? (
                            <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          ) : 'Accept'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
