import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

// Load Firebase projectId from firebase-applet-config.json for ID token verification
let firebaseProjectId = '';
try {
  const configRaw = fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8');
  const parsed = JSON.parse(configRaw) as { projectId?: string };
  firebaseProjectId = parsed.projectId ?? '';
} catch {
  firebaseProjectId = '';
}

// Initialize Gemini SDK on server only
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// --- Lightweight Firebase ID Token Verification (RS256 via Google Public x509 Certs) ---
let cachedCerts: Record<string, string> = {};
let certsExpiresAt = 0;

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < certsExpiresAt && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error('Impossible de récupérer les certificats Firebase.');
  }
  const cacheControl = resp.headers.get('cache-control') ?? '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  cachedCerts = (await resp.json()) as Record<string, string>;
  certsExpiresAt = now + maxAgeSec * 1000;
  return cachedCerts;
}

function decodeBase64Url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

async function verifyFirebaseIdToken(token: string): Promise<{ uid: string; email?: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Jeton invalide.');
  }
  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(decodeBase64Url(headerB64).toString('utf8')) as {
    alg?: string;
    kid?: string;
  };
  const payload = JSON.parse(decodeBase64Url(payloadB64).toString('utf8')) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
  };

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Algorithme de jeton non supporté.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= nowSec) {
    throw new Error('Session expirée.');
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Sujet manquant.');
  }
  if (firebaseProjectId) {
    if (payload.aud !== firebaseProjectId) {
      throw new Error('Audience de jeton invalide.');
    }
    if (payload.iss !== `https://securetoken.google.com/${firebaseProjectId}`) {
      throw new Error('Émetteur de jeton invalide.');
    }
  }

  const certs = await getFirebasePublicCerts();
  const cert = certs[header.kid];
  if (!cert) {
    throw new Error('Clé de signature introuvable.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signature = decodeBase64Url(sigB64);
  if (!verifier.verify(cert, signature)) {
    throw new Error('Signature de jeton invalide.');
  }

  return { uid: payload.sub, email: payload.email };
}

interface AuthenticatedRequest extends Request {
  user?: { uid: string; email?: string };
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentification requise.' });
      return;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    req.user = await verifyFirebaseIdToken(token);
    next();
  } catch (err) {
    res.status(401).json({
      error: err instanceof Error ? err.message : 'Authentification invalide.',
    });
  }
}

function safeTrim(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

const app = express();
app.use(express.json({ limit: '8mb' }));

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// 1. Bilingual Translation + Explanatory Note + Key Expression
app.post('/api/translate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const text = safeTrim(req.body?.text, 2000);
    const senderNativeLang = req.body?.senderNativeLang === 'en' ? 'en' : 'fr';
    const context = safeTrim(req.body?.context, 400);

    if (!text) {
      res.status(400).json({ error: 'Le message est vide.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: 'Clé API Gemini manquante sur le serveur.' });
      return;
    }

    const explanationLanguage = senderNativeLang === 'fr' ? 'French' : 'English';

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Translate and analyze this chat message sent on a warm, authentic dating & language-learning app called EntreDeux:
Message: "${text}"
Sender native language: ${senderNativeLang === 'fr' ? 'French' : 'English'}
${context ? `Context: ${context}` : ''}

Instructions:
1. Detect whether the original message is primarily French ('fr'), English ('en'), or mixed ('mix').
2. Produce a natural, idiomatic French version (textFr) and a natural, conversational, warm English version (textEn). Never be robotic or overly formal—match the charm and warmth of the message.
3. Provide a concise pedagogical note (note) in ${explanationLanguage} (1 to 2 short sentences explaining a nuance, phrasing choice, or tone tip).
4. Pick one useful key expression (keyExpression) from the TARGET language (English if sender is French, French if sender is English), with its meaning (keyExpressionMeaning) in ${explanationLanguage} and a short natural example sentence (keyExpressionExample) in the target language.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedLang: { type: Type.STRING, enum: ['fr', 'en', 'mix'] },
            textFr: { type: Type.STRING },
            textEn: { type: Type.STRING },
            note: { type: Type.STRING },
            keyExpression: { type: Type.STRING },
            keyExpressionMeaning: { type: Type.STRING },
            keyExpressionExample: { type: Type.STRING },
          },
          required: [
            'detectedLang',
            'textFr',
            'textEn',
            'note',
            'keyExpression',
            'keyExpressionMeaning',
            'keyExpressionExample',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      detectedLang?: string;
      textFr?: string;
      textEn?: string;
      note?: string;
      keyExpression?: string;
      keyExpressionMeaning?: string;
      keyExpressionExample?: string;
    };

    res.json({
      detectedLang: parsed.detectedLang ?? senderNativeLang,
      textFr: safeTrim(parsed.textFr || text, 2500),
      textEn: safeTrim(parsed.textEn || text, 2500),
      note: safeTrim(parsed.note || '', 600),
      keyExpression: safeTrim(parsed.keyExpression || '', 200),
      keyExpressionMeaning: safeTrim(parsed.keyExpressionMeaning || '', 300),
      keyExpressionExample: safeTrim(parsed.keyExpressionExample || '', 400),
    });
  } catch (err) {
    console.error('Translation error:', err);
    res.status(500).json({ error: 'Erreur lors de la traduction Gemini.' });
  }
});

