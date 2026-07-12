'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, PhoneCall, Send, Square, User, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { sendMessage } from '@/lib/actions/messages';
import { useVoiceCall } from '@/lib/contexts/VoiceCallContext';
import { cn } from '@/lib/utils';

type ChatMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_business_id?: string | null;
  receiver_business_id?: string | null;
  content: string;
  created_at: string;
  message_type?: 'text' | 'voice';
  attachment_path?: string | null;
  attachment_mime?: string | null;
  attachment_duration_seconds?: number | null;
};

type ContactChatProps = {
  contactId: string;
  contactName: string;
  businessId: string;
  connectedBusinessId: string | null;
  currentUserId: string;
  connectedUserId: string | null;
  connectionStatus: string | null;
};

const MAX_RECORDING_SECONDS = 60;

function VoiceMessagePlayer({ message }: { message: ChatMessage }) {
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const retryCountRef = useRef(0);

  const refreshUrl = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/chat/voice-message/${encodeURIComponent(message.id)}`, { cache: 'no-store' });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || 'Voice message is unavailable');
      setAudioUrl(result.url);
    } catch (playbackError) {
      setError(playbackError instanceof Error ? playbackError.message : 'Voice message is unavailable');
    } finally {
      setLoading(false);
    }
  }, [message.id]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/chat/voice-message/${encodeURIComponent(message.id)}`, { cache: 'no-store' })
      .then(async response => {
        const result = await response.json() as { url?: string; error?: string };
        if (!response.ok || !result.url) throw new Error(result.error || 'Voice message is unavailable');
        if (active) setAudioUrl(result.url);
      })
      .catch(playbackError => {
        if (active) setError(playbackError instanceof Error ? playbackError.message : 'Voice message is unavailable');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [message.id]);

  if (loading) return <span className="inline-flex h-9 items-center text-xs text-white/45">Loading voice message…</span>;
  if (error || !audioUrl) {
    return (
      <button type="button" onClick={() => void refreshUrl()} className="h-9 text-xs text-red-200 underline decoration-red-300/30 underline-offset-4">
        {error || 'Voice message unavailable'} · Retry
      </button>
    );
  }

  return (
    <audio
      controls
      preload="metadata"
      src={audioUrl}
      className="h-9 max-w-[240px]"
      aria-label={`Voice message, ${message.attachment_duration_seconds || 0} seconds`}
      onError={() => {
        if (retryCountRef.current >= 1) {
          setError('Voice message could not be played');
          return;
        }
        retryCountRef.current += 1;
        void refreshUrl();
      }}
    />
  );
}

function recordingError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'Microphone permission was blocked. Allow it in your browser and try again.';
    if (error.name === 'NotFoundError') return 'No microphone was found on this device.';
    if (error.name === 'NotReadableError') return 'The microphone is busy or could not be opened.';
  }
  return error instanceof Error ? error.message : 'The microphone is unavailable.';
}

