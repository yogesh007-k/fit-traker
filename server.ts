import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  createDefaultProfile,
  createSessionToken,
  db,
  deleteSessionToken,
  ensureDemoAthleteSeeded,
  getProfile,
  getUserBootstrap,
  getUserBySessionToken,
  hashPassword,
  verifyPassword,
} from './src/server/db';
import {
  GeminiUnavailableError,
  chatWithFitnessCoach,
  createLiveCoachSession,
  generateAiMealSuggestions,
  generateAiWeeklyReport,
  generateAiWorkoutPlan,
  streamChatWithFitnessCoach,
  upsertAutoMemories,
} from './src/server/gemini';
import { AiChatMessage, CoachLanguage, UserAccount } from './src/types/fitness';
import { calculateSessionXp, extractPersonalRecords } from './src/utils/fitnessMath';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SESSION_COOKIE_NAME = 'fittrack_session';

app.set('trust proxy', 1);
app.use(express.json({ limit: '4mb' }));

// Seed deterministic demo athlete once at startup
ensureDemoAthleteSeeded();

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

function getTokenFromReq(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME];
}

function setSessionCookie(res: Response, token: string): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=604800`
  );
}

function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`
  );
}

// Same-origin CSRF guard on cookie-authenticated mutations
function verifySameOrigin(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    next();
    return;
  }
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        res.status(403).json({ error: 'Cross-origin mutation blocked.' });
        return;
      }
    } catch {
      res.status(403).json({ error: 'Invalid Origin header.' });
      return;
    }
  }
  next();
}

app.use('/api', verifySameOrigin);

interface AuthedRequest extends Request {
  user?: UserAccount;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = getTokenFromReq(req);
  const user = getUserBySessionToken(token);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  req.user = user;
  next();
}

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string };
  if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') {
    res.status(400).json({ error: 'Name, email, and password are required.' });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  if (!cleanEmail.includes('@') || cleanEmail.length > 160) {
    res.status(400).json({ error: 'Enter a valid email address.' });
    return;
  }
  if (password.length < 8 || password.length > 128) {
    res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    return;
  }
  if (cleanName.length < 2 || cleanName.length > 80) {
    res.status(400).json({ error: 'Name must be at least 2 characters.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const userId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userId,
    cleanEmail,
    cleanName,
    hashPassword(password),
    createdAt
  );

  createDefaultProfile(userId, cleanName, false);
  const token = createSessionToken(userId);
  setSessionCookie(res, token);

  res.status(201).json({
    user: { id: userId, email: cleanEmail, name: cleanName, createdAt },
    token,
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();
  const row = db
    .prepare('SELECT id, email, name, password_hash, created_at FROM users WHERE email = ?')
    .get(cleanEmail) as { id: string; email: string; name: string; password_hash: string; created_at: string } | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = createSessionToken(row.id);
  setSessionCookie(res, token);

  res.json({
    user: { id: row.id, email: row.email, name: row.name, createdAt: row.created_at },
    token,
  });
});

app.post('/api/auth/demo', (_req, res) => {
  const demoUser = ensureDemoAthleteSeeded();
  const token = createSessionToken(demoUser.id);
  setSessionCookie(res, token);
  res.json({ user: demoUser, token });
});

app.post('/api/auth/reset-password', (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };
  const token = getTokenFromReq(req);
  const authed = getUserBySessionToken(token);
  if (!authed) {
    res.status(400).json({
      error:
        'Password recovery links require an external email provider (SMTP/Firebase Auth). While signed in, you can change your password directly in Settings.',
    });
    return;
  }
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
    res.status(400).json({ error: 'Current password and new password (min 8 chars) are required.' });
    return;
  }
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(authed.id) as { password_hash: string } | undefined;
  if (!row || !verifyPassword(currentPassword, row.password_hash)) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), authed.id);
  res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  deleteSessionToken(getTokenFromReq(req));
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = getUserBySessionToken(getTokenFromReq(req));
  res.json({ user: user || null });
});

// ==================== BOOTSTRAP & PROFILE ====================
app.get('/api/bootstrap', requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  if (!getProfile(user.id)) {
    createDefaultProfile(user.id, user.name, false);
  }
  res.json({
    user,
    ...getUserBootstrap(user.id),
  });
});

