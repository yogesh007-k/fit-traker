import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAthleteContextObject,
  buildCoachSystemInstruction,
  extractAndStripMemoryTags,
  prepareConversationContents,
} from '../server/aiHelpers';
import { matchDirectAppCommand } from './aiCommand';
import { AiChatMessage, UserProfile, WorkoutSession } from '../types/fitness';

const baseProfile: UserProfile = {
  userId: 'user-a',
  name: 'Jordan',
  age: 26,
  heightCm: 178,
  weightKg: 75,
  experience: 'intermediate',
  goal: 'muscle_gain',
  location: 'gym',
  equipment: ['Barbell', 'Dumbbells'],
  weeklyDays: 4,
  preferredDurationMin: 50,
  dietaryPref: 'non_veg',
  activityLevel: 'moderate',
  limitations: 'Left shoulder discomfort on upright rows',
  units: 'metric',
  language: 'en',
  notificationsEnabled: true,
  aiMemoryEnabled: true,
  privacyPhotosPrivate: true,
  onboardingCompleted: true,
  updatedAt: '2026-11-20T00:00:00Z',
};

const sampleSession: WorkoutSession = {
  id: 'sess-1',
  userId: 'user-a',
  planId: null,
  title: 'Push Strength',
  startedAt: '2026-11-19T10:00:00Z',
  completedAt: '2026-11-19T10:50:00Z',
  durationSec: 3000,
  totalSets: 3,
  totalVolumeKg: 1920,
  estCalories: 350,
  notes: 'Felt strong on top set',
  xpEarned: 150,
  exercises: [
    {
      exerciseId: 'barbell-bench-press',
      exerciseName: 'Barbell Bench Press',
      primaryMuscles: ['middle_chest'],
      secondaryMuscles: ['front_delts', 'triceps_lateral'],
      sets: [
        { setNumber: 1, reps: 8, weightKg: 80, completed: true },
        { setNumber: 2, reps: 8, weightKg: 80, completed: true, isPr: true },
        { setNumber: 3, reps: 8, weightKg: 80, completed: true },
      ],
    },
  ],
};

test('buildAthleteContextObject includes real lift weights, PRs, recovery, and respects aiMemoryEnabled', () => {
  const nowMs = new Date('2026-11-20T12:00:00Z').getTime();
  const ctx = buildAthleteContextObject(
    {
      profile: baseProfile,
      plans: [],
      sessions: [sampleSession],
      nutritionLogs: [],
      waterLogs: [],
      recoveryLogs: [],
      measurements: [],
      aiMemory: [
        {
          id: 'm1',
          userId: 'user-a',
          memoryKey: 'Tempo',
          memoryValue: 'Prefers 3-second eccentric on bench press',
          source: 'user',
          updatedAt: '2026-11-20T00:00:00Z',
        },
      ],
    },
    nowMs
  );

  const json = JSON.stringify(ctx);
  assert.ok(json.includes('80kg×8 (PR)'), 'Expected exact set weight and PR marker');
  assert.ok(json.includes('Left shoulder discomfort'), 'Expected profile limitation');
  assert.ok(json.includes('Prefers 3-second eccentric'), 'Expected saved AI memory');

  const noMemCtx = buildAthleteContextObject(
    {
      profile: { ...baseProfile, aiMemoryEnabled: false },
      plans: [],
      sessions: [],
      nutritionLogs: [],
      waterLogs: [],
      recoveryLogs: [],
      measurements: [],
      aiMemory: [
        {
          id: 'm1',
          userId: 'user-a',
          memoryKey: 'Secret',
          memoryValue: 'Should not leak when memory disabled',
          source: 'user',
          updatedAt: '2026-11-20T00:00:00Z',
        },
      ],
    },
    nowMs
  );
  assert.equal((noMemCtx.savedMemoryFacts as unknown[]).length, 0);
});

test('extractAndStripMemoryTags cleanly parses and removes [[MEMORY: ...]] markers', () => {
  const raw = `Here is a chest routine.\n\n- Incline Dumbbell Press: 3x10\n\n[[MEMORY: Knee Constraint | Avoid deep barbell lunges due to patellar soreness]]\n[[MEMORY: Schedule | Can only train 35 minutes on weekdays]]`;
  const { cleanText, memories } = extractAndStripMemoryTags(raw);
  assert.equal(cleanText.includes('[[MEMORY:'), false);
  assert.equal(memories.length, 2);
  assert.equal(memories[0].memoryKey, 'Knee Constraint');
  assert.equal(memories[1].memoryKey, 'Schedule');
});

test('prepareConversationContents preserves opening context and recent turns for long chats', () => {
  const history: AiChatMessage[] = Array.from({ length: 30 }, (_, idx) => ({
    id: `msg-${idx}`,
    role: idx % 2 === 0 ? 'user' : 'assistant',
    content: `Turn ${idx}`,
    timestamp: '2026-11-20T00:00:00Z',
  }));
  const contents = prepareConversationContents(history, 'Latest follow-up', 24);
  assert.equal(contents.length, 25); // 24 history + 1 latest
  assert.equal(contents[0].parts[0].text, 'Turn 0');
  assert.equal(contents[1].parts[0].text, 'Turn 1');
  assert.equal(contents[2].parts[0].text, 'Turn 8');
  assert.equal(contents[24].parts[0].text, 'Latest follow-up');
});

test('matchDirectAppCommand only triggers on imperative commands and never hijacks coaching questions', () => {
  assert.deepEqual(matchDirectAppCommand('Pause workout', true), { type: 'pause-workout' });
  assert.deepEqual(matchDirectAppCommand('Open 3D anatomy', false), {
    type: 'navigate',
    page: 'anatomy',
    label: '3D Muscle Anatomy',
  });
  // Coaching questions containing similar keywords must NOT be intercepted
  assert.equal(matchDirectAppCommand('When should I pause workout for deload recovery?', true), null);
  assert.equal(matchDirectAppCommand('Should I start live workout right after cardio?', true), null);
  assert.equal(matchDirectAppCommand('Give me a beginner chest workout.', false), null);
});

test('buildCoachSystemInstruction includes Tamil and Tanglish guidance accurately', () => {
  const taPrompt = buildCoachSystemInstruction({
    contextJson: '{}',
    language: 'ta',
    aiMemoryEnabled: true,
  });
  assert.ok(taPrompt.includes('Tamil (தமிழ்)'));

  const tanglishPrompt = buildCoachSystemInstruction({
    contextJson: '{}',
    language: 'tanglish',
    aiMemoryEnabled: true,
  });
  assert.ok(tanglishPrompt.includes('Tanglish'));
});
