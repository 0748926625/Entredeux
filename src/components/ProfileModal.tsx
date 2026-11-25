import { useRef, useState } from 'react';
import { Camera, LogOut, Trash2, Volume2, X } from 'lucide-react';
import type {
  EnglishLevel,
  Gender,
  LookingFor,
  NativeLanguage,
  UserProfile,
  VoiceSettings,
} from '../types';
import type { VoiceOption } from '../hooks/useSpeech';
import { compressProfileImage } from '../utils/imageCompression';
import { Avatar } from './Avatar';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  userEmail: string;
  enVoices: VoiceOption[];
  frVoices: VoiceOption[];
  onTestVoice: (text: string, lang: 'en' | 'fr', voiceId: string) => void;
  onSaveProfile: (data: Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onSignOut: () => Promise<void>;
}

const SUGGESTED_INTERESTS = [
  'Cinéma',
  'Voyages',
  'Cuisine',
  'Musique',
  'Littérature',
  'Sport',
  'Art & expos',
  'Cafés',
  'Photographie',
  'Séries VO',
];

const ENGLISH_LEVELS: EnglishLevel[] = [
  'Débutant (A1–A2)',
  'Intermédiaire (B1–B2)',
  'Avancé (C1–C2)',
  'Natif / Bilingue',
];