export default function ContactChat({
  contactId,
  contactName,
  businessId,
  connectedBusinessId,
  currentUserId,
  connectedUserId,
  connectionStatus,
}: ContactChatProps) {
  const [supabase] = useState(() => createClient());
  const { callInProgress, startCall } = useVoiceCall();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const [chatError, setChatError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const cancelRecordingRef = useRef(false);
  const recordingAttemptRef = useRef(0);
  const recordingStartingRef = useRef(false);
  const isConnected = Boolean(connectedUserId && connectedBusinessId && connectionStatus === 'connected');

  const belongsToConversation = useCallback((message: ChatMessage) => (
    (message.sender_business_id === businessId && message.receiver_business_id === connectedBusinessId)
    || (message.sender_business_id === connectedBusinessId && message.receiver_business_id === businessId)
  ), [businessId, connectedBusinessId]);

  useEffect(() => {
    if (!isConnected || !connectedUserId || !connectedBusinessId) {
      return;
    }
    let active = true;
    const fetchMessages = async () => {
      setChatError('');
      const { data, error } = await supabase.from('messages').select('*')
        .or(`and(sender_business_id.eq.${businessId},receiver_business_id.eq.${connectedBusinessId}),and(sender_business_id.eq.${connectedBusinessId},receiver_business_id.eq.${businessId})`)
        .order('created_at', { ascending: true });
      if (error) {
        if (active) {
          setChatError('Secure messages could not be loaded. Check the chat database migration.');
          setLoading(false);
        }
        return;
      }
      await supabase.from('messages').update({ is_read: true })
        .eq('receiver_business_id', businessId)
        .eq('sender_business_id', connectedBusinessId)
        .eq('is_read', false);
      if (active) {
        setMessages((data || []) as ChatMessage[]);
        setLoading(false);
      }
    };
    void fetchMessages();

    const receiveMessage = (message: ChatMessage) => {
      if (!belongsToConversation(message)) return;
      setMessages(previous => previous.some(existing => existing.id === message.id) ? previous : [...previous, message]);
      if (message.receiver_business_id === businessId) {
        void supabase.from('messages').update({ is_read: true }).eq('id', message.id).eq('receiver_business_id', businessId);
      }
    };

    const channel = supabase.channel(`messages:${businessId}:${connectedBusinessId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_business_id=eq.${businessId}`,
      }, payload => {
        receiveMessage(payload.new as ChatMessage);
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_business_id=eq.${businessId}`,
      }, payload => {
        receiveMessage(payload.new as ChatMessage);
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setChatError('Live message updates are temporarily unavailable.');
      });
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [belongsToConversation, businessId, connectedBusinessId, connectedUserId, isConnected, supabase]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const clearRecordingTimers = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    stopTimerRef.current = null;
    elapsedTimerRef.current = null;
  }, []);

  useEffect(() => () => {
    recordingAttemptRef.current += 1;
    recordingStartingRef.current = false;
    cancelRecordingRef.current = true;
    clearRecordingTimers();
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
    recorder?.stream.getTracks().forEach(track => track.stop());
  }, [clearRecordingTimers, contactId]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = newMessage.trim();
    if (!content || !connectedUserId || !isConnected) return;
    setChatError('');
    const temporaryId = crypto.randomUUID();
    const temporaryMessage: ChatMessage = {
      id: temporaryId,
      sender_id: currentUserId,
      receiver_id: connectedUserId,
      sender_business_id: businessId,
      receiver_business_id: connectedBusinessId,
      content,
      created_at: new Date().toISOString(),
      message_type: 'text',
    };
    setMessages(previous => [...previous, temporaryMessage]);
    setNewMessage('');
    const result = await sendMessage(contactId, content);
    if (result.error || !result.message) {
      setMessages(previous => previous.filter(message => message.id !== temporaryId));
      setChatError(result.error || 'Message could not be sent.');
      return;
    }
    setMessages(previous => {
      const withoutTemporary = previous.filter(message => message.id !== temporaryId);
      const savedMessage = result.message as ChatMessage;
      return withoutTemporary.some(message => message.id === savedMessage.id) ? withoutTemporary : [...withoutTemporary, savedMessage];
    });
  };

  const uploadRecording = useCallback(async (blob: Blob, durationSeconds: number) => {
    setSendingVoice(true);
    setChatError('');
    const mime = blob.type.split(';')[0] || 'audio/webm';
    const extension = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : mime.includes('mpeg') ? 'mp3' : 'webm';
    try {
      if (!blob.size) throw new Error('The recording was empty. Please try again.');
      const formData = new FormData();
      formData.set('contact_id', contactId);
      formData.set('duration_seconds', String(durationSeconds));
      formData.set('file', new File([blob], `voice-message.${extension}`, { type: mime }));
      const response = await fetch('/api/chat/voice-message', { method: 'POST', body: formData });
      const result = await response.json() as { message?: ChatMessage; error?: string };
      if (!response.ok || !result.message) throw new Error(result.error || 'Voice message could not be sent.');
      setMessages(previous => previous.some(message => message.id === result.message?.id) ? previous : [...previous, result.message as ChatMessage]);
    } catch (uploadError) {
      setChatError(uploadError instanceof Error ? uploadError.message : 'Voice message could not be sent.');
    } finally {
      setSendingVoice(false);
    }
  }, [contactId]);

  const stopRecording = useCallback((cancel = false) => {
    cancelRecordingRef.current = cancel;
    clearRecordingTimers();
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording' || recorder?.state === 'paused') recorder.stop();
    else recorder?.stream.getTracks().forEach(track => track.stop());
    setRecording(false);
  }, [clearRecordingTimers]);

  const startRecording = async () => {
    if (
      !isConnected
      || !connectedUserId
      || recording
      || sendingVoice
      || recordingStartingRef.current
      || recorderRef.current
    ) return;
    const attemptId = ++recordingAttemptRef.current;
    recordingStartingRef.current = true;
    setChatError('');
    if (!window.isSecureContext) {
      recordingStartingRef.current = false;
      setChatError('Voice messages require a secure HTTPS connection.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      recordingStartingRef.current = false;
      setChatError('This browser does not support voice recording. Please use a current Chrome, Edge, Firefox, or Safari version.');
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (recordingAttemptRef.current !== attemptId) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      const preferredMime = [
        'audio/webm;codecs=opus',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : undefined);
      const chunks: BlobPart[] = [];
      cancelRecordingRef.current = false;
      startedAtRef.current = performance.now();
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        if (recordingAttemptRef.current !== attemptId) return;
        cancelRecordingRef.current = true;
        clearRecordingTimers();
        stream?.getTracks().forEach(track => track.stop());
        if (recorderRef.current === recorder) recorderRef.current = null;
        setRecording(false);
        setChatError('Recording failed. Check that no other app is using the microphone.');
      };
      recorder.onstop = () => {
        clearRecordingTimers();
        stream?.getTracks().forEach(track => track.stop());
        if (recorderRef.current === recorder) recorderRef.current = null;
        if (recordingAttemptRef.current !== attemptId) return;
        const elapsed = Math.max(1, Math.min(MAX_RECORDING_SECONDS, Math.round((performance.now() - startedAtRef.current) / 1000)));
        setRecording(false);
        setRecordingSeconds(0);
        if (!cancelRecordingRef.current && chunks.length) {
          void uploadRecording(new Blob(chunks, { type: recorder.mimeType || preferredMime || 'audio/webm' }), elapsed);
        }
      };
      recorderRef.current = recorder;
      recorder.start(500);
      recordingStartingRef.current = false;
      setRecordingSeconds(0);
      setRecording(true);
      elapsedTimerRef.current = setInterval(() => {
        setRecordingSeconds(Math.min(MAX_RECORDING_SECONDS, Math.floor((performance.now() - startedAtRef.current) / 1000)));
      }, 250);
      stopTimerRef.current = setTimeout(() => stopRecording(false), MAX_RECORDING_SECONDS * 1000);
    } catch (mediaError) {
      stream?.getTracks().forEach(track => track.stop());
      if (recordingAttemptRef.current !== attemptId) return;
      clearRecordingTimers();
      if (recorderRef.current?.state === 'inactive') recorderRef.current = null;
      recordingStartingRef.current = false;
      setRecording(false);
      setChatError(recordingError(mediaError));
    }
  };

  if (!isConnected) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
        <p className="text-sm text-white/40">Secure chat opens after this business contact accepts the connection.</p>
        <p className="mt-2 text-xs italic text-white/20">Connected contacts can exchange messages, voice notes, and one-to-one calls.</p>
      </div>
    );
  }

  return (
    <div className="glass-card flex h-[540px] flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-white/5 bg-white/5 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zenqar-500/20"><User className="h-4 w-4 text-zenqar-400" /></div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-white">{contactName}</h4>
          <p className="text-[10px] text-white/35">Private text, voice messages, and one-to-one calls</p>
        </div>
        <button
          type="button"
          onClick={() => void startCall(contactId, contactName)}
          disabled={callInProgress || recording || sendingVoice}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Start a voice call with ${contactName}`}
          title={callInProgress ? 'A call is already in progress' : 'Start voice call'}
        >
          <PhoneCall className="h-4 w-4" />
          <span className="hidden sm:inline">Voice call</span>
        </button>
      </div>

      <div ref={scrollRef} className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-1 space-y-4 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-white/20">Connecting to secure chat…</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm text-white/35">Start the conversation</p>
            <p className="mt-1 max-w-xs text-xs text-white/20">Send a message or voice note, or use Voice call for a quick invoice question.</p>
          </div>
        ) : messages.map(message => (
          <div key={message.id} className={cn('flex max-w-[85%] flex-col', message.sender_business_id === businessId || (!message.sender_business_id && message.sender_id === currentUserId) ? 'ml-auto items-end' : 'items-start')}>
            <div className={cn('rounded-2xl px-4 py-2 text-sm', message.sender_business_id === businessId || (!message.sender_business_id && message.sender_id === currentUserId) ? 'rounded-tr-none bg-zenqar-600 text-white' : 'rounded-tl-none border border-white/5 bg-white/10 text-white/90')}>
              {message.message_type === 'voice' ? <VoiceMessagePlayer message={message} /> : message.content}
            </div>
            <span className="mt-1 text-[10px] text-white/20">{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
      </div>

      {chatError && <p className="px-4 pt-2 text-xs text-red-400" role="alert">{chatError}</p>}
      <form onSubmit={handleSend} className="flex gap-2 border-t border-white/5 bg-white/5 p-4">
        {recording ? (
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
            <span className="flex-1 text-sm text-red-100">Recording {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}</span>
            <span className="text-[10px] text-white/30">max 1:00</span>
          </div>
        ) : (
          <input
            type="text"
            value={newMessage}
            maxLength={4000}
            onChange={event => setNewMessage(event.target.value)}
            placeholder={sendingVoice ? 'Sending voice message…' : 'Type a message…'}
            disabled={sendingVoice}
            aria-label="Message"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition-all focus:border-zenqar-500/50 focus:outline-none disabled:opacity-50"
          />
        )}
        {recording && (
          <button type="button" onClick={() => stopRecording(true)} aria-label="Cancel recording" className="rounded-xl bg-white/10 p-2 text-white/70 transition hover:bg-white/15 hover:text-white"><X className="h-4 w-4" /></button>
        )}
        <button
          type="button"
          onClick={recording ? () => stopRecording(false) : () => void startRecording()}
          disabled={sendingVoice}
          aria-label={recording ? 'Send voice message' : 'Record voice message'}
          className={cn('rounded-xl p-2 text-white transition-all', recording ? 'animate-pulse bg-red-500 hover:bg-red-400' : 'bg-white/10 hover:bg-white/15')}
        >
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        {!recording && (
          <button type="submit" disabled={!newMessage.trim() || sendingVoice} aria-label="Send message" className="rounded-xl bg-zenqar-500 p-2 text-white shadow-glow-sm transition-all hover:bg-zenqar-400 disabled:opacity-50"><Send className="h-4 w-4" /></button>
        )}
      </form>
    </div>
  );
}
