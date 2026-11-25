import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { auth } from '../firebase';
import { synthesizeTtsApi } from '../utils/api';

export interface VoiceOption {
  id: string;
  label: string;
  lang: 'en' | 'fr';
  source: 'browser' | 'gemini';
}

const GEMINI_VOICE_OPTIONS: VoiceOption[] = [
  { id: 'gemini:Zephyr', label: 'Studio · Zephyr (Naturelle)', lang: 'en', source: 'gemini' },
  { id: 'gemini:Kore', label: 'Studio · Kore (Chaleureuse)', lang: 'en', source: 'gemini' },
  { id: 'gemini:Puck', label: 'Studio · Puck (Dynamique)', lang: 'en', source: 'gemini' },
  { id: 'gemini:Charon', label: 'Studio · Charon (Posée)', lang: 'en', source: 'gemini' },
  { id: 'gemini:Fenrir', label: 'Studio · Fenrir (Grave)', lang: 'en', source: 'gemini' },
  { id: 'gemini:Kore', label: 'Studio · Kore (Chaleureuse)', lang: 'fr', source: 'gemini' },
  { id: 'gemini:Zephyr', label: 'Studio · Zephyr (Douce)', lang: 'fr', source: 'gemini' },
  { id: 'gemini:Puck', label: 'Studio · Puck (Vive)', lang: 'fr', source: 'gemini' },
  { id: 'gemini:Charon', label: 'Studio · Charon (Posée)', lang: 'fr', source: 'gemini' },
  { id: 'gemini:Fenrir', label: 'Studio · Fenrir (Grave)', lang: 'fr', source: 'gemini' },
];

export function useSpeech() {
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length > 0) {
        setBrowserVoices(list);
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  const enVoices = useMemo<VoiceOption[]>(() => {
    const native = browserVoices
      .filter((v) => v.lang.toLowerCase().startsWith('en'))
      .slice(0, 12)
      .map((v) => ({
        id: `browser:${v.name}`,
        label: `${v.name} (${v.lang})`,
        lang: 'en' as const,
        source: 'browser' as const,
      }));
    return [
      {
        id: 'browser:auto',
        label: 'Voix anglaise du navigateur (Gratuite)',
        lang: 'en',
        source: 'browser',
      },
      ...native,
      ...GEMINI_VOICE_OPTIONS.filter((v) => v.lang === 'en'),
    ];
  }, [browserVoices]);

  const frVoices = useMemo<VoiceOption[]>(() => {
    const native = browserVoices
      .filter((v) => v.lang.toLowerCase().startsWith('fr'))
      .slice(0, 12)
      .map((v) => ({
        id: `browser:${v.name}`,
        label: `${v.name} (${v.lang})`,
        lang: 'fr' as const,
        source: 'browser' as const,
      }));
    return [
      {
        id: 'browser:auto',
        label: 'Voix française du navigateur (Gratuite)',
        lang: 'fr',
        source: 'browser',
      },
      ...native,
      ...GEMINI_VOICE_OPTIONS.filter((v) => v.lang === 'fr'),
    ];
  }, [browserVoices]);

  const stop = useCallback(() => {
    requestIdRef.current += 1;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string, lang: 'en' | 'fr', preferredVoiceId?: string) => {
      const cleanText = text.trim();
      if (!cleanText) return;

      stop();
      const myReq = ++requestIdRef.current;

      const tryGeminiTts = async (voiceName?: string) => {
        if (!auth.currentUser) {
          // If unauthenticated and browser has voices, fall back to browser speechSynthesis
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(cleanText);
            utter.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
            utter.onstart = () => setIsSpeaking(true);
            utter.onend = () => setIsSpeaking(false);
            utter.onerror = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utter);
          }
          return;
        }
        try {
          setIsSpeaking(true);
          const { audioBase64, mimeType } = await synthesizeTtsApi({
            text: cleanText,
            lang,
            voiceName,
          });
          if (requestIdRef.current !== myReq) return;
          const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
          audioRef.current = audio;
          audio.onended = () => {
            if (requestIdRef.current === myReq) setIsSpeaking(false);
          };
          audio.onerror = () => {
            if (requestIdRef.current === myReq) setIsSpeaking(false);
          };
          await audio.play();
        } catch (err) {
          console.error('Gemini TTS playback failed, trying browser fallback:', err);
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(cleanText);
            utter.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
            utter.onend = () => setIsSpeaking(false);
            utter.onerror = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utter);
          } else {
            setIsSpeaking(false);
          }
        }
      };

      if (preferredVoiceId?.startsWith('gemini:')) {
        await tryGeminiTts(preferredVoiceId.slice('gemini:'.length));
        return;
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const allVoices = window.speechSynthesis.getVoices();
        const prefix = lang === 'fr' ? 'fr' : 'en';
        let matched: SpeechSynthesisVoice | undefined;

        if (preferredVoiceId?.startsWith('browser:') && preferredVoiceId !== 'browser:auto') {
          const targetName = preferredVoiceId.slice('browser:'.length);
          matched = allVoices.find((v) => v.name === targetName);
        }
        if (!matched) {
          matched = allVoices.find((v) => v.lang.toLowerCase().startsWith(prefix));
        }

        if (matched || allVoices.length > 0) {
          const utter = new SpeechSynthesisUtterance(cleanText);
          utter.lang = matched?.lang || (lang === 'fr' ? 'fr-FR' : 'en-US');
          if (matched) utter.voice = matched;
          utter.rate = 0.98;
          utter.onstart = () => {
            if (requestIdRef.current === myReq) setIsSpeaking(true);
          };
          utter.onend = () => {
            if (requestIdRef.current === myReq) setIsSpeaking(false);
          };
          utter.onerror = () => {
            if (requestIdRef.current === myReq) setIsSpeaking(false);
          };
          window.speechSynthesis.speak(utter);
          return;
        }
      }

      // Fallback when browser has no speechSynthesis voices
      await tryGeminiTts(lang === 'fr' ? 'Kore' : 'Zephyr');
    },
    [stop]
  );

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    enVoices,
    frVoices,
    isSpeaking,
    speak,
    stop,
  };
}