app.put('/api/profile', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const b = req.body as Record<string, unknown>;
  const name = typeof b.name === 'string' && b.name.trim().length >= 2 ? b.name.trim().slice(0, 80) : req.user!.name;
  const age = b.age !== null && b.age !== undefined && Number(b.age) >= 13 && Number(b.age) <= 110 ? Math.round(Number(b.age)) : null;
  const heightCm = b.heightCm !== null && b.heightCm !== undefined && Number(b.heightCm) >= 100 && Number(b.heightCm) <= 250 ? Number(b.heightCm) : null;
  const weightKg = b.weightKg !== null && b.weightKg !== undefined && Number(b.weightKg) >= 30 && Number(b.weightKg) <= 300 ? Number(b.weightKg) : null;
  const experience = ['beginner', 'intermediate', 'advanced'].includes(String(b.experience)) ? String(b.experience) : 'beginner';
  const goal = ['muscle_gain', 'fat_loss', 'strength', 'recomposition', 'endurance', 'general_health'].includes(String(b.goal))
    ? String(b.goal)
    : 'muscle_gain';
  const location = ['gym', 'home', 'both'].includes(String(b.location)) ? String(b.location) : 'both';
  const equipment = Array.isArray(b.equipment) ? b.equipment.map((item) => String(item).slice(0, 40)).slice(0, 20) : [];
  const weeklyDays = Math.max(1, Math.min(7, Number(b.weeklyDays) || 4));
  const preferredDurationMin = Math.max(15, Math.min(180, Number(b.preferredDurationMin) || 45));
  const dietaryPref = ['non_veg', 'vegetarian', 'vegan', 'eggetarian', 'pescatarian'].includes(String(b.dietaryPref))
    ? String(b.dietaryPref)
    : 'non_veg';
  const activityLevel = ['sedentary', 'light', 'moderate', 'active', 'athlete'].includes(String(b.activityLevel))
    ? String(b.activityLevel)
    : 'moderate';
  const limitations = typeof b.limitations === 'string' ? b.limitations.slice(0, 400) : '';
  const units = b.units === 'imperial' ? 'imperial' : 'metric';
  const language = b.language === 'ta' ? 'ta' : 'en';
  const notificationsEnabled = b.notificationsEnabled === false ? 0 : 1;
  const aiMemoryEnabled = b.aiMemoryEnabled === false ? 0 : 1;
  const privacyPhotosPrivate = b.privacyPhotosPrivate === false ? 0 : 1;
  const onboardingCompleted = b.onboardingCompleted ? 1 : 0;
  const now = new Date().toISOString();

  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, userId);
  db.prepare(
    `UPDATE profiles SET
      name = ?, age = ?, height_cm = ?, weight_kg = ?, experience = ?, goal = ?, location = ?,
      equipment_json = ?, weekly_days = ?, preferred_duration_min = ?, dietary_pref = ?,
      activity_level = ?, limitations = ?, units = ?, language = ?, notifications_enabled = ?,
      ai_memory_enabled = ?, privacy_photos_private = ?, onboarding_completed = ?, updated_at = ?
     WHERE user_id = ?`
  ).run(
    name,
    age,
    heightCm,
    weightKg,
    experience,
    goal,
    location,
    JSON.stringify(equipment),
    weeklyDays,
    preferredDurationMin,
    dietaryPref,
    activityLevel,
    limitations,
    units,
    language,
    notificationsEnabled,
    aiMemoryEnabled,
    privacyPhotosPrivate,
    onboardingCompleted,
    now,
    userId
  );

  res.json({ profile: getProfile(userId) });
});

// ==================== WORKOUT PLANS ====================
app.post('/api/plans', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const b = req.body as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 100) : '';
  if (!name) {
    res.status(400).json({ error: 'Workout plan name is required.' });
    return;
  }
  const splitType = ['PPL', 'Upper/Lower', 'Full Body', 'Bro Split', 'Custom'].includes(String(b.splitType))
    ? String(b.splitType)
    : 'Custom';
  const dayOfWeek = Math.max(0, Math.min(6, Number(b.dayOfWeek) || 0));
  const exercises = Array.isArray(b.exercises) ? b.exercises.slice(0, 20) : [];
  if (exercises.length === 0) {
    res.status(400).json({ error: 'Add at least one exercise to save a workout plan.' });
    return;
  }
  const notes = typeof b.notes === 'string' ? b.notes.slice(0, 400) : '';
  const isAiGenerated = b.isAiGenerated ? 1 : 0;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO workout_plans (id, user_id, name, split_type, day_of_week, exercises_json, notes, is_ai_generated, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, name, splitType, dayOfWeek, JSON.stringify(exercises), notes, isAiGenerated, now, now);

  res.status(201).json({
    plan: {
      id,
      userId,
      name,
      splitType,
      dayOfWeek,
      exercises,
      notes,
      isAiGenerated: Boolean(isAiGenerated),
      createdAt: now,
      updatedAt: now,
    },
  });
});