export function ProfileModal({
  isOpen,
  onClose,
  profile,
  userEmail,
  enVoices,
  frVoices,
  onTestVoice,
  onSaveProfile,
  onSignOut,
}: ProfileModalProps) {
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [age, setAge] = useState<number>(profile?.age ?? 26);
  const [gender, setGender] = useState<Gender>(profile?.gender ?? 'femme');
  const [lookingFor, setLookingFor] = useState<LookingFor>(profile?.lookingFor ?? 'tous');
  const [city, setCity] = useState(profile?.city ?? '');
  const [job, setJob] = useState(profile?.job ?? '');
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel>(
    profile?.englishLevel ?? 'Intermédiaire (B1–B2)'
  );
  const [nativeLanguage, setNativeLanguage] = useState<NativeLanguage>(
    profile?.nativeLanguage ?? 'fr'
  );
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const [customInterest, setCustomInterest] = useState('');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [photoDataUrl, setPhotoDataUrl] = useState(profile?.photoDataUrl ?? '');
  const [isPublished, setIsPublished] = useState(profile?.isPublished ?? true);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enVoice: profile?.voiceSettings?.enVoice ?? enVoices[0]?.id ?? 'browser:auto',
    frVoice: profile?.voiceSettings?.frVoice ?? frVoices[0]?.id ?? 'browser:auto',
    autoPlay: profile?.voiceSettings?.autoPlay ?? true,
  });

  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setPhotoBusy(true);
    try {
      const compressed = await compressProfileImage(file);
      setPhotoDataUrl(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du traitement de la photo.');
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleInterest = (tag: string) => {
    setInterests((prev) => {
      if (prev.includes(tag)) return prev.filter((item) => item !== tag);
      if (prev.length >= 8) return prev;
      return [...prev, tag];
    });
  };

  const addCustomInterest = () => {
    const clean = customInterest.trim().slice(0, 40);
    if (!clean) return;
    if (!interests.includes(clean) && interests.length < 8) {
      setInterests((prev) => [...prev, clean]);
    }
    setCustomInterest('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedName = firstName.trim();
    const trimmedCity = city.trim();
    if (!trimmedName) {
      setError('Indique ton prénom.');
      return;
    }
    if (!trimmedCity) {
      setError('Indique ta ville.');
      return;
    }
    const clampedAge = Math.min(99, Math.max(18, Number(age) || 18));

    setSaving(true);
    try {
      await onSaveProfile({
        firstName: trimmedName.slice(0, 50),
        age: clampedAge,
        gender,
        lookingFor,
        city: trimmedCity.slice(0, 80),
        job: job.trim().slice(0, 80),
        englishLevel,
        interests: interests.slice(0, 8),
        bio: bio.trim().slice(0, 500),
        nativeLanguage,
        photoDataUrl,
        voiceSettings,
        isPublished,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d’enregistrer le profil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#141217] border border-white/10 rounded-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <div>
            <h2 className="text-2xl font-editorial font-semibold text-white">Mon profil EntreDeux</h2>
            <p className="text-xs text-zinc-400">{userEmail}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-sm text-rose-200">
              {error}
            </div>
          )}

          {/* Photo section - Zero default photo */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-white/[0.08]">
            <Avatar name={firstName || 'E'} src={photoDataUrl} size="lg" />
            <div className="space-y-2">
              <div className="text-sm font-medium text-zinc-200">
                Photo de profil {photoDataUrl ? '(compressée et enregistrée)' : '(initiale affichée par défaut)'}
              </div>
              <p className="text-xs text-zinc-400">
                Importe une photo depuis ton appareil. Aucune image par défaut n’est utilisée.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {photoBusy ? 'Compression...' : photoDataUrl ? 'Changer la photo' : 'Importer une photo'}
                </button>
                {photoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoDataUrl('')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-xs font-medium text-rose-300 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-zinc-300">Prénom *</span>
              <input
                type="text"
                required
                maxLength={50}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex. Camille"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0A0D] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-zinc-300">Âge *</span>
              <input
                type="number"
                required
                min={18}
                max={99}
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0A0D] border border-white/10 text-sm text-white tabular-nums focus:outline-none focus:border-rose-500"
              />
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-zinc-300">Genre</span>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0A0D] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
              >
                <option value="femme">Femme</option>
                <option value="homme">Homme</option>
              </select>
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-zinc-300">Préférence de rencontre</span>
              <select
                value={lookingFor}
                onChange={(e) => setLookingFor(e.target.value as LookingFor)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0A0D] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
              >
                <option value="femmes">Femmes</option>
                <option value="hommes">Hommes</option>
                <option value="tous">Tous</option>
              </select>
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-zinc-300">Ville *</span>
              <input
                type="text"
                required
                maxLength={80}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex. Lyon, Paris, Montréal"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0A0D] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-zinc-300">Métier</span>
              <input
                type="text"
                maxLength={80}
                value={job}
                onChange={(e) => setJob(e.target.value)}
                placeholder="Ex. Designer produit"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0A0D] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-zinc-300">Niveau d’anglais</span>
              <select
                value={englishLevel}
                onChange={(e) => setEnglishLevel(e.target.value as EnglishLevel)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0A0D] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
              >
                {ENGLISH_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-zinc-300">Langue maternelle</span>
              <select
                value={nativeLanguage}
                onChange={(e) => setNativeLanguage(e.target.value as NativeLanguage)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0A0D] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
              >
                <option value="fr">Francophone (affiche l’anglais en priorité)</option>
                <option value="en">Anglophone (affiche le français en priorité)</option>
              </select>
            </label>
          </div>

          {/* Interests */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">Centres d’intérêt (max 8)</span>
              <span className="text-xs text-zinc-500 tabular-nums">{interests.length}/8</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_INTERESTS.map((tag) => {
                const active = interests.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleInterest(tag)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-rose-600 text-white'
                        : 'bg-[#0B0A0D] border border-white/10 text-zinc-300 hover:border-white/25'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                maxLength={40}
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomInterest();
                  }
                }}
                placeholder="Ajouter un centre d’intérêt..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-[#0B0A0D] border border-white/10 text-xs text-white focus:outline-none focus:border-rose-500"
              />
              <button
                type="button"
                onClick={addCustomInterest}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-colors"
              >
                Ajouter
              </button>
            </div>
          </div>

          {/* Bio */}
          <label className="space-y-1.5 block">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">Présentation</span>
              <span className="text-xs text-zinc-500 tabular-nums">{bio.length}/500</span>
            </div>
            <textarea
              rows={3}
              maxLength={500}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Ce que tu aimes, ce que tu recherches, et comment tu aimes apprendre..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0A0D] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500 resize-none"
            />
          </label>

          {/* Voice Settings */}
          <div className="pt-4 border-t border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Réglages vocaux</h3>
                <p className="text-xs text-zinc-400">
                  Choisis les voix utilisées pour lire les messages envoyés et reçus.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-zinc-200">
                <input
                  type="checkbox"
                  checked={voiceSettings.autoPlay}
                  onChange={(e) =>
                    setVoiceSettings((prev) => ({ ...prev, autoPlay: e.target.checked }))
                  }
                  className="accent-rose-600 w-4 h-4"
                />
                Lecture automatique
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-zinc-300">Voix anglaise préférée</span>
                <div className="flex gap-2">
                  <select
                    value={voiceSettings.enVoice}
                    onChange={(e) =>
                      setVoiceSettings((prev) => ({ ...prev, enVoice: e.target.value }))
                    }
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#0B0A0D] border border-white/10 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    {enVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      onTestVoice(
                        "Hey! I'd love to grab a coffee and practice English together.",
                        'en',
                        voiceSettings.enVoice
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white shrink-0 transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-rose-400" />
                    Tester
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-zinc-300">Voix française préférée</span>
                <div className="flex gap-2">
                  <select
                    value={voiceSettings.frVoice}
                    onChange={(e) =>
                      setVoiceSettings((prev) => ({ ...prev, frVoice: e.target.value }))
                    }
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#0B0A0D] border border-white/10 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    {frVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      onTestVoice(
                        'Salut ! Ça te dirait de prendre un café et discuter ce soir ?',
                        'fr',
                        voiceSettings.frVoice
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white shrink-0 transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-rose-400" />
                    Tester
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Publish toggle */}
          <label className="flex items-center justify-between p-4 rounded-xl bg-[#0B0A0D] border border-white/10 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-white">Publier mon profil dans Découvrir</div>
              <div className="text-xs text-zinc-400">
                Les autres membres inscrits pourront voir ta fiche et engager la conversation.
              </div>
            </div>
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="accent-rose-600 w-4 h-4 shrink-0 ml-4"
            />
          </label>

          {/* Footer actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-zinc-300 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Se déconnecter
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer mon profil'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
