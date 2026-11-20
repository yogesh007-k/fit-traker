import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  AiConversation,
  AiMemoryItem,
  BodyMeasurement,
  NutritionLog,
  RecoveryLog,
  UserAccount,
  UserProfile,
  WaterLog,
  WorkoutPlan,
  WorkoutSession,
} from '../types/fitness';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'fittrack.db');
export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER,
    height_cm REAL,
    weight_kg REAL,
    experience TEXT NOT NULL DEFAULT 'beginner',
    goal TEXT NOT NULL DEFAULT 'muscle_gain',
    location TEXT NOT NULL DEFAULT 'both',
    equipment_json TEXT NOT NULL DEFAULT '["Dumbbells","Bodyweight"]',
    weekly_days INTEGER NOT NULL DEFAULT 4,
    preferred_duration_min INTEGER NOT NULL DEFAULT 50,
    dietary_pref TEXT NOT NULL DEFAULT 'non_veg',
    activity_level TEXT NOT NULL DEFAULT 'moderate',
    limitations TEXT NOT NULL DEFAULT '',
    units TEXT NOT NULL DEFAULT 'metric',
    language TEXT NOT NULL DEFAULT 'en',
    notifications_enabled INTEGER NOT NULL DEFAULT 1,
    ai_memory_enabled INTEGER NOT NULL DEFAULT 1,
    privacy_photos_private INTEGER NOT NULL DEFAULT 1,
    onboarding_completed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS workout_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    split_type TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,
    exercises_json TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    is_ai_generated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS workout_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_id TEXT,
    title TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    duration_sec INTEGER NOT NULL,
    total_sets INTEGER NOT NULL,
    total_volume_kg REAL NOT NULL,
    est_calories INTEGER NOT NULL,
    exercises_json TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    xp_earned INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS nutrition_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    log_date TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    food_name TEXT NOT NULL,
    serving_qty REAL NOT NULL,
    serving_unit TEXT NOT NULL,
    calories REAL NOT NULL,
    protein_g REAL NOT NULL,
    carbs_g REAL NOT NULL,
    fat_g REAL NOT NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS water_logs (
    user_id TEXT NOT NULL,
    log_date TEXT NOT NULL,
    amount_ml INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, log_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS recovery_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    log_date TEXT NOT NULL,
    sleep_hours REAL NOT NULL,
    sleep_quality INTEGER NOT NULL,
    soreness_level INTEGER NOT NULL,
    fatigue_level INTEGER NOT NULL,
    sore_muscles_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS measurements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    log_date TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    waist_cm REAL,
    chest_cm REAL,
    arms_cm REAL,
    thighs_cm REAL,
    hips_cm REAL,
    photo_data_url TEXT,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    messages_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ai_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    memory_key TEXT NOT NULL,
    memory_value TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'user',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS exercise_favorites (
    user_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, exercise_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, originalHex] = stored.split(':');
  if (!salt || !originalHex) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (candidate.length !== original.length) return false;
  return crypto.timingSafeEqual(candidate, original);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSessionToken(userId: string): string {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).run(tokenHash, userId, expires.toISOString(), now.toISOString());
  return rawToken;
}

export function getUserBySessionToken(rawToken: string | undefined): UserAccount | null {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.created_at, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash) as { id: string; email: string; name: string; created_at: string; expires_at: string } | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at,
  };
}

export function deleteSessionToken(rawToken: string | undefined): void {
  if (!rawToken) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(rawToken));
}

export function createDefaultProfile(userId: string, name: string, onboardingCompleted = false): UserProfile {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO profiles (
      user_id, name, age, height_cm, weight_kg, experience, goal, location,
      equipment_json, weekly_days, preferred_duration_min, dietary_pref, activity_level,
      limitations, units, language, notifications_enabled, ai_memory_enabled,
      privacy_photos_private, onboarding_completed, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    name,
    27,
    176,
    74,
    'intermediate',
    'muscle_gain',
    'both',
    JSON.stringify(['Barbell', 'Dumbbells', 'Cable Machine', 'Pull-Up Bar']),
    4,
    55,
    'non_veg',
    'moderate',
    '',
    'metric',
    'en',
    1,
    1,
    1,
    onboardingCompleted ? 1 : 0,
    now
  );
  return getProfile(userId)!;
}

