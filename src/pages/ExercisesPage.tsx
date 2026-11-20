import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Dumbbell,
  Heart,
  Play,
  Scan,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useFitness } from '../context/FitnessContext';
import { EXERCISE_BY_ID, EXERCISE_CATEGORIES, EXERCISES } from '../data/exercises';
import { MUSCLE_BY_ID } from '../data/muscles';
import { api } from '../services/api';
import { Exercise, ExerciseCategory, ExperienceLevel } from '../types/fitness';
import {
  Card,
  EmptyState,
  ExercisePoseDiagram,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from '../components/ui/Primitives';

export const ExercisesPage: React.FC = () => {
  const {
    favoriteExerciseIds,
    refreshBootstrap,
    notify,
    startQuickWorkoutWithExercise,
    exerciseFilterMuscle,
    setExerciseFilterMuscle,
    setSelectedAnatomyMuscleId,
    setActivePage,
    sessions,
  } = useFitness();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | 'All'>('All');
  const [difficulty, setDifficulty] = useState<ExperienceLevel | 'all'>('all');
  const [location, setLocation] = useState<'all' | 'gym' | 'home' | 'both'>('all');
  const [equipmentFilter, setEquipmentFilter] = useState('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    if (exerciseFilterMuscle && EXERCISE_CATEGORIES.includes(exerciseFilterMuscle as ExerciseCategory)) {
      setCategory(exerciseFilterMuscle as ExerciseCategory);
      setExerciseFilterMuscle(null);
    }
  }, [exerciseFilterMuscle, setExerciseFilterMuscle]);

  const equipmentOptions = useMemo(() => {
    return Array.from(new Set(EXERCISES.map((e) => e.equipment))).sort();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EXERCISES.filter((ex) => {
      if (category !== 'All' && ex.category !== category) return false;
      if (difficulty !== 'all' && ex.difficulty !== difficulty) return false;
      if (location !== 'all' && ex.location !== location && ex.location !== 'both') return false;
      if (equipmentFilter !== 'all' && ex.equipment !== equipmentFilter) return false;
      if (favoritesOnly && !favoriteExerciseIds.includes(ex.id)) return false;
      if (q) {
        const muscleNames = [...ex.primaryMuscles, ...ex.secondaryMuscles]
          .map((id) => MUSCLE_BY_ID[id]?.name || id)
          .join(' ')
          .toLowerCase();
        const hay = `${ex.name} ${ex.category} ${ex.subGroup} ${ex.equipment} ${muscleNames}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [search, category, difficulty, location, equipmentFilter, favoritesOnly, favoriteExerciseIds]);

  const handleToggleFavorite = async (exerciseId: string) => {
    try {
      const res = await api.toggleFavorite(exerciseId);
      await refreshBootstrap();
      notify(res.favorited ? 'Added to favorites.' : 'Removed from favorites.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update favorite.', 'error');
    }
  };

  const selectedExerciseHistory = useMemo(() => {
    if (!selectedExercise) return [];
    const entries: Array<{ date: string; topWeightKg: number; bestReps: number; totalSets: number }> = [];
    for (const s of sessions) {
      for (const ex of s.exercises) {
        if (ex.exerciseId === selectedExercise.id) {
          const done = ex.sets.filter((st) => st.completed);
          if (done.length > 0) {
            const topWeightKg = Math.max(...done.map((st) => st.weightKg));
            const bestReps = Math.max(...done.map((st) => st.reps));
            entries.push({
              date: s.completedAt.slice(0, 10),
              topWeightKg,
              bestReps,
              totalSets: done.length,
            });
          }
        }
      }
    }
    return entries.slice(0, 6);
  }, [selectedExercise, sessions]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exercise Intelligence Library"
        subtitle={`Explore ${EXERCISES.length} biomechanically structured exercises with muscle links, safety cues, alternatives, and direct workout launch.`}
        actions={
          <div className="text-xs font-mono tabular-nums text-[#B7FF67] bg-[#101619] border border-white/10 px-3 py-2 rounded-lg">
            Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} matching
          </div>
        }
      />

      {/* Search & Filter Controls */}
      <Card className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-[#A0AAA7] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(24);
              }}
              placeholder="Search exercise, muscle, or equipment..."
              className="w-full bg-[#080B0D] border border-white/15 rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#F5F7F5] focus:outline-none focus:border-[#B7FF67]"
            />
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Filter by difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as ExperienceLevel | 'all')}
              className="w-full min-w-0 bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5]"
            >
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              aria-label="Filter by location"
              value={location}
              onChange={(e) => setLocation(e.target.value as 'all' | 'gym' | 'home' | 'both')}
              className="w-full min-w-0 bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5]"
            >
              <option value="all">Gym & Home</option>
              <option value="gym">Gym</option>
              <option value="home">Home</option>
            </select>
          </div>

          <div className="md:col-span-4 flex items-center gap-2 min-w-0">
            <select
              aria-label="Filter by equipment"
              value={equipmentFilter}
              onChange={(e) => setEquipmentFilter(e.target.value)}
              className="flex-1 min-w-0 bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5]"
            >
              <option value="all">All Equipment</option>
              {equipmentOptions.map((eq) => (
                <option key={eq} value={eq}>
                  {eq}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setFavoritesOnly((f) => !f)}
              title="Favorites Only"
              className={`px-3 py-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shrink-0 ${
                favoritesOnly
                  ? 'bg-red-500/15 border-red-400 text-red-300'
                  : 'bg-[#080B0D] border-white/15 text-[#A0AAA7]'
              }`}
            >
              <Heart className={`w-4 h-4 ${favoritesOnly ? 'fill-red-400 text-red-400' : ''}`} />
              Fav
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(['All', ...EXERCISE_CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setCategory(cat);
                setVisibleCount(24);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                category === cat
                  ? 'bg-[#B7FF67] text-[#080B0D] font-semibold'
                  : 'bg-[#080B0D] text-[#A0AAA7] hover:text-white border border-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </Card>

      {/* Exercise Cards Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No matching exercises found"
          description="Try clearing a filter or searching by muscle group such as Chest, Lats, or Quads."
          actionLabel="Reset Filters"
          onAction={() => {
            setSearch('');
            setCategory('All');
            setDifficulty('all');
            setLocation('all');
            setEquipmentFilter('all');
            setFavoritesOnly(false);
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.slice(0, visibleCount).map((ex) => {
              const isFav = favoriteExerciseIds.includes(ex.id);
              const primaryLabel = ex.primaryMuscles
                .map((id) => MUSCLE_BY_ID[id]?.name || id)
                .slice(0, 2)
                .join(', ');

              return (
                <Card key={ex.id} className="flex flex-col justify-between hover:border-white/25">
                  <div>
                    <ExercisePoseDiagram pose={ex.visualPose} label={ex.name} />
                    <div className="flex items-start justify-between gap-2 mt-3.5">
                      <div>
                        <div className="text-[11px] font-mono uppercase tracking-wider text-[#40E0D0]">
                          {ex.category} · {ex.difficulty}
                        </div>
                        <h3 className="text-base font-bold text-[#F5F7F5] mt-0.5">{ex.name}</h3>
                      </div>
                      <button
                        type="button"
                        aria-label={isFav ? 'Remove favorite' : 'Favorite exercise'}
                        onClick={() => handleToggleFavorite(ex.id)}
                        className="p-1.5 rounded-lg bg-[#080B0D] border border-white/10 text-[#A0AAA7] hover:text-red-400 cursor-pointer shrink-0"
                      >
                        <Heart
                          className={`w-4 h-4 ${isFav ? 'fill-red-400 text-red-400' : ''}`}
                        />
                      </button>
                    </div>
                    <p className="text-xs text-[#A0AAA7] mt-1.5">
                      Primary: <span className="text-[#F5F7F5]">{primaryLabel}</span>
                    </p>
                    <p className="text-xs text-[#A0AAA7] mt-0.5">
                      Equipment: {ex.equipment} · {ex.setsGuidance} × {ex.repsGuidance}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10">
                    <SecondaryButton
                      type="button"
                      onClick={() => setSelectedExercise(ex)}
                      className="flex-1 text-xs py-2"
                    >
                      Inspect Guide
                    </SecondaryButton>
                    <PrimaryButton
                      type="button"
                      onClick={() => startQuickWorkoutWithExercise(ex.id)}
                      className="text-xs py-2 px-3"
                    >
                      <Play className="w-3.5 h-3.5" /> Train
                    </PrimaryButton>
                  </div>
                </Card>
              );
            })}
          </div>

          {visibleCount < filtered.length && (
            <div className="flex justify-center pt-2">
              <SecondaryButton onClick={() => setVisibleCount((c) => c + 24)}>
                Load More Exercises ({filtered.length - visibleCount} remaining)
              </SecondaryButton>
            </div>
          )}
        </>
      )}

      {/* Exercise Detail Modal */}
      {selectedExercise && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={selectedExercise.name}
        >
          <div className="bg-[#101619] border border-white/15 rounded-2xl max-w-3xl w-full p-6 sm:p-8 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-[#40E0D0]">
                  {selectedExercise.category} · {selectedExercise.workoutType} ·{' '}
                  {selectedExercise.difficulty}
                </div>
                <h2 className="text-2xl font-bold text-[#F5F7F5] mt-1">{selectedExercise.name}</h2>
                <p className="text-xs text-[#A0AAA7] mt-1">
                  Equipment: {selectedExercise.equipment} · Location: {selectedExercise.location}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close exercise guide"
                onClick={() => setSelectedExercise(null)}
                className="p-2 rounded-lg text-[#A0AAA7] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
              <div className="space-y-4">
                <ExercisePoseDiagram
                  pose={selectedExercise.visualPose}
                  label={selectedExercise.name}
                />

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-[#080B0D] border border-white/10 rounded-lg p-2.5">
                    <div className="text-[#A0AAA7]">Sets</div>
                    <div className="font-mono font-semibold text-[#B7FF67] mt-0.5">
                      {selectedExercise.setsGuidance}
                    </div>
                  </div>
                  <div className="bg-[#080B0D] border border-white/10 rounded-lg p-2.5">
                    <div className="text-[#A0AAA7]">Reps</div>
                    <div className="font-mono font-semibold text-[#F5F7F5] mt-0.5">
                      {selectedExercise.repsGuidance}
                    </div>
                  </div>
                  <div className="bg-[#080B0D] border border-white/10 rounded-lg p-2.5">
                    <div className="text-[#A0AAA7]">Rest</div>
                    <div className="font-mono font-semibold text-[#40E0D0] mt-0.5">
                      {selectedExercise.restSeconds}s
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-[#F5F7F5] mb-2">
                    Target Muscles (Click to inspect in 3D)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedExercise.primaryMuscles.map((mId) => (
                      <button
                        key={mId}
                        type="button"
                        onClick={() => {
                          setSelectedAnatomyMuscleId(mId);
                          setSelectedExercise(null);
                          setActivePage('anatomy');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#B7FF67]/15 border border-[#B7FF67]/40 text-xs text-[#B7FF67] cursor-pointer"
                      >
                        <Scan className="w-3 h-3" /> {MUSCLE_BY_ID[mId]?.name || mId}
                      </button>
                    ))}
                    {selectedExercise.secondaryMuscles.map((mId) => (
                      <button
                        key={mId}
                        type="button"
                        onClick={() => {
                          setSelectedAnatomyMuscleId(mId);
                          setSelectedExercise(null);
                          setActivePage('anatomy');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#080B0D] border border-white/15 text-xs text-[#A0AAA7] hover:text-[#40E0D0] cursor-pointer"
                      >
                        {MUSCLE_BY_ID[mId]?.name || mId}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#080B0D] border border-white/10 rounded-xl p-3 text-xs space-y-1.5">
                  <div className="font-semibold text-[#40E0D0]">Breathing Cue</div>
                  <p className="text-[#A0AAA7]">{selectedExercise.breathing}</p>
                </div>
              </div>

              <div className="space-y-4 text-xs leading-relaxed">
                <div>
                  <div className="font-semibold text-[#F5F7F5] mb-1">Starting Position</div>
                  <p className="text-[#A0AAA7]">{selectedExercise.startingPosition}</p>
                </div>

                <div>
                  <div className="font-semibold text-[#F5F7F5] mb-1.5">Execution Steps</div>
                  <ol className="list-decimal list-inside space-y-1 text-[#A0AAA7]">
                    {selectedExercise.steps.map((st, idx) => (
                      <li key={idx}>{st}</li>
                    ))}
                  </ol>
                </div>

                <div>
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5 mb-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> Common Mistakes & Safety
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[#A0AAA7]">
                    {selectedExercise.commonMistakes.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                    {selectedExercise.safetyTips.map((t, idx) => (
                      <li key={`tip-${idx}`} className="text-[#F5F7F5]/90">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>

                {selectedExercise.alternatives.length > 0 && (
                  <div>
                    <div className="font-semibold text-[#F5F7F5] mb-1.5">Alternatives</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedExercise.alternatives.map((altId) => {
                        const alt = EXERCISE_BY_ID[altId];
                        if (!alt) return null;
                        return (
                          <button
                            key={altId}
                            type="button"
                            onClick={() => setSelectedExercise(alt)}
                            className="px-2.5 py-1 rounded-lg bg-[#080B0D] border border-white/15 text-[#40E0D0] hover:border-[#40E0D0] cursor-pointer"
                          >
                            {alt.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedExerciseHistory.length > 0 && (
                  <div>
                    <div className="font-semibold text-[#B7FF67] flex items-center gap-1.5 mb-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Your Recent History
                    </div>
                    <div className="space-y-1">
                      {selectedExerciseHistory.map((h, i) => (
                        <div
                          key={i}
                          className="flex justify-between bg-[#080B0D] border border-white/10 rounded px-2.5 py-1.5 font-mono tabular-nums"
                        >
                          <span className="text-[#A0AAA7]">{h.date}</span>
                          <span className="text-[#F5F7F5]">
                            {h.topWeightKg} kg × {h.bestReps} reps ({h.totalSets} sets)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
              <SecondaryButton onClick={() => setSelectedExercise(null)}>Close</SecondaryButton>
              <PrimaryButton
                onClick={() => {
                  const id = selectedExercise.id;
                  setSelectedExercise(null);
                  startQuickWorkoutWithExercise(id);
                }}
              >
                <Dumbbell className="w-4 h-4" /> Add to Live Workout
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
