import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Compass, MessageCircle, Sparkles } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Avatar } from './components/Avatar';
import { ChatView } from './components/ChatView';
import { DiscoverView } from './components/DiscoverView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MethodView } from './components/MethodView';
import { NotebookView } from './components/NotebookView';
import { ProfileModal } from './components/ProfileModal';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { useSpeech } from './hooks/useSpeech';
import type {
  AiPartner,
  AppTab,
  Conversation,
  LikeRecord,
  UserProfile,
  VocabEntry,
  VoiceSettings,
} from './types';

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>('discover');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [authError, setAuthError] = useState('');

  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<UserProfile[]>([]);
  const [sentLikes, setSentLikes] = useState<LikeRecord[]>([]);
  const [receivedLikes, setReceivedLikes] = useState<LikeRecord[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [vocabEntries, setVocabEntries] = useState<VocabEntry[]>([]);
  const [initialChatDraft, setInitialChatDraft] = useState('');

  const { enVoices, frVoices, speak } = useSpeech();

  const [localVoiceSettings, setLocalVoiceSettings] = useState<VoiceSettings>({
    enVoice: 'browser:auto',
    frVoice: 'browser:auto',
    autoPlay: true,
  });

  const effectiveVoiceSettings = currentProfile?.voiceSettings ?? localVoiceSettings;

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Ensure private user record exists & subscribe to own profile + published profiles + likes + conversations + vocab
  useEffect(() => {
    if (!authReady || !user) {
      setCurrentProfile(null);
      setMemberProfiles([]);
      setSentLikes([]);
      setReceivedLikes([]);
      setConversations([]);
      setVocabEntries([]);
      setActiveConversationId(null);
      return;
    }

    const uid = user.uid;

    // Sync isolated PII record
    const syncPrivate = async () => {
      const privRef = doc(db, 'userPrivate', uid);
      try {
        await setDoc(
          privRef,
          {
            uid,
            email: (user.email ?? '').slice(0, 200),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        console.error('Private user sync error:', err);
      }
    };
    void syncPrivate();

    const unsubOwnProfile = onSnapshot(
      doc(db, 'profiles', uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setCurrentProfile(data);
          setLocalVoiceSettings(data.voiceSettings);
        } else {
          setCurrentProfile(null);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `profiles/${uid}`)
    );

    const unsubPublishedProfiles = onSnapshot(
      query(collection(db, 'profiles'), where('isPublished', '==', true)),
      (snap) => {
        setMemberProfiles(snap.docs.map((d) => d.data() as UserProfile));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'profiles')
    );

    const unsubSentLikes = onSnapshot(
      query(collection(db, 'likes'), where('fromUid', '==', uid)),
      (snap) => {
        setSentLikes(snap.docs.map((d) => d.data() as LikeRecord));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'likes')
    );

    const unsubReceivedLikes = onSnapshot(
      query(collection(db, 'likes'), where('toUid', '==', uid)),
      (snap) => {
        setReceivedLikes(snap.docs.map((d) => d.data() as LikeRecord));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'likes')
    );

    const unsubConversations = onSnapshot(
      query(
        collection(db, 'conversations'),
        where('participantIds', 'array-contains', uid),
        orderBy('updatedAt', 'desc')
      ),
      (snap) => {
        setConversations(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Conversation, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'conversations')
    );

    const vocabPath = `userPrivate/${uid}/vocab`;
    const unsubVocab = onSnapshot(
      query(
        collection(db, vocabPath),
        where('ownerId', '==', uid),
        orderBy('createdAt', 'desc')
      ),
      (snap) => {
        setVocabEntries(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<VocabEntry, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, vocabPath)
    );

    return () => {
      unsubOwnProfile();
      unsubPublishedProfiles();
      unsubSentLikes();
      unsubReceivedLikes();
      unsubConversations();
      unsubVocab();
    };
  }, [authReady, user]);

  const likedIds = useMemo(() => new Set(sentLikes.map((l) => l.toUid)), [sentLikes]);
  const receivedLikeIds = useMemo(
    () => new Set(receivedLikes.map((l) => l.fromUid)),
    [receivedLikes]
  );
  const savedExpressions = useMemo(
    () => new Set(vocabEntries.map((v) => v.expression.trim().toLowerCase())),
    [vocabEntries]
  );

  const handleSignIn = useCallback(async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'La connexion Google a été annulée.'
      );
    }
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    setIsProfileOpen(false);
  };

  const handleSaveProfile = async (
    data: Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) return;
    const uid = user.uid;
    const ref = doc(db, 'profiles', uid);
    const existing = await getDoc(ref);

    if (existing.exists()) {
      try {
        await updateDoc(ref, {
          ...data,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `profiles/${uid}`);
      }
    } else {
      try {
        await setDoc(ref, {
          uid,
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `profiles/${uid}`);
      }
    }
    setLocalVoiceSettings(data.voiceSettings);
  };

  const handleUpdateVoiceSettings = async (next: VoiceSettings) => {
    setLocalVoiceSettings(next);
    if (!user || !currentProfile) return;
    try {
      await updateDoc(doc(db, 'profiles', user.uid), {
        voiceSettings: next,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `profiles/${user.uid}`);
    }
  };

  const handleToggleLike = async (targetId: string) => {
    if (!user) return;
    const likeId = `${user.uid}_${targetId}`;
    const likeRef = doc(db, 'likes', likeId);
    if (likedIds.has(targetId)) {
      try {
        await deleteDoc(likeRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `likes/${likeId}`);
      }
    } else {
      try {
        await setDoc(likeRef, {
          fromUid: user.uid,
          toUid: targetId,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `likes/${likeId}`);
      }
    }
  };

  const handleStartMemberChat = async (member: UserProfile) => {
    if (!user) return;
    const [pA, pB] = [user.uid, member.uid].sort();
    const convId = `${pA}_${pB}`;
    const convRef = doc(db, 'conversations', convId);
    const snap = await getDoc(convRef);
    if (!snap.exists()) {
      try {
        await setDoc(convRef, {
          participantA: pA,
          participantB: pB,
          participantIds: [pA, pB],
          isAiPartner: false,
          aiPartnerId: '',
          aiResponseMode: 'en',
          lastMessagePreviewEn: '',
          lastMessagePreviewFr: '',
          lastSenderId: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `conversations/${convId}`);
      }
    }
    setActiveConversationId(convId);
    setActiveTab('chats');
  };

  const handleStartAiChat = async (partner: AiPartner, icebreaker?: string) => {
    if (!user) return;
    const convId = `${user.uid}_${partner.id}`;
    const convRef = doc(db, 'conversations', convId);
    const snap = await getDoc(convRef);
    if (!snap.exists()) {
      try {
        await setDoc(convRef, {
          participantA: user.uid,
          participantB: partner.id,
          participantIds: [user.uid, partner.id],
          isAiPartner: true,
          aiPartnerId: partner.id,
          aiResponseMode: 'en',
          lastMessagePreviewEn: '',
          lastMessagePreviewFr: '',
          lastSenderId: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `conversations/${convId}`);
      }
    }
    if (icebreaker) {
      setInitialChatDraft(icebreaker);
    }
    setActiveConversationId(convId);
    setActiveTab('chats');
  };

  const handleSaveVocab = async (payload: {
    expression: string;
    translation: string;
    note: string;
    example: string;
    lang: 'en' | 'fr';
    sourcePartnerName?: string;
  }) => {
    if (!user) return;
    const vocabPath = `userPrivate/${user.uid}/vocab`;
    try {
      await addDoc(collection(db, vocabPath), {
        ownerId: user.uid,
        expression: payload.expression.slice(0, 200),
        translation: payload.translation.slice(0, 300),
        note: payload.note.slice(0, 500),
        example: payload.example.slice(0, 400),
        lang: payload.lang,
        sourcePartnerName: (payload.sourcePartnerName ?? '').slice(0, 60),
        status: 'to_review',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, vocabPath);
    }
  };

  const handleToggleVocabStatus = async (entry: VocabEntry) => {
    if (!user) return;
    const path = `userPrivate/${user.uid}/vocab/${entry.id}`;
    try {
      await updateDoc(doc(db, 'userPrivate', user.uid, 'vocab', entry.id), {
        status: entry.status === 'to_review' ? 'mastered' : 'to_review',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteVocab = async (entryId: string) => {
    if (!user) return;
    const path = `userPrivate/${user.uid}/vocab/${entryId}`;
    try {
      await deleteDoc(doc(db, 'userPrivate', user.uid, 'vocab', entryId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const navItems: Array<{ id: AppTab; label: string; icon: typeof Compass }> = [
    { id: 'discover', label: 'Découvrir', icon: Compass },
    { id: 'chats', label: 'Discussions', icon: MessageCircle },
    { id: 'notebook', label: 'Carnet', icon: BookOpen },
    { id: 'method', label: 'Méthode', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-[#0B0A0D] text-[#F5F2F4] flex flex-col">
      {/* Desktop Top Bar (3-zone contract) */}
      <header className="hidden md:flex sticky top-0 z-40 h-16 items-center justify-between gap-8 px-8 bg-[#0B0A0D]/90 backdrop-blur-md border-b border-white/[0.08]">
        <button
          type="button"
          onClick={() => setActiveTab('discover')}
          className="text-2xl font-editorial font-semibold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          EntreDeux
        </button>

        <nav className="flex items-center gap-7">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1.5 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                  active
                    ? 'text-white border-rose-500'
                    : 'text-zinc-400 border-transparent hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          {!user ? (
            <button
              type="button"
              onClick={() => void handleSignIn()}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors"
            >
              Connexion Google
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              className="inline-flex items-center gap-2.5 pl-1.5 pr-3.5 py-1.5 rounded-xl bg-[#141217] hover:bg-white/[0.06] border border-white/10 text-xs font-medium text-white whitespace-nowrap shrink-0 transition-colors"
            >
              <Avatar
                name={currentProfile?.firstName || user.displayName || 'E'}
                src={currentProfile?.photoDataUrl}
                size="sm"
                className="w-7 h-7 text-[11px]"
              />
              <span>{currentProfile?.firstName || 'Mon profil'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Compact Top Header */}
      <header className="md:hidden sticky top-0 z-40 h-12 px-4 flex items-center justify-between bg-[#0B0A0D]/90 backdrop-blur-md border-b border-white/[0.08]">
        <button
          type="button"
          onClick={() => setActiveTab('discover')}
          className="text-xl font-editorial font-semibold text-white whitespace-nowrap shrink-0"
        >
          EntreDeux
        </button>

        {!user ? (
          <button
            type="button"
            onClick={() => void handleSignIn()}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-xs font-semibold text-white whitespace-nowrap shrink-0"
          >
            Connexion
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            aria-label="Mon profil"
            className="inline-flex items-center gap-2 text-xs font-medium text-zinc-200"
          >
            <Avatar
              name={currentProfile?.firstName || user.displayName || 'E'}
              src={currentProfile?.photoDataUrl}
              size="sm"
              className="w-7 h-7 text-[11px]"
            />
          </button>
        )}
      </header>

      {/* Auth error banner if popup blocked */}
      {authError && (
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 pt-4">
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-xs text-rose-200 flex items-center justify-between gap-3">
            <span>{authError}</span>
            <button
              type="button"
              onClick={() => setAuthError('')}
              className="text-rose-300 hover:text-white shrink-0"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 pb-24 md:pb-12">
        {activeTab === 'discover' && (
          <DiscoverView
            currentUserUid={user?.uid ?? null}
            currentProfile={currentProfile}
            memberProfiles={memberProfiles}
            likedIds={likedIds}
            receivedLikeIds={receivedLikeIds}
            onSignIn={() => void handleSignIn()}
            onOpenProfileModal={() => setIsProfileOpen(true)}
            onToggleLike={handleToggleLike}
            onStartMemberChat={handleStartMemberChat}
            onStartAiChat={handleStartAiChat}
          />
        )}

        {activeTab === 'chats' && (
          <ChatView
            currentUserUid={user?.uid ?? null}
            currentProfile={currentProfile}
            memberProfiles={memberProfiles}
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={setActiveConversationId}
            onStartAiChat={handleStartAiChat}
            onSignIn={() => void handleSignIn()}
            enVoices={enVoices}
            frVoices={frVoices}
            voiceSettings={effectiveVoiceSettings}
            onUpdateVoiceSettings={handleUpdateVoiceSettings}
            onSpeak={speak}
            savedExpressions={savedExpressions}
            onSaveVocab={handleSaveVocab}
            initialDraft={initialChatDraft}
            onConsumeInitialDraft={() => setInitialChatDraft('')}
          />
        )}

        {activeTab === 'notebook' && (
          <NotebookView
            currentUserUid={user?.uid ?? null}
            entries={vocabEntries}
            onSignIn={() => void handleSignIn()}
            onSpeak={(text, lang) =>
              void speak(
                text,
                lang,
                lang === 'en'
                  ? effectiveVoiceSettings.enVoice
                  : effectiveVoiceSettings.frVoice
              )
            }
            onAddEntry={handleSaveVocab}
            onToggleStatus={handleToggleVocabStatus}
            onDeleteEntry={handleDeleteVocab}
          />
        )}

        {activeTab === 'method' && (
          <MethodView
            onSpeakSample={(text, lang) =>
              void speak(
                text,
                lang,
                lang === 'en'
                  ? effectiveVoiceSettings.enVoice
                  : effectiveVoiceSettings.frVoice
              )
            }
            onGoDiscover={() => setActiveTab('discover')}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-[#0B0A0D]/95 backdrop-blur-md border-t border-white/[0.08] grid grid-cols-4 items-center"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-rose-400' : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Profile Editor Modal */}
      {user && (
        <ProfileModal
          key={`${user.uid}_${isProfileOpen ? 'open' : 'closed'}`}
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          profile={currentProfile}
          userEmail={user.email ?? ''}
          enVoices={enVoices}
          frVoices={frVoices}
          onTestVoice={(text, lang, voiceId) => void speak(text, lang, voiceId)}
          onSaveProfile={handleSaveProfile}
          onSignOut={handleSignOut}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
