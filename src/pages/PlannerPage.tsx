import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  Edit3,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useFitness } from '../context/FitnessContext';
import { EXERCISES, EXERCISE_BY_ID } from '../data/exercises';
import { api, ApiError } from '../services/api';
import { PlannedExercise, WorkoutPlan } from '../types/fitness';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from '../components/ui/Primitives';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CURATED_TEMPLATES: Array<{
  label: string;
  level: string;
  splitType: WorkoutPlan['splitType'];
  name: string;
  dayOfWeek: number;
  notes: string;
  exerciseIds: string[];
}> = [
  {
    label: 'Beginner Full Body Foundation',
    level: 'Beginner',
    splitType: 'Full Body',
    name: 'Full Body Foundation A',
    dayOfWeek: 1,
    notes: 'Balanced compound movement pattern template for beginners.',
    exerciseIds: [
      'goblet-squat',
      'flat-dumbbell-press',
      'chest-supported-dumbbell-row',
      'dumbbell-shoulder-press',
      'dead-bug',
    ],
  },
  {
    label: 'Intermediate Upper Strength',
    level: 'Intermediate',
    splitType: 'Upper/Lower',
    name: 'Upper Body Power & Hypertrophy',
    dayOfWeek: 2,
    notes: 'Upper push-pull strength template.',
    exerciseIds: [
      'barbell-bench-press',
      'wide-grip-lat-pulldown',
      'incline-dumbbell-press',
      'cable-face-pull',
      'ez-bar-biceps-curl',
      'rope-triceps-pushdown',
    ],
  },
  {
    label: 'Advanced Lower Body Posterior',
    level: 'Advanced',
    splitType: 'PPL',
    name: 'Lower Body Squat & Hinge',
    dayOfWeek: 4,
    notes: 'High-stimulus lower-body strength day.',
    exerciseIds: [
      'barbell-back-squat',
      'romanian-deadlift',
      'bulgarian-split-squat',
      'seated-leg-curl',
      'standing-calf-raise',
    ],
  },
];