app.put('/api/plans/:id', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const b = req.body as Record<string, unknown>;
  const existing = db.prepare('SELECT id FROM workout_plans WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) {
    res.status(404).json({ error: 'Workout plan not found.' });
    return;
  }
  const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 100) : 'Custom Workout';
  const splitType = ['PPL', 'Upper/Lower', 'Full Body', 'Bro Split', 'Custom'].includes(String(b.splitType))
    ? String(b.splitType)
    : 'Custom';
  const dayOfWeek = Math.max(0, Math.min(6, Number(b.dayOfWeek) ?? 0));
  const exercises = Array.isArray(b.exercises) ? b.exercises.slice(0, 20) : [];
  const notes = typeof b.notes === 'string' ? b.notes.slice(0, 400) : '';
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE workout_plans SET name = ?, split_type = ?, day_of_week = ?, exercises_json = ?, notes = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(name, splitType, dayOfWeek, JSON.stringify(exercises), notes, now, id, userId);

  res.json({ ok: true, updatedAt: now });
});

app.delete('/api/plans/:id', requireAuth, (req: AuthedRequest, res) => {
  const info = db.prepare('DELETE FROM workout_plans WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Workout plan not found.' });
    return;
  }
  res.json({ ok: true });
});

// ==================== WORKOUT SESSIONS ====================
app.post('/api/sessions', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const b = req.body as {
    planId?: string | null;
    title?: string;
    startedAt?: string;
    durationSec?: number;
    exercises?: Array<{
      exerciseId: string;
      exerciseName: string;
      primaryMuscles: string[];
      secondaryMuscles: string[];
      sets: Array<{ setNumber: number; reps: number; weightKg: number; completed: boolean }>;
      notes?: string;
    }>;
    notes?: string;
  };

  const title = typeof b.title === 'string' && b.title.trim() ? b.title.trim().slice(0, 120) : 'Tracked Workout';
  const exercises = Array.isArray(b.exercises) ? b.exercises : [];
  if (exercises.length === 0) {
    res.status(400).json({ error: 'At least one exercise is required to save a workout session.' });
    return;
  }

  const priorBootstrap = getUserBootstrap(userId);
  const priorPrs = new Map(extractPersonalRecords(priorBootstrap.sessions).map((p) => [p.exerciseId, p]));

  let totalSets = 0;
  let totalVolumeKg = 0;
  let prCount = 0;

  const processedExercises = exercises.map((ex) => {
    const prevPr = priorPrs.get(ex.exerciseId);
    let maxSeen = prevPr?.maxWeightKg ?? 0;
    const processedSets = (ex.sets || []).map((st, idx) => {
      const reps = Math.max(0, Math.round(Number(st.reps) || 0));
      const weightKg = Math.max(0, Number(st.weightKg) || 0);
      const completed = Boolean(st.completed);
      let isPr = false;
      if (completed && reps > 0) {
        totalSets += 1;
        totalVolumeKg += reps * weightKg;
        if (weightKg > maxSeen && weightKg > 0) {
          isPr = true;
          maxSeen = weightKg;
          prCount += 1;
        }
      }
      return { setNumber: st.setNumber || idx + 1, reps, weightKg, completed, isPr };
    });
    return {
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      primaryMuscles: ex.primaryMuscles || [],
      secondaryMuscles: ex.secondaryMuscles || [],
      sets: processedSets,
      notes: ex.notes || '',
    };
  });

  if (totalSets === 0) {
    res.status(400).json({ error: 'Complete at least one working set before finishing the workout.' });
    return;
  }

  const durationSec = Math.max(60, Math.round(Number(b.durationSec) || 1800));
  const userWeight = priorBootstrap.profile?.weightKg || 74;
  // Transparent MET-based calorie estimate (~5.5 MET strength training)
  const estCalories = Math.round(((5.5 * 3.5 * userWeight) / 200) * (durationSec / 60));
  const xpEarned = calculateSessionXp(totalSets, totalVolumeKg, prCount);
  const id = crypto.randomUUID();
  const completedAt = new Date().toISOString();
  const startedAt = typeof b.startedAt === 'string' ? b.startedAt : new Date(Date.now() - durationSec * 1000).toISOString();
  const notes = typeof b.notes === 'string' ? b.notes.slice(0, 500) : '';

  db.prepare(
    `INSERT INTO workout_sessions (id, user_id, plan_id, title, started_at, completed_at, duration_sec, total_sets, total_volume_kg, est_calories, exercises_json, notes, xp_earned)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    b.planId || null,
    title,
    startedAt,
    completedAt,
    durationSec,
    totalSets,
    Math.round(totalVolumeKg),
    estCalories,
    JSON.stringify(processedExercises),
    notes,
    xpEarned
  );

  res.status(201).json({
    session: {
      id,
      userId,
      planId: b.planId || null,
      title,
      startedAt,
      completedAt,
      durationSec,
      totalSets,
      totalVolumeKg: Math.round(totalVolumeKg),
      estCalories,
      exercises: processedExercises,
      notes,
      xpEarned,
    },
  });
});

app.delete('/api/sessions/:id', requireAuth, (req: AuthedRequest, res) => {
  const info = db.prepare('DELETE FROM workout_sessions WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }
  res.json({ ok: true });
});

// ==================== NUTRITION & WATER ====================
app.post('/api/nutrition', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const b = req.body as Record<string, unknown>;
  const foodName = typeof b.foodName === 'string' ? b.foodName.trim().slice(0, 120) : '';
  if (!foodName) {
    res.status(400).json({ error: 'Food name is required.' });
    return;
  }
  const logDate = typeof b.logDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.logDate)
    ? b.logDate
    : new Date().toISOString().slice(0, 10);
  const mealType = ['breakfast', 'lunch', 'dinner', 'snack'].includes(String(b.mealType))
    ? String(b.mealType)
    : 'snack';
  const servingQty = Math.max(0.1, Number(b.servingQty) || 1);
  const servingUnit = typeof b.servingUnit === 'string' ? b.servingUnit.slice(0, 40) : 'serving';
  const calories = Math.max(0, Number(b.calories) || 0);
  const proteinG = Math.max(0, Number(b.proteinG) || 0);
  const carbsG = Math.max(0, Number(b.carbsG) || 0);
  const fatG = Math.max(0, Number(b.fatG) || 0);
  const isFavorite = b.isFavorite ? 1 : 0;
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO nutrition_logs (id, user_id, log_date, meal_type, food_name, serving_qty, serving_unit, calories, protein_g, carbs_g, fat_g, is_favorite, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, logDate, mealType, foodName, servingQty, servingUnit, calories, proteinG, carbsG, fatG, isFavorite, createdAt);

  res.status(201).json({
    entry: {
      id,
      userId,
      logDate,
      mealType,
      foodName,
      servingQty,
      servingUnit,
      calories,
      proteinG,
      carbsG,
      fatG,
      isFavorite: Boolean(isFavorite),
      createdAt,
    },
  });
});

app.patch('/api/nutrition/:id', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const b = req.body as Record<string, unknown>;
  const existing = db.prepare('SELECT * FROM nutrition_logs WHERE id = ? AND user_id = ?').get(req.params.id, userId) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Food log entry not found.' });
    return;
  }
  const newQty = b.servingQty !== undefined ? Math.max(0.1, Number(b.servingQty) || 1) : Number(existing.serving_qty);
  const oldQty = Math.max(0.1, Number(existing.serving_qty) || 1);
  const ratio = newQty / oldQty;
  const isFav = b.isFavorite !== undefined ? (b.isFavorite ? 1 : 0) : Number(existing.is_favorite);

  const calories = b.servingQty !== undefined ? Math.round(Number(existing.calories) * ratio) : Number(existing.calories);
  const proteinG = b.servingQty !== undefined ? Math.round(Number(existing.protein_g) * ratio * 10) / 10 : Number(existing.protein_g);
  const carbsG = b.servingQty !== undefined ? Math.round(Number(existing.carbs_g) * ratio * 10) / 10 : Number(existing.carbs_g);
  const fatG = b.servingQty !== undefined ? Math.round(Number(existing.fat_g) * ratio * 10) / 10 : Number(existing.fat_g);

  db.prepare(
    'UPDATE nutrition_logs SET serving_qty = ?, calories = ?, protein_g = ?, carbs_g = ?, fat_g = ?, is_favorite = ? WHERE id = ? AND user_id = ?'
  ).run(newQty, calories, proteinG, carbsG, fatG, isFav, req.params.id, userId);

  res.json({ ok: true, servingQty: newQty, calories, proteinG, carbsG, fatG, isFavorite: Boolean(isFav) });
});

app.delete('/api/nutrition/:id', requireAuth, (req: AuthedRequest, res) => {
  const info = db.prepare('DELETE FROM nutrition_logs WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Food log entry not found.' });
    return;
  }
  res.json({ ok: true });
});

app.put('/api/water', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const b = req.body as { logDate?: string; amountMl?: number };
  const logDate = typeof b.logDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.logDate)
    ? b.logDate
    : new Date().toISOString().slice(0, 10);
  const amountMl = Math.max(0, Math.min(10000, Math.round(Number(b.amountMl) || 0)));
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO water_logs (user_id, log_date, amount_ml, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, log_date) DO UPDATE SET amount_ml = excluded.amount_ml, updated_at = excluded.updated_at`
  ).run(userId, logDate, amountMl, now);

  res.json({ waterLog: { userId, logDate, amountMl, updatedAt: now } });
});

