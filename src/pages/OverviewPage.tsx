import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bot,
  Calendar,
  Droplets,
  Dumbbell,
  Flame,
  HeartPulse,
  Play,
  Plus,
  Scale,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { useFitness } from '../context/FitnessContext';
import { calculateDailyFitnessScore } from '../utils/fitnessMath';
import { api, ApiError } from '../services/api';
import {
  Card,
  CircularProgress,
  PageHeader,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
} from '../components/ui/Primitives';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const OverviewPage: React.FC = () => {
  const {
    profile,
    plans,
    sessions,
    nutritionLogs,
    waterLogs,
    muscleRecovery,
    macroTargets,
    streak,
    totalXp,
    levelInfo,
    activeWorkout,
    startWorkoutFromPlan,
    setActivePage,
    refreshBootstrap,
    notify,
  } = useFitness();

  const [chartMetric, setChartMetric] = useState<'volume' | 'duration'>('volume');
  const [waterLoading, setWaterLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDow = new Date().getDay();

  // Last 7 days sessions
  const { sessionsLast7d, calories7d, durationMin7d, dailyChart } = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recent = sessions.filter((s) => new Date(s.completedAt).getTime() >= sevenDaysAgo);
    const cal = recent.reduce((acc, s) => acc + (s.estCalories || 0), 0);
    const dur = Math.round(recent.reduce((acc, s) => acc + (s.durationSec || 0), 0) / 60);

    const days: Array<{ date: string; label: string; volumeKg: number; durationMin: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const iso = d.toISOString().slice(0, 10);
      const daySessions = sessions.filter((s) => s.completedAt.slice(0, 10) === iso);
      days.push({
        date: iso,
        label: DAYS_SHORT[d.getDay()],
        volumeKg: daySessions.reduce((a, s) => a + s.totalVolumeKg, 0),
        durationMin: Math.round(daySessions.reduce((a, s) => a + s.durationSec, 0) / 60),
      });
    }

    return {
      sessionsLast7d: recent.length,
      calories7d: cal,
      durationMin7d: dur,
      dailyChart: days,
    };
  }, [sessions]);

  const todayNutrition = useMemo(() => {
    const todayEntries = nutritionLogs.filter((n) => n.logDate === todayStr);
    return todayEntries.reduce(
      (acc, n) => ({
        calories: acc.calories + n.calories,
        proteinG: acc.proteinG + n.proteinG,
        carbsG: acc.carbsG + n.carbsG,
        fatG: acc.fatG + n.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );
  }, [nutritionLogs, todayStr]);

  const todayWaterMl = useMemo(
    () => waterLogs.find((w) => w.logDate === todayStr)?.amountMl ?? 0,
    [waterLogs, todayStr]
  );

  const avgRecoveryPct = useMemo(() => {
    if (!muscleRecovery.length) return 90;
    return Math.round(
      muscleRecovery.reduce((acc, m) => acc + m.recoveryPct, 0) / muscleRecovery.length
    );
  }, [muscleRecovery]);

  const fatiguedMuscles = useMemo(
    () =>
      [...muscleRecovery]
        .sort((a, b) => a.recoveryPct - b.recoveryPct)
        .slice(0, 3),
    [muscleRecovery]
  );

  const dailyScore = useMemo(
    () =>
      calculateDailyFitnessScore({
        sessionsLast7d,
        weeklyGoalDays: profile?.weeklyDays || 4,
        todayCalories: todayNutrition.calories,
        targetCalories: macroTargets.calories,
        todayWaterMl,
        targetWaterMl: macroTargets.waterMl,
        avgRecoveryPct,
      }),
    [
      sessionsLast7d,
      profile?.weeklyDays,
      todayNutrition.calories,
      macroTargets.calories,
      macroTargets.waterMl,
      todayWaterMl,
      avgRecoveryPct,
    ]
  );

  const todaysPlan = useMemo(
    () => plans.find((p) => p.dayOfWeek === todayDow) || plans[0] || null,
    [plans, todayDow]
  );

  const maxChartVal = Math.max(
    1,
    ...dailyChart.map((d) => (chartMetric === 'volume' ? d.volumeKg : d.durationMin))
  );

  const handleQuickWater = async () => {
    setWaterLoading(true);
    try {
      await api.setWater(todayStr, todayWaterMl + 250);
      await refreshBootstrap();
      notify('+250ml hydration logged.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to log water.', 'error');
    } finally {
      setWaterLoading(false);
    }
  };

  const handleGenerateAiReport = async () => {
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await api.aiWeeklyReport(profile?.language || 'en');
      setAiReport(res.report);
    } catch (err) {
      if (err instanceof ApiError) {
        setReportError(err.message);
      } else {
        setReportError('Unable to reach AI reporting service.');
      }
    } finally {
      setReportLoading(false);
    }
  };

  // Real data-driven deterministic coaching insight
  const liveInsight = useMemo(() => {
    const proteinDiff = Math.round(macroTargets.proteinG - todayNutrition.proteinG);
    const lowMuscles = fatiguedMuscles.filter((m) => m.recoveryPct < 75);
    if (sessions.length === 0) {
      return 'No workouts logged yet. Pick today’s plan or start a quick workout to calibrate muscle recovery and personal records.';
    }
    if (lowMuscles.length > 0 && proteinDiff > 25) {
      return `${lowMuscles[0].muscleName} is at ${lowMuscles[0].recoveryPct}% estimated readiness and you still need ${proteinDiff}g protein today. Focus on fresh muscle groups and prioritize lean protein.`;
    }
    if (proteinDiff > 30) {
      return `You have ${proteinDiff}g protein remaining toward your ${macroTargets.proteinG}g daily target. Log a high-protein meal or shake to support recovery.`;
    }
    return `You have completed ${sessionsLast7d} of ${profile?.weeklyDays || 4} weekly sessions with ${avgRecoveryPct}% average muscle readiness.`;
  }, [
    avgRecoveryPct,
    fatiguedMuscles,
    macroTargets.proteinG,
    profile?.weeklyDays,
    sessions.length,
    sessionsLast7d,
    todayNutrition.proteinG,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${profile?.name || 'Athlete'}`}
        subtitle={`Goal: ${(profile?.goal || 'muscle_gain').replace('_', ' ')} · Level ${levelInfo.level} (${totalXp} XP) · ${streak}-day active streak`}
        actions={
          <div className="flex flex-wrap gap-2.5">
            {activeWorkout ? (
              <PrimaryButton onClick={() => setActivePage('live-workout')}>
                <Play className="w-4 h-4" /> Resume Live Workout
              </PrimaryButton>
            ) : todaysPlan ? (
              <PrimaryButton onClick={() => startWorkoutFromPlan(todaysPlan)}>
                <Play className="w-4 h-4" /> Start Today’s Workout
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={() => setActivePage('planner')}>
                <Plus className="w-4 h-4" /> Build Workout Plan
              </PrimaryButton>
            )}
            <SecondaryButton onClick={() => setActivePage('ai-coach')}>
              <Bot className="w-4 h-4" /> Ask AI Coach
            </SecondaryButton>
          </div>
        }
      />

      {/* Top Hero Grid: Daily Score + 4 Computed KPI Tiles */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-4 flex items-center gap-5">
          <CircularProgress value={dailyScore} size={108} label="Score" accent="#B7FF67" />
          <div className="min-w-0">
            <div className="text-xs font-mono uppercase tracking-wider text-[#40E0D0]">
              Daily Fitness Score
            </div>
            <h2 className="text-lg font-bold text-[#F5F7F5] mt-0.5">
              {dailyScore >= 80
                ? 'Peak Readiness'
                : dailyScore >= 60
                  ? 'Strong Momentum'
                  : 'Building Baseline'}
            </h2>
            <p className="text-xs text-[#A0AAA7] mt-1 leading-relaxed">
              Computed from weekly session consistency, today’s calories, hydration, and estimated
              muscle recovery.
            </p>
          </div>
        </Card>

        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between text-xs text-[#A0AAA7]">
              <span>Weekly Sessions</span>
              <Dumbbell className="w-4 h-4 text-[#B7FF67]" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#F5F7F5] mt-2">
              {sessionsLast7d}{' '}
              <span className="text-sm font-normal text-[#A0AAA7]">
                / {profile?.weeklyDays || 4}
              </span>
            </div>
            <div className="text-[11px] text-[#A0AAA7] mt-1">Last 7 days</div>
          </Card>

          <Card>
            <div className="flex items-center justify-between text-xs text-[#A0AAA7]">
              <span>Active Streak</span>
              <Flame className="w-4 h-4 text-[#B7FF67]" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#B7FF67] mt-2">
              {streak} <span className="text-sm font-normal text-[#A0AAA7]">days</span>
            </div>
            <div className="text-[11px] text-[#A0AAA7] mt-1">Consecutive days</div>
          </Card>

          <Card>
            <div className="flex items-center justify-between text-xs text-[#A0AAA7]">
              <span>Est. Burn (7d)</span>
              <Activity className="w-4 h-4 text-[#40E0D0]" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#F5F7F5] mt-2">
              {calories7d.toLocaleString()}
            </div>
            <div className="text-[11px] text-[#A0AAA7] mt-1">kcal (MET estimate)</div>
          </Card>

          <Card>
            <div className="flex items-center justify-between text-xs text-[#A0AAA7]">
              <span>Duration (7d)</span>
              <Calendar className="w-4 h-4 text-[#40E0D0]" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#F5F7F5] mt-2">
              {durationMin7d} <span className="text-sm font-normal text-[#A0AAA7]">min</span>
            </div>
            <div className="text-[11px] text-[#A0AAA7] mt-1">{sessions.length} total sessions</div>
          </Card>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <button
          type="button"
          onClick={() =>
            todaysPlan ? startWorkoutFromPlan(todaysPlan) : setActivePage('live-workout')
          }
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#151D20] border border-white/10 hover:border-[#B7FF67] text-xs font-medium text-[#F5F7F5] cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 text-[#B7FF67]" /> Start Workout
        </button>
        <button
          type="button"
          onClick={() => setActivePage('ai-coach')}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#151D20] border border-white/10 hover:border-[#40E0D0] text-xs font-medium text-[#F5F7F5] cursor-pointer"
        >
          <Bot className="w-3.5 h-3.5 text-[#40E0D0]" /> Ask AI Coach
        </button>
        <button
          type="button"
          onClick={() => setActivePage('exercises')}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#151D20] border border-white/10 hover:border-[#B7FF67] text-xs font-medium text-[#F5F7F5] cursor-pointer"
        >
          <Dumbbell className="w-3.5 h-3.5 text-[#B7FF67]" /> Explore Exercises
        </button>
        <button
          type="button"
          onClick={() => setActivePage('nutrition')}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#151D20] border border-white/10 hover:border-[#40E0D0] text-xs font-medium text-[#F5F7F5] cursor-pointer"
        >
          <Utensils className="w-3.5 h-3.5 text-[#40E0D0]" /> Log Food
        </button>
        <button
          type="button"
          onClick={() => setActivePage('transformation')}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#151D20] border border-white/10 hover:border-[#B7FF67] text-xs font-medium text-[#F5F7F5] cursor-pointer"
        >
          <Scale className="w-3.5 h-3.5 text-[#B7FF67]" /> Update Weight
        </button>
        <button
          type="button"
          disabled={waterLoading}
          onClick={handleQuickWater}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#151D20] border border-white/10 hover:border-[#40E0D0] text-xs font-medium text-[#40E0D0] cursor-pointer disabled:opacity-50"
        >
          <Droplets className="w-3.5 h-3.5" /> +250ml Water
        </button>
      </div>

      {/* Main Content Split: Weekly Chart + Today's Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-semibold text-[#F5F7F5]">7-Day Training Output</h3>
              <p className="text-xs text-[#A0AAA7]">
                Calculated directly from your saved workout sessions
              </p>
            </div>
            <div className="inline-flex rounded-lg bg-[#080B0D] border border-white/10 p-1">
              <button
                type="button"
                onClick={() => setChartMetric('volume')}
                className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                  chartMetric === 'volume'
                    ? 'bg-[#B7FF67] text-[#080B0D] font-semibold'
                    : 'text-[#A0AAA7]'
                }`}
              >
                Volume (kg)
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('duration')}
                className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                  chartMetric === 'duration'
                    ? 'bg-[#40E0D0] text-[#080B0D] font-semibold'
                    : 'text-[#A0AAA7]'
                }`}
              >
                Duration (min)
              </button>
            </div>
          </div>

          <div className="h-52 flex items-end gap-3 pt-4">
            {dailyChart.map((d) => {
              const val = chartMetric === 'volume' ? d.volumeKg : d.durationMin;
              const pct = Math.max(4, Math.round((val / maxChartVal) * 100));
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-2 h-full">
                  <div className="text-[11px] font-mono tabular-nums text-[#A0AAA7]">
                    {val > 0 ? val : '0'}
                  </div>
                  <div className="w-full flex-1 bg-[#080B0D] rounded-lg flex items-end overflow-hidden border border-white/5">
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        val === 0
                          ? 'bg-white/5'
                          : chartMetric === 'volume'
                            ? 'bg-[#B7FF67]'
                            : 'bg-[#40E0D0]'
                      }`}
                      style={{ height: `${val === 0 ? 4 : pct}%` }}
                    />
                  </div>
                  <div className="text-xs text-[#A0AAA7]">{d.label}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-[#B7FF67]">
                Today’s Training Plan
              </span>
              <button
                type="button"
                onClick={() => setActivePage('planner')}
                className="text-xs text-[#40E0D0] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                Open Planner <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {todaysPlan ? (
              <>
                <h3 className="text-lg font-bold text-[#F5F7F5] mt-2">{todaysPlan.name}</h3>
                <p className="text-xs text-[#A0AAA7] mt-1">
                  {todaysPlan.splitType} · {todaysPlan.exercises.length} exercises
                </p>
                <div className="mt-4 space-y-2 max-h-44 overflow-y-auto pr-1">
                  {todaysPlan.exercises.map((ex, idx) => (
                    <div
                      key={`${ex.exerciseId}-${idx}`}
                      className="flex items-center justify-between text-xs bg-[#080B0D] border border-white/10 rounded-lg px-3 py-2"
                    >
                      <span className="font-medium text-[#F5F7F5] truncate pr-2">
                        {ex.exerciseName}
                      </span>
                      <span className="font-mono tabular-nums text-[#A0AAA7] shrink-0">
                        {ex.targetSets} × {ex.targetReps}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-[#A0AAA7] mt-3">
                No workout scheduled for today yet. Create or generate a plan in Workout Planner.
              </p>
            )}
          </div>

          {todaysPlan && (
            <PrimaryButton
              onClick={() => startWorkoutFromPlan(todaysPlan)}
              className="w-full mt-4"
            >
              <Play className="w-4 h-4" /> Launch Live Workout
            </PrimaryButton>
          )}
        </Card>
      </div>

      {/* Nutrition, Recovery & AI Intelligence Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#F5F7F5] flex items-center gap-2">
              <Utensils className="w-4 h-4 text-[#B7FF67]" /> Today’s Nutrition
            </h3>
            <button
              type="button"
              onClick={() => setActivePage('nutrition')}
              className="text-xs text-[#40E0D0] hover:underline cursor-pointer"
            >
              Details
            </button>
          </div>
          <div className="space-y-3">
            <ProgressBar
              value={todayNutrition.calories}
              max={macroTargets.calories}
              color="lime"
              label="Calories (kcal)"
            />
            <ProgressBar
              value={todayNutrition.proteinG}
              max={macroTargets.proteinG}
              color="cyan"
              label="Protein (g)"
            />
            <ProgressBar
              value={todayWaterMl}
              max={macroTargets.waterMl}
              color="cyan"
              label="Hydration (ml)"
            />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#F5F7F5] flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-[#40E0D0]" /> Recovery Status
            </h3>
            <button
              type="button"
              onClick={() => setActivePage('recovery')}
              className="text-xs text-[#40E0D0] hover:underline cursor-pointer"
            >
              Heatmap
            </button>
          </div>
          <div className="flex items-center justify-between bg-[#080B0D] border border-white/10 rounded-lg px-3.5 py-2.5 mb-3">
            <span className="text-xs text-[#A0AAA7]">Avg Estimated Readiness</span>
            <span className="text-base font-bold font-mono tabular-nums text-[#B7FF67]">
              {avgRecoveryPct}%
            </span>
          </div>
          <div className="space-y-2">
            {fatiguedMuscles.map((m) => (
              <div key={m.muscleId} className="flex items-center justify-between text-xs">
                <span className="text-[#F5F7F5] truncate pr-2">{m.muscleName}</span>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    m.recoveryPct >= 78
                      ? 'text-[#B7FF67]'
                      : m.recoveryPct >= 50
                        ? 'text-amber-300'
                        : 'text-red-400'
                  }`}
                >
                  {m.recoveryPct}% ({m.statusLabel})
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#F5F7F5] flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#B7FF67]" /> Intelligence Summary
            </h3>
            <p className="text-xs text-[#F5F7F5] leading-relaxed bg-[#080B0D] border border-white/10 rounded-lg p-3.5">
              {liveInsight}
            </p>
            {aiReport && (
              <div className="mt-3 p-3 rounded-lg bg-[#101619] border border-[#40E0D0]/30 text-xs text-[#F5F7F5] whitespace-pre-wrap max-h-40 overflow-y-auto">
                {aiReport}
              </div>
            )}
            {reportError && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                {reportError}
              </div>
            )}
          </div>

          <SecondaryButton
            onClick={handleGenerateAiReport}
            disabled={reportLoading}
            className="w-full mt-4 text-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#40E0D0]" />
            {reportLoading ? 'Generating Weekly AI Report...' : 'Generate Gemini Weekly Report'}
          </SecondaryButton>
        </Card>
      </div>
    </div>
  );
};
