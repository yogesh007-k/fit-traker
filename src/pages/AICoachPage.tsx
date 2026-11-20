import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronUp,
  History,
  Mic,
  MicOff,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useFitness } from '../context/FitnessContext';
import { api, ApiError, getInMemoryToken } from '../services/api';
import { AiChatMessage, AiConversation, CoachLanguage } from '../types/fitness';
import { Card, PageHeader, PrimaryButton, SecondaryButton } from '../components/ui/Primitives';
import { ChatMessageContent } from '../components/ai/ChatMessageContent';
import { matchDirectAppCommand } from '../utils/aiCommand';

const SUGGESTED_PROMPTS: Array<{ label: string; prompt: string; langHint?: CoachLanguage }> = [
  {
    label: 'Today from my history',
    prompt: 'What should I train today based on my saved workout history?',
  },
  {
    label: 'Beginner chest workout',
    prompt: 'Give me a beginner chest workout with sets, reps, and form cues.',
  },
  {
    label: 'Biceps vs triceps',
    prompt: 'Explain the difference between biceps and triceps and how to train both.',
  },
  {
    label: '5-day muscle plan',
    prompt: 'Create a 5-day muscle-building workout plan.',
  },
  {
    label: 'No-equipment home',
    prompt: 'Suggest a home workout without equipment.',
  },
  {
    label: 'Overload bench press',
    prompt: 'How do I progressively overload my bench press?',
  },
  {
    label: 'Protein for muscle',
    prompt: 'Explain protein requirements for muscle building and meal timing.',
  },
  {
    label: 'Weekly progress report',
    prompt: 'Give me a weekly workout progress report based on my saved logs.',
  },
  {
    label: 'தமிழ் (Tamil)',
    prompt: 'இன்று நான் எந்த தசைப் பயிற்சியை செய்ய வேண்டும்? என் பதிவுகளின் அடிப்படையில் சொல்லுங்கள்.',
    langHint: 'ta',
  },
  {
    label: 'Tanglish Coach',
    prompt: 'En chest & arms grow panna oru practical weekly plan Tanglish-la sollunga.',
    langHint: 'tanglish',
  },
];

const FOLLOWUP_CHIPS = [
  'Make this dumbbell/home friendly',
  'Give exact form cues & mistakes to avoid',
  'Break down sets, reps & progression',
  'Explain this in Tanglish',
];

interface SpeechRecLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface PendingExchange {
  conversationId?: string;
  userText: string;
  assistantText: string;
  replaceLastAssistant?: boolean;
}