// ==================== RECOVERY & MEASUREMENTS ====================
app.post('/api/recovery', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const b = req.body as Record<string, unknown>;
  const logDate = typeof b.logDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.logDate)
    ? b.logDate
    : new Date().toISOString().slice(0, 10);
  const sleepHours = Math.max(0, Math.min(20, Number(b.sleepHours) || 7));
  const sleepQuality = Math.max(1, Math.min(5, Math.round(Number(b.sleepQuality) || 3)));
  const sorenessLevel = Math.max(1, Math.min(5, Math.round(Number(b.sorenessLevel) || 2)));
  const fatigueLevel = Math.max(1, Math.min(5, Math.round(Number(b.fatigueLevel) || 2)));
  const soreMuscles = Array.isArray(b.soreMuscles) ? b.soreMuscles.map((m) => String(m).slice(0, 50)).slice(0, 20) : [];
  const notes = typeof b.notes === 'string' ? b.notes.slice(0, 400) : '';
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO recovery_logs (id, user_id, log_date, sleep_hours, sleep_quality, soreness_level, fatigue_level, sore_muscles_json, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, logDate, sleepHours, sleepQuality, sorenessLevel, fatigueLevel, JSON.stringify(soreMuscles), notes, createdAt);

  res.status(201).json({
    recoveryLog: {
      id,
      userId,
      logDate,
      sleepHours,
      sleepQuality,
      sorenessLevel,
      fatigueLevel,
      soreMuscles,
      notes,
      createdAt,
    },
  });
});

