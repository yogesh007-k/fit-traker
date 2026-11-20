import {
  AiChatMessage,
  AiMemoryItem,
  BodyMeasurement,
  CoachLanguage,
  NutritionLog,
  RecoveryLog,
  UserProfile,
  WaterLog,
  WorkoutPlan,
  WorkoutSession,
} from '../types/fitness';
import {
  calculateMacroTargets,
  calculateWorkoutStreak,
  estimateMuscleRecovery,
  extractPersonalRecords,
} from '../utils/fitnessMath';

export type { CoachLanguage };

export interface AthleteBootstrapSnapshot {
  profile: UserProfile | null;
  plans: WorkoutPlan[];
  sessions: WorkoutSession[];
  nutritionLogs: NutritionLog[];
  waterLogs: WaterLog[];
  recoveryLogs: RecoveryLog[];
  measurements: BodyMeasurement[];
  aiMemory: AiMemoryItem[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function buildAthleteContextObject(
  data: AthleteBootstrapSnapshot,
  nowMs: number = Date.now()
): Record<string, unknown> {
  if (!data.profile) {
    return { status: 'No profile data available yet.' };
  }

  const p = data.profile;
  const nowDate = new Date(nowMs);
  const todayDate = nowDate.toISOString().slice(0, 10);
  const weekday = DAY_NAMES[nowDate.getUTCDay()];
  const macros = calculateMacroTargets(p);
  const recovery = estimateMuscleRecovery(data.sessions, data.recoveryLogs[0] || null, nowMs);
  const streak = calculateWorkoutStreak(data.sessions, nowDate.toISOString());
  const prs = extractPersonalRecords(data.sessions);

  const fatiguedOrRecovering = recovery
    .filter((m) => m.recoveryPct < 78)
    .sort((a, b) => a.recoveryPct - b.recoveryPct)
    .slice(0, 10)
    .map((m) => ({
      muscle: m.muscleName,
      readinessPct: m.recoveryPct,
      status: m.statusLabel,
      hoursSinceTrained: m.hoursSinceTrained,
      setsLast7d: m.recentSets7d,
    }));

  const recoveredReadyToday = recovery
    .filter((m) => m.recoveryPct >= 85)
    .slice(0, 14)
    .map((m) => m.muscleName);

  const sevenDaysAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
  const last7dSessions = data.sessions.filter((s) => {
    const t = new Date(s.completedAt).getTime();
    return !Number.isNaN(t) && t >= sevenDaysAgoMs && t <= nowMs;
  });

  const weeklyVolumeKg = Math.round(
    last7dSessions.reduce((acc, s) => acc + (s.totalVolumeKg || 0), 0)
  );
  const weeklyDurationMin = Math.round(
    last7dSessions.reduce((acc, s) => acc + (s.durationSec || 0), 0) / 60
  );
  const weeklySets = last7dSessions.reduce((acc, s) => acc + (s.totalSets || 0), 0);

  const recentWorkouts = data.sessions.slice(0, 8).map((s) => ({
    date: s.completedAt.slice(0, 10),
    title: s.title,
    durationMin: Math.round(s.durationSec / 60),
    totalSets: s.totalSets,
    totalVolumeKg: s.totalVolumeKg,
    notes: s.notes || undefined,
    exercises: s.exercises.map((ex) => {
      const doneSets = ex.sets.filter((st) => st.completed);
      const setSummary = doneSets
        .map((st) => `${st.weightKg}kg×${st.reps}${st.isPr ? ' (PR)' : ''}`)
        .join(', ');
      return `${ex.exerciseName}: [${setSummary || `${ex.sets.length} planned sets`}]`;
    }),
  }));

  const todayFood = data.nutritionLogs.filter((n) => n.logDate === todayDate);
  const todayTotals = todayFood.reduce(
    (acc, n) => ({
      cal: acc.cal + n.calories,
      p: acc.p + n.proteinG,
      c: acc.c + n.carbsG,
      f: acc.f + n.fatG,
    }),
    { cal: 0, p: 0, c: 0, f: 0 }
  );
  const todayWater = data.waterLogs.find((w) => w.logDate === todayDate)?.amountMl || 0;

  const latestMeas = data.measurements[0] || null;
  const oldestMeas = data.measurements[data.measurements.length - 1] || null;

  return {
    currentDate: todayDate,
    currentWeekday: weekday,
    athlete: {
      name: p.name,
      age: p.age,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      experience: p.experience,
      goal: p.goal,
      location: p.location,
      equipment: p.equipment,
      weeklyDaysTarget: p.weeklyDays,
      preferredDurationMin: p.preferredDurationMin,
      dietaryPref: p.dietaryPref,
      activityLevel: p.activityLevel,
      limitations: p.limitations || 'None noted',
      languagePreference: p.language,
    },
    estimatedMacroTargets: macros,
    todayNutritionSoFar: {
      calories: Math.round(todayTotals.cal),
      proteinG: Math.round(todayTotals.p),
      carbsG: Math.round(todayTotals.c),
      fatG: Math.round(todayTotals.f),
      waterMl: todayWater,
      loggedFoods: todayFood.map((f) => `${f.foodName} (${f.mealType})`),
    },
    remainingMacrosToday: {
      calories: Math.max(0, Math.round(macros.calories - todayTotals.cal)),
      proteinG: Math.max(0, Math.round(macros.proteinG - todayTotals.p)),
      carbsG: Math.max(0, Math.round(macros.carbsG - todayTotals.c)),
      fatG: Math.max(0, Math.round(macros.fatG - todayTotals.f)),
      waterMl: Math.max(0, Math.round(macros.waterMl - todayWater)),
    },
    weeklyTrainingStats7d: {
      sessionsCompleted: last7dSessions.length,
      weeklyTargetDays: p.weeklyDays,
      activeStreakDays: streak,
      totalSets: weeklySets,
      totalVolumeKg: weeklyVolumeKg,
      totalDurationMin: weeklyDurationMin,
      totalAllTimeSessions: data.sessions.length,
    },
    personalRecordsTop: prs.slice(0, 10).map((pr) => ({
      exercise: pr.exerciseName,
      maxWeightKg: pr.maxWeightKg,
      bestSetVolumeKg: Math.round(pr.bestVolumeSetKg),
      date: pr.achievedAt.slice(0, 10),
    })),
    bodyMeasurementTrend: latestMeas
      ? {
          latestDate: latestMeas.logDate,
          latestWeightKg: latestMeas.weightKg,
          waistCm: latestMeas.waistCm,
          chestCm: latestMeas.chestCm,
          armsCm: latestMeas.armsCm,
          weightDeltaSinceStartKg:
            oldestMeas && oldestMeas.id !== latestMeas.id
              ? Math.round((latestMeas.weightKg - oldestMeas.weightKg) * 10) / 10
              : 0,
        }
      : null,
    latestRecoveryLog: data.recoveryLogs[0] || null,
    muscleReadiness: {
      fatiguedOrRecovering,
      fullyRecoveredReadyToday: recoveredReadyToday,
    },
    recentWorkouts,
    savedPlans: data.plans.map((pl) => ({
      name: pl.name,
      split: pl.splitType,
      day: DAY_NAMES[pl.dayOfWeek] || `Day ${pl.dayOfWeek}`,
      exercises: pl.exercises.map((e) => `${e.exerciseName} (${e.targetSets}×${e.targetReps} @ ${e.targetWeightKg}kg)`),
    })),
    savedMemoryFacts: p.aiMemoryEnabled
      ? data.aiMemory.map((m) => ({ key: m.memoryKey, value: m.memoryValue, source: m.source }))
      : [],
  };
}

export function buildCoachSystemInstruction(params: {
  contextJson: string;
  language: CoachLanguage;
  aiMemoryEnabled: boolean;
}): string {
  const { contextJson, language, aiMemoryEnabled } = params;

  let langRule =
    'Respond in clear, structured English by default. However, if the user writes in Tamil script or Tanglish (Tamil written in Latin script like "sollu", "venum", "pannanum", "epdi"), naturally match their language (Tamil or Tanglish) while keeping standard exercise names readable in English in parentheses.';

  if (language === 'ta') {
    langRule =
      'Respond fluently in Tamil (தமிழ்) using clear fitness terminology, keeping standard exercise names in English in parentheses for clarity (e.g., "இன்க்லைன் டம்பெல் பிரஸ் (Incline Dumbbell Press)").';
  } else if (language === 'tanglish') {
    langRule =
      'Respond in clear, natural Tanglish (conversational Tamil written in English letters, e.g., "Chest grow panna incline dumbbell press 3 sets x 8-10 reps pannunga"), keeping exercise names and numbers crisp and easy to follow.';
  }

  const memoryRule = aiMemoryEnabled
    ? `DURABLE PERSONAL MEMORY CAPTURE:
If the user reveals a NEW, durable personal fitness fact in this message (such as a joint pain/injury, equipment change, schedule change, dietary switch, or specific lift goal) that is NOT already in savedMemoryFacts or profile, append at most ONE or TWO lines at the VERY END of your reply in the exact format:
[[MEMORY: Short Topic | Concise factual preference or constraint]]
Never emit [[MEMORY: ...]] for temporary questions or facts already recorded.`
    : 'Persistent memory saving is disabled by the user; do not emit any [[MEMORY: ...]] tags.';

  return `You are FITTRACK X ULTRA Personal AI Fitness Manager — an elite, evidence-based strength, hypertrophy, fat-loss, nutrition, anatomy, and recovery coach.

DOMAIN MASTERY:
Provide genuinely expert, detailed, practical coaching across:
- All 40 major muscle groups (chest heads, back lats/traps/rhomboids/erectors, deltoid heads, biceps heads/brachialis, triceps heads, forearms, upper/mid/lower abs, obliques, glutes, quads, hamstrings, adductors/abductors, calves/tibialis).
- Exercise biomechanics, setup, grip/stance cues, tempo, breathing, and common form mistakes.
- Gym splits (PPL, Upper/Lower, Full Body, 5-Day Hypertrophy/Bro Split) and zero-equipment / minimal-equipment home workouts.
- Muscle hypertrophy (RPE/RIR, effective volume 10–20 sets/muscle/week, rep ranges 6–20), fat loss (caloric deficit, protein retention, step/cardio integration), strength training, and progressive overload (double progression, micro-loading, tempo/density).
- Nutrition (protein g/kg targets, calorie/macro breakdown, Indian & global food options, hydration).
- Recovery (sleep quality, soreness vs sharp pain, muscle readiness, deload timing).

PERSONALIZATION & GROUNDING RULES:
1. Ground every personalized recommendation directly in ATHLETE LIVE CONTEXT below (use their actual logged weights, reps, PRs, 7-day volume, muscle readiness %, remaining protein/calories, equipment, and limitations).
2. NEVER invent workouts, PRs, or logs not present in ATHLETE LIVE CONTEXT. If recentWorkouts is empty (new account), state honestly that no workouts are logged yet, ask 2–3 quick clarifying questions if helpful, and give a tailored starting plan from their profile/equipment.
3. Respect injuries and limitations strictly (e.g., if wrist tightness is noted, prefer EZ-bar/neutral-grip options; do not diagnose medical conditions—recommend consulting a clinician for acute/sharp pain).
4. Conversation Intelligence: Track all prior turns in the conversation. When answering follow-up requests ("swap to dumbbells", "make it shorter", "explain day 2"), modify or expand the active discussion directly without repeating boilerplate from previous turns.
5. Formatting & Clarity: Use clean Markdown headings (###), bullet points, bold exercise names, and concrete numbers (sets, reps, target load/RIR, rest seconds).
6. ${langRule}

${memoryRule}

ATHLETE LIVE CONTEXT:
${contextJson}`;
}

export interface ExtractedMemoryFact {
  memoryKey: string;
  memoryValue: string;
}

const MEMORY_TAG_REGEX = /\[\[MEMORY:\s*([^|\]]+?)\s*\|\s*([^\]]+?)\s*\]\]/gi;

