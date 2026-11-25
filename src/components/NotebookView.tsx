import { useMemo, useState } from 'react';
import { CheckCircle2, Plus, RotateCcw, Trash2, Volume2 } from 'lucide-react';
import type { VocabEntry } from '../types';

interface NotebookViewProps {
  currentUserUid: string | null;
  entries: VocabEntry[];
  onSignIn: () => void;
  onSpeak: (text: string, lang: 'en' | 'fr') => void;
  onAddEntry: (entry: {
    expression: string;
    translation: string;
    note: string;
    example: string;
    lang: 'en' | 'fr';
  }) => Promise<void>;
  onToggleStatus: (entry: VocabEntry) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
}

export function NotebookView({
  currentUserUid,
  entries,
  onSignIn,
  onSpeak,
  onAddEntry,
  onToggleStatus,
  onDeleteEntry,
}: NotebookViewProps) {
  const [filter, setFilter] = useState<'to_review' | 'mastered'>('to_review');
  const [showAddForm, setShowAddForm] = useState(false);
  const [expression, setExpression] = useState('');
  const [translation, setTranslation] = useState('');
  const [example, setExample] = useState('');
  const [note, setNote] = useState('');
  const [lang, setLang] = useState<'en' | 'fr'>('en');
  const [saving, setSaving] = useState(false);

  const toReviewCount = useMemo(
    () => entries.filter((e) => e.status === 'to_review').length,
    [entries]
  );
  const masteredCount = useMemo(
    () => entries.filter((e) => e.status === 'mastered').length,
    [entries]
  );

  const visibleEntries = useMemo(
    () => entries.filter((e) => e.status === filter),
    [entries, filter]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expression.trim() || !translation.trim()) return;
    setSaving(true);
    try {
      await onAddEntry({
        expression: expression.trim(),
        translation: translation.trim(),
        example: example.trim(),
        note: note.trim(),
        lang,
      });
      setExpression('');
      setTranslation('');
      setExample('');
      setNote('');
      setShowAddForm(false);
      setFilter('to_review');
    } finally {
      setSaving(false);
    }
  };

  if (!currentUserUid) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-2xl bg-[#141217] border border-white/[0.08] text-center space-y-4">
        <h2 className="text-3xl font-editorial font-semibold text-white">Carnet de vocabulaire</h2>
        <p className="text-sm text-zinc-400">
          Connecte-toi avec Google pour enregistrer les expressions clés de tes conversations et
          les réviser à ton rythme.
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-editorial font-semibold text-white">
            Carnet d’expressions
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Retrouve tes tournures favorites, écoute leur prononciation et suis ta progression.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter une expression
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-2xl bg-[#141217] border border-white/[0.08] space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-zinc-300">Expression *</span>
              <input
                type="text"
                required
                maxLength={200}
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder="Ex. To hit it off"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0A0D] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-zinc-300">Traduction / Sens *</span>
              <input
                type="text"
                required
                maxLength={300}
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
                placeholder="Ex. Avoir tout de suite le déclic ensemble"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0A0D] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-zinc-300">Exemple en contexte</span>
              <input
                type="text"
                maxLength={400}
                value={example}
                onChange={(e) => setExample(e.target.value)}
                placeholder="Ex. We really hit it off over coffee."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0A0D] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </label>

            <label className="space-y-1.5 block">
              <span className="text-xs font-medium text-zinc-300">Langue de l’expression</span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as 'en' | 'fr')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0A0D] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
              >
                <option value="en">Anglais</option>
                <option value="fr">Français</option>
              </select>
            </label>
          </div>

          <label className="space-y-1.5 block">
            <span className="text-xs font-medium text-zinc-300">Note personnelle (facultatif)</span>
            <input
              type="text"
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Astuce de prononciation ou contexte..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0A0D] border border-white/10 text-sm text-white focus:outline-none focus:border-rose-500"
            />
          </label>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors"
            >
              {saving ? 'Ajout...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}

      {/* Segmented filter */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#141217] border border-white/[0.08]">
        <button
          type="button"
          onClick={() => setFilter('to_review')}
          className={`px-4 py-2 rounded-lg text-xs font-medium tabular-nums transition-colors ${
            filter === 'to_review'
              ? 'bg-rose-600 text-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          À réviser ({toReviewCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter('mastered')}
          className={`px-4 py-2 rounded-lg text-xs font-medium tabular-nums transition-colors ${
            filter === 'mastered'
              ? 'bg-rose-600 text-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Maîtrisées ({masteredCount})
        </button>
      </div>

      {/* Cards */}
      {visibleEntries.length === 0 ? (
        <div className="p-10 rounded-2xl bg-[#141217] border border-white/[0.08] text-center space-y-2">
          <p className="text-sm font-medium text-zinc-200">
            {filter === 'to_review'
              ? 'Aucune expression à réviser pour l’instant.'
              : 'Aucune expression marquée comme maîtrisée.'}
          </p>
          <p className="text-xs text-zinc-500">
            Enregistre des expressions directement depuis les bulles de conversation ou ajoute-en une
            manuellement.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleEntries.map((entry) => (
            <article
              key={entry.id}
              className="p-5 rounded-2xl bg-[#141217] border border-white/[0.08] flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-zinc-500">
                      {entry.lang === 'en' ? 'Anglais' : 'Français'}
                      {entry.sourcePartnerName ? ` · Avec ${entry.sourcePartnerName}` : ''}
                    </div>
                    <h3 className="text-xl font-editorial font-semibold text-white mt-0.5">
                      {entry.expression}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSpeak(entry.expression, entry.lang)}
                    aria-label={`Écouter ${entry.expression}`}
                    className="min-w-[40px] min-h-[40px] rounded-xl bg-white/[0.06] hover:bg-rose-600/20 text-rose-300 flex items-center justify-center shrink-0 transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-rose-200/90 font-medium">{entry.translation}</p>

                {entry.example && (
                  <p className="text-xs text-zinc-300 italic leading-relaxed">« {entry.example} »</p>
                )}
                {entry.note && <p className="text-xs text-zinc-400 leading-relaxed">{entry.note}</p>}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => onToggleStatus(entry)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
                >
                  {entry.status === 'to_review' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-rose-400" />
                      Marquer maîtrisée
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 text-zinc-400" />
                      Remettre à réviser
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteEntry(entry.id)}
                  aria-label="Supprimer l’expression"
                  className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
