import crypto from 'node:crypto';
import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel, Type } from '@google/genai';
import { db, getUserBootstrap } from './db';
import { EXERCISES, EXERCISE_BY_ID } from '../data/exercises';
import { AiChatMessage, CoachLanguage, PlannedExercise } from '../types/fitness';
import {
  ExtractedMemoryFact,
  buildAthleteContextObject,
  buildCoachSystemInstruction,
  extractAndStripMemoryTags,
  prepareConversationContents,
} from './aiHelpers';

const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-4-hydrogen';
const LIVE_MODEL = 'gemini-3.8-live';

function getConfiguredApiKey(): string | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return apiKey;
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = getConfiguredApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getLiveAiClient(): GoogleGenAI | null {
  const apiKey = getConfiguredApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export class GeminiUnavailableError extends Error {
  statusCode: number;
  code: string;
  retryable: boolean;

  constructor(
    message: string,
    statusCode = 503,
    code = 'GEMINI_UNAVAILABLE',
    retryable = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.retryable = retryable;
  }
}

function createCombinedTimeoutSignal(
  timeoutMs: number,
  externalSignal?: AbortSignal
): { signal: AbortSignal; cleanup: () => void; wasTimeout: () => boolean } {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('Gemini request timed out'));
  }, timeoutMs);

  const onExternalAbort = () => {
    controller.abort(externalSignal?.reason || new Error('Client aborted request'));
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    wasTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    },
  };
}

function classifyGeminiError(err: unknown, wasTimeout = false): GeminiUnavailableError {
  if (err instanceof GeminiUnavailableError) return err;
  const rawMsg = err instanceof Error ? err.message : String(err);
  const lower = rawMsg.toLowerCase();

  if (wasTimeout || lower.includes('timed out') || lower.includes('timeout')) {
    return new GeminiUnavailableError(
      'AI Coach timed out waiting for Gemini. Click Retry to send your message again.',
      504,
      'UPSTREAM_TIMEOUT',
      true
    );
  }

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('permission_denied') ||
    lower.includes('401') ||
    lower.includes('403')
  ) {
    return new GeminiUnavailableError(
      'Gemini API authentication failed. Verify GEMINI_API_KEY in Settings > Secrets.',
      503,
      'INVALID_API_KEY',
      false
    );
  }

  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return new GeminiUnavailableError(
      'Gemini API rate limit reached momentarily. Wait a few seconds and click Retry.',
      429,
      'RATE_LIMITED',
      true
    );
  }

  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand')) {
    return new GeminiUnavailableError(
      'Gemini AI service is experiencing temporary high demand. Click Retry in a moment.',
      503,
      'UPSTREAM_BUSY',
      true
    );
  }

  return new GeminiUnavailableError(
    `Gemini AI request failed: ${rawMsg}`,
    502,
    'UPSTREAM_ERROR',
    true
  );
}