export const PlannerPage: React.FC = () => {
  const { plans, refreshBootstrap, notify, startWorkoutFromPlan } = useFitness();

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');
  const [splitType, setSplitType] = useState<WorkoutPlan['splitType']>('PPL');
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [plannedExercises, setPlannedExercises] = useState<PlannedExercise[]>([]);
  const [exSearch, setExSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // AI Plan Generator state
  const [aiSplit, setAiSplit] = useState<WorkoutPlan['splitType']>('PPL');
  const [aiFocus, setAiFocus] = useState('');
  const [aiDay, setAiDay] = useState<number>(new Date().getDay());
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<WorkoutPlan | null>(null);

  const filteredExercisePicker = useMemo(() => {
    const q = exSearch.trim().toLowerCase();
    return EXERCISES.filter(
      (e) =>
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q)
    ).slice(0, 12);
  }, [exSearch]);

  const openCreateModal = (defaultDay = 1) => {
    setEditingPlanId(null);
    setPlanName('');
    setSplitType('Custom');
    setDayOfWeek(defaultDay);
    setNotes('');
    setPlannedExercises([]);
    setBuilderOpen(true);
  };

  const openEditModal = (plan: WorkoutPlan) => {
    setEditingPlanId(plan.id);
    setPlanName(plan.name);
    setSplitType(plan.splitType);
    setDayOfWeek(plan.dayOfWeek);
    setNotes(plan.notes);
    setPlannedExercises(plan.exercises.map((e) => ({ ...e })));
    setBuilderOpen(true);
  };

  const addExerciseToPlan = (exerciseId: string) => {
    const ex = EXERCISE_BY_ID[exerciseId];
    if (!ex) return;
    setPlannedExercises((prev) => [
      ...prev,
      {
        exerciseId: ex.id,
        exerciseName: ex.name,
        targetSets: 3,
        targetReps: ex.repsGuidance || '8-12',
        targetWeightKg: ex.equipment === 'Bodyweight' ? 0 : 20,
        restSeconds: ex.restSeconds || 90,
      },
    ]);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim() || plannedExercises.length === 0) {
      notify('Enter a plan name and add at least one exercise.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingPlanId) {
        await api.updatePlan(editingPlanId, {
          name: planName.trim(),
          splitType,
          dayOfWeek,
          exercises: plannedExercises,
          notes,
        });
        notify('Workout plan updated.', 'success');
      } else {
        await api.createPlan({
          name: planName.trim(),
          splitType,
          dayOfWeek,
          exercises: plannedExercises,
          notes,
        });
        notify('Workout plan created.', 'success');
      }
      await refreshBootstrap();
      setBuilderOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save plan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyTemplate = async (tpl: (typeof CURATED_TEMPLATES)[number]) => {
    const exercises: PlannedExercise[] = tpl.exerciseIds
      .map((id) => EXERCISE_BY_ID[id])
      .filter(Boolean)
      .map((ex) => ({
        exerciseId: ex.id,
        exerciseName: ex.name,
        targetSets: 3,
        targetReps: ex.repsGuidance,
        targetWeightKg: ex.equipment === 'Bodyweight' ? 0 : 20,
        restSeconds: ex.restSeconds,
      }));
    try {
      await api.createPlan({
        name: tpl.name,
        splitType: tpl.splitType,
        dayOfWeek: tpl.dayOfWeek,
        exercises,
        notes: tpl.notes,
      });
      await refreshBootstrap();
      notify(`Template "${tpl.name}" added to ${WEEKDAYS[tpl.dayOfWeek]}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to apply template.', 'error');
    }
  };

  const handleAiGeneratePlan = async () => {
    setAiGenerating(true);
    setAiError(null);
    try {
      const generated = await api.aiGeneratePlan({ splitType: aiSplit, focusNotes: aiFocus });
      await api.createPlan({
        name: generated.name,
        splitType: aiSplit,
        dayOfWeek: aiDay,
        exercises: generated.exercises,
        notes: generated.notes,
        isAiGenerated: true,
      });
      await refreshBootstrap();
      notify(`AI Plan "${generated.name}" saved to ${WEEKDAYS[aiDay]}.`, 'success');
    } catch (err) {
      setAiError(
        err instanceof ApiError
          ? err.message
          : 'Failed to generate AI plan. Verify Gemini API configuration.'
      );
    } finally {
      setAiGenerating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deletePlan(deleteTarget.id);
      await refreshBootstrap();
      notify('Workout plan deleted.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete plan.', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workout Planner & Split Architect"
        subtitle="Organize your weekly training calendar, deploy beginner-to-advanced templates, build custom workouts, or generate adaptive plans with Gemini."
        actions={
          <PrimaryButton onClick={() => openCreateModal(new Date().getDay())}>
            <Plus className="w-4 h-4" /> Create Custom Plan
          </PrimaryButton>
        }
      />

      {/* AI Plan Generator + Curated Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F7F5]">
            <Sparkles className="w-4 h-4 text-[#B7FF67]" /> Gemini AI Workout Plan Generator
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#A0AAA7] mb-1">Split Style</label>
              <select
                value={aiSplit}
                onChange={(e) => setAiSplit(e.target.value as WorkoutPlan['splitType'])}
                className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-sm text-[#F5F7F5]"
              >
                <option value="PPL">Push / Pull / Legs</option>
                <option value="Upper/Lower">Upper / Lower</option>
                <option value="Full Body">Full Body</option>
                <option value="Bro Split">Body-Part Split</option>
                <option value="Custom">Custom Focus</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#A0AAA7] mb-1">Target Weekday</label>
              <select
                value={aiDay}
                onChange={(e) => setAiDay(Number(e.target.value))}
                className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-sm text-[#F5F7F5]"
              >
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#A0AAA7] mb-1">
              Focus Notes (Optional)
            </label>
            <input
              type="text"
              value={aiFocus}
              onChange={(e) => setAiFocus(e.target.value)}
              placeholder="e.g., Emphasize upper chest and rear delts, knee-friendly"
              className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-sm text-[#F5F7F5]"
            />
          </div>
          {aiError && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
              {aiError}
            </div>
          )}
          <PrimaryButton onClick={handleAiGeneratePlan} loading={aiGenerating} className="w-full">
            <Sparkles className="w-4 h-4" /> Generate & Save AI Plan
          </PrimaryButton>
        </Card>

        <Card className="lg:col-span-6 space-y-3">
          <div className="text-sm font-semibold text-[#F5F7F5]">
            Quick-Deploy Split Templates
          </div>
          <div className="space-y-2.5">
            {CURATED_TEMPLATES.map((tpl) => (
              <div
                key={tpl.label}
                className="flex flex-wrap items-center justify-between gap-2 bg-[#080B0D] border border-white/10 rounded-xl px-3.5 py-2.5"
              >
                <div>
                  <div className="text-xs font-semibold text-[#F5F7F5]">{tpl.label}</div>
                  <div className="text-[11px] text-[#A0AAA7]">
                    {tpl.level} · {tpl.splitType} · {tpl.exerciseIds.length} exercises
                  </div>
                </div>
                <SecondaryButton
                  type="button"
                  onClick={() => handleApplyTemplate(tpl)}
                  className="text-xs py-1.5 px-3"
                >
                  <Plus className="w-3.5 h-3.5" /> Add to {WEEKDAYS[tpl.dayOfWeek].slice(0, 3)}
                </SecondaryButton>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Weekly Calendar Grid */}
      {plans.length === 0 ? (
        <EmptyState
          title="Your weekly training calendar is empty"
          description="Deploy a template above, generate an AI workout, or build a custom plan from 181 exercises."
          actionLabel="Create First Plan"
          onAction={() => openCreateModal(1)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {WEEKDAYS.map((dayName, dayIdx) => {
            const dayPlans = plans.filter((p) => p.dayOfWeek === dayIdx);
            return (
              <Card key={dayName} className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
                    <span className="text-sm font-bold text-[#F5F7F5] flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-[#40E0D0]" /> {dayName}
                    </span>
                    <button
                      type="button"
                      onClick={() => openCreateModal(dayIdx)}
                      aria-label={`Add plan on ${dayName}`}
                      className="text-xs text-[#B7FF67] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>

                  {dayPlans.length === 0 ? (
                    <p className="text-xs text-[#A0AAA7] py-4">Rest / Active Recovery Day</p>
                  ) : (
                    <div className="space-y-3">
                      {dayPlans.map((plan) => (
                        <div
                          key={plan.id}
                          className="bg-[#080B0D] border border-white/10 rounded-xl p-3.5 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-[#F5F7F5]">
                                {plan.name}
                              </div>
                              <div className="text-[11px] text-[#40E0D0]">
                                {plan.splitType} · {plan.exercises.length} exercises
                                {plan.isAiGenerated ? ' · AI' : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label="Edit workout plan"
                                onClick={() => openEditModal(plan)}
                                className="p-1.5 text-[#A0AAA7] hover:text-white cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label="Delete workout plan"
                                onClick={() => setDeleteTarget(plan)}
                                className="p-1.5 text-[#A0AAA7] hover:text-red-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <ul className="space-y-1 text-xs text-[#A0AAA7]">
                            {plan.exercises.slice(0, 4).map((ex, i) => (
                              <li key={i} className="flex justify-between">
                                <span className="truncate pr-2">{ex.exerciseName}</span>
                                <span className="font-mono tabular-nums shrink-0">
                                  {ex.targetSets}×{ex.targetReps}
                                </span>
                              </li>
                            ))}
                            {plan.exercises.length > 4 && (
                              <li className="text-[11px] text-[#40E0D0]">
                                +{plan.exercises.length - 4} more exercises
                              </li>
                            )}
                          </ul>

                          <PrimaryButton
                            type="button"
                            onClick={() => startWorkoutFromPlan(plan)}
                            className="w-full py-2 text-xs"
                          >
                            <Play className="w-3.5 h-3.5" /> Start Live Session
                          </PrimaryButton>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Custom Plan Builder Modal */}
      {builderOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSavePlan}
            className="bg-[#101619] border border-white/15 rounded-2xl max-w-3xl w-full p-6 my-auto max-h-[90vh] overflow-y-auto space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-bold text-[#F5F7F5]">
                {editingPlanId ? 'Edit Workout Plan' : 'Create Workout Plan'}
              </h2>
              <button
                type="button"
                onClick={() => setBuilderOpen(false)}
                className="p-1 text-[#A0AAA7] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs text-[#A0AAA7] mb-1">Plan Name</label>
                <input
                  type="text"
                  required
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Push Day Hypertrophy"
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-sm text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#A0AAA7] mb-1">Split Type</label>
                <select
                  value={splitType}
                  onChange={(e) => setSplitType(e.target.value as WorkoutPlan['splitType'])}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-sm text-[#F5F7F5]"
                >
                  <option value="PPL">PPL</option>
                  <option value="Upper/Lower">Upper/Lower</option>
                  <option value="Full Body">Full Body</option>
                  <option value="Bro Split">Bro Split</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#A0AAA7] mb-1">Weekday</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-sm text-[#F5F7F5]"
                >
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Exercise Picker */}
            <div className="bg-[#080B0D] border border-white/10 rounded-xl p-3 space-y-2">
              <div className="text-xs font-semibold text-[#40E0D0]">Add Exercises</div>
              <input
                type="text"
                value={exSearch}
                onChange={(e) => setExSearch(e.target.value)}
                placeholder="Search 181 exercises to add..."
                className="w-full bg-[#101619] border border-white/10 rounded-lg px-3 py-2 text-xs text-[#F5F7F5]"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                {filteredExercisePicker.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => addExerciseToPlan(ex.id)}
                    className="flex items-center justify-between text-left px-2.5 py-1.5 rounded-lg bg-[#151D20] hover:border-[#B7FF67] border border-white/10 text-xs cursor-pointer"
                  >
                    <span className="truncate pr-2">{ex.name}</span>
                    <Plus className="w-3.5 h-3.5 text-[#B7FF67] shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Exercises */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#F5F7F5]">
                Plan Exercises ({plannedExercises.length})
              </div>
              {plannedExercises.map((pe, idx) => (
                <div
                  key={`${pe.exerciseId}-${idx}`}
                  className="grid grid-cols-12 gap-2 items-center bg-[#080B0D] border border-white/10 rounded-lg p-2.5 text-xs"
                >
                  <div className="col-span-12 sm:col-span-4 font-medium truncate">
                    {pe.exerciseName}
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <label className="text-[10px] text-[#A0AAA7] block">Sets</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={pe.targetSets}
                      onChange={(e) =>
                        setPlannedExercises((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, targetSets: Number(e.target.value) || 1 } : item
                          )
                        )
                      }
                      className="w-full bg-[#101619] border border-white/15 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="text-[10px] text-[#A0AAA7] block">Reps</label>
                    <input
                      type="text"
                      value={pe.targetReps}
                      onChange={(e) =>
                        setPlannedExercises((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, targetReps: e.target.value } : item
                          )
                        )
                      }
                      className="w-full bg-[#101619] border border-white/15 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    <label className="text-[10px] text-[#A0AAA7] block">Target kg</label>
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={pe.targetWeightKg}
                      onChange={(e) =>
                        setPlannedExercises((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, targetWeightKg: Number(e.target.value) || 0 }
                              : item
                          )
                        )
                      }
                      className="w-full bg-[#101619] border border-white/15 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        setPlannedExercises((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <SecondaryButton type="button" onClick={() => setBuilderOpen(false)}>
                Cancel
              </SecondaryButton>
              <PrimaryButton type="submit" loading={saving}>
                Save Workout Plan
              </PrimaryButton>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Workout Plan?"
        message={`Remove "${deleteTarget?.name}" from your weekly training calendar? Past completed sessions will remain in your history.`}
        confirmLabel="Delete Plan"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