// 2. AI Practice Partner Conversational Reply (Always bilingual FR + EN + Note + Key Expression)
app.post('/api/ai-chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const partnerName = safeTrim(req.body?.partnerName, 60) || 'Chloé';
    const partnerPersona = safeTrim(req.body?.partnerPersona, 600);
    const responseMode =
      req.body?.responseMode === 'fr' || req.body?.responseMode === 'mix'
        ? req.body.responseMode
        : 'en';
    const userNativeLang = req.body?.userNativeLang === 'en' ? 'en' : 'fr';
    const userName = safeTrim(req.body?.userName, 50) || 'toi';
    const userMessage = safeTrim(req.body?.userMessage, 2000);
    const rawHistory = Array.isArray(req.body?.history) ? req.body.history.slice(-10) : [];

    if (!userMessage) {
      res.status(400).json({ error: 'Message utilisateur requis.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: 'Clé API Gemini manquante sur le serveur.' });
      return;
    }

    const historyText = rawHistory
      .map((item: { role?: string; text?: string }) => {
        const who = item.role === 'ai' ? partnerName : userName;
        return `${who}: ${safeTrim(item.text, 500)}`;
      })
      .join('\n');

    const modeGuidance =
      responseMode === 'en'
        ? 'Write your reply primarily in natural, warm, slightly playful/flirty or friendly English.'
        : responseMode === 'fr'
          ? 'Write your reply primarily in natural, warm French.'
          : 'Write your reply in a charming bilingual mix of English and French (Franglais / natural code-switching).';

    const explanationLang = userNativeLang === 'fr' ? 'French' : 'English';
    const targetVocabLang = userNativeLang === 'fr' ? 'English' : 'French';

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `You are ${partnerName}, a charming, witty, and encouraging language-and-dating practice partner on EntreDeux.
Persona: ${partnerPersona}
User's first name: ${userName}
User's native language: ${userNativeLang === 'fr' ? 'French' : 'English'}
Requested reply language mode: ${responseMode} (${modeGuidance})

Recent conversation:
${historyText || '(Début de conversation)'}

Latest message from ${userName}: "${userMessage}"

Requirements:
1. Reply naturally in character (2 to 3 sentences, engaging, curious, asking a natural follow-up question to keep the conversation flowing).
2. Regardless of the requested mode, you MUST return BOTH:
   - textFr: complete natural French version of your reply
   - textEn: complete natural English version of your reply
   (If responseMode is 'mix', you may weave subtle bilingual warmth while ensuring textFr is clean French and textEn is clean English, and originalText reflects the exact mixed phrasing).
3. Include a brief helpful learning note (note) in ${explanationLang} (1 sentence about a cool phrase in your reply or a gentle tip).
4. Include one memorable ${targetVocabLang} expression from your reply (keyExpression), its meaning in ${explanationLang} (keyExpressionMeaning), and a short example sentence (keyExpressionExample).`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            originalText: { type: Type.STRING },
            textFr: { type: Type.STRING },
            textEn: { type: Type.STRING },
            note: { type: Type.STRING },
            keyExpression: { type: Type.STRING },
            keyExpressionMeaning: { type: Type.STRING },
            keyExpressionExample: { type: Type.STRING },
          },
          required: [
            'originalText',
            'textFr',
            'textEn',
            'note',
            'keyExpression',
            'keyExpressionMeaning',
            'keyExpressionExample',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      originalText?: string;
      textFr?: string;
      textEn?: string;
      note?: string;
      keyExpression?: string;
      keyExpressionMeaning?: string;
      keyExpressionExample?: string;
    };

    res.json({
      originalLang: responseMode,
      originalText: safeTrim(parsed.originalText || parsed.textEn || parsed.textFr || '', 2000),
      textFr: safeTrim(parsed.textFr || '', 2500),
      textEn: safeTrim(parsed.textEn || '', 2500),
      note: safeTrim(parsed.note || '', 600),
      keyExpression: safeTrim(parsed.keyExpression || '', 200),
      keyExpressionMeaning: safeTrim(parsed.keyExpressionMeaning || '', 300),
      keyExpressionExample: safeTrim(parsed.keyExpressionExample || '', 400),
    });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: 'Erreur lors de la réponse du partenaire IA.' });
  }
});

