'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mic, Send, Square, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sendMessage, sendVoiceMessage } from '@/lib/actions/messages';

type ChatMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  message_type?: 'text' | 'voice';
  attachment_path?: string | null;
  attachment_mime?: string | null;
  attachment_duration_seconds?: number | null;
  audioUrl?: string;
};

const MAX_RECORDING_SECONDS = 60;

export default function ContactChat({ contactId, currentUserId, connectedUserId }: { contactId: string; currentUserId: string; connectedUserId: string | null }) {
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [chatError, setChatError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addSignedAudioUrl = useCallback(async (message: ChatMessage) => {
    if (message.message_type !== 'voice' || !message.attachment_path) return message;
    const { data } = await supabase.storage.from('chat-voice').createSignedUrl(message.attachment_path, 3600);
    return { ...message, audioUrl: data?.signedUrl };
  }, [supabase]);

  useEffect(() => {
    if (!connectedUserId) return;
    let active = true;
    const fetchMessages = async () => {
      const { data } = await supabase.from('messages').select('*')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${connectedUserId}),and(sender_id.eq.${connectedUserId},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: true });
      const hydrated = await Promise.all((data || []).map(message => addSignedAudioUrl(message as ChatMessage)));
      await supabase.from('messages').update({ is_read: true }).eq('receiver_id', currentUserId).eq('sender_id', connectedUserId).eq('is_read', false);
      if (active) {
        setMessages(hydrated);
        setLoading(false);
      }
    };
    void fetchMessages();

    const channel = supabase.channel(`messages:${currentUserId}:${connectedUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUserId}` }, payload => {
        const message = payload.new as ChatMessage;
        if (message.sender_id === connectedUserId) void addSignedAudioUrl(message).then(async hydrated => {
          setMessages(previous => previous.some(existing => existing.id === hydrated.id) ? previous : [...previous, hydrated]);
          await supabase.from('messages').update({ is_read: true }).eq('id', hydrated.id).eq('receiver_id', currentUserId);
        });
      }).subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [addSignedAudioUrl, connectedUserId, currentUserId, supabase]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => () => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    recorderRef.current?.stream.getTracks().forEach(track => track.stop());
  }, []);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = newMessage.trim();
    if (!content || !connectedUserId) return;
    setChatError('');
    const tempMessage: ChatMessage = { id: crypto.randomUUID(), sender_id: currentUserId, receiver_id: connectedUserId, content, created_at: new Date().toISOString(), message_type: 'text' };
    setMessages(previous => [...previous, tempMessage]);
    setNewMessage('');
    const result = await sendMessage(contactId, content);
    if (result.error) {
      setMessages(previous => previous.filter(message => message.id !== tempMessage.id));
      setChatError(result.error);
    }
  };

  const uploadRecording = async (blob: Blob, durationSeconds: number) => {
    if (!connectedUserId) return;
    setSendingVoice(true);
    setChatError('');
    const mime = (blob.type.split(';')[0] || 'audio/webm') as 'audio/webm' | 'audio/ogg' | 'audio/mp4' | 'audio/mpeg';
    const extension = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : mime.includes('mpeg') ? 'mp3' : 'webm';
    const path = `${currentUserId}/${connectedUserId}/${crypto.randomUUID()}.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage.from('chat-voice').upload(path, blob, { contentType: mime, upsert: false });
      if (uploadError) throw uploadError;
      const result = await sendVoiceMessage(contactId, { path, mime, durationSeconds });
      if (result.error || !result.message) {
        await supabase.storage.from('chat-voice').remove([path]);
        throw new Error(result.error || 'Voice message could not be sent');
      }
      const message = await addSignedAudioUrl(result.message as ChatMessage);
      setMessages(previous => [...previous, message]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Voice message could not be sent');
    } finally {
      setSendingVoice(false);
    }
  };

  const startRecording = async () => {
    if (!connectedUserId || recording || sendingVoice) return;
    setChatError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : undefined);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const duration = Math.max(1, Math.min(MAX_RECORDING_SECONDS, Math.ceil(chunks.length / 4)));
        if (chunks.length) void uploadRecording(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }), duration);
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
      stopTimerRef.current = setTimeout(() => stopRecording(), MAX_RECORDING_SECONDS * 1000);
    } catch {
      setChatError('Microphone access was denied or is unavailable.');
    }
  };

  const stopRecording = () => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setRecording(false);
  };

  if (!connectedUserId) return <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-white/5 rounded-2xl border border-dashed border-white/10"><p className="text-sm text-white/40">You can only chat with connected B2B contacts.</p><p className="text-xs text-white/20 mt-2 italic">Connect with them to start messaging.</p></div>;

  return (
    <div className="flex flex-col h-[500px] glass-card overflow-hidden">
      <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-zenqar-500/20 flex items-center justify-center"><User className="w-4 h-4 text-zenqar-400" /></div><div><h4 className="font-semibold text-white text-sm">Secure Channel</h4><p className="text-[10px] text-white/35">Private text and voice messages</p></div></div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {loading ? <div className="flex items-center justify-center h-full text-white/20 text-xs">Connecting to secure line...</div> : messages.length === 0 ? <div className="flex items-center justify-center h-full text-white/20 text-xs">No messages yet. Say hello!</div> : messages.map(message => (
          <div key={message.id} className={cn('flex flex-col max-w-[80%]', message.sender_id === currentUserId ? 'ml-auto items-end' : 'items-start')}>
            <div className={cn('px-4 py-2 rounded-2xl text-sm', message.sender_id === currentUserId ? 'bg-zenqar-600 text-white rounded-tr-none' : 'bg-white/10 text-white/90 rounded-tl-none border border-white/5')}>
              {message.message_type === 'voice' ? message.audioUrl ? <audio controls preload="metadata" src={message.audioUrl} className="h-9 max-w-[240px]" aria-label={`Voice message, ${message.attachment_duration_seconds || 0} seconds`} /> : <span>Voice message unavailable</span> : message.content}
            </div>
            <span className="text-[10px] text-white/20 mt-1">{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
      </div>
      {chatError && <p className="px-4 pt-2 text-xs text-red-400" role="alert">{chatError}</p>}
      <form onSubmit={handleSend} className="p-4 border-t border-white/5 bg-white/5 flex gap-2">
        <input type="text" value={newMessage} maxLength={4000} onChange={event => setNewMessage(event.target.value)} placeholder={recording ? 'Recording voice message…' : 'Type a message...'} disabled={recording || sendingVoice} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-zenqar-500/50 transition-all" />
        <button type="button" onClick={recording ? stopRecording : () => void startRecording()} disabled={sendingVoice} aria-label={recording ? 'Stop recording' : 'Record voice message'} className={cn('p-2 rounded-xl text-white transition-all', recording ? 'bg-red-500 animate-pulse' : 'bg-white/10 hover:bg-white/15')}>
          {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        <button type="submit" disabled={!newMessage.trim() || recording || sendingVoice} aria-label="Send message" className="p-2 rounded-xl bg-zenqar-500 text-white hover:bg-zenqar-400 disabled:opacity-50 transition-all shadow-glow-sm"><Send className="w-4 h-4" /></button>
      </form>
    </div>
  );
}
