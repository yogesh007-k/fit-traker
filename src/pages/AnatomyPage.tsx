import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BookOpen,
  Dumbbell,
  History,
  Layers,
  Play,
} from 'lucide-react';
import { useFitness } from '../context/FitnessContext';
import { MUSCLE_BY_ID, MUSCLES } from '../data/muscles';
import { getExercisesForMuscle } from '../data/exercises';
import {
  Anatomy3DCanvas,
  AnatomyColorMode,
  AnatomyViewPreset,
  BodySideSelection,
} from '../components/anatomy/Anatomy3DCanvas';
import { Card, PageHeader, PrimaryButton, ProgressBar, SecondaryButton } from '../components/ui/Primitives';
import { ExperienceLevel } from '../types/fitness';

export const AnatomyPage: React.FC = () => {
  const {
    selectedAnatomyMuscleId,
    setSelectedAnatomyMuscleId,
    muscleRecovery,
    sessions,
    setActivePage,
    setExerciseFilterMuscle,
    startQuickWorkoutWithExercise,
  } = useFitness();

  const [selectedSide, setSelectedSide] = useState<BodySideSelection>('both');
  const [colorMode, setColorMode] = useState<AnatomyColorMode>('anatomy');
  const [viewPreset, setViewPreset] = useState<AnatomyViewPreset>('front');
  const [presetTrigger, setPresetTrigger] = useState(0);
  const [difficultyTab, setDifficultyTab] = useState<ExperienceLevel | 'all'>('all');

  const recoveryMap = useMemo(
    () => Object.fromEntries(muscleRecovery.map((r) => [r.muscleId, r])),
    [muscleRecovery]
  );

  const selectedMuscle = MUSCLE_BY_ID[selectedAnatomyMuscleId] || MUSCLES[0];
  const selectedRecovery = recoveryMap[selectedMuscle.id];
  const matchedExercises = useMemo(
    () => getExercisesForMuscle(selectedMuscle.id),
    [selectedMuscle.id]
  );

  const filteredPrimary = useMemo(() => {
    const base =
      matchedExercises.primary.length > 0
        ? matchedExercises.primary
        : matchedExercises.secondary;
    if (difficultyTab === 'all') return base;
    const filtered = base.filter((e) => e.difficulty === difficultyTab);
    return filtered.length > 0 ? filtered : base;
  }, [matchedExercises, difficultyTab]);

  // Recent training history for this muscle
  const muscleHistory = useMemo(() => {
    const items: Array<{ date: string; title: string; exerciseName: string; sets: number }> = [];
    for (const s of sessions) {
      for (const ex of s.exercises) {
        if (
          ex.primaryMuscles.includes(selectedMuscle.id) ||
          ex.secondaryMuscles.includes(selectedMuscle.id)
        ) {
          const doneSets = ex.sets.filter((st) => st.completed).length;
          if (doneSets > 0) {
            items.push({
              date: s.completedAt.slice(0, 10),
              title: s.title,
              exerciseName: ex.exerciseName,
              sets: doneSets,
            });
          }
        }
      }
    }
    return items.slice(0, 5);
  }, [sessions, selectedMuscle.id]);

  const handleSelectMuscle = (muscleId: string, side: BodySideSelection = 'both') => {
    setSelectedAnatomyMuscleId(muscleId);
    setSelectedSide(side);
    const def = MUSCLE_BY_ID[muscleId];
    if (def && side === 'both') {
      if (def.view === 'back') {
        setViewPreset('back');
        setPresetTrigger((n) => n + 1);
      } else if (def.view === 'front') {
        setViewPreset('front');
        setPresetTrigger((n) => n + 1);
      }
    }
  };

  const triggerPreset = (preset: AnatomyViewPreset) => {
    setViewPreset(preset);
    setPresetTrigger((n) => n + 1);
  };

  const groupedMuscles = useMemo(() => {
    return {
      'Upper Body — Front': MUSCLES.filter((m) => m.region === 'Upper Body — Front'),
      'Upper Body — Back': MUSCLES.filter((m) => m.region === 'Upper Body — Back'),
      'Lower Body': MUSCLES.filter((m) => m.region === 'Lower Body'),
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="3D Muscle Anatomy Explorer"
        subtitle="Interactive procedural 3D human muscular reference across 40 anterior, posterior, and lower-body muscle groups."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg bg-[#101619] border border-white/10 p-1">
              <button
                type="button"
                onClick={() => setColorMode('anatomy')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                  colorMode === 'anatomy'
                    ? 'bg-[#B7FF67] text-[#080B0D] font-semibold'
                    : 'text-[#A0AAA7] hover:text-white'
                }`}
              >
                Anatomy Mode
              </button>
              <button
                type="button"
                onClick={() => setColorMode('recovery')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                  colorMode === 'recovery'
                    ? 'bg-[#40E0D0] text-[#080B0D] font-semibold'
                    : 'text-[#A0AAA7] hover:text-white'
                }`}
              >
                Recovery Heatmap
              </button>
            </div>

            <div className="inline-flex rounded-lg bg-[#101619] border border-white/10 p-1">
              {(['both', 'left', 'right'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSide(s)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium capitalize cursor-pointer ${
                    selectedSide === s
                      ? 'bg-white/15 text-[#F5F7F5]'
                      : 'text-[#A0AAA7] hover:text-white'
                  }`}
                >
                  {s === 'both' ? 'Both Sides' : `${s} Side`}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* Main Split: 3D Stage + Muscle Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-3">
          <Anatomy3DCanvas
            selectedMuscleId={selectedMuscle.id}
            selectedSide={selectedSide}
            colorMode={colorMode}
            recoveryMap={recoveryMap}
            viewPreset={viewPreset}
            presetTrigger={presetTrigger}
            onSelectMuscle={handleSelectMuscle}
            onChangeViewPreset={triggerPreset}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#A0AAA7] px-1">
            <span>
              Procedural 3D anatomical reference model. Click any muscle on the figure or select
              from the 40-muscle matrix below.
            </span>
            {colorMode === 'recovery' && (
              <span className="font-mono text-[#F5F7F5]">
                Green: &ge;78% · Amber: 50–77% · Red: &lt;50% (Estimated)
              </span>
            )}
          </div>
        </div>

        {/* Muscle Intelligence Panel */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-[#40E0D0]">
                  {selectedMuscle.region} ·{' '}
                  {selectedSide === 'both' ? 'Bilateral' : `${selectedSide.toUpperCase()} SIDE`}
                </div>
                <h2 className="text-xl font-bold text-[#F5F7F5] mt-1">{selectedMuscle.name}</h2>
                <p className="text-xs italic text-[#A0AAA7]">{selectedMuscle.scientificName}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-bold font-mono tabular-nums text-[#B7FF67]">
                  {selectedRecovery?.recoveryPct ?? 92}%
                </div>
                <div className="text-[11px] text-[#A0AAA7]">
                  {selectedRecovery?.statusLabel ?? 'Recovered'}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <ProgressBar
                value={selectedRecovery?.recoveryPct ?? 92}
                max={100}
                color={
                  (selectedRecovery?.recoveryPct ?? 92) >= 78
                    ? 'lime'
                    : (selectedRecovery?.recoveryPct ?? 92) >= 50
                      ? 'amber'
                      : 'red'
                }
                label="Estimated Readiness (from training volume & sleep)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
              <div className="bg-[#080B0D] border border-white/10 rounded-lg p-3">
                <div className="text-[#A0AAA7]">7-Day Primary Sets</div>
                <div className="text-base font-bold font-mono tabular-nums text-[#F5F7F5] mt-0.5">
                  {selectedRecovery?.recentSets7d ?? 0} sets
                </div>
              </div>
              <div className="bg-[#080B0D] border border-white/10 rounded-lg p-3">
                <div className="text-[#A0AAA7]">Last Trained</div>
                <div className="text-base font-bold font-mono tabular-nums text-[#F5F7F5] mt-0.5">
                  {selectedRecovery?.hoursSinceTrained !== null &&
                  selectedRecovery?.hoursSinceTrained !== undefined
                    ? `${selectedRecovery.hoursSinceTrained}h ago`
                    : 'Not logged'}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed">
              <div>
                <div className="font-semibold text-[#F5F7F5] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#40E0D0]" /> Anatomical Location
                </div>
                <p className="text-[#A0AAA7] mt-1">{selectedMuscle.location}</p>
              </div>
              <div>
                <div className="font-semibold text-[#F5F7F5] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#B7FF67]" /> Primary Function
                </div>
                <p className="text-[#A0AAA7] mt-1">{selectedMuscle.mainFunction}</p>
              </div>
              <div>
                <div className="font-semibold text-[#F5F7F5] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> Common Mistakes &
                  Recovery
                </div>
                <ul className="list-disc list-inside text-[#A0AAA7] mt-1 space-y-0.5">
                  {selectedMuscle.commonMistakes.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
                <p className="text-[#A0AAA7] mt-1.5">{selectedMuscle.recoveryGuidance}</p>
              </div>
            </div>
          </Card>

          {/* Recommended Exercises */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-[#F5F7F5] flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-[#B7FF67]" /> Targeted Exercises
              </h3>
              <div className="flex gap-1">
                {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setDifficultyTab(lvl)}
                    className={`px-2 py-1 rounded text-[11px] capitalize cursor-pointer ${
                      difficultyTab === lvl
                        ? 'bg-[#B7FF67] text-[#080B0D] font-semibold'
                        : 'bg-[#080B0D] text-[#A0AAA7] hover:text-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {filteredPrimary.slice(0, 6).map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between gap-2 bg-[#080B0D] border border-white/10 rounded-lg px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#F5F7F5] truncate">{ex.name}</div>
                    <div className="text-[11px] text-[#A0AAA7] capitalize">
                      {ex.difficulty} · {ex.equipment} · {ex.setsGuidance}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startQuickWorkoutWithExercise(ex.id)}
                    title="Add to Live Workout"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#B7FF67]/15 text-[#B7FF67] hover:bg-[#B7FF67] hover:text-[#080B0D] text-xs font-medium shrink-0 cursor-pointer"
                  >
                    <Play className="w-3 h-3" /> Train
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-white/10 flex gap-2">
              <SecondaryButton
                type="button"
                onClick={() => {
                  setExerciseFilterMuscle(selectedMuscle.exerciseCategories[0] || null);
                  setActivePage('exercises');
                }}
                className="flex-1 text-xs py-2"
              >
                <BookOpen className="w-3.5 h-3.5" /> Open in Exercise Library
              </SecondaryButton>
              {filteredPrimary[0] && (
                <PrimaryButton
                  type="button"
                  onClick={() => startQuickWorkoutWithExercise(filteredPrimary[0].id)}
                  className="text-xs py-2"
                >
                  Quick Start
                </PrimaryButton>
              )}
            </div>
          </Card>

          {/* Muscle History */}
          <Card>
            <h3 className="text-sm font-semibold text-[#F5F7F5] flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-[#40E0D0]" /> Recent Training History
            </h3>
            {muscleHistory.length === 0 ? (
              <p className="text-xs text-[#A0AAA7]">
                No logged sets targeting {selectedMuscle.name} yet. Start a workout to record
                history.
              </p>
            ) : (
              <div className="space-y-2">
                {muscleHistory.map((h, idx) => (
                  <div
                    key={`${h.date}-${idx}`}
                    className="flex items-center justify-between text-xs bg-[#080B0D] border border-white/10 rounded-lg px-3 py-2"
                  >
                    <div>
                      <div className="font-medium text-[#F5F7F5]">{h.exerciseName}</div>
                      <div className="text-[11px] text-[#A0AAA7]">{h.title}</div>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="text-[#B7FF67] font-semibold">{h.sets} sets</div>
                      <div className="text-[11px] text-[#A0AAA7]">{h.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Complete 40-Muscle Quick Selector Matrix */}
      <Card>
        <h3 className="text-base font-semibold text-[#F5F7F5] mb-4">
          All 40 Muscle Groups Directory
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(groupedMuscles).map(([region, items]) => (
            <div key={region}>
              <div className="text-xs font-mono uppercase tracking-wider text-[#40E0D0] mb-2.5">
                {region} ({items.length})
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {items.map((m) => {
                  const active = m.id === selectedMuscle.id;
                  const rec = recoveryMap[m.id];
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectMuscle(m.id, 'both')}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-colors cursor-pointer text-left ${
                        active
                          ? 'bg-[#B7FF67]/15 border-[#B7FF67] text-[#B7FF67] font-semibold'
                          : 'bg-[#080B0D] border-white/10 text-[#F5F7F5] hover:border-white/25'
                      }`}
                    >
                      <span className="truncate pr-2">{m.name}</span>
                      <span className="font-mono tabular-nums text-[11px] text-[#A0AAA7] shrink-0">
                        {rec?.recoveryPct ?? 92}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