// 3. Fallback Audio Transcription via Gemini
app.post('/api/transcribe', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64 : '';
    const mimeType = safeTrim(req.body?.mimeType, 60) || 'audio/webm';
    const languageHint = req.body?.languageHint === 'en' ? 'en' : 'fr';

    if (!audioBase64 || audioBase64.length > 6_500_000) {
      res.status(400).json({ error: 'Audio manquant ou trop volumineux.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: 'Clé API Gemini manquante sur le serveur.' });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
          {
            text: `Transcribe this voice message accurately with natural punctuation. The speaker is likely speaking ${languageHint === 'fr' ? 'French (or French with some English words)' : 'English (or English with some French words)'}. Return only the transcribed text.`,
          },
        ],
      },
    });

    res.json({ text: (response.text ?? '').trim() });
  } catch (err) {
    console.error('Transcription error:', err);
    res.status(500).json({ error: 'Erreur lors de la transcription audio.' });
  }
});

// 4. Gemini TTS Studio Voice Synthesis (Fallback / Studio Voices)
app.post('/api/tts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const text = safeTrim(req.body?.text, 1000);
    const lang = req.body?.lang === 'fr' ? 'fr' : 'en';
    const requestedVoice = safeTrim(req.body?.voiceName, 40);
    const allowedVoices = new Set(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']);
    const voiceName = allowedVoices.has(requestedVoice)
      ? requestedVoice
      : lang === 'fr'
        ? 'Kore'
        : 'Zephyr';

    if (!text) {
      res.status(400).json({ error: 'Texte requis pour la lecture vocale.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: 'Clé API Gemini manquante sur le serveur.' });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
              speechMetadata: {
                style:
                  lang === 'fr'
                    ? 'Warm, natural conversational French speaker'
                    : 'Warm, natural conversational English speaker',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioBase64) {
      res.status(500).json({ error: 'Audio non généré.' });
      return;
    }

    res.json({ audioBase64, mimeType: 'audio/wav' });
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: 'Erreur lors de la synthèse vocale.' });
  }
});

async function startServer() {
  const distPath = path.join(__dirname, 'dist');
  const hasDistBuild = fs.existsSync(path.join(distPath, 'index.html'));
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (hasDistBuild && process.env.npm_lifecycle_event !== 'dev');

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EntreDeux server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
