import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDailyFitnessScore,
  calculateLevelFromXp,
  calculateMacroTargets,
  calculateSessionXp,
  calculateWorkoutStreak,
  estimateMuscleRecovery,
  evaluateAchievements,
  extractPersonalRecords,
} from './fitnessMath';
import { WorkoutSession } from '../types/fitness';

const sampleSessions: WorkoutSession[] = [
  {
    id: 's1',
    userId: 'u1',
    title: 'Upper Push',
    startedAt: '2026-11-19T10:00:00Z',
    completedAt: '2026-11-19T10:45:00Z',
    durationSec: 2700,
    totalSets: 8,
    totalVolumeKg: 3200,
    estCalories: 310,
    notes: '',
    xpEarned: 100,
    exercises: [
      {
        exerciseId: 'barbell-bench-press',
        exerciseName: 'Barbell Bench Press',
        primaryMuscles: ['middle_chest'],
        secondaryMuscles: ['front_delts', 'triceps_lateral'],
        sets: [
          { setNumber: 1, reps: 8, weightKg: 80, completed: true, isPr: true },
          { setNumber: 2, reps: 8, weightKg: 80, completed: true },
        ],
      },
    ],
  },
  {
    id: 's2',
    userId: 'u1',
    title: 'Leg Power',
    startedAt: '2026-11-20T09:00:00Z',
    completedAt: '2026-11-20T09:50:00Z',
    durationSec: 3000,
    totalSets: 6,
    totalVolumeKg: 4500,
    estCalories: 390,
    notes: '',
    xpEarned: 120,
    exercises: [
      {
        exerciseId: 'barbell-back-squat',
        exerciseName: 'Barbell Back Squat',
        primaryMuscles: ['rectus_femoris', 'vastus_lateralis', 'gluteus_maximus'],
        secondaryMuscles: ['erector_spinae'],
        sets: [{ setNumber: 1, reps: 5, weightKg: 110, completed: true, isPr: true }],
      },
    ],
  },
];

test('calculateMacroTargets scales calories and protein by goal', () => {
  const bulk = calculateMacroTargets({ weightKg: 80, heightCm: 180, age: 26, goal: 'muscle_gain', activityLevel: 'moderate' });
  const cut = calculateMacroTargets({ weightKg: 80, heightCm: 180, age: 26, goal: 'fat_loss', activityLevel: 'moderate' });
  assert.ok(bulk.calories > cut.calories);
  assert.equal(bulk.proteinG, 160);
  assert.equal(bulk.waterMl, 2800);
});

test('calculateWorkoutStreak counts consecutive active days accurately', () => {
  const streak = calculateWorkoutStreak(sampleSessions, '2026-11-20T12:00:00Z');
  assert.equal(streak, 2);
  const broken = calculateWorkoutStreak(sampleSessions, '2026-11-25T12:00:00Z');
  assert.equal(broken, 0);
});

test('estimateMuscleRecovery lowers readiness for recently trained muscles', () => {
  const now = new Date('2026-11-20T12:00:00Z').getTime();
  const recovery = estimateMuscleRecovery(sampleSessions, null, now);
  const middleChest = recovery.find((r) => r.muscleId === 'middle_chest');
  const lats = recovery.find((r) => r.muscleId === 'lats');
  assert.ok(middleChest && lats);
  assert.ok(middleChest.recoveryPct < lats.recoveryPct);
  assert.equal(lats.recoveryPct, 100);
});

test('extractPersonalRecords and achievements compute from recorded sessions', () => {
  const prs = extractPersonalRecords(sampleSessions);
  assert.equal(prs.length, 2);
  assert.equal(prs[0].maxWeightKg, 110);

  const badges = evaluateAchievements({
    sessions: sampleSessions,
    nutritionLogs: [],
    measurements: [],
    streak: 2,
  });
  const firstWorkout = badges.find((b) => b.key === 'first_workout');
  const streak7 = badges.find((b) => b.key === 'streak_7');
  assert.equal(firstWorkout?.unlocked, true);
  assert.equal(streak7?.unlocked, false);
});

test('XP, level, and daily fitness score stay bounded', () => {
  const xp = calculateSessionXp(12, 5000, 1);
  assert.ok(xp > 100);
  const lvl = calculateLevelFromXp(450);
  assert.equal(lvl.level, 3);
  const score = calculateDailyFitnessScore({
    sessionsLast7d: 4,
    weeklyGoalDays: 4,
    todayCalories: 2400,
    targetCalories: 2400,
    todayWaterMl: 2800,
    targetWaterMl: 2800,
    avgRecoveryPct: 90,
  });
  assert.ok(score >= 95 && score <= 100);
});