function isTransientError(err: GeminiUnavailableError): boolean {
  return err.code === 'RATE_LIMITED' || err.code === 'UPSTREAM_BUSY' || err.code === 'UPSTREAM_TIMEOUT';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildAthleteContextString(userId: string): {
  contextJson: string;
  aiMemoryEnabled: boolean;
} {
  const data = getUserBootstrap(userId);
  const contextObj = buildAthleteContextObject(data);
  return {
    contextJson: JSON.stringify(contextObj, null, 2),
    aiMemoryEnabled: Boolean(data.profile?.aiMemoryEnabled ?? true),
  };
}

export function upsertAutoMemories(userId: string, memories: ExtractedMemoryFact[]): number {
  if (!memories.length) return 0;
  const bootstrap = getUserBootstrap(userId);
  if (bootstrap.profile && !bootstrap.profile.aiMemoryEnabled) {
    return 0;
  }

  const now = new Date().toISOString();
  let savedCount = 0;

  for (const item of memories) {
    const key = item.memoryKey.trim().slice(0, 60);
    const val = item.memoryValue.trim().slice(0, 280);
    if (!key || !val) continue;

    const existing = db
      .prepare('SELECT id FROM ai_memory WHERE user_id = ? AND LOWER(memory_key) = LOWER(?)')
      .get(userId, key) as { id: string } | undefined;

    if (existing) {
      db.prepare('UPDATE ai_memory SET memory_value = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(
        val,
        now,
        existing.id,
        userId
      );
      savedCount += 1;
    } else {
      const countRow = db
        .prepare('SELECT COUNT(*) AS cnt FROM ai_memory WHERE user_id = ?')
        .get(userId) as { cnt: number };
      if ((countRow?.cnt || 0) < 30) {
        db.prepare(
          'INSERT INTO ai_memory (id, user_id, memory_key, memory_value, source, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(crypto.randomUUID(), userId, key, val, 'auto', now);
        savedCount += 1;
      }
    }
  }

  return savedCount;
}

export async function chatWithFitnessCoach(params: {
  userId: string;
  history: AiChatMessage[];
  message: string;
  language?: CoachLanguage;
}): Promise<{ replyText: string; memories: ExtractedMemoryFact[] }> {
  const ai = getAiClient();
  if (!ai) {
    throw new GeminiUnavailableError(
      'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to enable live Gemini coaching.',
      503,
      'MISSING_API_KEY',
      false
    );
  }

  const { contextJson, aiMemoryEnabled } = buildAthleteContextString(params.userId);
  const systemInstruction = buildCoachSystemInstruction({
    contextJson,
    language: params.language || 'en',
    aiMemoryEnabled,
  });
  const contents = prepareConversationContents(params.history, params.message, 24);

  const attemptModel = async (model: string, timeoutMs: number): Promise<string> => {
    const { signal, cleanup, wasTimeout } = createCombinedTimeoutSignal(timeoutMs);
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          abortSignal: signal,
        },
      });
      const raw = response.text?.trim();
      if (!raw) {
        throw new GeminiUnavailableError('Gemini returned an empty response.', 502, 'EMPTY_RESPONSE', true);
      }
      return raw;
    } catch (err) {
      throw classifyGeminiError(err, wasTimeout());
    } finally {
      cleanup();
    }
  };

  let rawText: string | null = null;
  let lastErr: GeminiUnavailableError | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      rawText = await attemptModel(PRIMARY_MODEL, 25000);
      break;
    } catch (err) {
      lastErr = classifyGeminiError(err);
      if (attempt === 0 && isTransientError(lastErr)) {
        await sleep(700);
        continue;
      }
      break;
    }
  }

  if (!rawText && lastErr && lastErr.code !== 'INVALID_API_KEY') {
    try {
      rawText = await attemptModel(FALLBACK_MODEL, 12000);
    } catch {
      throw lastErr;
    }
  }

  if (!rawText) {
    throw lastErr || new GeminiUnavailableError('Gemini could not generate a response.', 502, 'EMPTY_RESPONSE', true);
  }

  const { cleanText, memories } = extractAndStripMemoryTags(rawText);
  return {
    replyText: cleanText || rawText,
    memories,
  };
}

