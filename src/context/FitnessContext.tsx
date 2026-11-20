import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AchievementBadge,
  AiConversation,
  AiMemoryItem,
  BodyMeasurement,
  NutritionLog,
  RecoveryLog,
  SessionExercise,
  UserAccount,
  UserProfile,
  WaterLog,
  WorkoutPlan,
  WorkoutSession,
} from '../types/fitness';
import { api, ApiError, setInMemoryToken } from '../services/api';
import {
  calculateLevelFromXp,
  calculateMacroTargets,
  calculateWorkoutStreak,
  estimateMuscleRecovery,
  evaluateAchievements,
  extractPersonalRecords,
  MacroTargets,
  PersonalRecord,
} from '../utils/fitnessMath';
import { EXERCISE_BY_ID } from '../data/exercises';

export type NavPageId =
  | 'overview'
  | 'ai-coach'
  | 'anatomy'
  | 'exercises'
  | 'planner'
  | 'live-workout'
  | 'form-lab'
  | 'nutrition'
  | 'recovery'
  | 'transformation'
  | 'analytics'
  | 'achievements'
  | 'profile'
  | 'settings';

export interface ActiveWorkoutDraft {
  planId: string | null;
  title: string;
  startedAt: string;
  elapsedSec: number;
  isPaused: boolean;
  notes: string;
  exercises: SessionExercise[];
}

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface FitnessContextValue {
  loadingAuth: boolean;
  user: UserAccount | null;
  profile: UserProfile | null;
  plans: WorkoutPlan[];
  sessions: WorkoutSession[];
  nutritionLogs: NutritionLog[];
  waterLogs: WaterLog[];
  recoveryLogs: RecoveryLog[];
  measurements: BodyMeasurement[];
  aiConversations: AiConversation[];
  aiMemory: AiMemoryItem[];
  favoriteExerciseIds: string[];
  activePage: NavPageId;
  setActivePage: (page: NavPageId) => void;
  selectedAnatomyMuscleId: string;
  setSelectedAnatomyMuscleId: (muscleId: string) => void;
  exerciseFilterMuscle: string | null;
  setExerciseFilterMuscle: (category: string | null) => void;
  activeWorkout: ActiveWorkoutDraft | null;
  setActiveWorkout: React.Dispatch<React.SetStateAction<ActiveWorkoutDraft | null>>;
  startWorkoutFromPlan: (plan: WorkoutPlan) => void;
  startQuickWorkoutWithExercise: (exerciseId: string) => void;
  toasts: ToastItem[];
  notify: (message: string, type?: ToastItem['type']) => void;
  dismissToast: (id: string) => void;
  refreshBootstrap: () => Promise<void>;
  signInDemo: () => Promise<void>;
  signOut: () => Promise<void>;
  macroTargets: MacroTargets;
  streak: number;
  totalXp: number;
  levelInfo: ReturnType<typeof calculateLevelFromXp>;
  muscleRecovery: ReturnType<typeof estimateMuscleRecovery>;
  personalRecords: PersonalRecord[];
  achievements: AchievementBadge[];
}

const FitnessContext = createContext<FitnessContextValue | null>(null);
const ACTIVE_WORKOUT_KEY = 'fittrack_active_workout_v1';

