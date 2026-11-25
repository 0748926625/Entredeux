import { useState } from 'react';
import { BookOpen, Eye, EyeOff, Mic, Volume2 } from 'lucide-react';

interface MethodViewProps {
  onSpeakSample: (text: string, lang: 'en' | 'fr') => void;
  onGoDiscover: () => void;
}

export function MethodView({ onSpeakSample, onGoDiscover }: MethodViewProps) {
  const [revealDemoFr, setRevealDemoFr] = useState(false);

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <header className="space-y-4 border-b border-white/[0.08] pb-8">
        <p className="text-xs font-medium tracking-wide text-rose-400">La méthode EntreDeux</p>
        <h1 className="text-3xl sm:text-5xl font-editorial font-semibold text-white leading-tight text-balance">
          Progresser sans manuel, au fil de vraies conversations.
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl">
          EntreDeux transforme chaque échange — flirt, complicité ou amitié — en immersion douce,
          visuelle et sonore.
        </p>
      </header>

      {/* Interactive Bubble Demonstration */}
      <section className="p-6 sm:p-8 rounded-2xl bg-[#141217] border border-white/[0.08] space-y-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-editorial font-semibold text-white">
            Exemple concret d’une bulle bilingue
          </h2>
          <p className="text-xs text-zinc-400">
            Si tu es francophone, ta langue maternelle reste masquée par défaut pour entraîner ton
            œil à lire directement en anglais.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0B0A0D] border border-white/[0.08] space-y-3 max-w-xl">
          <p className="text-base text-white leading-relaxed">
            “Honestly, I was hoping you’d text first — how is your evening going?”
          </p>
          {revealDemoFr && (
            <p className="text-xs text-zinc-300 pt-2 border-t border-white/[0.08]">
              « Honnêtement, j’espérais que tu écrives en premier — comment se passe ta soirée ? »
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => setRevealDemoFr((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
            >
              {revealDemoFr ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {revealDemoFr ? 'Masquer le français' : 'Afficher en français'}
            </button>
            <button
              type="button"
              onClick={() =>
                onSpeakSample(
                  "Honestly, I was hoping you'd text first — how is your evening going?",
                  'en'
                )
              }
              className="inline-flex items-center gap-1.5 text-rose-300 hover:text-rose-200 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Écouter la prononciation
            </button>
          </div>
          <div className="pt-2 border-t border-white/[0.06] text-xs text-zinc-400">
            <span className="text-rose-300 font-medium">Expression clé : </span>
            “you’d text first” (contraction naturelle de <em>you would</em> pour exprimer une
            envie légère).
          </div>
        </div>
      </section>

      {/* 4 Editorial Principles */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <article className="p-6 rounded-2xl bg-[#141217] border border-white/[0.08] space-y-2.5">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-medium">
            <EyeOff className="w-4 h-4" />
            01. Immersion ciblée
          </div>
          <h3 className="text-xl font-editorial font-semibold text-white">
            Langue maternelle masquée par défaut
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Que ton interlocuteur écrive en français, en anglais ou en mixte, chaque message
            possède les deux versions. Seule ta langue cible reste affichée pour stimuler ta
            compréhension spontanée, avec un bouton de vérification à portée de clic.
          </p>
        </article>

        <article className="p-6 rounded-2xl bg-[#141217] border border-white/[0.08] space-y-2.5">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-medium">
            <Volume2 className="w-4 h-4" />
            02. Ancrage auditif automatique
          </div>
          <h3 className="text-xl font-editorial font-semibold text-white">
            Écoute immédiate à l’envoi et 1,5 s à la réception
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Chaque message envoyé est lu dans la langue cible dès sa validation, et chaque réponse
            reçue est lue 1,5 seconde après son arrivée avec la voix anglaise ou française que tu as
            choisie.
          </p>
        </article>

        <article className="p-6 rounded-2xl bg-[#141217] border border-white/[0.08] space-y-2.5">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-medium">
            <Mic className="w-4 h-4" />
            03. Dictée vocale & aperçu avant envoi
          </div>
          <h3 className="text-xl font-editorial font-semibold text-white">
            Parle naturellement, relis la nuance
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Dicte tes phrases au micro et affiche un aperçu avant envoi avec une courte note
            explicative et l’expression clé à retenir avant de partager ton message.
          </p>
        </article>

        <article className="p-6 rounded-2xl bg-[#141217] border border-white/[0.08] space-y-2.5">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-medium">
            <BookOpen className="w-4 h-4" />
            04. Carnet personnel durable
          </div>
          <h3 className="text-xl font-editorial font-semibold text-white">
            Capture les expressions qui te plaisent
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Enregistre en un clic les tournures marquantes de tes discussions dans ton Carnet,
            réécoute-les et classe-les entre « À réviser » et « Maîtrisées ».
          </p>
        </article>
      </section>

      <div className="flex justify-start">
        <button
          type="button"
          onClick={onGoDiscover}
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold text-white transition-colors"
        >
          Explorer les profils dans Découvrir
        </button>
      </div>
    </div>
  );
}