function floatToInt16Base64(float32: Float32Array): string {
  const buf = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64PcmToFloat32(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const float32 = new Float32Array(new ArrayBuffer(sampleCount * 4));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

export const AICoachPage: React.FC = () => {
  const {
    profile,
    aiConversations,
    refreshBootstrap,
    notify,
    setActivePage,
    activeWorkout,
    setActiveWorkout,
  } = useFitness();

  // null = explicit new blank thread; undefined = auto-select latest saved thread
  const [selectedConvId, setSelectedConvId] = useState<string | null | undefined>(
    aiConversations[0]?.id
  );
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState<CoachLanguage>(profile?.language || 'en');
  const [sending, setSending] = useState(false);
  const [pendingExchange, setPendingExchange] = useState<PendingExchange | null>(null);
  const [errorState, setErrorState] = useState<{ message: string; retryable: boolean } | null>(
    null
  );
  const [lastFailedRequest, setLastFailedRequest] = useState<{
    message: string;
    replaceLastAssistant?: boolean;
    conversationId?: string;
  } | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [mobileThreadsOpen, setMobileThreadsOpen] = useState(false);

  // Live Voice Coach state (gemini-3.8-live via /api/ai/live)
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
  const [liveTranscripts, setLiveTranscripts] = useState<Array<{ role: 'user' | 'coach'; text: string }>>([]);
  const [liveError, setLiveError] = useState<string | null>(null);

  const sendingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const recRef = useRef<SpeechRecLike | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Live Voice refs
  const liveWsRef = useRef<WebSocket | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const liveInputCtxRef = useRef<AudioContext | null>(null);
  const liveOutputCtxRef = useRef<AudioContext | null>(null);
  const liveProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const liveNextStartRef = useRef<number>(0);
  const liveActiveSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Sync selected conversation if user switches accounts or deletes current thread
  useEffect(() => {
    if (selectedConvId === null) return;
    if (selectedConvId === undefined) {
      if (aiConversations.length > 0) setSelectedConvId(aiConversations[0].id);
      return;
    }
    if (!aiConversations.some((c) => c.id === selectedConvId)) {
      setSelectedConvId(aiConversations[0]?.id ?? null);
    }
  }, [aiConversations, selectedConvId]);

  const activeConversation: AiConversation | undefined = useMemo(() => {
    if (selectedConvId === null) return undefined;
    return aiConversations.find((c) => c.id === selectedConvId);
  }, [aiConversations, selectedConvId]);

  const displayedMessages: Array<AiChatMessage & { isStreaming?: boolean }> = useMemo(() => {
    const base = activeConversation?.messages || [];
    if (!pendingExchange) return base;

    const trimmedBase =
      pendingExchange.replaceLastAssistant &&
      base.length > 0 &&
      base[base.length - 1].role === 'assistant'
        ? base.slice(0, -1)
        : base;

    const alreadyHasSameUser =
      pendingExchange.replaceLastAssistant &&
      trimmedBase.length > 0 &&
      trimmedBase[trimmedBase.length - 1].role === 'user' &&
      trimmedBase[trimmedBase.length - 1].content.trim() === pendingExchange.userText;

    const out: Array<AiChatMessage & { isStreaming?: boolean }> = [...trimmedBase];
    if (!alreadyHasSameUser) {
      out.push({
        id: 'pending-user',
        role: 'user',
        content: pendingExchange.userText,
        timestamp: new Date().toISOString(),
      });
    }
    out.push({
      id: 'pending-assistant',
      role: 'assistant',
      content: pendingExchange.assistantText,
      timestamp: new Date().toISOString(),
      isStreaming: true,
    });
    return out;
  }, [activeConversation, pendingExchange]);

  useEffect(() => {
    if (displayedMessages.length === 0 && !errorState) {
      chatScrollRef.current?.scrollTo({ top: 0 });
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [displayedMessages.length, pendingExchange?.assistantText, errorState]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      stopLiveVoice();
    };
  }, []);

  const speakText = (text: string, lang: CoachLanguage) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text.replace(/[#*`]/g, '').slice(0, 600));
    utter.lang = lang === 'ta' ? 'ta-IN' : 'en-US';
    window.speechSynthesis.speak(utter);
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const sendMessage = async (
    msgText: string,
    opts?: {
      languageOverride?: CoachLanguage;
      replaceLastAssistant?: boolean;
      conversationIdOverride?: string;
    }
  ) => {
    const clean = msgText.trim();
    if (!clean || sendingRef.current) return;

    const targetLang = opts?.languageOverride || language;
    if (opts?.languageOverride) {
      setLanguage(opts.languageOverride);
    }

    setErrorState(null);
    setLastFailedRequest(null);

    if (!opts?.replaceLastAssistant) {
      const cmd = matchDirectAppCommand(clean, Boolean(activeWorkout));
      if (cmd) {
        if (cmd.type === 'pause-workout') {
          setActiveWorkout((w) => (w ? { ...w, isPaused: true } : w));
          notify('Workout paused.', 'info');
        } else if (cmd.type === 'resume-workout') {
          setActiveWorkout((w) => (w ? { ...w, isPaused: false } : w));
          notify('Workout resumed.', 'info');
        } else if (cmd.type === 'navigate') {
          setActivePage(cmd.page);
          notify(`Opened ${cmd.label}.`, 'info');
        }
        setInput('');
        return;
      }
    }

    const activeConvId =
      opts?.conversationIdOverride !== undefined
        ? opts.conversationIdOverride
        : activeConversation?.id;

    sendingRef.current = true;
    setSending(true);
    if (!opts?.replaceLastAssistant) {
      setInput('');
    }
    setPendingExchange({
      conversationId: activeConvId,
      userText: clean,
      assistantText: '',
      replaceLastAssistant: opts?.replaceLastAssistant,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await api.aiChatStream(
        {
          conversationId: activeConvId,
          message: clean,
          language: targetLang,
          replaceLastAssistant: opts?.replaceLastAssistant,
        },
        {
          signal: controller.signal,
          onStart: (convId) => {
            setPendingExchange((prev) => (prev ? { ...prev, conversationId: convId } : prev));
          },
          onChunk: (delta) => {
            setPendingExchange((prev) =>
              prev ? { ...prev, assistantText: prev.assistantText + delta } : prev
            );
          },
        }
      );

      setPendingExchange(null);
      await refreshBootstrap();
      setSelectedConvId(res.conversation.id);

      if (res.memoriesSaved > 0) {
        notify(
          `Saved ${res.memoriesSaved} personal preference${res.memoriesSaved > 1 ? 's' : ''} to AI Memory.`,
          'success'
        );
      }

      const lastReply = res.conversation.messages[res.conversation.messages.length - 1];
      if (autoSpeak && lastReply?.role === 'assistant') {
        speakText(lastReply.content, targetLang);
      }
    } catch (err) {
      const wasAborted =
        controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError');
      setPendingExchange(null);

      if (wasAborted) {
        if (!opts?.replaceLastAssistant) {
          setInput(clean);
        }
        notify('Response generation stopped.', 'info');
      } else {
        const msg =
          err instanceof ApiError
            ? err.message
            : 'Failed to reach AI Fitness Coach. Check your network and Gemini API configuration.';
        const retryable = err instanceof ApiError ? Boolean(err.retryable) : true;
        setErrorState({ message: msg, retryable });
        setLastFailedRequest({
          message: clean,
          replaceLastAssistant: opts?.replaceLastAssistant,
          conversationId: activeConvId,
        });
        if (!opts?.replaceLastAssistant) {
          setInput(clean);
        }
      }
    } finally {
      abortControllerRef.current = null;
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleRegenerateLast = () => {
    if (!activeConversation || sendingRef.current) return;
    const msgs = activeConversation.messages;
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    sendMessage(lastUser.content, {
      replaceLastAssistant: true,
      conversationIdOverride: activeConversation.id,
    });
  };

  const toggleVoiceMic = () => {
    setVoiceNote(null);
    if (listening && recRef.current) {
      recRef.current.stop();
      setListening(false);
      return;
    }
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecLike;
      webkitSpeechRecognition?: new () => SpeechRecLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceNote(
        'Browser speech dictation is unavailable in this browser. Type below or try Live Voice Coach.'
      );
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.lang = language === 'ta' ? 'ta-IN' : 'en-US';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (ev) => {
        const transcript = ev.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };
      rec.onerror = (ev) => {
        setVoiceNote(`Microphone / dictation note: ${ev.error}`);
        setListening(false);
      };
      rec.onend = () => {
        setListening(false);
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setVoiceNote('Microphone access could not be initialized. Type your message instead.');
      setListening(false);
    }
  };

  const stopLiveVoice = () => {
    try {
      liveProcessorRef.current?.disconnect();
    } catch {
      // ignore
    }
    liveProcessorRef.current = null;

    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach((t) => t.stop());
      liveStreamRef.current = null;
    }
    for (const src of liveActiveSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // ignore
      }
    }
    liveActiveSourcesRef.current.clear();
    liveNextStartRef.current = 0;

    if (liveInputCtxRef.current) {
      liveInputCtxRef.current.close().catch(() => {});
      liveInputCtxRef.current = null;
    }
    if (liveOutputCtxRef.current) {
      liveOutputCtxRef.current.close().catch(() => {});
      liveOutputCtxRef.current = null;
    }
    if (liveWsRef.current) {
      try {
        liveWsRef.current.close();
      } catch {
        // ignore
      }
      liveWsRef.current = null;
    }
    setLiveStatus('idle');
  };

  const startLiveVoice = async () => {
    if (liveStatus === 'connecting' || liveStatus === 'active') {
      stopLiveVoice();
      return;
    }

    setLiveError(null);
    setLiveTranscripts([]);
    setLiveStatus('connecting');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone capture is not supported in this browser environment.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      liveStreamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      liveInputCtxRef.current = inputCtx;
      liveOutputCtxRef.current = outputCtx;
      liveNextStartRef.current = 0;

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = getInMemoryToken();
      const wsUrl = `${proto}//${window.location.host}/api/ai/live?lang=${encodeURIComponent(language)}${
        token ? `&token=${encodeURIComponent(token)}` : ''
      }`;
      const ws = new WebSocket(wsUrl);
      liveWsRef.current = ws;

      ws.onopen = () => {
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        liveProcessorRef.current = processor;

        processor.onaudioprocess = (ev) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const pcmBase64 = floatToInt16Base64(ev.inputBuffer.getChannelData(0));
          ws.send(JSON.stringify({ audio: pcmBase64 }));
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data) as {
          type?: string;
          audio?: string;
          text?: string;
          error?: string;
        };

        if (msg.type === 'ready') {
          setLiveStatus('active');
        } else if (msg.type === 'audio' && msg.audio && liveOutputCtxRef.current) {
          const ctx = liveOutputCtxRef.current;
          const samples = base64PcmToFloat32(msg.audio);
          const buffer = ctx.createBuffer(1, samples.length, 24000);
          buffer.getChannelData(0).set(samples);
          const node = ctx.createBufferSource();
          node.buffer = buffer;
          node.connect(ctx.destination);

          const now = ctx.currentTime;
          const startAt = Math.max(now, liveNextStartRef.current);
          node.start(startAt);
          liveNextStartRef.current = startAt + buffer.duration;

          liveActiveSourcesRef.current.add(node);
          node.onended = () => {
            liveActiveSourcesRef.current.delete(node);
          };
        } else if (msg.type === 'interrupted') {
          for (const src of liveActiveSourcesRef.current) {
            try {
              src.stop();
            } catch {
              // ignore
            }
          }
          liveActiveSourcesRef.current.clear();
          liveNextStartRef.current = 0;
        } else if (msg.type === 'inputTranscript' && msg.text) {
          setLiveTranscripts((prev) => [...prev.slice(-11), { role: 'user', text: msg.text! }]);
        } else if (msg.type === 'outputTranscript' && msg.text) {
          setLiveTranscripts((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'coach') {
              return [...prev.slice(0, -1), { role: 'coach', text: last.text + msg.text! }];
            }
            return [...prev.slice(-11), { role: 'coach', text: msg.text! }];
          });
        } else if (msg.type === 'error') {
          setLiveError(msg.error || 'Live Voice Coach connection error.');
          setLiveStatus('error');
        } else if (msg.type === 'closed') {
          stopLiveVoice();
        }
      };

      ws.onerror = () => {
        setLiveError('Live Voice Coach WebSocket connection failed.');
        stopLiveVoice();
        setLiveStatus('error');
      };

      ws.onclose = () => {
        if (liveWsRef.current === ws) {
          stopLiveVoice();
        }
      };
    } catch (err) {
      stopLiveVoice();
      setLiveError(err instanceof Error ? err.message : 'Unable to start Live Voice Coach.');
      setLiveStatus('error');
    }
  };

  const handleDeleteConv = async (id: string) => {
    await api.deleteAiConversation(id);
    if (selectedConvId === id) setSelectedConvId(null);
    await refreshBootstrap();
    notify('Conversation removed.', 'info');
  };

  const startNewThread = () => {
    setSelectedConvId(null);
    setErrorState(null);
    setLastFailedRequest(null);
    setMobileThreadsOpen(false);
    textareaRef.current?.focus();
  };

  const ThreadListContent = (
    <div className="space-y-3">
      <PrimaryButton type="button" onClick={startNewThread} className="w-full">
        <Plus className="w-4 h-4" /> New Coaching Thread
      </PrimaryButton>

      <div className="text-xs font-mono uppercase tracking-wider text-[#A0AAA7] pt-1">
        Saved Conversations ({aiConversations.length})
      </div>

      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {aiConversations.length === 0 ? (
          <p className="text-xs text-[#A0AAA7] py-2">
            No coaching threads yet. Ask a question to start.
          </p>
        ) : (
          aiConversations.map((c) => {
            const active = activeConversation?.id === c.id;
            return (
              <div
                key={c.id}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 border text-xs ${
                  active
                    ? 'bg-[#B7FF67]/12 border-[#B7FF67]/40 text-[#F5F7F5]'
                    : 'bg-[#080B0D] border-white/10 text-[#A0AAA7]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedConvId(c.id);
                    setErrorState(null);
                    setMobileThreadsOpen(false);
                  }}
                  className="flex-1 text-left truncate font-medium cursor-pointer"
                >
                  {c.title}
                </button>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  onClick={() => handleDeleteConv(c.id)}
                  className="text-[#A0AAA7] hover:text-red-400 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="bg-[#080B0D] border border-white/10 rounded-xl p-3 text-xs space-y-1.5">
        <div className="font-semibold text-[#40E0D0]">Quick App Commands</div>
        <p className="text-[11px] text-[#A0AAA7]">
          Direct commands like &ldquo;Open 3D anatomy&rdquo;, &ldquo;Start live workout&rdquo;, or
          &ldquo;Pause workout&rdquo; navigate instantly. Full questions go straight to Gemini.
        </p>
      </div>
    </div>
  );

  const lastMessage = displayedMessages[displayedMessages.length - 1];
  const hasCompletedReply = Boolean(lastMessage && lastMessage.role === 'assistant' && !lastMessage.isStreaming);

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI Fitness Manager & Coach"
        subtitle="Context-aware coaching powered by server-side Gemini AI, synced with your training logs, nutrition, recovery, and persistent AI memory."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-[#101619] border border-white/10 p-1">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                  language === 'en' ? 'bg-[#B7FF67] text-[#080B0D] font-semibold' : 'text-[#A0AAA7]'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ta')}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                  language === 'ta' ? 'bg-[#40E0D0] text-[#080B0D] font-semibold' : 'text-[#A0AAA7]'
                }`}
              >
                தமிழ்
              </button>
              <button
                type="button"
                onClick={() => setLanguage('tanglish')}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                  language === 'tanglish'
                    ? 'bg-[#B7FF67] text-[#080B0D] font-semibold'
                    : 'text-[#A0AAA7]'
                }`}
              >
                Tanglish
              </button>
            </div>

            <SecondaryButton
              type="button"
              onClick={startLiveVoice}
              className={`text-xs py-2 ${
                liveStatus === 'active' || liveStatus === 'connecting'
                  ? 'border-[#40E0D0] text-[#40E0D0] bg-[#40E0D0]/10'
                  : ''
              }`}
            >
              <Radio
                className={`w-4 h-4 ${liveStatus === 'active' ? 'text-[#40E0D0] animate-pulse' : ''}`}
              />
              {liveStatus === 'active'
                ? 'End Live Voice'
                : liveStatus === 'connecting'
                ? 'Connecting...'
                : 'Live Voice'}
            </SecondaryButton>

            <SecondaryButton
              type="button"
              onClick={() => {
                setAutoSpeak((s) => !s);
                if (autoSpeak && 'speechSynthesis' in window) window.speechSynthesis.cancel();
              }}
              className="text-xs py-2"
            >
              {autoSpeak ? <Volume2 className="w-4 h-4 text-[#B7FF67]" /> : <VolumeX className="w-4 h-4" />}
              {autoSpeak ? 'TTS On' : 'TTS Off'}
            </SecondaryButton>
          </div>
        }
      />

      {/* Live Voice Session Banner */}
      {(liveStatus !== 'idle' || liveError) && (
        <Card className="border-[#40E0D0]/40 bg-[#101619] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#40E0D0]">
              <Radio className={`w-4 h-4 ${liveStatus === 'active' ? 'animate-pulse' : ''}`} />
              <span>
                {liveStatus === 'connecting'
                  ? 'Connecting Gemini Live Voice Coach...'
                  : liveStatus === 'active'
                  ? 'Live Voice Coach Active — Speak naturally'
                  : 'Live Voice Coach'}
              </span>
            </div>
            {(liveStatus === 'active' || liveStatus === 'connecting') && (
              <SecondaryButton type="button" onClick={stopLiveVoice} className="text-xs py-1 px-2.5">
                <Square className="w-3 h-3" /> Disconnect
              </SecondaryButton>
            )}
          </div>
          {liveError && <p className="text-xs text-red-300">{liveError}</p>}
          {liveTranscripts.length > 0 && (
            <div className="max-h-28 overflow-y-auto space-y-1 text-xs bg-[#080B0D] rounded-lg p-2.5 border border-white/10">
              {liveTranscripts.map((item, idx) => (
                <div key={idx} className={item.role === 'user' ? 'text-[#B7FF67]' : 'text-[#F5F7F5]'}>
                  <span className="font-mono uppercase text-[10px] opacity-75 mr-1.5">
                    {item.role === 'user' ? 'You:' : 'Coach:'}
                  </span>
                  {item.text}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Mobile Thread Controls (compact above chat so composer stays visible on mobile) */}
        <div className="lg:hidden space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileThreadsOpen((o) => !o)}
              className="flex-1 min-w-0 flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-[#101619] text-[#F5F7F5] border border-white/15 hover:border-[#40E0D0]/60 transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-2 min-w-0 flex-1">
                <History className="w-4 h-4 text-[#40E0D0] shrink-0" />
                <span className="truncate">
                  {activeConversation ? activeConversation.title : 'New Coaching Thread'} (
                  {aiConversations.length})
                </span>
              </span>
              {mobileThreadsOpen ? (
                <ChevronUp className="w-4 h-4 shrink-0 text-[#A0AAA7]" />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0 text-[#A0AAA7]" />
              )}
            </button>
            <PrimaryButton type="button" onClick={startNewThread} className="text-xs py-2 px-3 shrink-0">
              <Plus className="w-4 h-4" /> New
            </PrimaryButton>
          </div>

          {mobileThreadsOpen && <Card className="p-3">{ThreadListContent}</Card>}
        </div>

        {/* Desktop Conversation Sidebar */}
        <Card className="hidden lg:block lg:col-span-4">{ThreadListContent}</Card>

        {/* Main Chat Canvas */}
        <Card className="lg:col-span-8 flex flex-col min-h-[460px] lg:min-h-[580px]">
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[54vh] lg:max-h-[520px]"
          >
            {displayedMessages.length === 0 ? (
              <div className="py-1 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#B7FF67]/15 border border-[#B7FF67]/30 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-[#B7FF67]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#F5F7F5]">
                      FITTRACK X ULTRA Coach Ready
                    </h3>
                    <p className="text-xs text-[#A0AAA7] mt-1 leading-relaxed">
                      Ask about training splits, muscle anatomy, progressive overload, home
                      workouts, nutrition macros, recovery, or your saved logs in English, தமிழ், or
                      Tanglish.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-mono uppercase tracking-wider text-[#A0AAA7] mb-2">
                    Suggested Coaching Prompts
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SUGGESTED_PROMPTS.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        disabled={sending}
                        onClick={() =>
                          sendMessage(item.prompt, { languageOverride: item.langHint })
                        }
                        className="text-left text-xs bg-[#080B0D] border border-white/10 hover:border-[#B7FF67]/60 rounded-xl px-3.5 py-2.5 text-[#F5F7F5] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <div className="font-semibold text-[#B7FF67] mb-0.5">{item.label}</div>
                        <div className="text-[#A0AAA7] line-clamp-2">{item.prompt}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              displayedMessages.map((m, idx) => {
                const isLastMsg = idx === displayedMessages.length - 1;
                return (
                  <div
                    key={m.id}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-[#B7FF67] text-[#080B0D] font-medium whitespace-pre-wrap'
                          : 'bg-[#080B0D] border border-white/10 text-[#F5F7F5]'
                      }`}
                    >
                      {m.role === 'user' ? (
                        m.content
                      ) : m.isStreaming && !m.content ? (
                        <div className="flex items-center gap-2 text-xs text-[#40E0D0]">
                          <Sparkles className="w-3.5 h-3.5 animate-spin" />
                          <span>Analyzing your training context with Gemini...</span>
                        </div>
                      ) : (
                        <ChatMessageContent content={m.content} isStreaming={Boolean(m.isStreaming)} />
                      )}

                      {m.role === 'assistant' && !m.isStreaming && m.content && (
                        <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap items-center justify-end gap-3">
                          {isLastMsg && !sending && (
                            <button
                              type="button"
                              onClick={handleRegenerateLast}
                              className="text-[11px] text-[#A0AAA7] hover:text-[#B7FF67] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" /> Regenerate
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => speakText(m.content, language)}
                            className="text-[11px] text-[#40E0D0] hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Volume2 className="w-3 h-3" /> Read aloud
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {hasCompletedReply && !sending && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {FOLLOWUP_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => sendMessage(chip)}
                    className="text-[11px] bg-[#101619] border border-white/10 hover:border-[#40E0D0]/60 text-[#A0AAA7] hover:text-[#F5F7F5] rounded-lg px-2.5 py-1 transition-colors cursor-pointer"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            )}

            {errorState && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-xs text-red-200 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">AI Coach Request Failed</div>
                    <p className="mt-1 text-red-200/90">{errorState.message}</p>
                  </div>
                </div>
                {errorState.retryable && lastFailedRequest && (
                  <SecondaryButton
                    type="button"
                    onClick={() =>
                      sendMessage(lastFailedRequest.message, {
                        replaceLastAssistant: lastFailedRequest.replaceLastAssistant,
                        conversationIdOverride: lastFailedRequest.conversationId,
                      })
                    }
                    className="text-xs py-1.5 px-3 shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </SecondaryButton>
                )}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {voiceNote && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
              {voiceNote}
            </div>
          )}

          {/* Input Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="mt-4 pt-3 border-t border-white/10 flex items-end gap-2"
          >
            <button
              type="button"
              onClick={toggleVoiceMic}
              aria-label={listening ? 'Stop voice dictation' : 'Start voice dictation'}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                listening
                  ? 'bg-red-500/20 border-red-400 text-red-300'
                  : 'bg-[#080B0D] border-white/15 text-[#A0AAA7] hover:text-[#40E0D0]'
              }`}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder={
                language === 'ta'
                  ? 'உங்கள் உடற்பயிற்சி கேள்வியை கேளுங்கள்... (Enter to send)'
                  : language === 'tanglish'
                  ? 'Ungal fitness question-ai Tanglish-la kelunga... (Enter to send)'
                  : 'Ask your AI Fitness Coach anything... (Enter to send, Shift+Enter for new line)'
              }
              className="flex-1 resize-none bg-[#080B0D] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7F5] focus:outline-none focus:border-[#B7FF67] max-h-32 overflow-y-auto"
            />

            {sending ? (
              <SecondaryButton
                type="button"
                onClick={stopGeneration}
                className="shrink-0 border-red-500/40 text-red-300 hover:bg-red-500/10"
              >
                <Square className="w-3.5 h-3.5" /> Stop
              </SecondaryButton>
            ) : (
              <PrimaryButton type="submit" disabled={!input.trim()} className="shrink-0">
                <Send className="w-4 h-4" /> Send
              </PrimaryButton>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
};