export function getProfile(userId: string): UserProfile | null {
  const row = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    userId: String(row.user_id),
    name: String(row.name),
    age: row.age !== null ? Number(row.age) : null,
    heightCm: row.height_cm !== null ? Number(row.height_cm) : null,
    weightKg: row.weight_kg !== null ? Number(row.weight_kg) : null,
    experience: row.experience as UserProfile['experience'],
    goal: row.goal as UserProfile['goal'],
    location: row.location as UserProfile['location'],
    equipment: safeJsonParse<string[]>(String(row.equipment_json), []),
    weeklyDays: Number(row.weekly_days),
    preferredDurationMin: Number(row.preferred_duration_min),
    dietaryPref: row.dietary_pref as UserProfile['dietaryPref'],
    activityLevel: row.activity_level as UserProfile['activityLevel'],
    limitations: String(row.limitations || ''),
    units: (row.units as UserProfile['units']) || 'metric',
    language: (row.language as UserProfile['language']) || 'en',
    notificationsEnabled: Boolean(row.notifications_enabled),
    aiMemoryEnabled: Boolean(row.ai_memory_enabled),
    privacyPhotosPrivate: Boolean(row.privacy_photos_private),
    onboardingCompleted: Boolean(row.onboarding_completed),
    updatedAt: String(row.updated_at),
  };
}