app.post('/api/measurements', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const b = req.body as Record<string, unknown>;
  const weightKg = Number(b.weightKg);
  if (!weightKg || weightKg < 25 || weightKg > 350) {
    res.status(400).json({ error: 'Valid body weight (25–350 kg) is required.' });
    return;
  }
  const logDate = typeof b.logDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.logDate)
    ? b.logDate
    : new Date().toISOString().slice(0, 10);
  const optNum = (val: unknown) => (val !== null && val !== undefined && val !== '' && !Number.isNaN(Number(val)) ? Number(val) : null);
  const waistCm = optNum(b.waistCm);
  const chestCm = optNum(b.chestCm);
  const armsCm = optNum(b.armsCm);
  const thighsCm = optNum(b.thighsCm);
  const hipsCm = optNum(b.hipsCm);
  const photoDataUrl =
    typeof b.photoDataUrl === 'string' && b.photoDataUrl.startsWith('data:image/') && b.photoDataUrl.length <= 2_500_000
      ? b.photoDataUrl
      : null;
  const note = typeof b.note === 'string' ? b.note.slice(0, 300) : '';
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO measurements (id, user_id, log_date, weight_kg, waist_cm, chest_cm, arms_cm, thighs_cm, hips_cm, photo_data_url, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, logDate, weightKg, waistCm, chestCm, armsCm, thighsCm, hipsCm, photoDataUrl, note, createdAt);

  // Sync latest profile weight
  db.prepare('UPDATE profiles SET weight_kg = ?, updated_at = ? WHERE user_id = ?').run(weightKg, createdAt, userId);

  res.status(201).json({
    measurement: {
      id,
      userId,
      logDate,
      weightKg,
      waistCm,
      chestCm,
      armsCm,
      thighsCm,
      hipsCm,
      photoDataUrl,
      note,
      createdAt,
    },
  });
});

app.delete('/api/measurements/:id', requireAuth, (req: AuthedRequest, res) => {
  const info = db.prepare('DELETE FROM measurements WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Measurement entry not found.' });
    return;
  }
  res.json({ ok: true });
});

