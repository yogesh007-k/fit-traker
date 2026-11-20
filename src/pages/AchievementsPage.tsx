import React, { useMemo } from 'react';
import { Award, CheckCircle2, Flame, Lock, Target, Users } from 'lucide-react';
import { useFitness } from '../context/FitnessContext';
import { Card, PageHeader, ProgressBar } from '../components/ui/Primitives';

export const AchievementsPage: React.FC = () => {
  const {
    profile,
    sessions,
    nutritionLogs,
    achievements,
    totalXp,
    levelInfo,
    streak,
  } = useFitness();

  const weeklyStats = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 86400_000;
    const weekSessions = sessions.filter(
      (s) => new Date(s.completedAt).getTime() >= sevenDaysAgo
    );
    const weekSets = weekSessions.reduce((a, s) => a + s.totalSets, 0);
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayMeals = nutritionLogs.filter((n) => n.logDate === todayStr).length;
    return {
      workouts: weekSessions.length,
      sets: weekSets,
      todayMeals,
    };
  }, [sessions, nutritionLogs]);

  // Transparently labeled sample comparison benchmarks alongside user's real XP
  const leaderboard = useMemo(() => {
    const rows = [
      { name: `${profile?.name || 'You'} (You)`, xp: totalXp, streak, isSelf: true },
      { name: 'Kiran V. (Sample Benchmark)', xp: 920, streak: 6, isSelf: false },
      { name: 'Maya R. (Sample Benchmark)', xp: 640, streak: 4, isSelf: false },
      { name: 'Devon T. (Sample Benchmark)', xp: 410, streak: 2, isSelf: false },
    ];
    return rows.sort((a, b) => b.xp - a.xp);
  }, [profile?.name, totalXp, streak]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Achievements, XP & Challenges"
        subtitle="Earn Fitness XP for every completed workout, personal record, and milestone unlocked."
      />

      {/* Level & Streak Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-[#40E0D0]">
                Athlete Progression
              </div>
              <h2 className="text-2xl font-bold text-[#F5F7F5] mt-1">
                Level {levelInfo.level} ·{' '}
                <span className="text-[#B7FF67] font-mono tabular-nums">{totalXp} XP</span>
              </h2>
            </div>
            <Award className="w-9 h-9 text-[#B7FF67]" />
          </div>
          <ProgressBar
            value={levelInfo.currentLevelXp}
            max={levelInfo.nextLevelXp}
            color="lime"
            label={`Progress to Level ${levelInfo.level + 1}`}
          />
          <div className="text-xs text-[#A0AAA7]">
            {unlockedCount} of {achievements.length} achievement milestones unlocked.
          </div>
        </Card>

        <Card className="lg:col-span-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-[#A0AAA7]">Current Training Streak</div>
              <div className="text-3xl font-bold font-mono tabular-nums text-[#B7FF67] mt-1">
                {streak} Days
              </div>
            </div>
            <Flame className="w-8 h-8 text-[#B7FF67]" />
          </div>
          <p className="text-xs text-[#A0AAA7] mt-3">
            Complete at least one session per day to extend your consecutive momentum streak.
          </p>
        </Card>
      </div>

      {/* Weekly Challenges */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-[#F5F7F5] flex items-center gap-2">
          <Target className="w-4 h-4 text-[#40E0D0]" /> Active Weekly Challenges
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#080B0D] border border-white/10 rounded-xl p-4 space-y-2.5">
            <div className="text-xs font-semibold text-[#F5F7F5]">Weekly Consistency Target</div>
            <ProgressBar
              value={weeklyStats.workouts}
              max={profile?.weeklyDays || 4}
              color="lime"
              label="Sessions this week"
            />
          </div>
          <div className="bg-[#080B0D] border border-white/10 rounded-xl p-4 space-y-2.5">
            <div className="text-xs font-semibold text-[#F5F7F5]">45-Set Hypertrophy Block</div>
            <ProgressBar value={weeklyStats.sets} max={45} color="cyan" label="Completed sets (7d)" />
          </div>
          <div className="bg-[#080B0D] border border-white/10 rounded-xl p-4 space-y-2.5">
            <div className="text-xs font-semibold text-[#F5F7F5]">Daily Fuel Discipline</div>
            <ProgressBar value={weeklyStats.todayMeals} max={3} color="lime" label="Meals logged today" />
          </div>
        </div>
      </Card>

      {/* Achievement Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {achievements.map((badge) => (
          <Card
            key={badge.key}
            className={`space-y-2 ${
              badge.unlocked ? 'border-[#B7FF67]/40' : 'opacity-80'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-bold text-[#F5F7F5]">{badge.title}</div>
              {badge.unlocked ? (
                <CheckCircle2 className="w-5 h-5 text-[#B7FF67] shrink-0" />
              ) : (
                <Lock className="w-4 h-4 text-[#A0AAA7] shrink-0" />
              )}
            </div>
            <p className="text-xs text-[#A0AAA7]">{badge.description}</p>
            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs font-mono">
              <span className={badge.unlocked ? 'text-[#B7FF67]' : 'text-[#A0AAA7]'}>
                {badge.requirementText}
              </span>
              <span className="text-[#40E0D0]">+{badge.xpReward} XP</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Leaderboard (Transparent Benchmark Comparison) */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-base font-semibold text-[#F5F7F5] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#40E0D0]" /> Training Cohort Comparison
          </h2>
          <span className="text-[11px] text-[#A0AAA7]">
            Your live XP compared against local sample benchmark profiles
          </span>
        </div>
        <div className="space-y-2">
          {leaderboard.map((row, idx) => (
            <div
              key={row.name}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border text-xs ${
                row.isSelf
                  ? 'bg-[#B7FF67]/10 border-[#B7FF67]/40 text-[#F5F7F5]'
                  : 'bg-[#080B0D] border-white/10 text-[#A0AAA7]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-[#40E0D0]">#{idx + 1}</span>
                <span className="font-semibold">{row.name}</span>
              </div>
              <div className="flex items-center gap-4 font-mono tabular-nums">
                <span>{row.streak}d streak</span>
                <span className="text-[#B7FF67] font-bold">{row.xp} XP</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
