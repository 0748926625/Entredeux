import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookmarkCheck,
  BookmarkPlus,
  Eye,
  EyeOff,
  Info,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { AI_PARTNERS, getAiPartnerById } from '../data/aiPartners';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { VoiceOption } from '../hooks/useSpeech';
import type {
  AiPartner,
  AiResponseMode,
  ChatMessage,
  Conversation,
  TranslationResult,
  UserProfile,
  VoiceSettings,
} from '../types';
import { sendAiChatApi, transcribeAudioApi, translateMessageApi } from '../utils/api';
import { Avatar } from './Avatar';

interface ChatViewProps {
  currentUserUid: string | null;
  currentProfile: UserProfile | null;
  memberProfiles: UserProfile[];
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  onStartAiChat: (partner: AiPartner) => Promise<void>;
  onSignIn: () => void;
  enVoices: VoiceOption[];
  frVoices: VoiceOption[];
  voiceSettings: VoiceSettings;
  onUpdateVoiceSettings: (next: VoiceSettings) => Promise<void>;
  onSpeak: (text: string, lang: 'en' | 'fr', overrideVoice?: string) => Promise<void>;
  savedExpressions: Set<string>;
  onSaveVocab: (payload: {
    expression: string;
    translation: string;
    note: string;
    example: string;
    lang: 'en' | 'fr';
    sourcePartnerName: string;
  }) => Promise<void>;
  initialDraft?: string;
  onConsumeInitialDraft?: () => void;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative;
}
interface SpeechRecognitionEvent {
  results: ArrayLike<SpeechRecognitionResult>;
}
interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function ChatView({
  currentUserUid,
  currentProfile,
  memberProfiles,
  conversations,
  activeConversationId,
  onSelectConversation,
  onStartAiChat,
  onSignIn,
  enVoices,
  frVoices,
  voiceSettings,
  onUpdateVoiceSettings,
  onSpeak,
  savedExpressions,
  onSaveVocab,
  initialDraft,
  onConsumeInitialDraft,
}: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [preview, setPreview] = useState<TranslationResult | null>(null);
  const [previewSourceText, setPreviewSourceText] = useState('');
  const [translating, setTranslating] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [error, setError] = useState('');
  const [revealedNativeIds, setRevealedNativeIds] = useState<Record<string, boolean>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [showIcebreakers, setShowIcebreakers] = useState(false);

  // Mic dictation state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const initialLoadDoneRef = useRef<string | null>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const autoPlayTimerRef = useRef<number | null>(null);

  const userNativeLang = currentProfile?.nativeLanguage ?? 'fr';
  const targetLang: 'en' | 'fr' = userNativeLang === 'fr' ? 'en' : 'fr';

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const memberMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    for (const m of memberProfiles) map.set(m.uid, m);
    return map;
  }, [memberProfiles]);

  const getPartnerDisplay = (conv: Conversation) => {
    if (conv.isAiPartner) {
      const aiP = getAiPartnerById(conv.aiPartnerId);
      return {
        name: aiP?.firstName ?? 'Partenaire IA',
        avatar: aiP?.avatarUrl ?? '',
        subtitle: aiP ? `Partenaire IA · ${aiP.city}` : 'Partenaire IA',
        aiPartner: aiP ?? null,
      };
    }
    const otherUid =
      conv.participantA === currentUserUid ? conv.participantB : conv.participantA;
    const member = memberMap.get(otherUid);
    return {
      name: member?.firstName ?? 'Membre EntreDeux',
      avatar: member?.photoDataUrl ?? '',
      subtitle: member ? `${member.city} · ${member.englishLevel}` : 'Membre EntreDeux',
      aiPartner: null,
    };
  };

  useEffect(() => {
    if (initialDraft && activeConversationId) {
      setDraft(initialDraft);
      setPreview(null);
      onConsumeInitialDraft?.();
    }
  }, [initialDraft, activeConversationId, onConsumeInitialDraft]);

  // Subscribe to messages for active conversation
  useEffect(() => {
    if (autoPlayTimerRef.current) {
      window.clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }

    if (!currentUserUid || !activeConversationId) {
      setMessages([]);
      initialLoadDoneRef.current = null;
      knownMessageIdsRef.current = new Set();
      return;
    }

    initialLoadDoneRef.current = null;
    knownMessageIdsRef.current = new Set();
    setRevealedNativeIds({});
    setExpandedNotes({});
    setError('');

    const path = `conversations/${activeConversationId}/messages`;
    const q = query(
      collection(db, path),
      where('participantIds', 'array-contains', currentUserUid),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: ChatMessage[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChatMessage, 'id'>),
        }));

        if (initialLoadDoneRef.current !== activeConversationId) {
          initialLoadDoneRef.current = activeConversationId;
          knownMessageIdsRef.current = new Set(loaded.map((m) => m.id));
          setMessages(loaded);
          return;
        }

        // Detect newly arrived incoming messages from interlocutor
        const newlyReceived: ChatMessage[] = [];
        for (const msg of loaded) {
          if (!knownMessageIdsRef.current.has(msg.id)) {
            knownMessageIdsRef.current.add(msg.id);
            if (msg.senderId !== currentUserUid) {
              newlyReceived.push(msg);
            }
          }
        }

        setMessages(loaded);

        if (newlyReceived.length > 0 && voiceSettings.autoPlay) {
          const latestIncoming = newlyReceived[newlyReceived.length - 1];
          const textToSpeak =
            targetLang === 'en' ? latestIncoming.textEn : latestIncoming.textFr;
          const voiceToUse =
            targetLang === 'en' ? voiceSettings.enVoice : voiceSettings.frVoice;

          if (autoPlayTimerRef.current) {
            window.clearTimeout(autoPlayTimerRef.current);
          }
          // Speak newly received message automatically 1.5 seconds after arrival
          autoPlayTimerRef.current = window.setTimeout(() => {
            void onSpeak(textToSpeak, targetLang, voiceToUse);
          }, 1500);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );

    return () => {
      unsubscribe();
      if (autoPlayTimerRef.current) {
        window.clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [
    activeConversationId,
    currentUserUid,
    targetLang,
    voiceSettings.autoPlay,
    voiceSettings.enVoice,
    voiceSettings.frVoice,
    onSpeak,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, aiThinking]);

  const handlePreview = async () => {
    const clean = draft.trim();
    if (!clean) return;
    setError('');
    setTranslating(true);
    try {
      const result = await translateMessageApi({
        text: clean,
        senderNativeLang: userNativeLang,
      });
      setPreview(result);
      setPreviewSourceText(clean);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la traduction.');
    } finally {
      setTranslating(false);
    }
  };

  const handleSend = async () => {
    if (!currentUserUid || !activeConversation) return;
    const clean = draft.trim();
    if (!clean || sending) return;

    setError('');
    setSending(true);

    try {
      const translation =
        preview && previewSourceText === clean
          ? preview
          : await translateMessageApi({
              text: clean,
              senderNativeLang: userNativeLang,
            });

      const messagesPath = `conversations/${activeConversation.id}/messages`;
      const msgPayload = {
        participantIds: activeConversation.participantIds,
        senderId: currentUserUid,
        senderType: 'user' as const,
        originalLang: translation.detectedLang,
        originalText: clean,
        textFr: translation.textFr,
        textEn: translation.textEn,
        note: translation.note,
        keyExpression: translation.keyExpression,
        keyExpressionMeaning: translation.keyExpressionMeaning,
        keyExpressionExample: translation.keyExpressionExample,
        createdAt: serverTimestamp(),
      };

      try {
        await addDoc(collection(db, messagesPath), msgPayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, messagesPath);
      }

      const convPath = `conversations/${activeConversation.id}`;
      try {
        await updateDoc(doc(db, 'conversations', activeConversation.id), {
          lastMessagePreviewEn: translation.textEn.slice(0, 280),
          lastMessagePreviewFr: translation.textFr.slice(0, 280),
          lastSenderId: currentUserUid,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, convPath);
      }

      setDraft('');
      setPreview(null);
      setPreviewSourceText('');
      setShowIcebreakers(false);

      // Speak sent message aloud immediately in target language
      if (voiceSettings.autoPlay) {
        const spokenText = targetLang === 'en' ? translation.textEn : translation.textFr;
        const preferredVoice =
          targetLang === 'en' ? voiceSettings.enVoice : voiceSettings.frVoice;
        void onSpeak(spokenText, targetLang, preferredVoice);
      }

      // If AI partner conversation, trigger AI reply
      if (activeConversation.isAiPartner) {
        const partner = getAiPartnerById(activeConversation.aiPartnerId);
        if (partner) {
          setAiThinking(true);
          try {
            const recentHistory = [
              ...messages.slice(-8).map((m) => ({
                role: (m.senderType === 'ai' ? 'ai' : 'user') as 'user' | 'ai',
                text: m.originalText,
              })),
              { role: 'user' as const, text: clean },
            ];
            const aiReply = await sendAiChatApi({
              partnerId: partner.id,
              partnerName: partner.firstName,
              partnerPersona: partner.personaPrompt,
              responseMode: activeConversation.aiResponseMode,
              userNativeLang,
              userName: currentProfile?.firstName || 'toi',
              history: recentHistory,
              userMessage: clean,
            });

            const aiMsgPayload = {
              participantIds: activeConversation.participantIds,
              senderId: partner.id,
              senderType: 'ai' as const,
              originalLang: aiReply.originalLang,
              originalText: aiReply.originalText,
              textFr: aiReply.textFr,
              textEn: aiReply.textEn,
              note: aiReply.note,
              keyExpression: aiReply.keyExpression,
              keyExpressionMeaning: aiReply.keyExpressionMeaning,
              keyExpressionExample: aiReply.keyExpressionExample,
              createdAt: serverTimestamp(),
            };

            try {
              await addDoc(collection(db, messagesPath), aiMsgPayload);
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, messagesPath);
            }

            try {
              await updateDoc(doc(db, 'conversations', activeConversation.id), {
                lastMessagePreviewEn: aiReply.textEn.slice(0, 280),
                lastMessagePreviewFr: aiReply.textFr.slice(0, 280),
                lastSenderId: partner.id,
                updatedAt: serverTimestamp(),
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, convPath);
            }
          } finally {
            setAiThinking(false);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’envoi du message.');
    } finally {
      setSending(false);
    }
  };

  const handleModeChange = async (mode: AiResponseMode) => {
    if (!activeConversation || !activeConversation.isAiPartner) return;
    try {
      await updateDoc(doc(db, 'conversations', activeConversation.id), {
        aiResponseMode: mode,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${activeConversation.id}`);
    }
  };

  const startFallbackAudioRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) mediaChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(mediaChunksRef.current, { type: mimeType });
        if (blob.size < 400) {
          setIsRecording(false);
          return;
        }
        setIsTranscribing(true);
        try {
          const buffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const audioBase64 = btoa(binary);
          const transcript = await transcribeAudioApi({
            audioBase64,
            mimeType,
            languageHint: userNativeLang,
          });
          if (transcript) {
            setDraft((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
            setPreview(null);
          }
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'La transcription audio a échoué.'
          );
        } finally {
          setIsTranscribing(false);
          setIsRecording(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setError('Accès au microphone refusé ou indisponible.');
      setIsRecording(false);
    }
  };

  const toggleMicDictation = () => {
    setError('');
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.lang = userNativeLang === 'fr' ? 'fr-FR' : 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results?.[0]?.[0]?.transcript?.trim();
          if (transcript) {
            setDraft((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
            setPreview(null);
          }
        };

        recognition.onerror = (ev: { error: string }) => {
          recognitionRef.current = null;
          setIsRecording(false);
          if (ev.error !== 'aborted' && ev.error !== 'no-speech') {
            // Fall back seamlessly to MediaRecorder + Gemini transcription
            void startFallbackAudioRecorder();
          }
        };

        recognition.onend = () => {
          recognitionRef.current = null;
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
        return;
      } catch {
        // Fall through to MediaRecorder fallback
      }
    }

    void startFallbackAudioRecorder();
  };

  if (!currentUserUid) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-[#141217] border border-white/[0.08] text-center space-y-4">
        <h2 className="text-3xl font-editorial font-semibold text-white">Discussions bilingues</h2>
        <p className="text-sm text-zinc-400">
          Connecte-toi avec Google pour discuter en temps réel avec les membres inscrits et nos
          partenaires d’entraînement IA.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold text-white transition-colors"
        >
          Connexion Google
        </button>
      </div>
    );
  }

  const activePartnerInfo = activeConversation ? getPartnerDisplay(activeConversation) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 min-h-[calc(100vh-11rem)]">
      {/* Left Sidebar: Conversations */}
      <aside
        className={`rounded-2xl bg-[#141217] border border-white/[0.08] flex flex-col overflow-hidden ${
          activeConversation ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <h2 className="text-xl font-editorial font-semibold text-white">Discussions</h2>
          <span className="text-xs text-zinc-500 tabular-nums">{conversations.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
          {conversations.length === 0 ? (
            <div className="p-5 space-y-4">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Aucune conversation ouverte pour le moment. Choisis un partenaire d’entraînement ou
                écris à un membre depuis Découvrir.
              </p>
              <div className="space-y-2">
                {AI_PARTNERS.map((partner) => (
                  <button
                    key={partner.id}
                    type="button"
                    onClick={() => onStartAiChat(partner)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-[#0B0A0D] hover:bg-white/[0.04] border border-white/[0.06] text-left transition-colors"
                  >
                    <Avatar name={partner.firstName} src={partner.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-white truncate">
                        {partner.firstName}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate">
                        Partenaire IA · {partner.city}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            conversations.map((conv) => {
              const info = getPartnerDisplay(conv);
              const isActive = conv.id === activeConversationId;
              const previewText =
                targetLang === 'en'
                  ? conv.lastMessagePreviewEn || 'Nouvelle discussion'
                  : conv.lastMessagePreviewFr || 'New conversation';

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => onSelectConversation(conv.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-colors ${
                    isActive ? 'bg-rose-600/12' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <Avatar name={info.name} src={info.avatar} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-white truncate">{info.name}</span>
                      {conv.isAiPartner && (
                        <span className="text-[11px] text-rose-400 shrink-0">IA</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{previewText}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Main Chat Pane */}
      <section
        className={`rounded-2xl bg-[#141217] border border-white/[0.08] flex flex-col overflow-hidden ${
          activeConversation ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {!activeConversation || !activePartnerInfo ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
            <h3 className="text-2xl font-editorial font-semibold text-white">
              Sélectionne une conversation
            </h3>
            <p className="text-sm text-zinc-400 max-w-md">
              Tes messages sont automatiquement traduits, accompagnés d’une note contextuelle et
              lus à voix haute dans la langue que tu apprends.
            </p>
          </div>
        ) : (
          <>
            {/* Chat Header + Direct Voice Controls */}
            <header className="px-4 sm:px-6 py-3.5 border-b border-white/[0.08] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelectConversation(null)}
                    aria-label="Retour aux discussions"
                    className="lg:hidden min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-zinc-300 hover:bg-white/5"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <Avatar
                    name={activePartnerInfo.name}
                    src={activePartnerInfo.avatar}
                    size="md"
                  />
                  <div className="min-w-0">
                    <h2 className="text-lg font-editorial font-semibold text-white truncate">
                      {activePartnerInfo.name}
                    </h2>
                    <p className="text-xs text-zinc-400 truncate">{activePartnerInfo.subtitle}</p>
                  </div>
                </div>

                {/* AI Response Language Mode */}
                {activeConversation.isAiPartner && (
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0B0A0D] border border-white/[0.08]">
                    {(
                      [
                        { id: 'en', label: 'Anglais' },
                        { id: 'fr', label: 'Français' },
                        { id: 'mix', label: 'Mixte' },
                      ] as const
                    ).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => handleModeChange(mode.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                          activeConversation.aiResponseMode === mode.id
                            ? 'bg-rose-600 text-white'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Direct Voice & Auto-Play Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-white/[0.06] text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500">Voix EN</span>
                  <select
                    aria-label="Voix anglaise"
                    value={voiceSettings.enVoice}
                    onChange={(e) =>
                      void onUpdateVoiceSettings({ ...voiceSettings, enVoice: e.target.value })
                    }
                    className="max-w-[140px] px-2.5 py-1.5 rounded-lg bg-[#0B0A0D] border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
                  >
                    {enVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500">Voix FR</span>
                  <select
                    aria-label="Voix française"
                    value={voiceSettings.frVoice}
                    onChange={(e) =>
                      void onUpdateVoiceSettings({ ...voiceSettings, frVoice: e.target.value })
                    }
                    className="max-w-[140px] px-2.5 py-1.5 rounded-lg bg-[#0B0A0D] border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
                  >
                    {frVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void onUpdateVoiceSettings({
                      ...voiceSettings,
                      autoPlay: !voiceSettings.autoPlay,
                    })
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    voiceSettings.autoPlay
                      ? 'bg-rose-600/15 border border-rose-500/30 text-rose-200'
                      : 'bg-[#0B0A0D] border border-white/10 text-zinc-400'
                  }`}
                >
                  {voiceSettings.autoPlay ? (
                    <Volume2 className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5" />
                  )}
                  {voiceSettings.autoPlay ? 'Lecture auto : On' : 'Lecture auto : Off'}
                </button>

                {activePartnerInfo.aiPartner && (
                  <button
                    type="button"
                    onClick={() => setShowIcebreakers((prev) => !prev)}
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/10 text-zinc-200 font-medium transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                    Brise-glace
                  </button>
                )}
              </div>
            </header>

            {/* Optional AI Icebreakers Drawer */}
            {showIcebreakers && activePartnerInfo.aiPartner && (
              <div className="px-4 sm:px-6 py-3 bg-[#0B0A0D] border-b border-white/[0.08] space-y-2">
                <div className="text-xs font-medium text-zinc-400">
                  Idées pour lancer la conversation avec {activePartnerInfo.name} :
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {activePartnerInfo.aiPartner.icebreakers.map((ib, idx) => {
                    const text = userNativeLang === 'fr' ? ib.en : ib.fr;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setDraft(text);
                          setPreview(null);
                          setShowIcebreakers(false);
                        }}
                        className="p-2.5 rounded-xl bg-[#141217] hover:border-rose-500/40 border border-white/[0.08] text-left text-xs text-zinc-200 leading-snug transition-colors"
                      >
                        {text}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messages.length === 0 && (
                <div className="py-10 text-center space-y-2">
                  <p className="text-sm text-zinc-300">
                    Lance la discussion avec {activePartnerInfo.name}.
                  </p>
                  <p className="text-xs text-zinc-500">
                    {userNativeLang === 'fr'
                      ? 'Écris en français ou en anglais — tes messages seront traduits en anglais et lus à voix haute.'
                      : 'Write in English or French — your messages will be translated into French and read aloud.'}
                  </p>
                </div>
              )}

              {messages.map((msg) => {
                const isMine = msg.senderId === currentUserUid;
                const primaryText = userNativeLang === 'fr' ? msg.textEn : msg.textFr;
                const nativeText = userNativeLang === 'fr' ? msg.textFr : msg.textEn;
                const showNative = Boolean(revealedNativeIds[msg.id]);
                const showNote = Boolean(expandedNotes[msg.id]);
                const revealLabel =
                  userNativeLang === 'fr'
                    ? showNative
                      ? 'Masquer le français'
                      : 'Afficher en français'
                    : showNative
                      ? 'Masquer l’anglais'
                      : 'Afficher en anglais';

                const expressionKey = msg.keyExpression.trim().toLowerCase();
                const alreadySaved = expressionKey ? savedExpressions.has(expressionKey) : false;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] sm:max-w-[75%] rounded-2xl p-4 space-y-2.5 ${
                        isMine
                          ? 'bg-rose-950/45 border border-rose-500/25 text-white'
                          : 'bg-[#0B0A0D] border border-white/[0.08] text-zinc-100'
                      }`}
                    >
                      {/* Primary visible text (Target language ONLY by default) */}
                      <p className="text-sm sm:text-[15px] leading-relaxed">{primaryText}</p>

                      {/* Optional revealed native translation */}
                      {showNative && (
                        <p className="text-xs text-zinc-300/90 pt-2 border-t border-white/[0.08] leading-relaxed">
                          {nativeText}
                        </p>
                      )}

                      {/* Bubble Action Controls */}
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedNativeIds((prev) => ({
                              ...prev,
                              [msg.id]: !prev[msg.id],
                            }))
                          }
                          className="inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                        >
                          {showNative ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                          {revealLabel}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void onSpeak(
                              primaryText,
                              targetLang,
                              targetLang === 'en' ? voiceSettings.enVoice : voiceSettings.frVoice
                            )
                          }
                          className="inline-flex items-center gap-1 text-rose-300 hover:text-rose-200 transition-colors"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          Écouter
                        </button>

                        {msg.note && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedNotes((prev) => ({
                                ...prev,
                                [msg.id]: !prev[msg.id],
                              }))
                            }
                            className="inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                          >
                            <Info className="w-3.5 h-3.5" />
                            {showNote ? 'Masquer la note' : 'Note'}
                          </button>
                        )}
                      </div>

                      {/* Explanatory Note */}
                      {showNote && msg.note && (
                        <div className="p-2.5 rounded-xl bg-white/[0.04] text-xs text-zinc-300 leading-relaxed">
                          {msg.note}
                        </div>
                      )}

                      {/* Key Expression to Remember */}
                      {msg.keyExpression && (
                        <div className="pt-2 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="text-xs space-y-0.5">
                            <div className="text-rose-300 font-medium">
                              Expression clé · {msg.keyExpression}
                            </div>
                            {msg.keyExpressionMeaning && (
                              <div className="text-zinc-400">{msg.keyExpressionMeaning}</div>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={alreadySaved}
                            onClick={() =>
                              void onSaveVocab({
                                expression: msg.keyExpression,
                                translation: msg.keyExpressionMeaning || msg.textFr,
                                note: msg.note,
                                example: msg.keyExpressionExample || primaryText,
                                lang: targetLang,
                                sourcePartnerName: activePartnerInfo.name,
                              })
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium shrink-0 transition-colors ${
                              alreadySaved
                                ? 'bg-white/[0.05] text-zinc-400 cursor-default'
                                : 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-200'
                            }`}
                          >
                            {alreadySaved ? (
                              <>
                                <BookmarkCheck className="w-3.5 h-3.5 text-rose-400" />
                                Dans le carnet
                              </>
                            ) : (
                              <>
                                <BookmarkPlus className="w-3.5 h-3.5" />
                                Enregistrer
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {aiThinking && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl bg-[#0B0A0D] border border-white/[0.08] text-xs text-zinc-400">
                    {activePartnerInfo.name} est en train d’écrire…
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Composer Area */}
            <div className="p-4 border-t border-white/[0.08] space-y-3 bg-[#121015]">
              {error && (
                <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/30 text-xs text-rose-200">
                  {error}
                </div>
              )}

              {/* Pre-send Translation Preview */}
              {preview && (
                <div className="p-4 rounded-xl bg-[#0B0A0D] border border-rose-500/30 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-rose-300">
                      Aperçu avant envoi ({targetLang === 'en' ? 'Anglais naturel' : 'Français naturel'})
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreview(null)}
                      className="text-xs text-zinc-400 hover:text-white"
                    >
                      Fermer
                    </button>
                  </div>
                  <p className="text-sm text-white leading-relaxed">
                    {targetLang === 'en' ? preview.textEn : preview.textFr}
                  </p>
                  {preview.note && (
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      <span className="text-zinc-300 font-medium">Note : </span>
                      {preview.note}
                    </p>
                  )}
                  {preview.keyExpression && (
                    <p className="text-xs text-rose-200/90">
                      <span className="font-medium">À retenir : </span>
                      {preview.keyExpression} — {preview.keyExpressionMeaning}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        void onSpeak(
                          targetLang === 'en' ? preview.textEn : preview.textFr,
                          targetLang,
                          targetLang === 'en' ? voiceSettings.enVoice : voiceSettings.frVoice
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Écouter l’aperçu
                    </button>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void handleSend()}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
                    >
                      Envoyer ce message
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={toggleMicDictation}
                  disabled={isTranscribing || sending}
                  aria-label={isRecording ? 'Arrêter la dictée' : 'Dicter au micro'}
                  className={`min-w-[44px] min-h-[44px] px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-medium shrink-0 transition-colors ${
                    isRecording
                      ? 'bg-rose-600 text-white'
                      : 'bg-[#0B0A0D] border border-white/10 text-zinc-300 hover:border-white/25 hover:text-white'
                  }`}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span className="hidden sm:inline">
                    {isTranscribing ? 'Transcription...' : isRecording ? 'Arrêter' : 'Micro'}
                  </span>
                </button>

                <textarea
                  rows={2}
                  maxLength={2000}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (preview && e.target.value.trim() !== previewSourceText) {
                      setPreview(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder={
                    userNativeLang === 'fr'
                      ? 'Écris en français ou en anglais (Entrée pour envoyer)...'
                      : 'Write in English or French (Enter to send)...'
                  }
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0B0A0D] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 resize-none"
                />

                <button
                  type="button"
                  disabled={!draft.trim() || translating || sending}
                  onClick={() => void handlePreview()}
                  className="min-h-[44px] px-3.5 rounded-xl bg-[#0B0A0D] border border-white/10 hover:border-white/25 disabled:opacity-40 text-xs font-medium text-zinc-200 whitespace-nowrap shrink-0 transition-colors"
                >
                  {translating ? 'Traduction...' : 'Aperçu & note'}
                </button>

                <button
                  type="button"
                  disabled={!draft.trim() || sending}
                  onClick={() => void handleSend()}
                  aria-label="Envoyer"
                  className="min-w-[44px] min-h-[44px] px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">{sending ? 'Envoi...' : 'Envoyer'}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