// ==================== FAVORITES ====================
app.post('/api/favorites/toggle', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { exerciseId } = req.body as { exerciseId?: string };
  if (typeof exerciseId !== 'string' || !exerciseId) {
    res.status(400).json({ error: 'exerciseId is required.' });
    return;
  }
  const existing = db
    .prepare('SELECT exercise_id FROM exercise_favorites WHERE user_id = ? AND exercise_id = ?')
    .get(userId, exerciseId);
  if (existing) {
    db.prepare('DELETE FROM exercise_favorites WHERE user_id = ? AND exercise_id = ?').run(userId, exerciseId);
    res.json({ favorited: false });
  } else {
    db.prepare('INSERT INTO exercise_favorites (user_id, exercise_id, created_at) VALUES (?, ?, ?)').run(
      userId,
      exerciseId,
      new Date().toISOString()
    );
    res.json({ favorited: true });
  }
});

// ==================== AI FITNESS MANAGER ROUTES ====================
function parseCoachLanguage(raw: unknown): CoachLanguage {
  if (raw === 'ta') return 'ta';
  if (raw === 'tanglish') return 'tanglish';
  return 'en';
}

function persistAiConversationTurn(params: {
  userId: string;
  convId: string;
  existingRow: { id: string; title: string; messages_json: string; created_at: string } | undefined;
  history: AiChatMessage[];
  cleanMsg: string;
  replyText: string;
  replaceLastAssistant?: boolean;
}) {
  const now = new Date().toISOString();
  const baseHistory =
    params.replaceLastAssistant &&
    params.history.length > 0 &&
    params.history[params.history.length - 1].role === 'assistant'
      ? params.history.slice(0, -1)
      : params.history;

  const alreadyHasUserPrompt =
    params.replaceLastAssistant &&
    baseHistory.length > 0 &&
    baseHistory[baseHistory.length - 1].role === 'user' &&
    baseHistory[baseHistory.length - 1].content.trim() === params.cleanMsg;

  const assistantEntry: AiChatMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: params.replyText,
    timestamp: now,
  };

  const updatedMessages: AiChatMessage[] = alreadyHasUserPrompt
    ? [...baseHistory, assistantEntry]
    : [
        ...baseHistory,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: params.cleanMsg,
          timestamp: now,
        },
        assistantEntry,
      ];

  const title = params.existingRow?.title || params.cleanMsg.slice(0, 48);

  if (params.existingRow) {
    db.prepare('UPDATE ai_conversations SET messages_json = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(
      JSON.stringify(updatedMessages),
      assistantEntry.timestamp,
      params.convId,
      params.userId
    );
  } else {
    db.prepare(
      'INSERT INTO ai_conversations (id, user_id, title, messages_json, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(params.convId, params.userId, title, JSON.stringify(updatedMessages), assistantEntry.timestamp, now);
  }

  return {
    id: params.convId,
    userId: params.userId,
    title,
    messages: updatedMessages,
    updatedAt: assistantEntry.timestamp,
    createdAt: params.existingRow?.created_at || now,
  };
}

app.post('/api/ai/chat', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { conversationId, message, language, replaceLastAssistant } = req.body as {
    conversationId?: string;
    message?: string;
    language?: CoachLanguage;
    replaceLastAssistant?: boolean;
  };
  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'Message cannot be empty.' });
    return;
  }
  const cleanMsg = message.trim().slice(0, 2000);
  const convId = conversationId || crypto.randomUUID();
  const coachLang = parseCoachLanguage(language);

  const existingRow = db
    .prepare('SELECT * FROM ai_conversations WHERE id = ? AND user_id = ?')
    .get(convId, userId) as { id: string; title: string; messages_json: string; created_at: string } | undefined;

  const fullHistory: AiChatMessage[] = existingRow ? JSON.parse(existingRow.messages_json) : [];
  let promptHistory = fullHistory;
  if (replaceLastAssistant && promptHistory.length > 0 && promptHistory[promptHistory.length - 1].role === 'assistant') {
    promptHistory = promptHistory.slice(0, -1);
  }
  if (
    replaceLastAssistant &&
    promptHistory.length > 0 &&
    promptHistory[promptHistory.length - 1].role === 'user' &&
    promptHistory[promptHistory.length - 1].content.trim() === cleanMsg
  ) {
    promptHistory = promptHistory.slice(0, -1);
  }

  try {
    const { replyText, memories } = await chatWithFitnessCoach({
      userId,
      history: promptHistory,
      message: cleanMsg,
      language: coachLang,
    });

    const memoriesSaved = upsertAutoMemories(userId, memories);
    const conversation = persistAiConversationTurn({
      userId,
      convId,
      existingRow,
      history: fullHistory,
      cleanMsg,
      replyText,
      replaceLastAssistant,
    });

    res.json({ conversation, memoriesSaved });
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code, retryable: err.retryable });
      return;
    }
    res.status(500).json({ error: 'Unexpected AI service error.', retryable: true });
  }
});

