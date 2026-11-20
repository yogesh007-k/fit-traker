import React, { useMemo, useState } from 'react';
import { BarChart3, Trophy } from 'lucide-react';
import { useFitness } from '../context/FitnessContext';
import { MUSCLE_BY_ID } from '../data/muscles';
import { Card, PageHeader, ProgressBar } from '../components/ui/Primitives';

type DateRangeKey = '7d' | '30d' | '90d' | 'all';

export const AnalyticsPage: React.FC = () => {
  const { sessions, nutritionLogs, measurements, personalRecords, macroTargets } = useFitness();
  const [range, setRange] = useState<DateRangeKey>('30d');

  const cutoffMs = useMemo(() => {
    const now = Date.now();
    if (range === '7d') return now - 7 * 86400_000;
    if (range === '30d') return now - 30 * 86400_000;
    if (range === '90d') return now - 90 * 86400_000;
    return 0;
  }, [range]);

  const filteredSessions = useMemo(
    () =>
      sessions
        .filter((s) => new Date(s.completedAt).getTime() >= cutoffMs)
        .sort((a, b) => (a.completedAt < b.completedAt ? -1 : 1)),
    [sessions, cutoffMs]
  );

  const summary = useMemo(() => {
    const totalVolume = filteredSessions.reduce((a, s) => a + s.totalVolumeKg, 0);
    const totalMinutes = Math.round(
      filteredSessions.reduce((a, s) => a + s.durationSec, 0) / 60
    );
    const totalSets = filteredSessions.reduce((a, s) => a + s.totalSets, 0);
    return {
      workouts: filteredSessions.length,
      totalVolume,
      totalMinutes,
      totalSets,
    };
  }, [filteredSessions]);

  const muscleDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of filteredSessions) {
      for (const ex of s.exercises) {
        const done = ex.sets.filter((st) => st.completed).length;
        for (const mId of ex.primaryMuscles) {
          counts.set(mId, (counts.get(mId) || 0) + done);
        }
      }
    }
    const list = Array.from(counts.entries())
      .map(([id, sets]) => ({
        id,
        name: MUSCLE_BY_ID[id]?.name || id,
        sets,
      }))
      .sort((a, b) => b.sets - a.sets);
    const max = Math.max(1, ...list.map((x) => x.sets));
    return { list: list.slice(0, 10), max };
  }, [filteredSessions]);

  const nutritionByDay = useMemo(() => {
    const map = new Map<string, { calories: number; proteinG: number }>();
    for (const n of nutritionLogs) {
      if (new Date(n.logDate).getTime() < cutoffMs) continue;
      const prev = map.get(n.logDate) || { calories: 0, proteinG: 0 };
      map.set(n.logDate, {
        calories: prev.calories + n.calories,
        proteinG: prev.proteinG + n.proteinG,
      });
    }
    return Array.from(map.entries())
      .map(([date, vals]) => ({ date, ...vals }))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(-10);
  }, [nutritionLogs, cutoffMs]);

  const maxSessionVol = Math.max(1, ...filteredSessions.map((s) => s.totalVolumeKg));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training & Nutrition Analytics"
        subtitle="Real-time telemetry computed from your saved workouts, personal records, nutrition diary, and body measurements."
        actions={
          <div className="inline-flex rounded-lg bg-[#101619] border border-white/10 p-1">
            {(
              [
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' },
                { id: '90d', label: '90 Days' },
                { id: 'all', label: 'All Time' },
              ] as const
            ).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                  range === r.id
                    ? 'bg-[#B7FF67] text-[#080B0D] font-semibold'
                    : 'text-[#A0AAA7] hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="text-xs text-[#A0AAA7]">Completed Workouts</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#B7FF67] mt-1">
            {summary.workouts}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-[#A0AAA7]">Total Volume Lifted</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#F5F7F5] mt-1">
            {summary.totalVolume.toLocaleString()} kg
          </div>
        </Card>
        <Card>
          <div className="text-xs text-[#A0AAA7]">Completed Working Sets</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#40E0D0] mt-1">
            {summary.totalSets}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-[#A0AAA7]">Active Training Time</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#F5F7F5] mt-1">
            {summary.totalMinutes} min
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Session Volume Progression */}
        <Card className="lg:col-span-7">
          <h2 className="text-base font-semibold text-[#F5F7F5] flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[#B7FF67]" /> Session Volume Trend (kg)
          </h2>
          {filteredSessions.length === 0 ? (
            <p className="text-xs text-[#A0AAA7] py-8 text-center">
              No sessions recorded in this date window yet.
            </p>
          ) : (
            <div className="h-52 flex items-end gap-2.5">
              {filteredSessions.slice(-12).map((s) => {
                const pct = Math.max(8, Math.round((s.totalVolumeKg / maxSessionVol) * 100));
                return (
                  <div key={s.id} className="flex-1 flex flex-col items-center gap-1.5 h-full">
                    <span className="text-[10px] font-mono tabular-nums text-[#A0AAA7]">
                      {Math.round(s.totalVolumeKg / 100) / 10}t
                    </span>
                    <div className="w-full flex-1 bg-[#080B0D] rounded-lg flex items-end overflow-hidden border border-white/5">
                      <div
                        className="w-full bg-[#B7FF67] rounded-t"
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[#A0AAA7] truncate w-full text-center">
                      {s.completedAt.slice(5, 10)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Muscle Volume Distribution */}
        <Card className="lg:col-span-5">
          <h2 className="text-base font-semibold text-[#F5F7F5] mb-4">
            Muscle Group Distribution (Primary Sets)
          </h2>
          {muscleDistribution.list.length === 0 ? (
            <p className="text-xs text-[#A0AAA7]">Log workouts to analyze muscle distribution.</p>
          ) : (
            <div className="space-y-2.5">
              {muscleDistribution.list.map((m) => (
                <ProgressBar
                  key={m.id}
                  value={m.sets}
                  max={muscleDistribution.max}
                  color="cyan"
                  label={m.name}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Personal Records & Nutrition Adherence */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-6">
          <h2 className="text-base font-semibold text-[#F5F7F5] flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-[#B7FF67]" /> Personal Records Leaderboard
          </h2>
          {personalRecords.length === 0 ? (
            <p className="text-xs text-[#A0AAA7]">Complete weighted sets to unlock PRs.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {personalRecords.slice(0, 10).map((pr, idx) => (
                <div
                  key={pr.exerciseId}
                  className="flex items-center justify-between bg-[#080B0D] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-[#40E0D0]">#{idx + 1}</span>
                    <span className="font-medium text-[#F5F7F5]">{pr.exerciseName}</span>
                  </div>
                  <div className="font-mono tabular-nums text-right">
                    <span className="text-[#B7FF67] font-bold">{pr.maxWeightKg} kg</span>
                    <span className="text-[#A0AAA7] ml-2">({pr.achievedAt.slice(0, 10)})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-6 space-y-4">
          <h2 className="text-base font-semibold text-[#F5F7F5]">
            Nutrition Adherence & Weight Snapshot
          </h2>
          {nutritionByDay.length === 0 ? (
            <p className="text-xs text-[#A0AAA7]">No nutrition entries logged in this window.</p>
          ) : (
            <div className="space-y-2.5">
              {nutritionByDay.map((d) => (
                <div
                  key={d.date}
                  className="bg-[#080B0D] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs space-y-1.5"
                >
                  <div className="flex justify-between font-mono tabular-nums">
                    <span className="text-[#A0AAA7]">{d.date}</span>
                    <span className="text-[#F5F7F5]">
                      {Math.round(d.calories)} / {macroTargets.calories} kcal ·{' '}
                      <span className="text-[#40E0D0]">{Math.round(d.proteinG)}g protein</span>
                    </span>
                  </div>
                  <ProgressBar value={d.calories} max={macroTargets.calories} color="lime" />
                </div>
              ))}
            </div>
          )}
          {measurements.length > 0 && (
            <div className="text-xs text-[#A0AAA7] pt-2 border-t border-white/10">
              Latest Weight: <span className="font-mono text-[#B7FF67]">{measurements[0].weightKg} kg</span> ({measurements[0].logDate})
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
