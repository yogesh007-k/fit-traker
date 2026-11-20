import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Dumbbell,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  SkipForward,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { useFitness } from '../context/FitnessContext';
import { EXERCISES, EXERCISE_BY_ID } from '../data/exercises';
import { api } from '../services/api';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from '../components/ui/Primitives';

function formatTimer(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const LiveWorkoutPage: React.FC = () => {
  const {
    plans,
    sessions,
    activeWorkout,
    setActiveWorkout,
    startWorkoutFromPlan,
    startQuickWorkoutWithExercise,
    personalRecords,
    refreshBootstrap,
    notify,
    setActivePage,
  } = useFitness();

  const [restPresetSec, setRestPresetSec] = useState(90);
  const [restRemainingSec, setRestRemainingSec] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [addExSearch, setAddExSearch] = useState('');
  const [showAddEx, setShowAddEx] = useState(false);

  // Rest countdown ticker
  useEffect(() => {
    if (restRemainingSec <= 0) return;
    const id = window.setInterval(() => {
      setRestRemainingSec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [restRemainingSec > 0]);

  const prMap = useMemo(
    () => Object.fromEntries(personalRecords.map((p) => [p.exerciseId, p])),
    [personalRecords]
  );

  const filteredAddExercises = useMemo(() => {
    const q = addExSearch.trim().toLowerCase();
    return EXERCISES.filter(
      (e) => !q || e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [addExSearch]);

  const startFreestyleWorkout = () => {
    setActiveWorkout({
      planId: null,
      title: 'Freestyle Training Session',
      startedAt: new Date().toISOString(),
      elapsedSec: 0,
      isPaused: false,
      notes: '',
      exercises: [],
    });
    setShowAddEx(true);
  };

  const toggleSetCompleted = (exIdx: number, setIdx: number) => {
    if (!activeWorkout) return;
    const targetSet = activeWorkout.exercises[exIdx]?.sets[setIdx];
    const willComplete = targetSet ? !targetSet.completed : false;

    setActiveWorkout((prev) => {
      if (!prev) return prev;
      const nextExercises = prev.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((st, j) =>
            j === setIdx ? { ...st, completed: !st.completed } : st
          ),
        };
      });
      return { ...prev, exercises: nextExercises };
    });

    if (willComplete) {
      setRestRemainingSec(restPresetSec);
    }
  };

  const updateSetField = (
    exIdx: number,
    setIdx: number,
    field: 'reps' | 'weightKg',
    val: number
  ) => {
    setActiveWorkout((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex, i) =>
          i !== exIdx
            ? ex
            : {
                ...ex,
                sets: ex.sets.map((st, j) =>
                  j === setIdx ? { ...st, [field]: Math.max(0, val) } : st
                ),
              }
        ),
      };
    });
  };

  const addSetToExercise = (exIdx: number) => {
    setActiveWorkout((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex, i) => {
          if (i !== exIdx) return ex;
          const last = ex.sets[ex.sets.length - 1] || { reps: 10, weightKg: 20 };
          return {
            ...ex,
            sets: [
              ...ex.sets,
              {
                setNumber: ex.sets.length + 1,
                reps: last.reps,
                weightKg: last.weightKg,
                completed: false,
              },
            ],
          };
        }),
      };
    });
  };

  const removeExercise = (exIdx: number) => {
    setActiveWorkout((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.filter((_, i) => i !== exIdx),
      };
    });
  };

  const handleFinishSession = async () => {
    if (!activeWorkout) return;
    const completedCount = activeWorkout.exercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.completed && s.reps > 0).length,
      0
    );
    if (completedCount === 0) {
      notify('Check off at least one completed set before saving.', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await api.createSession({
        planId: activeWorkout.planId,
        title: activeWorkout.title,
        startedAt: activeWorkout.startedAt,
        durationSec: Math.max(60, activeWorkout.elapsedSec),
        exercises: activeWorkout.exercises,
        notes: activeWorkout.notes,
      });
      setActiveWorkout(null);
      setRestRemainingSec(0);
      await refreshBootstrap();
      notify(
        `Session saved! +${res.session.xpEarned} XP · ${res.session.totalVolumeKg.toLocaleString()} kg volume.`,
        'success'
      );
      setActivePage('overview');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save session.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!activeWorkout) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Live Workout Control Center"
          subtitle="Start a scheduled split or launch a freestyle session with real-time rest timers, volume tracking, and PR detection."
          actions={
            <PrimaryButton onClick={startFreestyleWorkout}>
              <Play className="w-4 h-4" /> Start Freestyle Workout
            </PrimaryButton>
          }
        />

        {plans.length === 0 ? (
          <EmptyState
            title="No scheduled plans yet"
            description="Start a freestyle workout right now or create a structured weekly split in the Workout Planner."
            actionLabel="Start Freestyle Workout"
            onAction={startFreestyleWorkout}
          />
        ) : (
          <div>
            <h2 className="text-base font-semibold text-[#F5F7F5] mb-3">
              Launch From Your Saved Plans
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((p) => (
                <Card key={p.id} className="flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-mono text-[#40E0D0]">{p.splitType}</div>
                    <h3 className="text-base font-bold text-[#F5F7F5] mt-1">{p.name}</h3>
                    <p className="text-xs text-[#A0AAA7] mt-1">
                      {p.exercises.length} exercises queued
                    </p>
                  </div>
                  <PrimaryButton
                    onClick={() => startWorkoutFromPlan(p)}
                    className="w-full mt-4 text-xs"
                  >
                    <Play className="w-3.5 h-3.5" /> Start Session
                  </PrimaryButton>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Recent Completed Sessions */}
        <Card>
          <h2 className="text-base font-semibold text-[#F5F7F5] mb-3">
            Completed Session Log ({sessions.length})
          </h2>
          {sessions.length === 0 ? (
            <p className="text-xs text-[#A0AAA7]">No completed workouts logged yet.</p>
          ) : (
            <div className="space-y-2.5">
              {sessions.slice(0, 8).map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 bg-[#080B0D] border border-white/10 rounded-xl px-4 py-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-[#F5F7F5]">{s.title}</div>
                    <div className="text-[#A0AAA7] mt-0.5">
                      {s.completedAt.slice(0, 10)} · {Math.round(s.durationSec / 60)} min ·{' '}
                      {s.totalSets} sets
                    </div>
                  </div>
                  <div className="flex items-center gap-4 font-mono tabular-nums">
                    <span className="text-[#40E0D0]">
                      {s.totalVolumeKg.toLocaleString()} kg
                    </span>
                    <span className="text-[#B7FF67] font-semibold">+{s.xpEarned} XP</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  const liveStats = activeWorkout.exercises.reduce(
    (acc, ex) => {
      for (const st of ex.sets) {
        if (st.completed && st.reps > 0) {
          acc.sets += 1;
          acc.volume += st.reps * st.weightKg;
        }
      }
      return acc;
    },
    { sets: 0, volume: 0 }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={activeWorkout.title}
        subtitle="Session state persists across page reloads until you Finish & Save or Cancel."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SecondaryButton
              type="button"
              onClick={() =>
                setActiveWorkout((prev) =>
                  prev ? { ...prev, isPaused: !prev.isPaused } : prev
                )
              }
            >
              {activeWorkout.isPaused ? (
                <>
                  <Play className="w-4 h-4 text-[#B7FF67]" /> Resume
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 text-amber-300" /> Pause
                </>
              )}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => setConfirmCancelOpen(true)}
              className="border-red-500/30 text-red-300 hover:border-red-400 hover:text-red-200"
            >
              <X className="w-4 h-4" /> Cancel
            </SecondaryButton>
            <PrimaryButton type="button" onClick={handleFinishSession} loading={saving}>
              <Save className="w-4 h-4" /> Finish & Save
            </PrimaryButton>
          </div>
        }
      />

      {/* Live Telemetry & Rest Timer Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-[#A0AAA7]">Elapsed Time</div>
            <div className="text-3xl font-bold font-mono tabular-nums text-[#B7FF67] mt-0.5">
              {formatTimer(activeWorkout.elapsedSec)}
            </div>
            <div className="text-[11px] text-[#A0AAA7] mt-0.5">
              {activeWorkout.isPaused ? 'Timer paused' : 'Live session running'}
            </div>
          </div>
          <div className="flex gap-5 text-right font-mono tabular-nums">
            <div>
              <div className="text-xs text-[#A0AAA7]">Sets Done</div>
              <div className="text-xl font-bold text-[#F5F7F5]">{liveStats.sets}</div>
            </div>
            <div>
              <div className="text-xs text-[#A0AAA7]">Live Volume</div>
              <div className="text-xl font-bold text-[#40E0D0]">
                {Math.round(liveStats.volume).toLocaleString()} kg
              </div>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-[#40E0D0]" />
            <div>
              <div className="text-xs text-[#A0AAA7]">Rest Countdown</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#F5F7F5]">
                {restRemainingSec > 0 ? formatTimer(restRemainingSec) : 'Ready'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[30, 60, 90, 120].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => {
                  setRestPresetSec(sec);
                  setRestRemainingSec(sec);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono cursor-pointer ${
                  restPresetSec === sec
                    ? 'bg-[#40E0D0] text-[#080B0D] font-bold'
                    : 'bg-[#080B0D] text-[#A0AAA7] border border-white/10'
                }`}
              >
                {sec}s
              </button>
            ))}
            {restRemainingSec > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setRestRemainingSec((s) => s + 15)}
                  className="px-2 py-1.5 rounded-lg bg-[#080B0D] border border-white/10 text-xs text-[#B7FF67] cursor-pointer"
                >
                  +15s
                </button>
                <button
                  type="button"
                  onClick={() => setRestRemainingSec(0)}
                  className="px-2 py-1.5 rounded-lg bg-[#080B0D] border border-white/10 text-xs text-[#A0AAA7] cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Exercise Checklists */}
      <div className="space-y-4">
        {activeWorkout.exercises.map((ex, exIdx) => {
          const prevPr = prMap[ex.exerciseId];
          return (
            <Card key={`${ex.exerciseId}-${exIdx}`} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-bold text-[#F5F7F5] flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-[#B7FF67]" /> {ex.exerciseName}
                  </h3>
                  {prevPr && (
                    <div className="text-xs text-[#40E0D0] flex items-center gap-1 mt-0.5 font-mono">
                      <Trophy className="w-3.5 h-3.5" /> Current Best PR: {prevPr.maxWeightKg} kg
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <SecondaryButton
                    type="button"
                    onClick={() => addSetToExercise(exIdx)}
                    className="text-xs py-1.5 px-3"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Set
                  </SecondaryButton>
                  <button
                    type="button"
                    aria-label="Remove exercise"
                    onClick={() => removeExercise(exIdx)}
                    className="p-2 text-[#A0AAA7] hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {ex.sets.map((st, setIdx) => {
                  const isPotentialPr =
                    st.completed &&
                    prevPr &&
                    st.weightKg > prevPr.maxWeightKg &&
                    st.reps > 0;

                  return (
                    <div
                      key={st.setNumber}
                      className={`grid grid-cols-12 gap-2 items-center rounded-xl px-3 py-2 border text-xs ${
                        st.completed
                          ? 'bg-[#B7FF67]/10 border-[#B7FF67]/40'
                          : 'bg-[#080B0D] border-white/10'
                      }`}
                    >
                      <div className="col-span-2 font-mono font-bold text-[#A0AAA7]">
                        SET {st.setNumber}
                      </div>
                      <div className="col-span-4">
                        <label className="text-[10px] text-[#A0AAA7] block">Weight (kg)</label>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={st.weightKg}
                          onChange={(e) =>
                            updateSetField(exIdx, setIdx, 'weightKg', Number(e.target.value))
                          }
                          className="w-full bg-[#101619] border border-white/15 rounded px-2 py-1.5 font-mono tabular-nums text-[#F5F7F5]"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] text-[#A0AAA7] block">Reps</label>
                        <input
                          type="number"
                          min={0}
                          value={st.reps}
                          onChange={(e) =>
                            updateSetField(exIdx, setIdx, 'reps', Number(e.target.value))
                          }
                          className="w-full bg-[#101619] border border-white/15 rounded px-2 py-1.5 font-mono tabular-nums text-[#F5F7F5]"
                        />
                      </div>
                      <div className="col-span-3 flex items-center justify-end gap-2 pt-3">
                        {isPotentialPr && (
                          <span className="text-[11px] font-mono font-bold text-[#B7FF67]">
                            PR!
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleSetCompleted(exIdx, setIdx)}
                          aria-label={st.completed ? 'Mark set incomplete' : 'Complete set'}
                          className={`px-3 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1 cursor-pointer ${
                            st.completed
                              ? 'bg-[#B7FF67] text-[#080B0D]'
                              : 'bg-[#151D20] text-[#F5F7F5] border border-white/15 hover:border-[#B7FF67]'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {st.completed ? 'Done' : 'Log'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}

        {/* Add Exercise Drawer */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#F5F7F5]">Add Exercise to Session</span>
            <SecondaryButton
              type="button"
              onClick={() => setShowAddEx((s) => !s)}
              className="text-xs py-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> {showAddEx ? 'Hide Picker' : 'Browse Exercises'}
            </SecondaryButton>
          </div>
          {showAddEx && (
            <div className="space-y-2.5">
              <input
                type="text"
                value={addExSearch}
                onChange={(e) => setAddExSearch(e.target.value)}
                placeholder="Search 181 exercises..."
                className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-xs text-[#F5F7F5]"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredAddExercises.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => {
                      const full = EXERCISE_BY_ID[ex.id];
                      if (!full) return;
                      startQuickWorkoutWithExercise(full.id);
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#080B0D] border border-white/10 hover:border-[#B7FF67] text-xs text-left cursor-pointer"
                  >
                    <span className="truncate pr-2">{ex.name}</span>
                    <Plus className="w-3.5 h-3.5 text-[#B7FF67] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-[#A0AAA7] mb-1">Session Notes</label>
            <textarea
              rows={2}
              value={activeWorkout.notes}
              onChange={(e) =>
                setActiveWorkout((prev) =>
                  prev ? { ...prev, notes: e.target.value } : prev
                )
              }
              placeholder="How did bar speed, grip, or joint comfort feel today?"
              className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-xs text-[#F5F7F5]"
            />
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmCancelOpen}
        title="Discard Active Workout?"
        message="This will end your live session without saving sets or XP."
        confirmLabel="Discard Session"
        danger
        onConfirm={() => {
          setActiveWorkout(null);
          setRestRemainingSec(0);
          setConfirmCancelOpen(false);
          notify('Active workout discarded.', 'info');
        }}
        onCancel={() => setConfirmCancelOpen(false)}
      />
    </div>
  );
};