export async function streamChatWithFitnessCoach(params: {
  userId: string;
  history: AiChatMessage[];
  message: string;
  language?: CoachLanguage;
  abortSignal?: AbortSignal;
  onChunk: (deltaText: string) => void;
}): Promise<{ replyText: string; memories: ExtractedMemoryFact[] }> {
  const ai = getAiClient();
  if (!ai) {
    throw new GeminiUnavailableError(
      'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to enable live Gemini coaching.',
      503,
      'MISSING_API_KEY',
      false
    );
  }

  const { contextJson, aiMemoryEnabled } = buildAthleteContextString(params.userId);
  const systemInstruction = buildCoachSystemInstruction({
    contextJson,
    language: params.language || 'en',
    aiMemoryEnabled,
  });
  const contents = prepareConversationContents(params.history, params.message, 24);

  const maxAttempts = 3;
  let lastErr: GeminiUnavailableError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (params.abortSignal?.aborted) {
      throw new GeminiUnavailableError('Generation stopped.', 499, 'CLIENT_ABORTED', false);
    }

    const { signal, cleanup, wasTimeout } = createCombinedTimeoutSignal(35000, params.abortSignal);
    let fullRaw = '';
    let emittedCleanLen = 0;

    try {
      const stream = await ai.models.generateContentStream({
        model: PRIMARY_MODEL,
        contents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          abortSignal: signal,
        },
      });

      for await (const chunk of stream) {
        if (params.abortSignal?.aborted) {
          throw new Error('Request cancelled by user.');
        }
        const delta = chunk.text || '';
        if (!delta) continue;
        fullRaw += delta;

        // Hold back any potential trailing [[MEMORY: ...]] tag before flushing to UI
        const markerIdx = fullRaw.indexOf('[[', emittedCleanLen);
        const safeLimit = markerIdx !== -1 ? markerIdx : fullRaw.length - 1;
        if (safeLimit > emittedCleanLen) {
          const piece = fullRaw.slice(emittedCleanLen, safeLimit);
          emittedCleanLen = safeLimit;
          params.onChunk(piece);
        }
      }

      const { cleanText, memories } = extractAndStripMemoryTags(fullRaw);
      if (!cleanText) {
        throw new GeminiUnavailableError('Gemini returned an empty streaming response.', 502, 'EMPTY_RESPONSE', true);
      }

      if (cleanText.length > emittedCleanLen) {
        params.onChunk(cleanText.slice(emittedCleanLen));
      }

      return {
        replyText: cleanText,
        memories,
      };
    } catch (err) {
      if (params.abortSignal?.aborted && !wasTimeout()) {
        throw new GeminiUnavailableError('Generation stopped.', 499, 'CLIENT_ABORTED', false);
      }
      const classified = classifyGeminiError(err, wasTimeout());
      lastErr = classified;
      if (emittedCleanLen === 0 && attempt < maxAttempts - 1 && isTransientError(classified)) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      throw classified;
    } finally {
      cleanup();
    }
  }

  throw lastErr || new GeminiUnavailableError('Gemini streaming failed.', 503, 'UPSTREAM_BUSY', true);
}

