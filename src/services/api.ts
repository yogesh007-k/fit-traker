import {
  AiConversation,
  AiMemoryItem,
  BodyMeasurement,
  CoachLanguage,
  MealType,
  NutritionLog,
  PlannedExercise,
  RecoveryLog,
  SessionExercise,
  UserAccount,
  UserProfile,
  WaterLog,
  WorkoutPlan,
  WorkoutSession,
} from '../types/fitness';

let memoryBearerToken: string | null = null;

export function setInMemoryToken(token: string | null): void {
  memoryBearerToken = token;
}

export function getInMemoryToken(): string | null {
  return memoryBearerToken;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  retryable?: boolean;
  constructor(message: string, status: number, code?: string, retryable?: boolean) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (memoryBearerToken) {
    headers['Authorization'] = `Bearer ${memoryBearerToken}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    throw new ApiError(
      String(data.error || `Request failed (${res.status})`),
      res.status,
      data.code ? String(data.code) : undefined,
      Boolean(data.retryable)
    );
  }
  return data as T;
}

export interface BootstrapPayload {
  user: UserAccount;
  profile: UserProfile;
  plans: WorkoutPlan[];
  sessions: WorkoutSession[];
  nutritionLogs: NutritionLog[];
  waterLogs: WaterLog[];
  recoveryLogs: RecoveryLog[];
  measurements: BodyMeasurement[];
  aiConversations: AiConversation[];
  aiMemory: AiMemoryItem[];
  favoriteExerciseIds: string[];
}

export const api = {
  register: (payload: { name: string; email: string; password: string }) =>
    request<{ user: UserAccount; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<{ user: UserAccount; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  demoLogin: () =>
    request<{ user: UserAccount; token: string }>('/api/auth/demo', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  resetPassword: (payload: { currentPassword: string; newPassword: string }) =>
    request<{ ok: boolean }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  authMe: () => request<{ user: UserAccount | null }>('/api/auth/me'),

  getBootstrap: () => request<BootstrapPayload>('/api/bootstrap'),

  updateProfile: (profile: Partial<UserProfile>) =>
    request<{ profile: UserProfile }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    }),

  createPlan: (plan: {
    name: string;
    splitType: WorkoutPlan['splitType'];
    dayOfWeek: number;
    exercises: PlannedExercise[];
    notes?: string;
    isAiGenerated?: boolean;
  }) =>
    request<{ plan: WorkoutPlan }>('/api/plans', {
      method: 'POST',
      body: JSON.stringify(plan),
    }),

  updatePlan: (
    id: string,
    plan: {
      name: string;
      splitType: WorkoutPlan['splitType'];
      dayOfWeek: number;
      exercises: PlannedExercise[];
      notes?: string;
    }
  ) =>
    request<{ ok: boolean; updatedAt: string }>(`/api/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(plan),
    }),

  deletePlan: (id: string) =>
    request<{ ok: boolean }>(`/api/plans/${id}`, {
      method: 'DELETE',
    }),

  createSession: (payload: {
    planId?: string | null;
    title: string;
    startedAt: string;
    durationSec: number;
    exercises: SessionExercise[];
    notes?: string;
  }) =>
    request<{ session: WorkoutSession }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteSession: (id: string) =>
    request<{ ok: boolean }>(`/api/sessions/${id}`, {
      method: 'DELETE',
    }),

  addNutrition: (payload: {
    logDate: string;
    mealType: MealType;
    foodName: string;
    servingQty: number;
    servingUnit: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    isFavorite?: boolean;
  }) =>
    request<{ entry: NutritionLog }>('/api/nutrition', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateNutrition: (id: string, payload: { servingQty?: number; isFavorite?: boolean }) =>
    request<{
      ok: boolean;
      servingQty: number;
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      isFavorite: boolean;
    }>(`/api/nutrition/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteNutrition: (id: string) =>
    request<{ ok: boolean }>(`/api/nutrition/${id}`, {
      method: 'DELETE',
    }),

  setWater: (logDate: string, amountMl: number) =>
    request<{ waterLog: WaterLog }>('/api/water', {
      method: 'PUT',
      body: JSON.stringify({ logDate, amountMl }),
    }),

  addRecovery: (payload: {
    logDate: string;
    sleepHours: number;
    sleepQuality: number;
    sorenessLevel: number;
    fatigueLevel: number;
    soreMuscles: string[];
    notes?: string;
  }) =>
    request<{ recoveryLog: RecoveryLog }>('/api/recovery', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  addMeasurement: (payload: {
    logDate: string;
    weightKg: number;
    waistCm?: number | null;
    chestCm?: number | null;
    armsCm?: number | null;
    thighsCm?: number | null;
    hipsCm?: number | null;
    photoDataUrl?: string | null;
    note?: string;
  }) =>
    request<{ measurement: BodyMeasurement }>('/api/measurements', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteMeasurement: (id: string) =>
    request<{ ok: boolean }>(`/api/measurements/${id}`, {
      method: 'DELETE',
    }),

  toggleFavorite: (exerciseId: string) =>
    request<{ favorited: boolean }>('/api/favorites/toggle', {
      method: 'POST',
      body: JSON.stringify({ exerciseId }),
    }),

  aiChat: (payload: {
    conversationId?: string;
    message: string;
    language?: CoachLanguage;
    replaceLastAssistant?: boolean;
  }) =>
    request<{ conversation: AiConversation; memoriesSaved?: number }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  aiChatStream: async (
    payload: {
      conversationId?: string;
      message: string;
      language?: CoachLanguage;
      replaceLastAssistant?: boolean;
    },
    handlers: {
      onStart?: (conversationId: string) => void;
      onChunk: (deltaText: string) => void;
      signal?: AbortSignal;
    }
  ): Promise<{ conversation: AiConversation; memoriesSaved: number }> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };
    if (memoryBearerToken) {
      headers['Authorization'] = `Bearer ${memoryBearerToken}`;
    }

    const res = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      credentials: 'include',
      signal: handlers.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      let errData: Record<string, unknown> = {};
      try {
        errData = JSON.parse(text) as Record<string, unknown>;
      } catch {
        errData = { error: text };
      }
      throw new ApiError(
        String(errData.error || `Request failed (${res.status})`),
        res.status,
        errData.code ? String(errData.code) : undefined,
        Boolean(errData.retryable ?? true)
      );
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new ApiError('Streaming response body unavailable.', 502, 'STREAM_UNAVAILABLE', true);
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let finalConversation: AiConversation | null = null;
    let memoriesSaved = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const evt of events) {
        const lines = evt
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim());
        for (const rawJson of lines) {
          if (!rawJson) continue;
          const parsed = JSON.parse(rawJson) as {
            type?: string;
            conversationId?: string;
            text?: string;
            conversation?: AiConversation;
            memoriesSaved?: number;
            error?: string;
            code?: string;
            retryable?: boolean;
          };
          if (parsed.type === 'start' && parsed.conversationId) {
            handlers.onStart?.(parsed.conversationId);
          } else if (parsed.type === 'chunk' && typeof parsed.text === 'string') {
            handlers.onChunk(parsed.text);
          } else if (parsed.type === 'done' && parsed.conversation) {
            finalConversation = parsed.conversation;
            memoriesSaved = Number(parsed.memoriesSaved || 0);
          } else if (parsed.type === 'error') {
            throw new ApiError(
              parsed.error || 'AI Coach streaming error.',
              502,
              parsed.code || 'UPSTREAM_ERROR',
              parsed.retryable !== false
            );
          }
        }
      }
    }

    if (!finalConversation) {
      throw new ApiError('AI Coach stream ended unexpectedly before completion.', 502, 'INCOMPLETE_STREAM', true);
    }

    return { conversation: finalConversation, memoriesSaved };
  },

  aiGeneratePlan: (payload: { splitType: WorkoutPlan['splitType']; focusNotes?: string }) =>
    request<{ name: string; notes: string; exercises: PlannedExercise[] }>('/api/ai/generate-plan', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  aiWeeklyReport: (language: CoachLanguage = 'en') =>
    request<{ report: string }>('/api/ai/weekly-report', {
      method: 'POST',
      body: JSON.stringify({ language }),
    }),

  aiMealIdeas: (promptFocus: string) =>
    request<{ suggestions: string }>('/api/ai/meal-ideas', {
      method: 'POST',
      body: JSON.stringify({ promptFocus }),
    }),

  deleteAiConversation: (id: string) =>
    request<{ ok: boolean }>(`/api/ai/conversations/${id}`, {
      method: 'DELETE',
    }),

  addAiMemory: (memoryKey: string, memoryValue: string) =>
    request<{ item: AiMemoryItem }>('/api/ai/memory', {
      method: 'POST',
      body: JSON.stringify({ memoryKey, memoryValue }),
    }),

  deleteAiMemory: (id: string) =>
    request<{ ok: boolean }>(`/api/ai/memory/${id}`, {
      method: 'DELETE',
    }),

  deleteAccount: () =>
    request<{ ok: boolean }>('/api/account', {
      method: 'DELETE',
    }),
};