export function getUserBootstrap(userId: string) {
  const profile = getProfile(userId);
  const plans = (db
    .prepare('SELECT * FROM workout_plans WHERE user_id = ? ORDER BY day_of_week ASC, updated_at DESC')
    .all(userId) as Record<string, unknown>[]).map((r): WorkoutPlan => ({
    id: String(r.id),
    userId: String(r.user_id),
    name: String(r.name),
    splitType: r.split_type as WorkoutPlan['splitType'],
    dayOfWeek: Number(r.day_of_week),
    exercises: safeJsonParse(String(r.exercises_json), []),
    notes: String(r.notes || ''),
    isAiGenerated: Boolean(r.is_ai_generated),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));

  const sessions = (db
    .prepare('SELECT * FROM workout_sessions WHERE user_id = ? ORDER BY completed_at DESC')
    .all(userId) as Record<string, unknown>[]).map((r): WorkoutSession => ({
    id: String(r.id),
    userId: String(r.user_id),
    planId: r.plan_id ? String(r.plan_id) : null,
    title: String(r.title),
    startedAt: String(r.started_at),
    completedAt: String(r.completed_at),
    durationSec: Number(r.duration_sec),
    totalSets: Number(r.total_sets),
    totalVolumeKg: Number(r.total_volume_kg),
    estCalories: Number(r.est_calories),
    exercises: safeJsonParse(String(r.exercises_json), []),
    notes: String(r.notes || ''),
    xpEarned: Number(r.xp_earned),
  }));

  const nutritionLogs = (db
    .prepare('SELECT * FROM nutrition_logs WHERE user_id = ? ORDER BY log_date DESC, created_at DESC')
    .all(userId) as Record<string, unknown>[]).map((r): NutritionLog => ({
    id: String(r.id),
    userId: String(r.user_id),
    logDate: String(r.log_date),
    mealType: r.meal_type as NutritionLog['mealType'],
    foodName: String(r.food_name),
    servingQty: Number(r.serving_qty),
    servingUnit: String(r.serving_unit),
    calories: Number(r.calories),
    proteinG: Number(r.protein_g),
    carbsG: Number(r.carbs_g),
    fatG: Number(r.fat_g),
    isFavorite: Boolean(r.is_favorite),
    createdAt: String(r.created_at),
  }));

  const waterLogs = (db
    .prepare('SELECT * FROM water_logs WHERE user_id = ? ORDER BY log_date DESC')
    .all(userId) as Record<string, unknown>[]).map((r): WaterLog => ({
    userId: String(r.user_id),
    logDate: String(r.log_date),
    amountMl: Number(r.amount_ml),
    updatedAt: String(r.updated_at),
  }));

  const recoveryLogs = (db
    .prepare('SELECT * FROM recovery_logs WHERE user_id = ? ORDER BY log_date DESC, created_at DESC')
    .all(userId) as Record<string, unknown>[]).map((r): RecoveryLog => ({
    id: String(r.id),
    userId: String(r.user_id),
    logDate: String(r.log_date),
    sleepHours: Number(r.sleep_hours),
    sleepQuality: Number(r.sleep_quality),
    sorenessLevel: Number(r.soreness_level),
    fatigueLevel: Number(r.fatigue_level),
    soreMuscles: safeJsonParse(String(r.sore_muscles_json), []),
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
  }));

  const measurements = (db
    .prepare('SELECT * FROM measurements WHERE user_id = ? ORDER BY log_date DESC, created_at DESC')
    .all(userId) as Record<string, unknown>[]).map((r): BodyMeasurement => ({
    id: String(r.id),
    userId: String(r.user_id),
    logDate: String(r.log_date),
    weightKg: Number(r.weight_kg),
    waistCm: r.waist_cm !== null ? Number(r.waist_cm) : null,
    chestCm: r.chest_cm !== null ? Number(r.chest_cm) : null,
    armsCm: r.arms_cm !== null ? Number(r.arms_cm) : null,
    thighsCm: r.thighs_cm !== null ? Number(r.thighs_cm) : null,
    hipsCm: r.hips_cm !== null ? Number(r.hips_cm) : null,
    photoDataUrl: r.photo_data_url ? String(r.photo_data_url) : null,
    note: String(r.note || ''),
    createdAt: String(r.created_at),
  }));

  const aiConversations = (db
    .prepare('SELECT * FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC')
    .all(userId) as Record<string, unknown>[]).map((r): AiConversation => ({
    id: String(r.id),
    userId: String(r.user_id),
    title: String(r.title),
    messages: safeJsonParse(String(r.messages_json), []),
    updatedAt: String(r.updated_at),
    createdAt: String(r.created_at),
  }));

  const aiMemory = (db
    .prepare('SELECT * FROM ai_memory WHERE user_id = ? ORDER BY updated_at DESC')
    .all(userId) as Record<string, unknown>[]).map((r): AiMemoryItem => ({
    id: String(r.id),
    userId: String(r.user_id),
    memoryKey: String(r.memory_key),
    memoryValue: String(r.memory_value),
    source: (r.source as 'user' | 'auto') || 'user',
    updatedAt: String(r.updated_at),
  }));

  const favoriteExerciseIds = (db
    .prepare('SELECT exercise_id FROM exercise_favorites WHERE user_id = ?')
    .all(userId) as { exercise_id: string }[]).map((r) => r.exercise_id);

  return {
    profile,
    plans,
    sessions,
    nutritionLogs,
    waterLogs,
    recoveryLogs,
    measurements,
    aiConversations,
    aiMemory,
    favoriteExerciseIds,
  };
}

function safeJsonParse<T>(input: string, fallback: T): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

export function ensureDemoAthleteSeeded(): UserAccount {
  const demoEmail = 'alex@fittrack.ultra';
  const existing = db
    .prepare('SELECT id, email, name, created_at FROM users WHERE email = ?')
    .get(demoEmail) as { id: string; email: string; name: string; created_at: string } | undefined;

  if (existing) {
    return {
      id: existing.id,
      email: existing.email,
      name: existing.name,
      createdAt: existing.created_at,
    };
  }

  const userId = 'demo-athlete-001';
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const daysAgoIso = (days: number, hour = 9) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - days);
    d.setUTCHours(hour, 15, 0, 0);
    return d.toISOString();
  };
  const daysAgoDate = (days: number) => daysAgoIso(days).slice(0, 10);

  db.prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userId,
    demoEmail,
    'Alex Mercer',
    hashPassword('FitTrackUltra2026!'),
    daysAgoIso(21)
  );

  db.prepare(
    `INSERT INTO profiles (
      user_id, name, age, height_cm, weight_kg, experience, goal, location,
      equipment_json, weekly_days, preferred_duration_min, dietary_pref, activity_level,
      limitations, units, language, notifications_enabled, ai_memory_enabled,
      privacy_photos_private, onboarding_completed, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    'Alex Mercer',
    28,
    179,
    76.8,
    'intermediate',
    'muscle_gain',
    'both',
    JSON.stringify(['Barbell', 'Dumbbells', 'Cable Machine', 'Pull-Up Bar', 'Squat Rack']),
    4,
    55,
    'non_veg',
    'moderate',
    'Prefer controlled eccentric tempo on squats; mild left wrist tightness on straight-bar curls.',
    'metric',
    'en',
    1,
    1,
    1,
    1,
    now.toISOString()
  );

  const dayOfWeekToday = now.getUTCDay();
  const plans: Array<{
    id: string;
    name: string;
    splitType: WorkoutPlan['splitType'];
    dayOfWeek: number;
    exercises: WorkoutPlan['exercises'];
    notes: string;
  }> = [
    {
      id: 'plan-upper-push',
      name: 'Upper Push & Chest Focus',
      splitType: 'PPL',
      dayOfWeek: (dayOfWeekToday + 0) % 7,
      notes: 'Focus on upper chest incline progression and controlled triceps lockout.',
      exercises: [
        { exerciseId: 'incline-dumbbell-press', exerciseName: 'Incline Dumbbell Press', targetSets: 4, targetReps: '8-10', targetWeightKg: 32, restSeconds: 90 },
        { exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', targetSets: 3, targetReps: '6-8', targetWeightKg: 82.5, restSeconds: 120 },
        { exerciseId: 'cable-lateral-raise', exerciseName: 'Single-Arm Cable Lateral Raise', targetSets: 4, targetReps: '12-15', targetWeightKg: 10, restSeconds: 60 },
        { exerciseId: 'overhead-cable-tricep-extension', exerciseName: 'Overhead Cable Rope Extension', targetSets: 3, targetReps: '10-12', targetWeightKg: 28, restSeconds: 75 },
      ],
    },
    {
      id: 'plan-pull-back',
      name: 'Pull & Posterior Width',
      splitType: 'PPL',
      dayOfWeek: (dayOfWeekToday + 1) % 7,
      notes: 'Lead with vertical lat pull, keep EZ-bar curls comfortable for wrist.',
      exercises: [
        { exerciseId: 'pull-up', exerciseName: 'Wide-Grip Pull-Up', targetSets: 4, targetReps: '8-10', targetWeightKg: 76.8, restSeconds: 120 },
        { exerciseId: 'chest-supported-t-bar-row', exerciseName: 'Chest-Supported T-Bar Row', targetSets: 4, targetReps: '8-12', targetWeightKg: 55, restSeconds: 90 },
        { exerciseId: 'face-pull', exerciseName: 'Rope Cable Face Pull', targetSets: 3, targetReps: '15-20', targetWeightKg: 22, restSeconds: 60 },
        { exerciseId: 'ez-bar-curl', exerciseName: 'EZ-Bar Bicep Curl', targetSets: 3, targetReps: '10-12', targetWeightKg: 30, restSeconds: 75 },
      ],
    },
    {
      id: 'plan-lower-power',
      name: 'Lower Quad & Hamstring Power',
      splitType: 'PPL',
      dayOfWeek: (dayOfWeekToday + 3) % 7,
      notes: 'Warm up ankles & hips with World’s Greatest Mobility Stretch.',
      exercises: [
        { exerciseId: 'barbell-back-squat', exerciseName: 'Barbell Back Squat', targetSets: 4, targetReps: '6-8', targetWeightKg: 105, restSeconds: 150 },
        { exerciseId: 'romanian-deadlift', exerciseName: 'Barbell Romanian Deadlift (RDL)', targetSets: 3, targetReps: '8-10', targetWeightKg: 95, restSeconds: 120 },
        { exerciseId: 'seated-leg-curl', exerciseName: 'Seated Hamstring Leg Curl', targetSets: 3, targetReps: '10-12', targetWeightKg: 52, restSeconds: 75 },
        { exerciseId: 'standing-calf-raise', exerciseName: 'Standing Machine Calf Raise', targetSets: 4, targetReps: '12-16', targetWeightKg: 70, restSeconds: 60 },
      ],
    },
  ];

  for (const p of plans) {
    db.prepare(
      `INSERT INTO workout_plans (id, user_id, name, split_type, day_of_week, exercises_json, notes, is_ai_generated, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(p.id, userId, p.name, p.splitType, p.dayOfWeek, JSON.stringify(p.exercises), p.notes, daysAgoIso(14), now.toISOString());
  }

  const seededSessions: Omit<WorkoutSession, 'userId'>[] = [
    {
      id: 'sess-001',
      planId: 'plan-upper-push',
      title: 'Upper Push & Chest Focus',
      startedAt: daysAgoIso(1, 8),
      completedAt: daysAgoIso(1, 9),
      durationSec: 3120,
      totalSets: 14,
      totalVolumeKg: 4860,
      estCalories: 365,
      notes: 'Strong upper chest pump; bumped incline DBs to 32kg.',
      xpEarned: 185,
      exercises: [
        {
          exerciseId: 'incline-dumbbell-press',
          exerciseName: 'Incline Dumbbell Press',
          primaryMuscles: ['upper_chest'],
          secondaryMuscles: ['front_delts', 'triceps_lateral'],
          sets: [
            { setNumber: 1, reps: 10, weightKg: 30, completed: true },
            { setNumber: 2, reps: 10, weightKg: 32, completed: true, isPr: true },
            { setNumber: 3, reps: 9, weightKg: 32, completed: true },
            { setNumber: 4, reps: 8, weightKg: 32, completed: true },
          ],
        },
        {
          exerciseId: 'barbell-bench-press',
          exerciseName: 'Barbell Bench Press',
          primaryMuscles: ['middle_chest'],
          secondaryMuscles: ['front_delts', 'triceps_lateral'],
          sets: [
            { setNumber: 1, reps: 8, weightKg: 80, completed: true },
            { setNumber: 2, reps: 7, weightKg: 82.5, completed: true, isPr: true },
            { setNumber: 3, reps: 7, weightKg: 82.5, completed: true },
          ],
        },
        {
          exerciseId: 'cable-lateral-raise',
          exerciseName: 'Single-Arm Cable Lateral Raise',
          primaryMuscles: ['side_delts'],
          secondaryMuscles: ['traps_upper'],
          sets: [
            { setNumber: 1, reps: 14, weightKg: 10, completed: true },
            { setNumber: 2, reps: 13, weightKg: 10, completed: true },
            { setNumber: 3, reps: 12, weightKg: 10, completed: true },
            { setNumber: 4, reps: 12, weightKg: 10, completed: true },
          ],
        },
        {
          exerciseId: 'overhead-cable-tricep-extension',
          exerciseName: 'Overhead Cable Rope Extension',
          primaryMuscles: ['triceps_long'],
          secondaryMuscles: ['triceps_lateral'],
          sets: [
            { setNumber: 1, reps: 12, weightKg: 28, completed: true },
            { setNumber: 2, reps: 11, weightKg: 28, completed: true },
            { setNumber: 3, reps: 10, weightKg: 28, completed: true },
          ],
        },
      ],
    },
    {
      id: 'sess-002',
      planId: 'plan-lower-power',
      title: 'Lower Quad & Hamstring Power',
      startedAt: daysAgoIso(3, 8),
      completedAt: daysAgoIso(3, 9),
      durationSec: 3480,
      totalSets: 13,
      totalVolumeKg: 6940,
      estCalories: 430,
      notes: 'Clean squat depth; hamstrings responded well to 3s RDL eccentric.',
      xpEarned: 210,
      exercises: [
        {
          exerciseId: 'barbell-back-squat',
          exerciseName: 'Barbell Back Squat',
          primaryMuscles: ['rectus_femoris', 'vastus_lateralis', 'vastus_medialis', 'gluteus_maximus'],
          secondaryMuscles: ['erector_spinae'],
          sets: [
            { setNumber: 1, reps: 8, weightKg: 100, completed: true },
            { setNumber: 2, reps: 7, weightKg: 105, completed: true, isPr: true },
            { setNumber: 3, reps: 6, weightKg: 105, completed: true },
            { setNumber: 4, reps: 6, weightKg: 105, completed: true },
          ],
        },
        {
          exerciseId: 'romanian-deadlift',
          exerciseName: 'Barbell Romanian Deadlift (RDL)',
          primaryMuscles: ['biceps_femoris', 'semitendinosus', 'gluteus_maximus'],
          secondaryMuscles: ['erector_spinae'],
          sets: [
            { setNumber: 1, reps: 10, weightKg: 90, completed: true },
            { setNumber: 2, reps: 9, weightKg: 95, completed: true },
            { setNumber: 3, reps: 9, weightKg: 95, completed: true },
          ],
        },
        {
          exerciseId: 'standing-calf-raise',
          exerciseName: 'Standing Machine Calf Raise',
          primaryMuscles: ['gastrocnemius'],
          secondaryMuscles: ['soleus'],
          sets: [
            { setNumber: 1, reps: 15, weightKg: 70, completed: true },
            { setNumber: 2, reps: 15, weightKg: 70, completed: true },
            { setNumber: 3, reps: 14, weightKg: 70, completed: true },
            { setNumber: 4, reps: 14, weightKg: 70, completed: true },
          ],
        },
      ],
    },
    {
      id: 'sess-003',
      planId: 'plan-pull-back',
      title: 'Pull & Posterior Width',
      startedAt: daysAgoIso(5, 8),
      completedAt: daysAgoIso(5, 9),
      durationSec: 2940,
      totalSets: 14,
      totalVolumeKg: 4320,
      estCalories: 340,
      notes: 'Strict dead-hang pull-ups felt crisp.',
      xpEarned: 155,
      exercises: [
        {
          exerciseId: 'pull-up',
          exerciseName: 'Wide-Grip Pull-Up',
          primaryMuscles: ['lats', 'teres_major'],
          secondaryMuscles: ['rhomboids', 'biceps_long'],
          sets: [
            { setNumber: 1, reps: 10, weightKg: 77, completed: true },
            { setNumber: 2, reps: 9, weightKg: 77, completed: true },
            { setNumber: 3, reps: 8, weightKg: 77, completed: true },
            { setNumber: 4, reps: 8, weightKg: 77, completed: true },
          ],
        },
        {
          exerciseId: 'chest-supported-t-bar-row',
          exerciseName: 'Chest-Supported T-Bar Row',
          primaryMuscles: ['rhomboids', 'traps_middle', 'lats'],
          secondaryMuscles: ['rear_delts'],
          sets: [
            { setNumber: 1, reps: 12, weightKg: 52.5, completed: true },
            { setNumber: 2, reps: 10, weightKg: 55, completed: true },
            { setNumber: 3, reps: 10, weightKg: 55, completed: true },
          ],
        },
        {
          exerciseId: 'ez-bar-curl',
          exerciseName: 'EZ-Bar Bicep Curl',
          primaryMuscles: ['biceps_short', 'biceps_long'],
          secondaryMuscles: ['forearms_flexors'],
          sets: [
            { setNumber: 1, reps: 12, weightKg: 30, completed: true },
            { setNumber: 2, reps: 11, weightKg: 30, completed: true },
            { setNumber: 3, reps: 10, weightKg: 30, completed: true },
          ],
        },
      ],
    },
    {
      id: 'sess-004',
      planId: 'plan-upper-push',
      title: 'Upper Push & Core',
      startedAt: daysAgoIso(8, 8),
      completedAt: daysAgoIso(8, 9),
      durationSec: 2800,
      totalSets: 12,
      totalVolumeKg: 4100,
      estCalories: 325,
      notes: 'Baseline push session.',
      xpEarned: 140,
      exercises: [
        {
          exerciseId: 'barbell-bench-press',
          exerciseName: 'Barbell Bench Press',
          primaryMuscles: ['middle_chest'],
          secondaryMuscles: ['front_delts', 'triceps_lateral'],
          sets: [
            { setNumber: 1, reps: 8, weightKg: 77.5, completed: true },
            { setNumber: 2, reps: 8, weightKg: 77.5, completed: true },
            { setNumber: 3, reps: 7, weightKg: 80, completed: true },
          ],
        },
        {
          exerciseId: 'hanging-leg-raise',
          exerciseName: 'Hanging Leg Raise',
          primaryMuscles: ['lower_abs'],
          secondaryMuscles: ['middle_abs'],
          sets: [
            { setNumber: 1, reps: 14, weightKg: 77, completed: true },
            { setNumber: 2, reps: 12, weightKg: 77, completed: true },
            { setNumber: 3, reps: 12, weightKg: 77, completed: true },
          ],
        },
      ],
    },
  ];

  for (const s of seededSessions) {
    db.prepare(
      `INSERT INTO workout_sessions (id, user_id, plan_id, title, started_at, completed_at, duration_sec, total_sets, total_volume_kg, est_calories, exercises_json, notes, xp_earned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      s.id,
      userId,
      s.planId ?? null,
      s.title,
      s.startedAt,
      s.completedAt,
      s.durationSec,
      s.totalSets,
      s.totalVolumeKg,
      s.estCalories,
      JSON.stringify(s.exercises),
      s.notes,
      s.xpEarned
    );
  }

  const nutritionSeeds = [
    { id: 'nut-1', logDate: todayStr, mealType: 'breakfast', foodName: 'Rolled Oats + Whey Isolate + Banana', qty: 1, unit: 'bowl', cal: 407, p: 34, c: 61, f: 4.3 },
    { id: 'nut-2', logDate: todayStr, mealType: 'lunch', foodName: 'Grilled Chicken Breast & Basmati Rice', qty: 1.5, unit: 'plate', cal: 540, p: 52, c: 63, f: 6 },
    { id: 'nut-3', logDate: todayStr, mealType: 'snack', foodName: 'Greek Yogurt & Raw Almonds', qty: 1, unit: 'cup', cal: 264, p: 23, c: 12, f: 14.6 },
    { id: 'nut-4', logDate: daysAgoDate(1), mealType: 'breakfast', foodName: '3 Boiled Eggs & Whole Wheat Toast', qty: 1, unit: 'meal', cal: 384, p: 25.7, c: 27.8, f: 18.1 },
    { id: 'nut-5', logDate: daysAgoDate(1), mealType: 'dinner', foodName: 'Baked Salmon & Sweet Potato', qty: 1.5, unit: 'plate', cal: 511, p: 37.5, c: 46.5, f: 18.9 },
  ];

  for (const n of nutritionSeeds) {
    db.prepare(
      `INSERT INTO nutrition_logs (id, user_id, log_date, meal_type, food_name, serving_qty, serving_unit, calories, protein_g, carbs_g, fat_g, is_favorite, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(n.id, userId, n.logDate, n.mealType, n.foodName, n.qty, n.unit, n.cal, n.p, n.c, n.f, now.toISOString());
  }

  db.prepare('INSERT INTO water_logs (user_id, log_date, amount_ml, updated_at) VALUES (?, ?, ?, ?)').run(
    userId,
    todayStr,
    1750,
    now.toISOString()
  );

  db.prepare(
    `INSERT INTO recovery_logs (id, user_id, log_date, sleep_hours, sleep_quality, soreness_level, fatigue_level, sore_muscles_json, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'rec-001',
    userId,
    todayStr,
    7.6,
    4,
    2,
    2,
    JSON.stringify(['upper_chest', 'middle_chest']),
    'Mild chest DOMS from yesterday incline pressing; ready for back/pull.',
    now.toISOString()
  );

  const measurements = [
    { id: 'meas-1', date: daysAgoDate(21), wt: 78.2, waist: 83.5, chest: 102.0, arms: 36.2, thighs: 57.5, hips: 96.0, note: 'Baseline calibration check-in' },
    { id: 'meas-2', date: daysAgoDate(14), wt: 77.6, waist: 82.8, chest: 102.4, arms: 36.4, thighs: 57.8, hips: 95.8, note: 'Week 2 check-in' },
    { id: 'meas-3', date: daysAgoDate(7), wt: 77.1, waist: 82.1, chest: 102.9, arms: 36.6, thighs: 58.0, hips: 95.5, note: 'Steady recomposition progress' },
    { id: 'meas-4', date: todayStr, wt: 76.8, waist: 81.6, chest: 103.2, arms: 36.8, thighs: 58.3, hips: 95.2, note: 'Morning fasted check-in' },
  ];

  for (const m of measurements) {
    db.prepare(
      `INSERT INTO measurements (id, user_id, log_date, weight_kg, waist_cm, chest_cm, arms_cm, thighs_cm, hips_cm, photo_data_url, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
    ).run(m.id, userId, m.date, m.wt, m.waist, m.chest, m.arms, m.thighs, m.hips, m.note, now.toISOString());
  }

  db.prepare('INSERT INTO ai_memory (id, user_id, memory_key, memory_value, source, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    'mem-1',
    userId,
    'Wrist Preference',
    'Prefers EZ-Bar or neutral grip dumbbells over straight barbell curls due to mild left wrist tightness.',
    'user',
    now.toISOString()
  );
  db.prepare('INSERT INTO ai_memory (id, user_id, memory_key, memory_value, source, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    'mem-2',
    userId,
    'Upper Chest Priority',
    'Prioritizing clavicular (upper) chest development with 30-degree incline presses.',
    'user',
    now.toISOString()
  );

  db.prepare('INSERT INTO exercise_favorites (user_id, exercise_id, created_at) VALUES (?, ?, ?)').run(userId, 'incline-dumbbell-press', now.toISOString());
  db.prepare('INSERT INTO exercise_favorites (user_id, exercise_id, created_at) VALUES (?, ?, ?)').run(userId, 'barbell-back-squat', now.toISOString());
  db.prepare('INSERT INTO exercise_favorites (user_id, exercise_id, created_at) VALUES (?, ?, ?)').run(userId, 'pull-up', now.toISOString());

  return {
    id: userId,
    email: demoEmail,
    name: 'Alex Mercer',
    createdAt: daysAgoIso(21),
  };
}
