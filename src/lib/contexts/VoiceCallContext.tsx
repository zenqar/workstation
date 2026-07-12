'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Mic, MicOff, Phone, PhoneCall, PhoneOff, ShieldCheck, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  acceptVoiceCall,
  createVoiceCall,
  declineVoiceCall,
  endVoiceCall,
  heartbeatVoiceCall,
} from '@/lib/actions/calls';
import { cn } from '@/lib/utils';

type CallStatus = 'ringing' | 'active' | 'declined' | 'missed' | 'cancelled' | 'ended' | 'failed';
type CallPhase = 'idle' | 'incoming' | 'preparing' | 'ringing' | 'connecting' | 'active' | 'failed';

type VoiceCallRecord = {
  id: string;
  caller_id: string;
  callee_id: string;
  caller_name: string;
  callee_name: string;
  status: CallStatus;
  offer: { type: 'offer'; sdp: string };
  answer: { type: 'answer'; sdp: string } | null;
  created_at: string;
  expires_at: string;
};

type VoiceCallContextValue = {
  callInProgress: boolean;
  startCall: (contactId: string, contactName?: string) => Promise<void>;
};

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null);
const TERMINAL_STATUSES = new Set<CallStatus>(['declined', 'missed', 'cancelled', 'ended', 'failed']);
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.cloudflare.com:3478'] }];

