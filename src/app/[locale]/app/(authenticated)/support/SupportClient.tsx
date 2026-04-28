'use client';

import { useState, useEffect, useRef } from 'react';
import { useBusiness } from '@/lib/contexts/BusinessContext';
import { 
  MessageSquare, 
  Send, 
  ShieldCheck, 
  Clock, 
  AlertCircle,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useTranslations } from 'next-intl';

export default function SupportClient() {
  const t = useTranslations();
  const { activeBusiness } = useBusiness();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!activeBusiness) return;

    // Load initial messages
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('support_messages')
        .select('*')
        .eq('business_id', activeBusiness.id)
        .order('created_at', { ascending: true });
      
      if (data) setMessages(data);
      setLoading(false);
      scrollToBottom();
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel('support-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `business_id=eq.${activeBusiness.id}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBusiness]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }, 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeBusiness || sending) return;

    setSending(true);
    const { error } = await supabase.from('support_messages').insert({
      business_id: activeBusiness.id,
      sender_type: 'business',
      message: newMessage,
      is_read: false
    });

    if (error) {
      alert('Failed to send message: ' + error.message);
    } else {
      setNewMessage('');
    }
    setSending(false);
  };

  if (!activeBusiness) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-zenqar-400" />
            Customer Support
          </h1>
          <p className="text-white/50 text-sm mt-1">Talk to our experts. Secure, encrypted messaging with Zenqar HQ.</p>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Support Online</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Area */}
        <div className="lg:col-span-2 flex flex-col h-[600px] glass-card overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-white/[0.02]">
            <div className="w-10 h-10 rounded-xl bg-zenqar-gradient flex items-center justify-center shadow-glow-sm">
              <span className="text-white font-black text-xs">Z</span>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Zenqar HQ Support</p>
              <p className="text-[10px] text-white/30 mt-1 uppercase tracking-widest font-bold">Encrypted Channel</p>
            </div>
          </div>

          {/* Messages */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"
          >
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-zenqar-400 border-t-transparent rounded-full animate-spin opacity-20" />
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                  <MessageSquare className="w-8 h-8 text-white/10" />
                </div>
                <p className="text-white/40 text-sm max-w-xs">
                  Welcome to support! Send us a message and our team will get back to you shortly.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={cn(
                    "max-w-[85%] flex flex-col gap-1",
                    msg.sender_type === 'business' ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div 
                    className={cn(
                      "p-3 rounded-2xl text-sm shadow-lg",
                      msg.sender_type === 'business'
                        ? "bg-zenqar-600/20 text-white border border-zenqar-500/20 rounded-tr-none"
                        : "bg-white/5 text-white/90 border border-white/10 rounded-tl-none"
                    )}
                  >
                    {msg.message}
                  </div>
                  <span className="text-[10px] text-white/20 font-medium px-1">
                    {msg.sender_type === 'admin' ? 'Zenqar Support' : 'You'} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-numeric', minute: '2-numeric' })}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/5 bg-white/[0.02]">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input 
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your question here..."
                className="input-glass flex-1"
                disabled={sending}
              />
              <button 
                type="submit" 
                className="btn-primary"
                disabled={sending || !newMessage.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Info Area */}
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Privacy & Security
            </h2>
            <p className="text-xs text-white/50 leading-relaxed">
              All communications in this channel are private and only visible to authorized Zenqar platform administrators. 
            </p>
            <div className="pt-2">
              <div className="flex items-center gap-3 text-xs text-white/70">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Direct Admin Access
              </div>
              <div className="flex items-center gap-3 text-xs text-white/70 mt-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Data stays in-platform
              </div>
            </div>
          </div>

          <div className="glass-card p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Help Center</h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Browse our guides to get the most out of Zenqar.
            </p>
            <div className="space-y-2">
              <a href="#" className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group">
                <span className="text-sm text-white/70 group-hover:text-white">Getting Started</span>
                <ExternalLink className="w-3 h-3 text-white/20 group-hover:text-zenqar-400" />
              </a>
              <a href="#" className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group">
                <span className="text-sm text-white/70 group-hover:text-white">Managing Wallets</span>
                <ExternalLink className="w-3 h-3 text-white/20 group-hover:text-zenqar-400" />
              </a>
              <a href="#" className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group">
                <span className="text-sm text-white/70 group-hover:text-white">Security Tips</span>
                <ExternalLink className="w-3 h-3 text-white/20 group-hover:text-zenqar-400" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
