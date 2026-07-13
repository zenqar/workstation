'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, MessageSquare, Minus, Send, Sparkles, X } from 'lucide-react';
import { useLocale } from 'next-intl';
import { chatWithAI } from '@/lib/actions/ai';
import { cn } from '@/lib/utils';

type ChatMessage = { role: 'assistant' | 'user'; content: string };

const HIDDEN_STORAGE_KEY = 'zenqar_ai_assistant_hidden';
const OPEN_ASSISTANT_EVENT = 'zenqar:open-ai-assistant';

export default function AIChatBot() {
  const [isReady, setIsReady] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I’m your Zenqar Assistant. Ask me how to scan a supplier invoice, create an invoice, record a payment, or use any Zenqar tool.',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const isRtl = locale === 'ar' || locale === 'ku';

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsDismissed(localStorage.getItem(HIDDEN_STORAGE_KEY) === '1');
      setIsReady(true);
    });

    const openAssistant = () => {
      localStorage.removeItem(HIDDEN_STORAGE_KEY);
      setIsDismissed(false);
      setIsOpen(true);
    };

    window.addEventListener(OPEN_ASSISTANT_EVENT, openAssistant);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(OPEN_ASSISTANT_EVENT, openAssistant);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  function dismissAssistant() {
    localStorage.setItem(HIDDEN_STORAGE_KEY, '1');
    setIsOpen(false);
    setIsDismissed(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage('');
    setMessages((current) => [...current, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const result = await chatWithAI(userMessage, messages, locale);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: result.response || result.error || 'Zenqar AI could not answer right now. Please try again.',
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: 'Connection lost. Please check your internet and try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!isReady || isDismissed) return null;

  return (
    <div
      className={cn('app-chrome fixed bottom-4 z-[100] sm:bottom-6', isRtl ? 'left-4 sm:left-6' : 'right-4 sm:right-6')}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {isOpen && (
        <section
          className={cn(
            'absolute bottom-20 flex h-[min(500px,calc(100vh-7rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300',
            isRtl ? 'left-0' : 'right-0',
          )}
          aria-label="Zenqar AI assistant"
        >
          <header className="flex items-center justify-between border-b border-white/5 bg-black/40 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-gradient shadow-glow">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold leading-none text-white">Zenqar Assistant</h2>
                <a
                  href="https://robillionair.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-zenqar-400 transition-colors hover:text-zenqar-300"
                  title="Powered by Xelvon XPT from Robillionair, using Tencent Hy3 through OpenRouter"
                >
                  <Sparkles className="h-2.5 w-2.5" /> Powered by Xelvon XPT · Robillionair
                </a>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Minimize AI assistant"
                title="Minimize"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={dismissAssistant}
                className="rounded-lg p-2 text-white/40 transition-colors hover:bg-red-500/15 hover:text-red-300"
                aria-label="Hide AI assistant completely"
                title="Hide assistant — reopen it from the sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4" ref={scrollRef} aria-live="polite">
            {messages.map((chatMessage, index) => (
              <div key={`${chatMessage.role}-${index}`} className={cn('flex', chatMessage.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[88%] whitespace-pre-wrap rounded-2xl p-3 text-sm leading-relaxed shadow-md',
                    chatMessage.role === 'user'
                      ? 'rounded-br-md bg-zenqar-600 text-white'
                      : 'rounded-bl-md border border-white/10 bg-slate-900/90 text-white/90',
                  )}
                >
                  {chatMessage.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md border border-white/10 bg-slate-900/90 p-3" aria-label="Zenqar AI is responding">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/25" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/25 [animation-delay:0.2s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/25 [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-white/5 bg-black/60 p-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Ask about Zenqar…"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={4_000}
                className={cn(
                  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-zenqar-500/50 focus:outline-none',
                  isRtl ? 'pl-12' : 'pr-12',
                )}
              />
              <button
                type="submit"
                disabled={!message.trim() || loading}
                aria-label="Send message"
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 rounded-lg bg-zenqar-500 p-2 text-white transition-all disabled:bg-white/10 disabled:opacity-50',
                  isRtl ? 'left-2' : 'right-2',
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-white/30">Review financial guidance before acting on it.</p>
          </form>
        </section>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          aria-label={isOpen ? 'Minimize AI assistant' : 'Open AI assistant'}
          className={cn(
            'group flex h-14 w-14 items-center justify-center rounded-full shadow-glow transition-all duration-300',
            isOpen ? 'rotate-90 bg-white/10' : 'bg-primary-gradient hover:scale-110 active:scale-95',
          )}
        >
          {isOpen ? <Minus className="h-6 w-6 text-white" /> : <MessageSquare className="h-6 w-6 text-white group-hover:animate-pulse" />}
        </button>
        {!isOpen && (
          <button
            type="button"
            onClick={dismissAssistant}
            aria-label="Hide AI assistant completely"
            title="Hide assistant"
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-slate-900 text-white/60 shadow-lg transition-colors hover:bg-red-500 hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
