'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, Sparkles, User } from 'lucide-react';
import { chatWithAI } from '@/lib/actions/ai';
import { cn } from '@/lib/utils';
import { useLocale } from 'next-intl';

export default function AIChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([
    { role: 'assistant', content: 'Hello! I am your Zenqar AI assistant. How can I help you today?' }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const isRtl = locale === 'ar' || locale === 'ku';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading) return;

    const userMsg = message.trim();
    setMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await chatWithAI(userMsg, messages);
      if (res.response) {
        setMessages(prev => [...prev, { role: 'assistant', content: res.response }]);
      } else if (res.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again later.' }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection lost. Please check your internet.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("fixed bottom-6 z-[100]", isRtl ? "left-6" : "right-6")} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Chat Window */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-[350px] sm:w-[400px] h-[500px] glass-card-elevated flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 shadow-2xl border-white/10">
          {/* Header */}
          <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-gradient flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-none">Zenqar Assistant</h3>
                <span className="text-[10px] text-zenqar-400 font-bold uppercase tracking-widest flex items-center gap-1 mt-1">
                  <Sparkles className="w-2 h-2" /> AI Powered
                </span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-md transition-colors text-white/40 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] p-3 rounded-2xl text-sm",
                  msg.role === 'user' 
                    ? "bg-zenqar-600 text-white rounded-br-none" 
                    : "bg-white/5 border border-white/10 text-white/80 rounded-bl-none"
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 p-3 rounded-2xl rounded-bl-none">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce" />
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-white/5 bg-white/[0.02]">
            <div className="relative">
              <input 
                type="text"
                placeholder="Ask anything..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 pr-12 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-zenqar-500/50 transition-colors"
              />
              <button 
                type="submit" 
                disabled={!message.trim() || loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-zenqar-500 text-white disabled:opacity-50 disabled:bg-white/10 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-glow transition-all duration-300 group",
          isOpen ? "bg-white/10 rotate-90" : "bg-primary-gradient hover:scale-110 active:scale-95"
        )}
      >
        {isOpen ? <X className="text-white w-6 h-6" /> : <MessageSquare className="text-white w-6 h-6 group-hover:animate-pulse" />}
      </button>
    </div>
  );
}
