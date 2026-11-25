export type Gender = 'homme' | 'femme';
export type LookingFor = 'femmes' | 'hommes' | 'tous';
export type NativeLanguage = 'fr' | 'en';
export type EnglishLevel =
  | 'Débutant (A1–A2)'
  | 'Intermédiaire (B1–B2)'
  | 'Avancé (C1–C2)'
  | 'Natif / Bilingue';

export type AiResponseMode = 'en' | 'fr' | 'mix';
export type AppTab = 'discover' | 'chats' | 'notebook' | 'method';

export interface VoiceSettings {
  enVoice: string;
  frVoice: string;
  autoPlay: boolean;
}

export interface UserProfile {
  uid: string;
  firstName: string;
  age: number;
  gender: Gender;
  lookingFor: LookingFor;
  city: string;
  job: string;
  englishLevel: EnglishLevel;
  interests: string[];
  bio: string;
  nativeLanguage: NativeLanguage;
  photoDataUrl: string;
  voiceSettings: VoiceSettings;
  isPublished: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AiPartner {
  id: string;
  firstName: string;
  age: number;
  gender: Gender;
  city: string;
  job: string;
  englishLevel: EnglishLevel;
  nativeLanguage: NativeLanguage;
  interests: string[];
  bio: string;
  personaPrompt: string;
  avatarUrl: string;
  defaultVoiceEn: string;
  defaultVoiceFr: string;
  icebreakers: Array<{
    en: string;
    fr: string;
  }>;
}

export interface Conversation {
  id: string;
  participantA: string;
  participantB: string;
  participantIds: string[];
  isAiPartner: boolean;
  aiPartnerId: string;
  aiResponseMode: AiResponseMode;
  lastMessagePreviewEn: string;
  lastMessagePreviewFr: string;
  lastSenderId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ChatMessage {
  id: string;
  participantIds: string[];
  senderId: string;
  senderType: 'user' | 'ai';
  originalLang: 'fr' | 'en' | 'mix';
  originalText: string;
  textFr: string;
  textEn: string;
  note: string;
  keyExpression: string;
  keyExpressionMeaning: string;
  keyExpressionExample: string;
  createdAt?: unknown;
}

export interface TranslationResult {
  detectedLang: 'fr' | 'en' | 'mix';
  textFr: string;
  textEn: string;
  note: string;
  keyExpression: string;
  keyExpressionMeaning: string;
  keyExpressionExample: string;
}

export interface VocabEntry {
  id: string;
  ownerId: string;
  expression: string;
  translation: string;
  note: string;
  example: string;
  lang: 'en' | 'fr';
  sourcePartnerName: string;
  status: 'to_review' | 'mastered';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LikeRecord {
  fromUid: string;
  toUid: string;
  createdAt?: unknown;
}