app.post('/api/ai/chat/stream', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { conversationId, message, language, replaceLastAssistant } = req.body as {
    conversationId?: string;
    message?: string;
    language?: CoachLanguage;
    replaceLastAssistant?: boolean;
  };
  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'Message cannot be empty.' });
    return;
  }

  const cleanMsg = message.trim().slice(0, 2000);
  const convId = conversationId || crypto.randomUUID();
  const coachLang = parseCoachLanguage(language);

  const existingRow = db
    .prepare('SELECT * FROM ai_conversations WHERE id = ? AND user_id = ?')
    .get(convId, userId) as { id: string; title: string; messages_json: string; created_at: string } | undefined;

  const fullHistory: AiChatMessage[] = existingRow ? JSON.parse(existingRow.messages_json) : [];
  let promptHistory = fullHistory;
  if (replaceLastAssistant && promptHistory.length > 0 && promptHistory[promptHistory.length - 1].role === 'assistant') {
    promptHistory = promptHistory.slice(0, -1);
  }
  if (
    replaceLastAssistant &&
    promptHistory.length > 0 &&
    promptHistory[promptHistory.length - 1].role === 'user' &&
    promptHistory[promptHistory.length - 1].content.trim() === cleanMsg
  ) {
    promptHistory = promptHistory.slice(0, -1);
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendSse = (payload: Record<string, unknown>) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) {
      abortController.abort(new Error('Client disconnected'));
    }
  });

  sendSse({ type: 'start', conversationId: convId });

  try {
    const { replyText, memories } = await streamChatWithFitnessCoach({
      userId,
      history: promptHistory,
      message: cleanMsg,
      language: coachLang,
      abortSignal: abortController.signal,
      onChunk: (deltaText) => {
        sendSse({ type: 'chunk', text: deltaText });
      },
    });

    const memoriesSaved = upsertAutoMemories(userId, memories);
    const conversation = persistAiConversationTurn({
      userId,
      convId,
      existingRow,
      history: fullHistory,
      cleanMsg,
      replyText,
      replaceLastAssistant,
    });

    sendSse({ type: 'done', conversation, memoriesSaved });
    if (!res.writableEnded) res.end();
  } catch (err) {
    if (abortController.signal.aborted) {
      if (!res.writableEnded) res.end();
      return;
    }
    if (err instanceof GeminiUnavailableError) {
      sendSse({ type: 'error', error: err.message, code: err.code, retryable: err.retryable });
    } else {
      sendSse({
        type: 'error',
        error: 'Unexpected AI streaming error.',
        code: 'UPSTREAM_ERROR',
        retryable: true,
      });
    }
    if (!res.writableEnded) res.end();
  }
});

app.post('/api/ai/generate-plan', requireAuth, async (req: AuthedRequest, res) => {
  const { splitType, focusNotes } = req.body as {
    splitType?: 'PPL' | 'Upper/Lower' | 'Full Body' | 'Bro Split' | 'Custom';
    focusNotes?: string;
  };
  try {
    const generated = await generateAiWorkoutPlan({
      userId: req.user!.id,
      splitType: splitType || 'PPL',
      focusNotes: typeof focusNotes === 'string' ? focusNotes.slice(0, 300) : '',
    });
    res.json(generated);
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code, retryable: err.retryable });
      return;
    }
    res.status(500).json({ error: 'Failed to generate AI plan.', retryable: true });
  }
});

app.post('/api/ai/weekly-report', requireAuth, async (req: AuthedRequest, res) => {
  const { language } = req.body as { language?: CoachLanguage };
  try {
    const report = await generateAiWeeklyReport(req.user!.id, parseCoachLanguage(language));
    res.json({ report });
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code, retryable: err.retryable });
      return;
    }
    res.status(500).json({ error: 'Failed to generate weekly AI report.', retryable: true });
  }
});

app.post('/api/ai/meal-ideas', requireAuth, async (req: AuthedRequest, res) => {
  const { promptFocus } = req.body as { promptFocus?: string };
  try {
    const suggestions = await generateAiMealSuggestions(req.user!.id, String(promptFocus || 'High protein balanced meals'));
    res.json({ suggestions });
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code, retryable: err.retryable });
      return;
    }
    res.status(500).json({ error: 'Failed to generate meal suggestions.', retryable: true });
  }
});

