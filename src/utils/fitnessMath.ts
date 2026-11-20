import {
  AchievementBadge,
  BodyMeasurement,
  MuscleRecoveryStatus,
  NutritionLog,
  RecoveryLog,
  UserProfile,
  WorkoutSession,
} from '../types/fitness';
import { MUSCLES } from '../data/muscles';

export interface MacroTargets {
  bmr: number;
  tdee: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
}

const ACTIVITY_MULTIPLIERS: Record<UserProfile['activityLevel'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

export function calculateMacroTargets(profile: Partial<UserProfile>): MacroTargets {
  const weightKg = profile.weightKg && profile.weightKg > 30 ? profile.weightKg : 74;
  const heightCm = profile.heightCm && profile.heightCm > 100 ? profile.heightCm : 175;
  const age = profile.age && profile.age > 12 ? profile.age : 27;

  // Mifflin-St Jeor balanced reference
  const bmr = Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
  const mult = ACTIVITY_MULTIPLIERS[profile.activityLevel || 'moderate'] || 1.55;
  const tdee = Math.round(bmr * mult);

  let calorieDelta = 0;
  let proteinPerKg = 1.8;
  switch (profile.goal) {
    case 'fat_loss':
      calorieDelta = -450;
      proteinPerKg = 2.0;
      break;
    case 'muscle_gain':
      calorieDelta = 300;
      proteinPerKg = 2.0;
      break;
    case 'strength':
      calorieDelta = 200;
      proteinPerKg = 1.9;
      break;
    case 'recomposition':
      calorieDelta = -100;
      proteinPerKg = 2.1;
      break;
    case 'endurance':
      calorieDelta = 150;
      proteinPerKg = 1.6;
      break;
    default:
      calorieDelta = 0;
      proteinPerKg = 1.7;
  }

  const calories = Math.max(1350, tdee + calorieDelta);
  const proteinG = Math.round(weightKg * proteinPerKg);
  const fatG = Math.round((calories * 0.27) / 9);
  const remainingCalories = Math.max(200, calories - proteinG * 4 - fatG * 9);
  const carbsG = Math.round(remainingCalories / 4);
  const waterMl = Math.round(weightKg * 35);

  return { bmr, tdee, calories, proteinG, carbsG, fatG, waterMl };
}

export function calculateWorkoutStreak(sessions: WorkoutSession[], referenceDateIso?: string): number {
  if (!sessions.length) return 0;
  const uniqueDays = Array.from(
    new Set(sessions.map((s) => s.completedAt.slice(0, 10)))
  ).sort((a, b) => (a > b ? -1 : 1));

  const today = (referenceDateIso || new Date().toISOString()).slice(0, 10);
  const yesterdayDate = new Date(today + 'T00:00:00Z');
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) {
    return 0;
  }

  let streak = 1;
  for (let i = 0; i < uniqueDays.length - 1; i++) {
    const curr = new Date(uniqueDays[i] + 'T00:00:00Z');
    const prev = new Date(uniqueDays[i + 1] + 'T00:00:00Z');
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function estimateMuscleRecovery(
  sessions: WorkoutSession[],
  latestRecovery: RecoveryLog | null,
  nowMs: number = Date.now()
): MuscleRecoveryStatus[] {
  const sleepFactor = latestRecovery
    ? Math.max(0.75, Math.min(1.15, (latestRecovery.sleepHours / 7.5) * (0.85 + latestRecovery.sleepQuality * 0.04)))
    : 1.0;

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  return MUSCLES.map((muscle) => {
    let weightedLoad = 0;
    let latestTrainedMs: number | null = null;
    let recentSets7d = 0;

    for (const session of sessions) {
      const completedMs = new Date(session.completedAt).getTime();
      if (Number.isNaN(completedMs) || completedMs > nowMs) continue;
      const ageMs = nowMs - completedMs;
      const ageHours = ageMs / (1000 * 60 * 60);

      for (const ex of session.exercises) {
        const completedSetsCount = ex.sets.filter((s) => s.completed).length;
        if (completedSetsCount === 0) continue;

        const isPrimary = ex.primaryMuscles.includes(muscle.id);
        const isSecondary = ex.secondaryMuscles.includes(muscle.id);
        if (!isPrimary && !isSecondary) continue;

        if (ageMs <= sevenDaysMs && isPrimary) {
          recentSets7d += completedSetsCount;
        }

        if (latestTrainedMs === null || completedMs > latestTrainedMs) {
          latestTrainedMs = completedMs;
        }

        // Recovery half-life ~ 24h for secondary, ~34h for primary
        if (ageHours < 96) {
          const roleWeight = isPrimary ? 1.0 : 0.45;
          const decay = Math.exp(-ageHours / (28 * sleepFactor));
          weightedLoad += completedSetsCount * roleWeight * 9.5 * decay;
        }
      }
    }

    // Add self-reported soreness penalty if tagged
    if (latestRecovery && latestRecovery.soreMuscles.includes(muscle.id)) {
      weightedLoad += latestRecovery.sorenessLevel * 7;
    }

    const recoveryPct = Math.max(12, Math.min(100, Math.round(100 - weightedLoad)));
    const statusLabel: MuscleRecoveryStatus['statusLabel'] =
      recoveryPct >= 78 ? 'Recovered' : recoveryPct >= 50 ? 'Moderate Load' : 'Fatigued';

    const hoursSinceTrained =
      latestTrainedMs !== null ? Math.round((nowMs - latestTrainedMs) / (1000 * 60 * 60)) : null;

    return {
      muscleId: muscle.id,
      muscleName: muscle.name,
      recoveryPct,
      statusLabel,
      hoursSinceTrained,
      recentSets7d,
    };
  });
}

export function calculateDailyFitnessScore(params: {
  sessionsLast7d: number;
  weeklyGoalDays: number;
  todayCalories: number;
  targetCalories: number;
  todayWaterMl: number;
  targetWaterMl: number;
  avgRecoveryPct: number;
}): number {
  const {
    sessionsLast7d,
    weeklyGoalDays,
    todayCalories,
    targetCalories,
    todayWaterMl,
    targetWaterMl,
    avgRecoveryPct,
  } = params;

  const workoutConsistency = Math.min(1, sessionsLast7d / Math.max(1, weeklyGoalDays)) * 40;

  let nutritionScore = 10;
  if (todayCalories > 0 && targetCalories > 0) {
    const ratio = todayCalories / targetCalories;
    const distance = Math.abs(1 - ratio);
    nutritionScore = Math.max(5, Math.min(25, Math.round(25 * (1 - Math.min(1, distance)))));
  }

  const hydrationScore = Math.min(15, Math.round((todayWaterMl / Math.max(500, targetWaterMl)) * 15));
  const recoveryScore = Math.round((avgRecoveryPct / 100) * 20);

  return Math.max(0, Math.min(100, Math.round(workoutConsistency + nutritionScore + hydrationScore + recoveryScore)));
}

export function calculateSessionXp(totalSets: number, totalVolumeKg: number, prCount: number): number {
  const base = 40;
  const setXp = totalSets * 6;
  const volumeXp = Math.min(120, Math.round(totalVolumeKg / 250));
  const prXp = prCount * 35;
  return base + setXp + volumeXp + prXp;
}

export function calculateLevelFromXp(xp: number): { level: number; currentLevelXp: number; nextLevelXp: number; progressPct: number } {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
  const currentThreshold = Math.pow(level - 1, 2) * 100;
  const nextThreshold = Math.pow(level, 2) * 100;
  const span = Math.max(100, nextThreshold - currentThreshold);
  const progressPct = Math.min(100, Math.round(((xp - currentThreshold) / span) * 100));
  return {
    level,
    currentLevelXp: xp - currentThreshold,
    nextLevelXp: span,
    progressPct,
  };
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  maxWeightKg: number;
  bestVolumeSetKg: number;
  achievedAt: string;
}

export function extractPersonalRecords(sessions: WorkoutSession[]): PersonalRecord[] {
  const map = new Map<string, PersonalRecord>();
  const ordered = [...sessions].sort((a, b) => (a.completedAt < b.completedAt ? -1 : 1));

  for (const session of ordered) {
    for (const ex of session.exercises) {
      for (const s of ex.sets) {
        if (!s.completed || s.reps <= 0) continue;
        const vol = s.weightKg * s.reps;
        const existing = map.get(ex.exerciseId);
        if (!existing || s.weightKg > existing.maxWeightKg || (s.weightKg === existing.maxWeightKg && vol > existing.bestVolumeSetKg)) {
          map.set(ex.exerciseId, {
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            maxWeightKg: Math.max(existing?.maxWeightKg ?? 0, s.weightKg),
            bestVolumeSetKg: Math.max(existing?.bestVolumeSetKg ?? 0, vol),
            achievedAt: session.completedAt,
          });
        }
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.maxWeightKg - a.maxWeightKg);
}

export function evaluateAchievements(params: {
  sessions: WorkoutSession[];
  nutritionLogs: NutritionLog[];
  measurements: BodyMeasurement[];
  streak: number;
}): AchievementBadge[] {
  const { sessions, nutritionLogs, measurements, streak } = params;
  const totalWorkouts = sessions.length;
  const totalSets = sessions.reduce((acc, s) => acc + s.totalSets, 0);
  const prs = extractPersonalRecords(sessions);
  const hasPr = sessions.some((s) => s.exercises.some((ex) => ex.sets.some((st) => st.isPr))) || prs.length >= 3;

  return [
    {
      key: 'first_workout',
      title: 'First Ignition',
      description: 'Complete your first logged workout session.',
      xpReward: 100,
      requirementText: `${Math.min(1, totalWorkouts)} / 1 workout`,
      unlocked: totalWorkouts >= 1,
      unlockedAt: sessions[sessions.length - 1]?.completedAt,
    },
    {
      key: 'streak_7',
      title: '7-Day Momentum',
      description: 'Maintain an active 7-day consecutive training streak.',
      xpReward: 250,
      requirementText: `${Math.min(7, streak)} / 7 days`,
      unlocked: streak >= 7,
    },
    {
      key: 'workouts_10',
      title: 'Iron Consistency',
      description: 'Complete 10 tracked workout sessions.',
      xpReward: 300,
      requirementText: `${Math.min(10, totalWorkouts)} / 10 workouts`,
      unlocked: totalWorkouts >= 10,
    },
    {
      key: 'sets_100',
      title: 'Centurion Volume',
      description: 'Log 100 completed working sets across your training history.',
      xpReward: 250,
      requirementText: `${Math.min(100, totalSets)} / 100 sets`,
      unlocked: totalSets >= 100,
    },
    {
      key: 'first_pr',
      title: 'Peak Breaker',
      description: 'Record a personal record weight or set volume milestone.',
      xpReward: 150,
      requirementText: hasPr ? 'Achieved' : 'Log a new PR set',
      unlocked: hasPr,
    },
    {
      key: 'nutrition_5',
      title: 'Macro Precision',
      description: 'Log at least 5 nutrition entries in the Nutrition AI Lab.',
      xpReward: 120,
      requirementText: `${Math.min(5, nutritionLogs.length)} / 5 meals`,
      unlocked: nutritionLogs.length >= 5,
    },
    {
      key: 'twin_3',
      title: 'Digital Twin Calibrated',
      description: 'Record 3 body measurement check-ins.',
      xpReward: 150,
      requirementText: `${Math.min(3, measurements.length)} / 3 check-ins`,
      unlocked: measurements.length >= 3,
    },
  ];
}
