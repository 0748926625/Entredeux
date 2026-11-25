import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Heart, MessageCircle, Sparkles, UserPlus } from 'lucide-react';
import { AI_PARTNERS } from '../data/aiPartners';
import type { AiPartner, UserProfile } from '../types';
import { Avatar } from './Avatar';

interface DiscoverViewProps {
  currentUserUid: string | null;
  currentProfile: UserProfile | null;
  memberProfiles: UserProfile[];
  likedIds: Set<string>;
  receivedLikeIds: Set<string>;
  onSignIn: () => void;
  onOpenProfileModal: () => void;
  onToggleLike: (targetId: string) => Promise<void>;
  onStartMemberChat: (member: UserProfile) => Promise<void>;
  onStartAiChat: (partner: AiPartner, initialIcebreaker?: string) => Promise<void>;
}

type SourceFilter = 'all' | 'members' | 'ai';
type GenderFilter = 'preference' | 'all' | 'femme' | 'homme';

export function DiscoverView({
  currentUserUid,
  currentProfile,
  memberProfiles,
  likedIds,
  receivedLikeIds,
  onSignIn,
  onOpenProfileModal,
  onToggleLike,
  onStartMemberChat,
  onStartAiChat,
}: DiscoverViewProps) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('preference');
  const [expandedIcebreakers, setExpandedIcebreakers] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const matchesPreference = (gender: 'homme' | 'femme') => {
    if (genderFilter === 'all') return true;
    if (genderFilter === 'femme') return gender === 'femme';
    if (genderFilter === 'homme') return gender === 'homme';
    const pref = currentProfile?.lookingFor ?? 'tous';
    if (pref === 'femmes') return gender === 'femme';
    if (pref === 'hommes') return gender === 'homme';
    return true;
  };

  const filteredMembers = useMemo(() => {
    if (sourceFilter === 'ai') return [];
    return memberProfiles.filter(
      (m) => m.uid !== currentUserUid && matchesPreference(m.gender)
    );
  }, [memberProfiles, currentUserUid, sourceFilter, genderFilter, currentProfile?.lookingFor]);

  const filteredAiPartners = useMemo(() => {
    if (sourceFilter === 'members') return [];
    return AI_PARTNERS.filter((p) => matchesPreference(p.gender));
  }, [sourceFilter, genderFilter, currentProfile?.lookingFor]);

  const handleLikeClick = async (targetId: string) => {
    if (!currentUserUid) {
      onSignIn();
      return;
    }
    setBusyId(targetId);
    try {
      await onToggleLike(targetId);
    } finally {
      setBusyId(null);
    }
  };

  const handleMemberChat = async (member: UserProfile) => {
    if (!currentUserUid) {
      onSignIn();
      return;
    }
    setBusyId(member.uid);
    try {
      await onStartMemberChat(member);
    } finally {
      setBusyId(null);
    }
  };

  const handleAiChat = async (partner: AiPartner, icebreaker?: string) => {
    if (!currentUserUid) {
      onSignIn();
      return;
    }
    setBusyId(partner.id);
    try {
      await onStartAiChat(partner, icebreaker);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-10">
      {/* Editorial Hero */}
      <section className="pt-2 pb-8 border-b border-white/[0.08]">
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-medium tracking-wide text-rose-400">
            Rencontres authentiques · Immersion linguistique
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-editorial font-semibold text-white leading-[1.06] text-balance">
            Apprends l’anglais en flirtant ou en te faisant des amis.
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl">
            Écris naturellement dans ta langue : chaque message est traduit instantanément avec une
            note culturelle, lu à voix haute et filtré pour garder ton regard sur la langue que tu
            veux maîtriser.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {!currentUserUid ? (
              <button
                type="button"
                onClick={onSignIn}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold text-white transition-colors"
              >
                Commencer avec Google
              </button>
            ) : !currentProfile ? (
              <button
                type="button"
                onClick={onOpenProfileModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold text-white transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Publier mon profil
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenProfileModal}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-xs font-medium text-zinc-200 transition-colors"
              >
                Modifier ma fiche ({currentProfile.firstName})
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#141217] border border-white/[0.08]">
          {(
            [
              { id: 'all', label: 'Tous' },
              { id: 'members', label: 'Membres' },
              { id: 'ai', label: 'Partenaires IA' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSourceFilter(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                sourceFilter === tab.id
                  ? 'bg-rose-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#141217] border border-white/[0.08]">
          {(
            [
              { id: 'preference', label: 'Mes préférences' },
              { id: 'femme', label: 'Femmes' },
              { id: 'homme', label: 'Hommes' },
              { id: 'all', label: 'Tout voir' },
            ] as const
          ).map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGenderFilter(g.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                genderFilter === g.id
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </section>

      {/* Real Members Section */}
      {sourceFilter !== 'ai' && (
        <section className="space-y-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-editorial font-semibold text-white">Membres inscrits</h2>
            <span className="text-xs text-zinc-500 tabular-nums">
              {filteredMembers.length} {filteredMembers.length > 1 ? 'profils' : 'profil'}
            </span>
          </div>

          {!currentUserUid ? (
            <div className="p-8 rounded-2xl bg-[#141217] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-white">
                  Connecte-toi avec Google pour découvrir les membres en direct
                </p>
                <p className="text-xs text-zinc-400">
                  Crée ta fiche, aime les profils qui te plaisent et discute en temps réel.
                </p>
              </div>
              <button
                type="button"
                onClick={onSignIn}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors"
              >
                Connexion Google
              </button>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#141217] border border-white/[0.08] text-sm text-zinc-400">
              Aucun autre membre publié ne correspond à ce filtre pour le moment. Tu peux déjà
              publier ton profil ou discuter avec nos partenaires d’entraînement ci-dessous.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMembers.map((member) => {
                const isLiked = likedIds.has(member.uid);
                const isMutual = isLiked && receivedLikeIds.has(member.uid);
                return (
                  <article
                    key={member.uid}
                    className="rounded-2xl bg-[#141217] border border-white/[0.08] overflow-hidden flex flex-col"
                  >
                    <div className="relative">
                      <Avatar name={member.firstName} src={member.photoDataUrl} size="card" />
                      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#141217] via-[#141217]/75 to-transparent pointer-events-none" />
                      <div className="absolute bottom-3 left-5 right-5 flex items-end justify-between gap-2">
                        <div>
                          <div className="text-xs text-rose-300">
                            {member.nativeLanguage === 'en' ? 'Anglophone' : 'Francophone'}
                            {isMutual ? ' · Coup de cœur mutuel' : ''}
                          </div>
                          <h3 className="text-2xl font-editorial font-semibold text-white">
                            {member.firstName}, <span className="tabular-nums">{member.age}</span>
                          </h3>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 pt-2 flex-1 flex flex-col justify-between gap-4">
                      <div className="space-y-3">
                        <p className="text-xs text-zinc-400">
                          {member.city}
                          {member.job ? ` · ${member.job}` : ''}
                          {` · ${member.englishLevel}`}
                        </p>
                        <p className="text-sm text-zinc-300 leading-relaxed line-clamp-3">
                          {member.bio || 'Disponible pour échanger en français et en anglais.'}
                        </p>
                        {member.interests.length > 0 && (
                          <p className="text-xs text-zinc-500 leading-relaxed">
                            {member.interests.join(' · ')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 pt-2">
                        <button
                          type="button"
                          disabled={busyId === member.uid}
                          onClick={() => handleLikeClick(member.uid)}
                          className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                            isLiked
                              ? 'bg-rose-600/20 border border-rose-500/40 text-rose-300'
                              : 'bg-white/[0.05] hover:bg-white/10 text-zinc-200'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                          {isLiked ? 'Aimé' : 'J’aime'}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === member.uid}
                          onClick={() => handleMemberChat(member)}
                          className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Discuter
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* AI Practice Partners Section */}
      {sourceFilter !== 'members' && (
        <section className="space-y-5">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-2xl font-editorial font-semibold text-white">
                Partenaires d’entraînement IA
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Choisis leur langue de réponse (anglais, français ou mixte) et lance la discussion
                avec un brise-glace.
              </p>
            </div>
            <span className="text-xs text-zinc-500 tabular-nums">
              {filteredAiPartners.length} partenaires
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAiPartners.map((partner) => {
              const isLiked = likedIds.has(partner.id);
              const showIcebreakers = Boolean(expandedIcebreakers[partner.id]);
              return (
                <article
                  key={partner.id}
                  className="rounded-2xl bg-[#141217] border border-white/[0.08] overflow-hidden flex flex-col"
                >
                  <div className="relative">
                    <Avatar name={partner.firstName} src={partner.avatarUrl} size="card" />
                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#141217] via-[#141217]/75 to-transparent pointer-events-none" />
                    <div className="absolute bottom-3 left-5 right-5">
                      <div className="text-xs text-rose-300">
                        Partenaire IA · {partner.nativeLanguage === 'en' ? 'Anglophone' : 'Bilingue'}
                      </div>
                      <h3 className="text-2xl font-editorial font-semibold text-white">
                        {partner.firstName}, <span className="tabular-nums">{partner.age}</span>
                      </h3>
                    </div>
                  </div>

                  <div className="p-5 pt-2 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <p className="text-xs text-zinc-400">
                        {partner.city} · {partner.job} · {partner.englishLevel}
                      </p>
                      <p className="text-sm text-zinc-300 leading-relaxed">{partner.bio}</p>
                      <p className="text-xs text-zinc-500">{partner.interests.join(' · ')}</p>

                      {/* Icebreakers toggle */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedIcebreakers((prev) => ({
                              ...prev,
                              [partner.id]: !prev[partner.id],
                            }))
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Idées de brise-glace
                          {showIcebreakers ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {showIcebreakers && (
                          <div className="mt-2.5 space-y-2 border-t border-white/[0.08] pt-2.5">
                            {partner.icebreakers.map((ib, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() =>
                                  handleAiChat(
                                    partner,
                                    currentProfile?.nativeLanguage === 'en' ? ib.fr : ib.en
                                  )
                                }
                                className="w-full text-left p-2.5 rounded-xl bg-[#0B0A0D] hover:bg-white/[0.04] border border-white/[0.06] transition-colors space-y-0.5"
                              >
                                <div className="text-xs text-zinc-200 leading-snug">
                                  {currentProfile?.nativeLanguage === 'en' ? ib.fr : ib.en}
                                </div>
                                <div className="text-[11px] text-zinc-500 leading-snug">
                                  {currentProfile?.nativeLanguage === 'en' ? ib.en : ib.fr}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 pt-2">
                      <button
                        type="button"
                        disabled={busyId === partner.id}
                        onClick={() => handleLikeClick(partner.id)}
                        className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                          isLiked
                            ? 'bg-rose-600/20 border border-rose-500/40 text-rose-300'
                            : 'bg-white/[0.05] hover:bg-white/10 text-zinc-200'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                        {isLiked ? 'Aimé' : 'J’aime'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === partner.id}
                        onClick={() => handleAiChat(partner)}
                        className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Discuter
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