export function extractAndStripMemoryTags(rawReply: string): {
  cleanText: string;
  memories: ExtractedMemoryFact[];
} {
  const memories: ExtractedMemoryFact[] = [];
  const seenKeys = new Set<string>();

  const cleanText = rawReply
    .replace(MEMORY_TAG_REGEX, (_match, rawKey: string, rawVal: string) => {
      const memoryKey = rawKey.trim().slice(0, 60);
      const memoryValue = rawVal.trim().slice(0, 280);
      const normKey = memoryKey.toLowerCase();
      if (memoryKey.length >= 2 && memoryValue.length >= 4 && !seenKeys.has(normKey)) {
        seenKeys.add(normKey);
        memories.push({ memoryKey, memoryValue });
      }
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleanText, memories: memories.slice(0, 2) };
}

export function prepareConversationContents(
  history: AiChatMessage[],
  latestMessage: string,
  maxMessages = 24
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  let windowed = history;
  if (history.length > maxMessages) {
    // Keep the opening exchange so long threads never forget the original goal, plus the latest turns
    const head = history.slice(0, 2);
    const tail = history.slice(-(maxMessages - 2));
    windowed = [...head, ...tail];
  }

  return [
    ...windowed.map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: m.content }],
    })),
    { role: 'user' as const, parts: [{ text: latestMessage }] },
  ];
}