export const FitnessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [user, setUser] = useState<UserAccount | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [nutritionLogs, setNutritionLogs] = useState<NutritionLog[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [recoveryLogs, setRecoveryLogs] = useState<RecoveryLog[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [aiConversations, setAiConversations] = useState<AiConversation[]>([]);
  const [aiMemory, setAiMemory] = useState<AiMemoryItem[]>([]);
  const [favoriteExerciseIds, setFavoriteExerciseIds] = useState<string[]>([]);
  const [activePage, setActivePage] = useState<NavPageId>('overview');
  const [selectedAnatomyMuscleId, setSelectedAnatomyMuscleId] = useState<string>('upper_chest');
  const [exerciseFilterMuscle, setExerciseFilterMuscle] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutDraft | null>(() => {
    try {
      const saved = sessionStorage.getItem(ACTIVE_WORKOUT_KEY);
      return saved ? (JSON.parse(saved) as ActiveWorkoutDraft) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (activeWorkout) {
        sessionStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(activeWorkout));
      } else {
        sessionStorage.removeItem(ACTIVE_WORKOUT_KEY);
      }
    } catch {
      // ignore storage quota errors
    }
  }, [activeWorkout]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const applyBootstrap = useCallback((data: Awaited<ReturnType<typeof api.getBootstrap>>) => {
    setUser(data.user);
    setProfile(data.profile);
    setPlans(data.plans);
    setSessions(data.sessions);
    setNutritionLogs(data.nutritionLogs);
    setWaterLogs(data.waterLogs);
    setRecoveryLogs(data.recoveryLogs);
    setMeasurements(data.measurements);
    setAiConversations(data.aiConversations);
    setAiMemory(data.aiMemory);
    setFavoriteExerciseIds(data.favoriteExerciseIds);
  }, []);

  const refreshBootstrap = useCallback(async () => {
    const data = await api.getBootstrap();
    applyBootstrap(data);
  }, [applyBootstrap]);

  const signInDemo = useCallback(async () => {
    const res = await api.demoLogin();
    setInMemoryToken(res.token);
    await refreshBootstrap();
    notify('Signed in as Demo Athlete (Alex Mercer).', 'success');
  }, [notify, refreshBootstrap]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setInMemoryToken(null);
      setUser(null);
      setProfile(null);
      setPlans([]);
      setSessions([]);
      setNutritionLogs([]);
      setWaterLogs([]);
      setRecoveryLogs([]);
      setMeasurements([]);
      setAiConversations([]);
      setAiMemory([]);
      setFavoriteExerciseIds([]);
      setActiveWorkout(null);
      setActivePage('overview');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const params = new URLSearchParams(window.location.search);
        const autostart = params.get('autostart') === '1';
        const { user: existingUser } = await api.authMe();
        if (existingUser) {
          const data = await api.getBootstrap();
          if (!cancelled) applyBootstrap(data);
        } else if (autostart) {
          const res = await api.demoLogin();
          setInMemoryToken(res.token);
          const data = await api.getBootstrap();
          if (!cancelled) applyBootstrap(data);
        }
      } catch {
        // remain signed out cleanly
      } finally {
        if (!cancelled) setLoadingAuth(false);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [applyBootstrap]);

  // Workout clock ticker (1s) when live workout is active & not paused
  useEffect(() => {
    if (!activeWorkout || activeWorkout.isPaused) return;
    const timer = window.setInterval(() => {
      setActiveWorkout((prev) => (prev && !prev.isPaused ? { ...prev, elapsedSec: prev.elapsedSec + 1 } : prev));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeWorkout?.isPaused, Boolean(activeWorkout)]);

  const startWorkoutFromPlan = useCallback(
    (plan: WorkoutPlan) => {
      const mapped: SessionExercise[] = plan.exercises.map((pe) => {
        const meta = EXERCISE_BY_ID[pe.exerciseId];
        return {
          exerciseId: pe.exerciseId,
          exerciseName: pe.exerciseName,
          primaryMuscles: meta?.primaryMuscles || [],
          secondaryMuscles: meta?.secondaryMuscles || [],
          notes: pe.notes || '',
          sets: Array.from({ length: pe.targetSets || 3 }, (_, idx) => ({
            setNumber: idx + 1,
            reps: parseInt(pe.targetReps, 10) || 10,
            weightKg: pe.targetWeightKg || 20,
            completed: false,
          })),
        };
      });
      setActiveWorkout({
        planId: plan.id,
        title: plan.name,
        startedAt: new Date().toISOString(),
        elapsedSec: 0,
        isPaused: false,
        notes: '',
        exercises: mapped,
      });
      setActivePage('live-workout');
      notify(`Started live session: ${plan.name}`, 'success');
    },
    [notify]
  );

  const startQuickWorkoutWithExercise = useCallback(
    (exerciseId: string) => {
      const ex = EXERCISE_BY_ID[exerciseId];
      if (!ex) return;
      setActiveWorkout((prev) => {
        const newEntry: SessionExercise = {
          exerciseId: ex.id,
          exerciseName: ex.name,
          primaryMuscles: ex.primaryMuscles,
          secondaryMuscles: ex.secondaryMuscles,
          sets: [
            { setNumber: 1, reps: 10, weightKg: 20, completed: false },
            { setNumber: 2, reps: 10, weightKg: 20, completed: false },
            { setNumber: 3, reps: 10, weightKg: 20, completed: false },
          ],
        };
        if (prev) {
          return { ...prev, exercises: [...prev.exercises, newEntry] };
        }
        return {
          planId: null,
          title: `${ex.category} Focus Session`,
          startedAt: new Date().toISOString(),
          elapsedSec: 0,
          isPaused: false,
          notes: '',
          exercises: [newEntry],
        };
      });
      setActivePage('live-workout');
      notify(`Added ${ex.name} to Live Workout`, 'success');
    },
    [notify]
  );

  const macroTargets = useMemo(() => calculateMacroTargets(profile || {}), [profile]);
  const streak = useMemo(() => calculateWorkoutStreak(sessions), [sessions]);
  const muscleRecovery = useMemo(
    () => estimateMuscleRecovery(sessions, recoveryLogs[0] || null),
    [sessions, recoveryLogs]
  );
  const personalRecords = useMemo(() => extractPersonalRecords(sessions), [sessions]);
  const achievements = useMemo(
    () => evaluateAchievements({ sessions, nutritionLogs, measurements, streak }),
    [sessions, nutritionLogs, measurements, streak]
  );

  const totalXp = useMemo(() => {
    const sessionXp = sessions.reduce((acc, s) => acc + (s.xpEarned || 0), 0);
    const badgeXp = achievements.filter((a) => a.unlocked).reduce((acc, a) => acc + a.xpReward, 0);
    return sessionXp + badgeXp;
  }, [sessions, achievements]);

  const levelInfo = useMemo(() => calculateLevelFromXp(totalXp), [totalXp]);

  const value: FitnessContextValue = {
    loadingAuth,
    user,
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
    activePage,
    setActivePage,
    selectedAnatomyMuscleId,
    setSelectedAnatomyMuscleId,
    exerciseFilterMuscle,
    setExerciseFilterMuscle,
    activeWorkout,
    setActiveWorkout,
    startWorkoutFromPlan,
    startQuickWorkoutWithExercise,
    toasts,
    notify,
    dismissToast,
    refreshBootstrap,
    signInDemo,
    signOut,
    macroTargets,
    streak,
    totalXp,
    levelInfo,
    muscleRecovery,
    personalRecords,
    achievements,
  };

  return <FitnessContext.Provider value={value}>{children}</FitnessContext.Provider>;
};

export function useFitness(): FitnessContextValue {
  const ctx = useContext(FitnessContext);
  if (!ctx) throw new Error('useFitness must be used inside FitnessProvider');
  return ctx;
}