export async function generateAiWorkoutPlan(params: {
  userId: string;
  splitType: 'PPL' | 'Upper/Lower' | 'Full Body' | 'Bro Split' | 'Custom';
  focusNotes: string;
}): Promise<{ name: string; notes: string; exercises: PlannedExercise[] }> {
  const ai = getAiClient();
  if (!ai) {
    throw new GeminiUnavailableError(
      'GEMINI_API_KEY is not configured on the server. Configure it in Settings > Secrets to generate AI workout plans.',
      503,
      'MISSING_API_KEY',
      false
    );
  }

  const { contextJson } = buildAthleteContextString(params.userId);
  const catalogSummary = EXERCISES.map(
    (e) => `${e.id}|${e.name}|${e.category}|${e.difficulty}|${e.equipment}`
  ).join('\n');

  for (let attempt = 0; attempt < 2; attempt++) {
    const { signal, cleanup, wasTimeout } = createCombinedTimeoutSignal(25000);
    try {
      const response = await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents: `Generate a tailored single workout session for split "${params.splitType}" with user focus: "${params.focusNotes || 'Balanced progression'}".
Select ONLY valid exerciseId values from the catalog below so every exercise maps directly to our database. Choose 4 to 6 exercises suitable for the athlete's equipment, experience level, and limitations.

EXERCISE CATALOG (id|name|category|difficulty|equipment):
${catalogSummary}`,
        config: {
          systemInstruction: `You are an expert strength and hypertrophy programmer. Athlete context:\n${contextJson}`,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              notes: { type: Type.STRING },
              exercises: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    exerciseId: { type: Type.STRING },
                    targetSets: { type: Type.INTEGER },
                    targetReps: { type: Type.STRING },
                    targetWeightKg: { type: Type.NUMBER },
                    restSeconds: { type: Type.INTEGER },
                  },
                  required: ['exerciseId', 'targetSets', 'targetReps', 'targetWeightKg', 'restSeconds'],
                },
              },
            },
            required: ['name', 'notes', 'exercises'],
          },
          abortSignal: signal,
        },
      });

      const parsed = JSON.parse(response.text || '{}') as {
        name?: string;
        notes?: string;
        exercises?: Array<{
          exerciseId: string;
          targetSets: number;
          targetReps: string;
          targetWeightKg: number;
          restSeconds: number;
        }>;
      };

      const validExercises: PlannedExercise[] = (parsed.exercises || [])
        .filter((item) => Boolean(EXERCISE_BY_ID[item.exerciseId]))
        .slice(0, 8)
        .map((item) => ({
          exerciseId: item.exerciseId,
          exerciseName: EXERCISE_BY_ID[item.exerciseId].name,
          targetSets: Math.max(1, Math.min(8, Number(item.targetSets) || 3)),
          targetReps: String(item.targetReps || '8-12'),
          targetWeightKg: Math.max(0, Number(item.targetWeightKg) || 20),
          restSeconds: Math.max(30, Math.min(300, Number(item.restSeconds) || 90)),
        }));

      if (validExercises.length === 0) {
        throw new GeminiUnavailableError(
          'AI could not map valid exercises from the catalog. Click Retry.',
          502,
          'INVALID_PLAN_OUTPUT',
          true
        );
      }

      return {
        name: parsed.name || `AI ${params.splitType} Session`,
        notes: parsed.notes || 'Personalized AI-generated session.',
        exercises: validExercises,
      };
    } catch (err) {
      const classified = classifyGeminiError(err, wasTimeout());
      if (attempt === 0 && isTransientError(classified)) {
        await sleep(800);
        continue;
      }
      throw classified;
    } finally {
      cleanup();
    }
  }
  throw new GeminiUnavailableError('Failed to generate AI plan.', 503, 'UPSTREAM_BUSY', true);
}

