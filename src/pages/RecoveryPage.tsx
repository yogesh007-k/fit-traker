import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, HeartPulse, Moon, Scan } from 'lucide-react';
import { useFitness } from '../context/FitnessContext';
import { MUSCLES } from '../data/muscles';
import { api } from '../services/api';
import { Card, PageHeader, PrimaryButton, ProgressBar } from '../components/ui/Primitives';

export const RecoveryPage: React.FC = () => {
  const {
    recoveryLogs,
    muscleRecovery,
    refreshBootstrap,
    notify,
    setSelectedAnatomyMuscleId,
    setActivePage,
  } = useFitness();

  const [sleepHours, setSleepHours] = useState(7.5);
  const [sleepQuality, setSleepQuality] = useState(4);
  const [sorenessLevel, setSorenessLevel] = useState(2);
  const [fatigueLevel, setFatigueLevel] = useState(2);
  const [soreMuscles, setSoreMuscles] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Fatigued' | 'Moderate Load' | 'Recovered'>('all');

  const avgRecovery = useMemo(() => {
    if (!muscleRecovery.length) return 90;
    return Math.round(
      muscleRecovery.reduce((acc, m) => acc + m.recoveryPct, 0) / muscleRecovery.length
    );
  }, [muscleRecovery]);

  const overtrainingRisk = useMemo(() => {
    const latest = recoveryLogs[0];
    const fatiguedCount = muscleRecovery.filter((m) => m.recoveryPct < 55).length;
    if ((latest && latest.fatigueLevel >= 4 && latest.sleepHours < 6.5) || fatiguedCount >= 6) {
      return {
        level: 'Elevated Load',
        guidance:
          'Multiple muscle groups show high accumulated fatigue or low sleep. Prioritize a rest or low-intensity mobility day.',
        color: 'text-red-300',
      };
    }
    if (fatiguedCount >= 2 || (latest && latest.sorenessLevel >= 4)) {
      return {
        level: 'Targeted Fatigue',
        guidance:
          'Train recovered muscle groups (>78% readiness) and give fatigued tissues another 24–48 hours.',
        color: 'text-amber-300',
      };
    }
    return {
      level: 'Balanced Readiness',
      guidance:
        'Training volume and sleep recovery look balanced. Progressive overload is well supported.',
      color: 'text-[#B7FF67]',
    };
  }, [muscleRecovery, recoveryLogs]);

  const filteredRecovery = useMemo(() => {
    const sorted = [...muscleRecovery].sort((a, b) => a.recoveryPct - b.recoveryPct);
    if (statusFilter === 'all') return sorted;
    return sorted.filter((m) => m.statusLabel === statusFilter);
  }, [muscleRecovery, statusFilter]);

  const toggleSoreMuscle = (id: string) => {
    setSoreMuscles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.addRecovery({
        logDate: new Date().toISOString().slice(0, 10),
        sleepHours,
        sleepQuality,
        sorenessLevel,
        fatigueLevel,
        soreMuscles,
        notes,
      });
      await refreshBootstrap();
      setNotes('');
      notify('Sleep and soreness check-in saved. Recovery estimates updated.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save recovery check-in.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recovery & Readiness Intelligence"
        subtitle="Estimated muscular readiness derived transparently from your 7-day set volume, time since last session, sleep logs, and soreness check-ins."
      />

      {/* Transparency Banner + Overall Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-[#40E0D0]">
              System Readiness Estimate
            </span>
            <span className="text-2xl font-bold font-mono tabular-nums text-[#B7FF67]">
              {avgRecovery}%
            </span>
          </div>
          <ProgressBar value={avgRecovery} max={100} color="lime" />
          <div className="bg-[#080B0D] border border-white/10 rounded-xl p-3.5 text-xs space-y-1">
            <div className={`font-semibold flex items-center gap-1.5 ${overtrainingRisk.color}`}>
              {overtrainingRisk.level === 'Elevated Load' ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {overtrainingRisk.level}
            </div>
            <p className="text-[#A0AAA7] leading-relaxed">{overtrainingRisk.guidance}</p>
          </div>
        </Card>

        <Card className="lg:col-span-7">
          <h2 className="text-base font-semibold text-[#F5F7F5] flex items-center gap-2 mb-4">
            <Moon className="w-4 h-4 text-[#40E0D0]" /> Log Today’s Sleep & Soreness Check-In
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[#A0AAA7] mb-1">Sleep Hours</label>
                <input
                  type="number"
                  min={1}
                  max={16}
                  step="0.5"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(Number(e.target.value))}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 font-mono text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Sleep Quality (1–5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={sleepQuality}
                  onChange={(e) => setSleepQuality(Number(e.target.value))}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 font-mono text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Soreness (1–5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={sorenessLevel}
                  onChange={(e) => setSorenessLevel(Number(e.target.value))}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 font-mono text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Fatigue (1–5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={fatigueLevel}
                  onChange={(e) => setFatigueLevel(Number(e.target.value))}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 font-mono text-[#F5F7F5]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#A0AAA7] mb-1.5">Tag Notably Sore Muscles (Optional)</label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {MUSCLES.slice(0, 20).map((m) => {
                  const active = soreMuscles.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleSoreMuscle(m.id)}
                      className={`px-2.5 py-1 rounded-md border cursor-pointer ${
                        active
                          ? 'bg-amber-400/20 border-amber-400 text-amber-200'
                          : 'bg-[#080B0D] border-white/10 text-[#A0AAA7]'
                      }`}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes on energy, stress, or joint stiffness..."
                className="flex-1 bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-[#F5F7F5]"
              />
              <PrimaryButton type="submit" loading={saving}>
                Save Check-In
              </PrimaryButton>
            </div>
          </form>
        </Card>
      </div>

      {/* 40-Muscle Recovery Matrix */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[#F5F7F5] flex items-center gap-2">
            <HeartPulse className="w-4 h-4 text-[#B7FF67]" /> Estimated Muscle Recovery Heatmap
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'Fatigued', 'Moderate Load', 'Recovered'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#B7FF67] text-[#080B0D] font-semibold'
                    : 'bg-[#080B0D] border border-white/10 text-[#A0AAA7]'
                }`}
              >
                {st === 'all' ? 'All Muscles (40)' : st}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredRecovery.map((m) => (
            <button
              key={m.muscleId}
              type="button"
              onClick={() => {
                setSelectedAnatomyMuscleId(m.muscleId);
                setActivePage('anatomy');
              }}
              className="text-left bg-[#080B0D] border border-white/10 hover:border-[#40E0D0] rounded-xl p-3.5 space-y-2 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-[#F5F7F5]">{m.muscleName}</span>
                <Scan className="w-3.5 h-3.5 text-[#40E0D0] shrink-0" />
              </div>
              <ProgressBar
                value={m.recoveryPct}
                max={100}
                color={m.recoveryPct >= 78 ? 'lime' : m.recoveryPct >= 50 ? 'amber' : 'red'}
              />
              <div className="flex justify-between text-[11px] font-mono text-[#A0AAA7] tabular-nums">
                <span>{m.recoveryPct}% est.</span>
                <span>{m.recentSets7d} sets / 7d</span>
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
};