function microphoneError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'Microphone permission was blocked. Allow microphone access in your browser, then try again.';
    }
    if (error.name === 'NotFoundError') return 'No microphone was found on this device.';
    if (error.name === 'NotReadableError') return 'Your microphone is already in use by another app or could not be opened.';
    if (error.name === 'OverconstrainedError') return 'Your microphone does not support the requested audio settings.';
  }
  return error instanceof Error ? error.message : 'The microphone could not be opened.';
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function VoiceCallProvider({ currentUserId, children }: { currentUserId: string; children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [displayName, setDisplayName] = useState('Zenqar contact');
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [turnConfigured, setTurnConfigured] = useState(true);
  const [inboxRevision, setInboxRevision] = useState(0);

  const callRef = useRef<VoiceCallRecord | null>(null);
  const phaseRef = useRef<CallPhase>('idle');
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const callChannelRef = useRef<RealtimeChannel | null>(null);
  const pendingLocalCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingRemoteCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteCandidateKeysRef = useRef(new Set<string>());
  const candidatePublishingEnabledRef = useRef(false);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const callAttemptRef = useRef(0);
  const ownsCallRef = useRef(false);

  const setCurrentPhase = useCallback((next: CallPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const setCurrentCall = useCallback((next: VoiceCallRecord | null) => {
    callRef.current = next;
  }, []);

  const stopMedia = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    pendingLocalCandidatesRef.current = [];
    pendingRemoteCandidatesRef.current = [];
    remoteCandidateKeysRef.current.clear();
    candidatePublishingEnabledRef.current = false;
    if (disconnectedTimeoutRef.current) clearTimeout(disconnectedTimeoutRef.current);
    disconnectedTimeoutRef.current = null;
    connectedAtRef.current = null;
    setElapsedSeconds(0);
    setMuted(false);
  }, []);

  const releaseAttemptMedia = useCallback((stream: MediaStream | null, peer: RTCPeerConnection | null) => {
    peer?.close();
    if (peer && peerRef.current === peer) peerRef.current = null;
    stream?.getTracks().forEach(track => track.stop());
    if (stream && localStreamRef.current === stream) localStreamRef.current = null;
  }, []);

  const removeCallChannel = useCallback(async () => {
    const channel = callChannelRef.current;
    callChannelRef.current = null;
    if (channel) await supabase.removeChannel(channel);
  }, [supabase]);

  const clearCall = useCallback(() => {
    callAttemptRef.current += 1;
    ownsCallRef.current = false;
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    if (terminalTimeoutRef.current) clearTimeout(terminalTimeoutRef.current);
    ringTimeoutRef.current = null;
    terminalTimeoutRef.current = null;
    stopMedia();
    void removeCallChannel();
    setCurrentCall(null);
    setCurrentPhase('idle');
    setError('');
    setInboxRevision(revision => revision + 1);
  }, [removeCallChannel, setCurrentCall, setCurrentPhase, stopMedia]);

  const failCall = useCallback((message: string) => {
    callAttemptRef.current += 1;
    ownsCallRef.current = false;
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = null;
    stopMedia();
    void removeCallChannel();
    setError(message);
    setCurrentPhase('failed');
  }, [removeCallChannel, setCurrentPhase, stopMedia]);

  const addRemoteCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const candidateKey = JSON.stringify(candidate);
    if (remoteCandidateKeysRef.current.has(candidateKey)) return;
    remoteCandidateKeysRef.current.add(candidateKey);
    const peer = peerRef.current;
    if (!peer?.remoteDescription) {
      pendingRemoteCandidatesRef.current.push(candidate);
      return;
    }
    try {
      await peer.addIceCandidate(candidate);
    } catch (candidateError) {
      console.warn('[voice-call] Could not add remote ICE candidate', candidateError);
    }
  }, []);

  const flushRemoteCandidates = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer?.remoteDescription) return;
    const candidates = pendingRemoteCandidatesRef.current.splice(0);
    for (const candidate of candidates) {
      try {
        await peer.addIceCandidate(candidate);
      } catch (candidateError) {
        console.warn('[voice-call] Could not add queued ICE candidate', candidateError);
      }
    }
  }, []);

  const publishCandidate = useCallback(async (callId: string, candidate: RTCIceCandidateInit) => {
    const { error: candidateError } = await supabase.from('voice_call_candidates').insert({
      call_id: callId,
      user_id: currentUserId,
      candidate,
    });
    if (candidateError) console.warn('[voice-call] ICE candidate was not published', candidateError);
  }, [currentUserId, supabase]);

  const flushLocalCandidates = useCallback(async (callId: string) => {
    const candidates = pendingLocalCandidatesRef.current.splice(0);
    await Promise.all(candidates.map(candidate => publishCandidate(callId, candidate)));
  }, [publishCandidate]);

  const handleCallUpdate = useCallback(async (updated: VoiceCallRecord) => {
    const current = callRef.current;
    if (!current || current.id !== updated.id) return;
    setCurrentCall(updated);

    if (TERMINAL_STATUSES.has(updated.status)) {
      callAttemptRef.current += 1;
      ownsCallRef.current = false;
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      const messages: Partial<Record<CallStatus, string>> = {
        declined: 'The call was declined.',
        missed: 'There was no answer.',
        cancelled: 'The call was cancelled.',
        failed: 'The call ended because the connection failed.',
      };
      if (messages[updated.status]) {
        setError(messages[updated.status] || '');
        setCurrentPhase('failed');
        stopMedia();
        terminalTimeoutRef.current = setTimeout(clearCall, 3500);
      } else {
        clearCall();
      }
      return;
    }

    // Every signed-in tab can observe an incoming call. Only the tab where the
    // user actually answered owns its media/session; passive tabs should simply
    // dismiss their incoming overlay when another tab accepts the call.
    if (
      updated.status === 'active'
      && current.callee_id === currentUserId
      && phaseRef.current === 'incoming'
      && !ownsCallRef.current
    ) {
      clearCall();
      return;
    }

    if (updated.status === 'active' && updated.answer && current.caller_id === currentUserId) {
      const peer = peerRef.current;
      if (peer && !peer.currentRemoteDescription) {
        try {
          await peer.setRemoteDescription(updated.answer);
          await flushRemoteCandidates();
          setCurrentPhase(peer.connectionState === 'connected' ? 'active' : 'connecting');
        } catch (answerError) {
          await endVoiceCall(updated.id, 'failed');
          failCall(answerError instanceof Error ? answerError.message : 'The call answer was invalid.');
        }
      }
    }
  }, [clearCall, currentUserId, failCall, flushRemoteCandidates, setCurrentCall, setCurrentPhase, stopMedia]);

  const subscribeToCall = useCallback(async (callId: string, attemptId?: number) => {
    await removeCallChannel();
    if (attemptId !== undefined && callAttemptRef.current !== attemptId) {
      throw new DOMException('The call setup was cancelled.', 'AbortError');
    }
    const channel = supabase.channel(`voice-call:${callId}:${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'voice_calls', filter: `id=eq.${callId}`,
      }, payload => {
        void handleCallUpdate(payload.new as VoiceCallRecord);
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'voice_call_candidates', filter: `call_id=eq.${callId}`,
      }, payload => {
        const candidateRow = payload.new as { user_id: string; candidate: RTCIceCandidateInit };
        if (candidateRow.user_id !== currentUserId) void addRemoteCandidate(candidateRow.candidate);
      });
    callChannelRef.current = channel;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Secure call signaling timed out.')), 10_000);
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          reject(new Error('Secure call signaling is unavailable. Check that migration 045 is installed.'));
        }
      });
    });

    if (attemptId !== undefined && callAttemptRef.current !== attemptId) {
      if (callChannelRef.current === channel) callChannelRef.current = null;
      await supabase.removeChannel(channel);
      throw new DOMException('The call setup was cancelled.', 'AbortError');
    }

    const { data: existingCandidates, error: candidateError } = await supabase
      .from('voice_call_candidates')
      .select('id, user_id, candidate')
      .eq('call_id', callId)
      .neq('user_id', currentUserId)
      .order('id', { ascending: true });
    if (candidateError) throw candidateError;
    for (const row of existingCandidates || []) await addRemoteCandidate(row.candidate as RTCIceCandidateInit);

    if (attemptId !== undefined && callAttemptRef.current !== attemptId) {
      if (callChannelRef.current === channel) callChannelRef.current = null;
      await supabase.removeChannel(channel);
      throw new DOMException('The call setup was cancelled.', 'AbortError');
    }

    const { data: latestCall, error: callError } = await supabase.from('voice_calls')
      .select('id, caller_id, callee_id, caller_name, callee_name, status, offer, answer, created_at, expires_at')
      .eq('id', callId)
      .maybeSingle();
    if (callError) throw callError;
    if (latestCall) await handleCallUpdate(latestCall as VoiceCallRecord);
    if (attemptId !== undefined && callAttemptRef.current !== attemptId) {
      if (callChannelRef.current === channel) callChannelRef.current = null;
      await supabase.removeChannel(channel);
      throw new DOMException('The call setup was cancelled.', 'AbortError');
    }
  }, [addRemoteCandidate, currentUserId, handleCallUpdate, removeCallChannel, supabase]);

  const getMicrophone = useCallback(async () => {
    if (!window.isSecureContext) throw new Error('Voice calls require a secure HTTPS connection.');
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      throw new Error('Voice calls are not supported by this browser. Please use a current Chrome, Edge, Firefox, or Safari version.');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      return stream;
    } catch (mediaError) {
      throw new Error(microphoneError(mediaError));
    }
  }, []);

  const getIceServers = useCallback(async (authorization: { callId: string } | { contactId: string }) => {
    try {
      const search = new URLSearchParams('callId' in authorization ? { callId: authorization.callId } : { contactId: authorization.contactId });
      const response = await fetch(`/api/calls/ice?${search}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('TURN credentials unavailable');
      const result = await response.json() as { iceServers?: RTCIceServer[]; turnConfigured?: boolean };
      setTurnConfigured(result.turnConfigured !== false);
      return result.iceServers?.length ? result.iceServers : FALLBACK_ICE_SERVERS;
    } catch {
      setTurnConfigured(false);
      return FALLBACK_ICE_SERVERS;
    }
  }, []);

  const createPeer = useCallback(async (
    stream: MediaStream,
    authorization: { callId: string } | { contactId: string },
    attemptId: number,
  ) => {
    const iceServers = await getIceServers(authorization);
    if (callAttemptRef.current !== attemptId) {
      throw new DOMException('The call setup was cancelled.', 'AbortError');
    }
    const peer = new RTCPeerConnection({
      iceServers,
      bundlePolicy: 'max-bundle',
      iceCandidatePoolSize: 4,
    });
    peerRef.current = peer;
    stream.getTracks().forEach(track => peer.addTrack(track, stream));
    peer.onicecandidate = event => {
      if (callAttemptRef.current !== attemptId || peerRef.current !== peer) return;
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON();
      const currentCallId = callRef.current?.id;
      if (currentCallId && candidatePublishingEnabledRef.current) void publishCandidate(currentCallId, candidate);
      else pendingLocalCandidatesRef.current.push(candidate);
    };
    peer.ontrack = event => {
      if (callAttemptRef.current !== attemptId || peerRef.current !== peer) return;
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        void remoteAudioRef.current.play().catch(() => undefined);
      }
    };
    peer.onconnectionstatechange = () => {
      if (callAttemptRef.current !== attemptId || peerRef.current !== peer) return;
      if (peer.connectionState === 'connected') {
        if (disconnectedTimeoutRef.current) clearTimeout(disconnectedTimeoutRef.current);
        disconnectedTimeoutRef.current = null;
        connectedAtRef.current ||= Date.now();
        setCurrentPhase('active');
      } else if (peer.connectionState === 'failed') {
        if (disconnectedTimeoutRef.current) clearTimeout(disconnectedTimeoutRef.current);
        disconnectedTimeoutRef.current = null;
        const activeCall = callRef.current;
        if (activeCall) void endVoiceCall(activeCall.id, 'failed');
        failCall('The voice connection failed. Check your network and try again.');
      } else if (peer.connectionState === 'disconnected') {
        setCurrentPhase('connecting');
        if (disconnectedTimeoutRef.current) clearTimeout(disconnectedTimeoutRef.current);
        disconnectedTimeoutRef.current = setTimeout(() => {
          if (peer.connectionState !== 'disconnected') return;
          const activeCall = callRef.current;
          if (activeCall) void endVoiceCall(activeCall.id, 'failed');
          failCall('The voice connection was lost. Check your network and try again.');
        }, 15_000);
      } else if (peer.connectionState === 'connecting') {
        setCurrentPhase('connecting');
      }
    };
    return peer;
  }, [failCall, getIceServers, publishCandidate, setCurrentPhase]);

  const startCall = useCallback(async (contactId: string, contactName = 'Zenqar contact') => {
    if (phaseRef.current !== 'idle') {
      setError('Finish the current call before starting another one.');
      return;
    }
    const attemptId = ++callAttemptRef.current;
    ownsCallRef.current = true;
    setDisplayName(contactName);
    setError('');
    setCurrentPhase('preparing');
    let createdCallId: string | null = null;
    let stream: MediaStream | null = null;
    let peer: RTCPeerConnection | null = null;
    try {
      stream = await getMicrophone();
      if (callAttemptRef.current !== attemptId) {
        releaseAttemptMedia(stream, peer);
        return;
      }
      localStreamRef.current = stream;
      peer = await createPeer(stream, { contactId }, attemptId);
      if (callAttemptRef.current !== attemptId) {
        releaseAttemptMedia(stream, peer);
        return;
      }
      const offer = await peer.createOffer({ offerToReceiveAudio: true });
      if (callAttemptRef.current !== attemptId) {
        releaseAttemptMedia(stream, peer);
        return;
      }
      await peer.setLocalDescription(offer);
      if (callAttemptRef.current !== attemptId) {
        releaseAttemptMedia(stream, peer);
        return;
      }
      if (!peer.localDescription?.sdp) throw new Error('The browser could not create a voice-call offer.');

      const result = await createVoiceCall(contactId, {
        type: 'offer',
        sdp: peer.localDescription.sdp,
      });
      if (result.error || !result.data) throw new Error(result.error || 'The call could not be started.');
      const createdCall = result.data as VoiceCallRecord;
      createdCallId = createdCall.id;
      if (callAttemptRef.current !== attemptId) {
        await endVoiceCall(createdCall.id, 'cancelled');
        releaseAttemptMedia(stream, peer);
        return;
      }
      setCurrentCall(createdCall);
      candidatePublishingEnabledRef.current = true;
      setDisplayName(createdCall.callee_name || contactName);
      await subscribeToCall(createdCall.id, attemptId);
      if (callAttemptRef.current !== attemptId) {
        await endVoiceCall(createdCall.id, 'cancelled');
        releaseAttemptMedia(stream, peer);
        return;
      }
      const latestCall = callRef.current;
      if (!latestCall || latestCall.id !== createdCall.id || TERMINAL_STATUSES.has(latestCall.status)) return;
      await flushLocalCandidates(createdCall.id);
      if (callAttemptRef.current !== attemptId) {
        await endVoiceCall(createdCall.id, 'cancelled');
        releaseAttemptMedia(stream, peer);
        return;
      }
      if (latestCall.status === 'active') {
        setCurrentPhase(peer.connectionState === 'connected' ? 'active' : 'connecting');
      } else {
        setCurrentPhase('ringing');
        ringTimeoutRef.current = setTimeout(() => {
          if (callRef.current?.id === createdCall.id && phaseRef.current === 'ringing') {
            void endVoiceCall(createdCall.id, 'missed');
            failCall('There was no answer.');
          }
        }, Math.max(1000, new Date(latestCall.expires_at).getTime() - Date.now()));
      }
    } catch (callError) {
      if (createdCallId) {
        await endVoiceCall(createdCallId, callAttemptRef.current === attemptId ? 'failed' : 'cancelled');
      }
      if (callAttemptRef.current !== attemptId) {
        releaseAttemptMedia(stream, peer);
        return;
      }
      failCall(callError instanceof Error ? callError.message : 'The call could not be started.');
    }
  }, [createPeer, failCall, flushLocalCandidates, getMicrophone, releaseAttemptMedia, setCurrentCall, setCurrentPhase, subscribeToCall]);

  const acceptIncomingCall = useCallback(async () => {
    const incoming = callRef.current;
    if (!incoming || phaseRef.current !== 'incoming') return;
    const attemptId = ++callAttemptRef.current;
    setError('');
    setCurrentPhase('preparing');
    candidatePublishingEnabledRef.current = false;
    let acceptedOnServer = false;
    let stream: MediaStream | null = null;
    let peer: RTCPeerConnection | null = null;
    try {
      stream = await getMicrophone();
      if (callAttemptRef.current !== attemptId) {
        releaseAttemptMedia(stream, peer);
        return;
      }
      localStreamRef.current = stream;
      peer = await createPeer(stream, { callId: incoming.id }, attemptId);
      if (callAttemptRef.current !== attemptId) {
        releaseAttemptMedia(stream, peer);
        return;
      }
      await subscribeToCall(incoming.id, attemptId);
      if (callAttemptRef.current !== attemptId) {
        releaseAttemptMedia(stream, peer);
        return;
      }
      await peer.setRemoteDescription(incoming.offer);
      if (callAttemptRef.current !== attemptId) {
        releaseAttemptMedia(stream, peer);
        return;
      }
      await flushRemoteCandidates();
      if (callAttemptRef.current !== attemptId) {
        releaseAttemptMedia(stream, peer);
        return;
      }
      const answer = await peer.createAnswer();
      if (callAttemptRef.current !== attemptId) {
        releaseAttemptMedia(stream, peer);
        return;
      }
      await peer.setLocalDescription(answer);
      if (callAttemptRef.current !== attemptId) {
        releaseAttemptMedia(stream, peer);
        return;
      }
      if (!peer.localDescription?.sdp) throw new Error('The browser could not answer this voice call.');
      const result = await acceptVoiceCall(incoming.id, {
        type: 'answer',
        sdp: peer.localDescription.sdp,
      });
      if (result.error || !result.data) throw new Error(result.error || 'The call is no longer available.');
      acceptedOnServer = true;
      if (callAttemptRef.current !== attemptId) {
        await endVoiceCall(incoming.id, 'ended');
        releaseAttemptMedia(stream, peer);
        return;
      }
      ownsCallRef.current = true;
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      setCurrentCall(result.data as VoiceCallRecord);
      candidatePublishingEnabledRef.current = true;
      await flushLocalCandidates(incoming.id);
      if (callAttemptRef.current !== attemptId) {
        await endVoiceCall(incoming.id, 'ended');
        releaseAttemptMedia(stream, peer);
        return;
      }
      setCurrentPhase(peer.connectionState === 'connected' ? 'active' : 'connecting');
      void remoteAudioRef.current?.play().catch(() => undefined);
    } catch (callError) {
      if (acceptedOnServer) await endVoiceCall(incoming.id, 'failed');
      if (callAttemptRef.current !== attemptId) {
        releaseAttemptMedia(stream, peer);
        return;
      }
      if (!acceptedOnServer && callRef.current?.status === 'active' && !ownsCallRef.current) {
        clearCall();
        return;
      }
      failCall(callError instanceof Error ? callError.message : 'The call could not be answered.');
    }
  }, [clearCall, createPeer, failCall, flushLocalCandidates, flushRemoteCandidates, getMicrophone, releaseAttemptMedia, setCurrentCall, setCurrentPhase, subscribeToCall]);

  const declineIncomingCall = useCallback(async () => {
    const incoming = callRef.current;
    if (!incoming) return;
    await declineVoiceCall(incoming.id);
    clearCall();
  }, [clearCall]);

  const hangUp = useCallback(async () => {
    const activeCall = callRef.current;
    const currentPhase = phaseRef.current;
    const ownedCall = ownsCallRef.current;
    clearCall();
    if (!activeCall) return;
    if (ownedCall) {
      const isOutgoingRing = activeCall.caller_id === currentUserId && activeCall.status === 'ringing';
      await endVoiceCall(activeCall.id, isOutgoingRing || currentPhase === 'ringing' ? 'cancelled' : 'ended');
    } else if (
      currentPhase === 'preparing'
      && activeCall.callee_id === currentUserId
      && activeCall.status === 'ringing'
    ) {
      await declineVoiceCall(activeCall.id);
    }
  }, [clearCall, currentUserId]);

  const toggleMute = useCallback(() => {
    const nextMuted = !muted;
    localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = !nextMuted; });
    setMuted(nextMuted);
  }, [muted]);

  useEffect(() => {
    if (phase !== 'active') return;
    connectedAtRef.current ||= Date.now();
    const updateDuration = () => setElapsedSeconds(Math.floor((Date.now() - (connectedAtRef.current || Date.now())) / 1000));
    const sendHeartbeat = () => {
      const activeCall = callRef.current;
      if (activeCall?.status === 'active') void heartbeatVoiceCall(activeCall.id);
    };
    updateDuration();
    sendHeartbeat();
    const durationTimer = setInterval(updateDuration, 1000);
    const heartbeatTimer = setInterval(sendHeartbeat, 30_000);
    return () => {
      clearInterval(durationTimer);
      clearInterval(heartbeatTimer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'idle') dialogRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    let mounted = true;
    const showIncoming = (incoming: VoiceCallRecord) => {
      if (!mounted || phaseRef.current !== 'idle' || incoming.status !== 'ringing') return;
      if (new Date(incoming.expires_at).getTime() <= Date.now()) return;
      ownsCallRef.current = false;
      setCurrentCall(incoming);
      setDisplayName(incoming.caller_name || 'Zenqar contact');
      setError('');
      setCurrentPhase('incoming');
      void subscribeToCall(incoming.id).catch(signalingError => {
        console.warn('[voice-call] Incoming call signaling is not ready', signalingError);
      });
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = setTimeout(() => {
        if (callRef.current?.id === incoming.id && phaseRef.current === 'incoming') {
          void endVoiceCall(incoming.id, 'missed');
          clearCall();
        }
      }, Math.max(1000, new Date(incoming.expires_at).getTime() - Date.now() + 250));
    };

    const scanIncoming = async () => {
      const { data, error: incomingError } = await supabase.from('voice_calls')
        .select('id, caller_id, callee_id, caller_name, callee_name, status, offer, answer, created_at, expires_at')
        .eq('callee_id', currentUserId)
        .eq('status', 'ringing')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!mounted) return;
      if (incomingError) {
        console.warn('[voice-call] Could not scan for incoming calls', incomingError);
        return;
      }
      if (data) showIncoming(data as VoiceCallRecord);
    };

    const incomingChannel = supabase.channel(`voice-inbox:${currentUserId}:${inboxRevision}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'voice_calls', filter: `callee_id=eq.${currentUserId}`,
      }, payload => showIncoming(payload.new as VoiceCallRecord))
      .subscribe(status => {
        // The first scan covers calls that existed before this component
        // mounted. Re-scanning after SUBSCRIBED closes the query/subscription
        // gap, so a call inserted while Realtime is connecting is not missed.
        if (status === 'SUBSCRIBED') void scanIncoming();
      });
    void scanIncoming();

    return () => {
      mounted = false;
      void supabase.removeChannel(incomingChannel);
    };
  }, [clearCall, currentUserId, inboxRevision, setCurrentCall, setCurrentPhase, subscribeToCall, supabase]);

  useEffect(() => () => {
    callAttemptRef.current += 1;
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    if (terminalTimeoutRef.current) clearTimeout(terminalTimeoutRef.current);
    const activeCall = callRef.current;
    if (activeCall && ownsCallRef.current) {
      const isOutgoingRing = activeCall.caller_id === currentUserId && activeCall.status === 'ringing';
      void endVoiceCall(activeCall.id, isOutgoingRing || phaseRef.current === 'ringing' ? 'cancelled' : 'ended');
    }
    ownsCallRef.current = false;
    stopMedia();
    const channel = callChannelRef.current;
    if (channel) void supabase.removeChannel(channel);
  }, [currentUserId, stopMedia, supabase]);

  const value = useMemo<VoiceCallContextValue>(() => ({
    callInProgress: phase !== 'idle',
    startCall,
  }), [phase, startCall]);

  const phaseLabel: Record<Exclude<CallPhase, 'idle' | 'incoming' | 'failed'>, string> = {
    preparing: 'Preparing secure audio…',
    ringing: 'Ringing…',
    connecting: 'Connecting…',
    active: formatDuration(elapsedSeconds),
  };
  const showCallControls = phase === 'connecting' || phase === 'active';

  return (
    <VoiceCallContext.Provider value={value}>
      {children}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {phase !== 'idle' && (
        <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xl outline-none" role="dialog" aria-modal="true" aria-label="Voice call">
          <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/10 bg-[#111119]/95 p-7 text-center shadow-2xl shadow-black/60">
            <div className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-zenqar-500/20 blur-3xl" />
            {phase === 'failed' && (
              <button type="button" onClick={clearCall} className="absolute right-4 top-4 rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white" aria-label="Close call status">
                <X className="h-4 w-4" />
              </button>
            )}

            <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center">
              {(phase === 'incoming' || phase === 'ringing') && <span className="absolute inset-0 animate-ping rounded-full bg-zenqar-500/20" />}
              <div className={cn('relative flex h-20 w-20 items-center justify-center rounded-full border', phase === 'failed' ? 'border-red-400/30 bg-red-500/15' : 'border-zenqar-400/30 bg-zenqar-500/20')}>
                {phase === 'failed' ? <PhoneOff className="h-8 w-8 text-red-300" /> : phase === 'incoming' ? <PhoneCall className="h-8 w-8 text-zenqar-300" /> : <Phone className="h-8 w-8 text-zenqar-300" />}
              </div>
            </div>

            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zenqar-300/70">
              {phase === 'incoming' ? 'Incoming Zenqar voice call' : 'Private voice call'}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{displayName}</h2>
            <p className={cn('mt-2 min-h-5 text-sm', phase === 'failed' ? 'text-red-300' : 'text-white/45')} role={phase === 'failed' ? 'alert' : undefined}>
              {phase === 'incoming' ? 'Would you like to answer?' : phase === 'failed' ? error : phaseLabel[phase as Exclude<CallPhase, 'idle' | 'incoming' | 'failed'>]}
            </p>

            {!turnConfigured && phase !== 'incoming' && phase !== 'failed' && (
              <p className="mt-3 rounded-xl border border-amber-400/15 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200/80">
                This workspace is using direct calling, which some restricted company networks may block.
              </p>
            )}

            {phase === 'incoming' ? (
              <div className="mt-8 flex items-center justify-center gap-8">
                <button type="button" onClick={() => void declineIncomingCall()} className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/20 transition hover:bg-red-400" aria-label="Decline call"><PhoneOff className="h-6 w-6" /></button>
                <button type="button" onClick={() => void acceptIncomingCall()} className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400" aria-label="Answer call"><Phone className="h-6 w-6" /></button>
              </div>
            ) : phase === 'failed' ? (
              <button type="button" onClick={clearCall} className="mt-7 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15">Close</button>
            ) : (
              <div className="mt-8 flex items-center justify-center gap-5">
                <button type="button" onClick={toggleMute} disabled={!showCallControls} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30" aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}>
                  {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>
                <button type="button" onClick={() => void hangUp()} className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/20 transition hover:bg-red-400" aria-label="End call"><PhoneOff className="h-6 w-6" /></button>
              </div>
            )}

            <div className="mt-7 flex items-center justify-center gap-2 text-[11px] text-white/30">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/70" />
              WebRTC audio is encrypted in transit
            </div>
          </div>
        </div>
      )}
    </VoiceCallContext.Provider>
  );
}

export function useVoiceCall() {
  const context = useContext(VoiceCallContext);
  if (!context) throw new Error('useVoiceCall must be used inside VoiceCallProvider');
  return context;
}