export async function generateAiWeeklyReport(
  userId: string,
  language: CoachLanguage = 'en'
): Promise<string> {
  const ai = getAiClient();
  if (!ai) {
    throw new GeminiUnavailableError(
      'GEMINI_API_KEY is not configured on the server.',
      503,
      'MISSING_API_KEY',
      false
    );
  }
  const { contextJson } = buildAthleteContextString(userId);
  let langRule = 'Write the report in crisp, structured English.';
  if (language === 'ta') {
    langRule = 'Write the report fluently in Tamil (தமிழ்), keeping exercise names in English in parentheses.';
  } else if (language === 'tanglish') {
    langRule = 'Write the report in clear, encouraging Tanglish (Tamil in English script) with crisp numbers.';
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const { signal, cleanup, wasTimeout } = createCombinedTimeoutSignal(25000);
    try {
      const response = await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents: `Analyze this athlete's past week using their logged workouts, exact sets/weights, PRs, muscle readiness estimates, nutrition intake, and goal progress.
Include clear Markdown headings for:
1. Consistency & Training Volume Review (cite exact numbers or honestly note if 0 sessions logged)
2. Muscle Group Balance & Recovery Readiness
3. Nutrition & Hydration Alignment
4. Next Week's Actionable Training Adjustments
${langRule}

ATHLETE CONTEXT:
${contextJson}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          abortSignal: signal,
        },
      });
      const text = response.text?.trim();
      if (!text) {
        throw new GeminiUnavailableError('Gemini returned an empty weekly report.', 502, 'EMPTY_RESPONSE', true);
      }
      return text;
    } catch (err) {
      const classified = classifyGeminiError(err, wasTimeout());
      if (attempt === 0 && isTransientError(classified)) {
        await sleep(800);
        continue;
      }
      throw classified;
    } finally {
      cleanup();
    }
  }
  throw new GeminiUnavailableError('Failed to generate weekly AI report.', 503, 'UPSTREAM_BUSY', true);
}

export async function generateAiMealSuggestions(userId: string, promptFocus: string): Promise<string> {
  const ai = getAiClient();
  if (!ai) {
    throw new GeminiUnavailableError(
      'GEMINI_API_KEY is not configured on the server.',
      503,
      'MISSING_API_KEY',
      false
    );
  }
  const { contextJson } = buildAthleteContextString(userId);
  for (let attempt = 0; attempt < 2; attempt++) {
    const { signal, cleanup, wasTimeout } = createCombinedTimeoutSignal(25000);
    try {
      const response = await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents: `Suggest 3 practical meals or snacks respecting the athlete's dietary preference and remaining daily calorie/macro targets. Request focus: "${promptFocus}". Include estimated calories, protein, carbs, and fat per meal clearly marked as estimates.\n\nCONTEXT:\n${contextJson}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          abortSignal: signal,
        },
      });
      const text = response.text?.trim();
      if (!text) {
        throw new GeminiUnavailableError('Gemini returned empty meal suggestions.', 502, 'EMPTY_RESPONSE', true);
      }
      return text;
    } catch (err) {
      const classified = classifyGeminiError(err, wasTimeout());
      if (attempt === 0 && isTransientError(classified)) {
        await sleep(800);
        continue;
      }
      throw classified;
    } finally {
      cleanup();
    }
  }
  throw new GeminiUnavailableError('Failed to generate meal suggestions.', 503, 'UPSTREAM_BUSY', true);
}

export async function createLiveCoachSession(params: {
  userId: string;
  language: CoachLanguage;
  onOpen?: () => void;
  onAudio: (base64Pcm24k: string) => void;
  onInputTranscript: (text: string) => void;
  onOutputTranscript: (text: string) => void;
  onInterrupted: () => void;
  onError: (message: string) => void;
  onClose: () => void;
}) {
  const ai = getLiveAiClient();
  if (!ai) {
    throw new GeminiUnavailableError(
      'GEMINI_API_KEY is not configured on the server.',
      503,
      'MISSING_API_KEY',
      false
    );
  }

  const { contextJson, aiMemoryEnabled } = buildAthleteContextString(params.userId);
  const baseInstruction = buildCoachSystemInstruction({
    contextJson,
    language: params.language,
    aiMemoryEnabled: false,
  });

  const voiceSystemInstruction = `${baseInstruction}

VOICE COACHING MODE:
You are speaking in a real-time voice coaching session. Keep answers concise, natural, encouraging, and conversational (2 to 5 crisp sentences unless the athlete asks for a full multi-day breakdown), with clear exercise cues and concrete numbers based on the athlete's saved data.${aiMemoryEnabled ? '' : ''}`;

  const session = await ai.live.connect({
    model: LIVE_MODEL,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: voiceSystemInstruction,
    },
    callbacks: {
      onopen: () => {
        params.onOpen?.();
      },
      onmessage: (message: LiveServerMessage) => {
        const content = message.serverContent;
        if (content?.inputTranscription?.text) {
          params.onInputTranscript(content.inputTranscription.text);
        }
        if (content?.outputTranscription?.text) {
          params.onOutputTranscript(content.outputTranscription.text);
        }
        for (const part of content?.modelTurn?.parts ?? []) {
          if (part.inlineData?.data) {
            params.onAudio(part.inlineData.data);
          }
        }
        if (content?.interrupted) {
          params.onInterrupted();
        }
      },
      onerror: (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Live voice session encountered an error.';
        params.onError(msg);
      },
      onclose: () => {
        params.onClose();
      },
    },
  });

  return session;
}