app.delete('/api/ai/conversations/:id', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM ai_conversations WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  res.json({ ok: true });
});

app.post('/api/ai/memory', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { memoryKey, memoryValue } = req.body as { memoryKey?: string; memoryValue?: string };
  if (typeof memoryKey !== 'string' || !memoryKey.trim() || typeof memoryValue !== 'string' || !memoryValue.trim()) {
    res.status(400).json({ error: 'Memory title and details are required.' });
    return;
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO ai_memory (id, user_id, memory_key, memory_value, source, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    userId,
    memoryKey.trim().slice(0, 60),
    memoryValue.trim().slice(0, 300),
    'user',
    now
  );
  res.status(201).json({
    item: { id, userId, memoryKey: memoryKey.trim().slice(0, 60), memoryValue: memoryValue.trim().slice(0, 300), source: 'user', updatedAt: now },
  });
});

app.delete('/api/ai/memory/:id', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM ai_memory WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  res.json({ ok: true });
});

// ==================== ACCOUNT EXPORT & DELETION ====================
app.get('/api/account/export', requireAuth, (req: AuthedRequest, res) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    user: req.user,
    data: getUserBootstrap(req.user!.id),
  };
  res.setHeader('Content-Disposition', 'attachment; filename="fittrack-x-ultra-export.json"');
  res.json(payload);
});

app.delete('/api/account', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  if (userId === 'demo-athlete-001') {
    res.status(400).json({ error: 'The shared Demo Athlete account cannot be deleted. Sign out or create a personal account.' });
    return;
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  clearSessionCookie(res);
  res.json({ ok: true });
});

// ==================== SERVER STARTUP (VITE / DIST + LIVE WS) ====================
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`FITTRACK X ULTRA server listening on http://0.0.0.0:${PORT}`);
  });

  const liveWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const parsedUrl = new URL(request.url || '/', 'http://localhost');
    if (parsedUrl.pathname !== '/api/ai/live') {
      return;
    }

    const cookies = parseCookies(request.headers.cookie);
    const authHeader = request.headers.authorization;
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
    const queryToken = parsedUrl.searchParams.get('token') || undefined;
    const token = bearer || cookies[SESSION_COOKIE_NAME] || queryToken;
    const user = getUserBySessionToken(token);

    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const lang = parseCoachLanguage(parsedUrl.searchParams.get('lang'));
    liveWss.handleUpgrade(request, socket, head, (ws) => {
      liveWss.emit('connection', ws, request, user, lang);
    });
  });

  liveWss.on('connection', (clientWs: WebSocket, _req: unknown, user: UserAccount, lang: CoachLanguage) => {
    let closed = false;
    let activeSession: Awaited<ReturnType<typeof createLiveCoachSession>> | null = null;

    const sendWs = (payload: Record<string, unknown>) => {
      if (!closed && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    const sessionPromise = createLiveCoachSession({
      userId: user.id,
      language: lang,
      onAudio: (audio) => sendWs({ type: 'audio', audio }),
      onInputTranscript: (text) => sendWs({ type: 'inputTranscript', text }),
      onOutputTranscript: (text) => sendWs({ type: 'outputTranscript', text }),
      onInterrupted: () => sendWs({ type: 'interrupted' }),
      onError: (error) => sendWs({ type: 'error', error }),
      onClose: () => sendWs({ type: 'closed' }),
    });

    sessionPromise
      .then((session) => {
        if (closed) {
          session.close();
          return;
        }
        activeSession = session;
        sendWs({ type: 'ready' });
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Unable to start Gemini Live voice session.';
        sendWs({ type: 'error', error: msg });
        clientWs.close();
      });

    clientWs.on('message', (raw) => {
      if (closed) return;
      let msg: { audio?: string; text?: string };
      try {
        msg = JSON.parse(raw.toString()) as { audio?: string; text?: string };
      } catch {
        return;
      }

      sessionPromise
        .then((session) => {
          if (closed) return;
          if (typeof msg.audio === 'string' && msg.audio.length > 0) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          } else if (typeof msg.text === 'string' && msg.text.trim()) {
            session.sendRealtimeInput({ text: msg.text.trim().slice(0, 1000) });
          }
        })
        .catch(() => {
          // Session error already forwarded
        });
    });

    const cleanup = () => {
      closed = true;
      try {
        activeSession?.close();
      } catch {
        // Ignore close errors
      }
      activeSession = null;
    };

    clientWs.on('close', cleanup);
    clientWs.on('error', cleanup);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
