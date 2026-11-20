export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type FitnessGoal = 'muscle_gain' | 'fat_loss' | 'strength' | 'recomposition' | 'endurance' | 'general_health';
export type WorkoutLocation = 'gym' | 'home' | 'both';
export type LanguageCode = 'en' | 'ta';
export type CoachLanguage = 'en' | 'ta' | 'tanglish';
export type UnitSystem = 'metric' | 'imperial';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface UserProfile {
  userId: string;
  name: string;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  experience: ExperienceLevel;
  goal: FitnessGoal;
  location: WorkoutLocation;
  equipment: string[];
  weeklyDays: number;
  preferredDurationMin: number;
  dietaryPref: 'non_veg' | 'vegetarian' | 'vegan' | 'eggetarian' | 'pescatarian';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
  limitations: string;
  units: UnitSystem;
  language: LanguageCode;
  notificationsEnabled: boolean;
  aiMemoryEnabled: boolean;
  privacyPhotosPrivate: boolean;
  onboardingCompleted: boolean;
  updatedAt: string;
}

export type ExerciseCategory =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Forearms'
  | 'Abs'
  | 'Obliques'
  | 'Quadriceps'
  | 'Hamstrings'
  | 'Glutes'
  | 'Calves'
  | 'Full Body'
  | 'Cardio'
  | 'Mobility';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  subGroup: string;
  workoutType: 'Strength' | 'Hypertrophy' | 'Bodyweight' | 'Cardio' | 'Mobility' | 'Functional';
  location: 'gym' | 'home' | 'both';
  primaryMuscles: string[]; // Muscle IDs from MUSCLES
  secondaryMuscles: string[];
  difficulty: ExperienceLevel;
  equipment: string;
  startingPosition: string;
  steps: string[];
  setsGuidance: string;
  repsGuidance: string;
  restSeconds: number;
  breathing: string;
  commonMistakes: string[];
  safetyTips: string[];
  alternatives: string[];
  visualPose: 'press' | 'pull' | 'squat' | 'hinge' | 'curl' | 'extension' | 'core' | 'carry' | 'cardio' | 'mobility';
}

export interface PlannedExercise {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetReps: string;
  targetWeightKg: number;
  restSeconds: number;
  notes?: string;
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  name: string;
  splitType: 'PPL' | 'Upper/Lower' | 'Full Body' | 'Bro Split' | 'Custom';
  dayOfWeek: number; // 0 = Sun ... 6 = Sat
  exercises: PlannedExercise[];
  notes: string;
  isAiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompletedSet {
  setNumber: number;
  reps: number;
  weightKg: number;
  completed: boolean;
  isPr?: boolean;
}

export interface SessionExercise {
  exerciseId: string;
  exerciseName: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  sets: CompletedSet[];
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  planId?: string | null;
  title: string;
  startedAt: string;
  completedAt: string;
  durationSec: number;
  totalSets: number;
  totalVolumeKg: number;
  estCalories: number;
  exercises: SessionExercise[];
  notes: string;
  xpEarned: number;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface NutritionLog {
  id: string;
  userId: string;
  logDate: string; // YYYY-MM-DD
  mealType: MealType;
  foodName: string;
  servingQty: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isFavorite: boolean;
  createdAt: string;
}

export interface WaterLog {
  userId: string;
  logDate: string;
  amountMl: number;
  updatedAt: string;
}

export interface RecoveryLog {
  id: string;
  userId: string;
  logDate: string;
  sleepHours: number;
  sleepQuality: number; // 1-5
  sorenessLevel: number; // 1-5
  fatigueLevel: number; // 1-5
  soreMuscles: string[];
  notes: string;
  createdAt: string;
}

export interface BodyMeasurement {
  id: string;
  userId: string;
  logDate: string;
  weightKg: number;
  waistCm: number | null;
  chestCm: number | null;
  armsCm: number | null;
  thighsCm: number | null;
  hipsCm: number | null;
  photoDataUrl?: string | null;
  note: string;
  createdAt: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AiConversation {
  id: string;
  userId: string;
  title: string;
  messages: AiChatMessage[];
  updatedAt: string;
  createdAt: string;
}

export interface AiMemoryItem {
  id: string;
  userId: string;
  memoryKey: string;
  memoryValue: string;
  source: 'user' | 'auto';
  updatedAt: string;
}

export interface AchievementBadge {
  key: string;
  title: string;
  description: string;
  xpReward: number;
  requirementText: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface MuscleDefinition {
  id: string;
  name: string;
  scientificName: string;
  region: 'Upper Body — Front' | 'Upper Body — Back' | 'Lower Body';
  view: 'front' | 'back' | 'side';
  location: string;
  mainFunction: string;
  commonMistakes: string[];
  recoveryGuidance: string;
  exerciseCategories: ExerciseCategory[];
}

export interface MuscleRecoveryStatus {
  muscleId: string;
  muscleName: string;
  recoveryPct: number; // 0-100 estimated readiness
  statusLabel: 'Recovered' | 'Moderate Load' | 'Fatigued';
  hoursSinceTrained: number | null;
  recentSets7d: number;
}
