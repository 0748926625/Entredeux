import { auth } from '../firebase';
import type { AiResponseMode, NativeLanguage, TranslationResult } from '../types';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Connecte-toi avec Google pour utiliser cette fonctionnalité.');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function translateMessageApi(params: {
  text: string;
  senderNativeLang: NativeLanguage;
  context?: string;
}): Promise<TranslationResult> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/translate', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = (await resp.json()) as TranslationResult & { error?: string };
  if (!resp.ok) {
    throw new Error(data.error || 'Erreur lors de la traduction.');
  }
  return data;
}

export async function sendAiChatApi(params: {
  partnerId: string;
  partnerName: string;
  partnerPersona: string;
  responseMode: AiResponseMode;
  userNativeLang: NativeLanguage;
  userName: string;
  history: Array<{ role: 'user' | 'ai'; text: string }>;
  userMessage: string;
}): Promise<{
  originalLang: 'fr' | 'en' | 'mix';
  originalText: string;
  textFr: string;
  textEn: string;
  note: string;
  keyExpression: string;
  keyExpressionMeaning: string;
  keyExpressionExample: string;
}> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/ai-chat', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = (await resp.json()) as {
    originalLang: 'fr' | 'en' | 'mix';
    originalText: string;
    textFr: string;
    textEn: string;
    note: string;
    keyExpression: string;
    keyExpressionMeaning: string;
    keyExpressionExample: string;
    error?: string;
  };
  if (!resp.ok) {
    throw new Error(data.error || 'Erreur de réponse du partenaire IA.');
  }
  return data;
}

export async function transcribeAudioApi(params: {
  audioBase64: string;
  mimeType: string;
  languageHint: NativeLanguage;
}): Promise<string> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/transcribe', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = (await resp.json()) as { text?: string; error?: string };
  if (!resp.ok) {
    throw new Error(data.error || 'Erreur de transcription audio.');
  }
  return data.text ?? '';
}

export async function synthesizeTtsApi(params: {
  text: string;
  lang: 'en' | 'fr';
  voiceName?: string;
}): Promise<{ audioBase64: string; mimeType: string }> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/tts', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = (await resp.json()) as {
    audioBase64?: string;
    mimeType?: string;
    error?: string;
  };
  if (!resp.ok || !data.audioBase64) {
    throw new Error(data.error || 'Erreur de synthèse vocale.');
  }
  return {
    audioBase64: data.audioBase64,
    mimeType: data.mimeType || 'audio/wav',
  };
}
