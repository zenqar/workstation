'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Send, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ContactChat({ contactId, currentUserId, connectedUserId }: { contactId: string; currentUserId: string; connectedUserId: string | null }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!connectedUserId) return;

    // Fetch initial messages
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${connectedUserId}),and(sender_id.eq.${connectedUserId},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: true });
      
      setMessages(data || []);
      setLoading(false);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel('messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `receiver_id=eq.${currentUserId}`
      }, (payload) => {
        if (payload.new.sender_id === connectedUserId) {
          setMessages(prev => [...prev, payload.new]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [connectedUserId, currentUserId, supabase]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !connectedUserId) return;

    const msg = {
      sender_id: currentUserId,
      receiver_id: connectedUserId,
      content: newMessage.trim(),
    };

    // Optimistic update
    const tempMsg = { ...msg, id: Math.random().toString(), created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);
    setNewMessage('');

    const { error } = await supabase.from('messages').insert(msg);
    if (error) {
      console.error('Send error:', error);
      // Remove optimistic msg on error
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    }
  };

  if (!connectedUserId) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-white/5 rounded-2xl border border-dashed border-white/10">
        <p className="text-sm text-white/40">You can only chat with connected B2B contacts.</p>
        <p className="text-xs text-white/20 mt-2 italic">Connect with them to start messaging.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] glass-card overflow-hidden">
      <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-zenqar-500/20 flex items-center justify-center">
          <User className="w-4 h-4 text-zenqar-400" />
        </div>
        <h4 className="font-semibold text-white text-sm">Secure Channel</h4>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {loading ? (
          <div className="flex items-center justify-center h-full text-white/20 text-xs">Connecting to secure line...</div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/20 text-xs">No messages yet. Say hello!</div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={cn(
              "flex flex-col max-w-[80%]",
              msg.sender_id === currentUserId ? "ml-auto items-end" : "items-start"
            )}>
              <div className={cn(
                "px-4 py-2 rounded-2xl text-sm",
                msg.sender_id === currentUserId 
                  ? "bg-zenqar-600 text-white rounded-tr-none" 
                  : "bg-white/10 text-white/90 rounded-tl-none border border-white/5"
              )}>
                {msg.content}
              </div>
              <span className="text-[10px] text-white/20 mt-1">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-white/5 bg-white/5 flex gap-2">
        <input 
          type="text" 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-zenqar-500/50 transition-all"
        />
        <button 
          type="submit" 
          disabled={!newMessage.trim()}
          className="p-2 rounded-xl bg-zenqar-500 text-white hover:bg-zenqar-400 disabled:opacity-50 disabled:hover:bg-zenqar-500 transition-all shadow-glow-sm"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
