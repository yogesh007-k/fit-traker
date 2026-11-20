import React, { useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  Bot,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Play,
  Scan,
  Settings,
  UserCircle,
  Utensils,
  X,
  Zap,
} from 'lucide-react';
import { NavPageId, useFitness } from '../../context/FitnessContext';

interface NavItem {
  id: NavPageId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', shortLabel: 'Home', icon: LayoutDashboard },
  { id: 'ai-coach', label: 'AI Fitness Coach', shortLabel: 'Coach', icon: Bot },
  { id: 'anatomy', label: '3D Muscle Anatomy', shortLabel: '3D Body', icon: Scan },
  { id: 'exercises', label: 'Exercise Library', shortLabel: 'Exercises', icon: Dumbbell },
  { id: 'planner', label: 'Workout Planner', shortLabel: 'Planner', icon: CalendarDays },
  { id: 'live-workout', label: 'Live Workout', shortLabel: 'Live', icon: Play },
  { id: 'form-lab', label: 'AI Form Lab', shortLabel: 'Form Lab', icon: Camera },
  { id: 'nutrition', label: 'Nutrition', shortLabel: 'Nutrition', icon: Utensils },
  { id: 'recovery', label: 'Recovery', shortLabel: 'Recovery', icon: HeartPulse },
  { id: 'transformation', label: 'Transformation', shortLabel: 'Twin', icon: Activity },
  { id: 'analytics', label: 'Analytics', shortLabel: 'Analytics', icon: BarChart3 },
  { id: 'achievements', label: 'Achievements', shortLabel: 'Badges', icon: Award },
  { id: 'profile', label: 'Profile', shortLabel: 'Profile', icon: UserCircle },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
];

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    profile,
    user,
    activePage,
    setActivePage,
    activeWorkout,
    levelInfo,
    streak,
    signOut,
  } = useFitness();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = (page: NavPageId) => {
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#080B0D] text-[#F5F7F5] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside
        aria-label="Primary Sidebar Navigation"
        className={`hidden lg:flex flex-col border-r border-white/10 bg-[#101619] shrink-0 transition-all duration-200 sticky top-0 h-screen ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-white/10">
          <button
            type="button"
            onClick={() => navigate('overview')}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-[#B7FF67] text-[#080B0D] flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="truncate">
                <div className="font-display font-bold text-sm tracking-wide text-[#F5F7F5]">
                  FITTRACK <span className="text-[#B7FF67]">X</span>
                </div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#A0AAA7]">
                  ULTRA OS
                </div>
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-[#A0AAA7] hover:text-white hover:bg-white/5 cursor-pointer"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            const isLiveSession = item.id === 'live-workout' && activeWorkout;
            return (
              <button
                key={item.id}
                type="button"
                data-nav={item.id}
                onClick={() => navigate(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#B7FF67]/15 text-[#B7FF67] border border-[#B7FF67]/30'
                    : 'text-[#A0AAA7] hover:text-[#F5F7F5] hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
                {!collapsed && isLiveSession && (
                  <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-[#B7FF67] text-[#080B0D] font-bold">
                    {formatClock(activeWorkout.elapsedSec)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-white/10 space-y-2.5">
          {!collapsed && (
            <div className="bg-[#080B0D] border border-white/10 rounded-xl p-2.5">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-mono font-semibold text-[#B7FF67] tabular-nums">
                  LVL {levelInfo.level}
                </span>
                <span className="inline-flex items-center gap-1 text-[#40E0D0] font-mono tabular-nums">
                  <Flame className="w-3.5 h-3.5" /> {streak}d streak
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#151D20] overflow-hidden">
                <div
                  className="h-full bg-[#B7FF67] rounded-full transition-all duration-300"
                  style={{ width: `${levelInfo.progressPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5">
            <img
              src="/src/assets/images/avatar_athlete_1795206869953.jpg"
              alt={profile?.name || 'Athlete'}
              className="w-9 h-9 rounded-full object-cover border border-white/20 shrink-0"
            />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[#F5F7F5] truncate">
                  {profile?.name || user?.name}
                </div>
                <div className="text-[11px] text-[#A0AAA7] truncate">{user?.email}</div>
              </div>
            )}
            <button
              type="button"
              onClick={signOut}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-2 rounded-lg text-[#A0AAA7] hover:text-red-400 hover:bg-white/5 cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-30 h-14 bg-[#101619] border-b border-white/10 px-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('overview')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-[#B7FF67] text-[#080B0D] flex items-center justify-center">
            <Zap className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-sm tracking-wide">
            FITTRACK <span className="text-[#B7FF67]">X ULTRA</span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          {activeWorkout && (
            <button
              type="button"
              onClick={() => navigate('live-workout')}
              className="px-2.5 py-1 rounded-lg bg-[#B7FF67] text-[#080B0D] text-xs font-mono font-bold tabular-nums cursor-pointer"
            >
              LIVE {formatClock(activeWorkout.elapsedSec)}
            </button>
          )}
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg text-[#F5F7F5] bg-[#151D20] border border-white/10 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile Full Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/80 flex justify-end">
          <div className="w-72 max-w-[85vw] bg-[#101619] h-full border-l border-white/10 flex flex-col p-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="font-display font-bold text-sm">Navigation</span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-[#A0AAA7] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer ${
                      isActive
                        ? 'bg-[#B7FF67]/15 text-[#B7FF67] border border-[#B7FF67]/30'
                        : 'text-[#A0AAA7] hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={signOut}
              className="mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/15 text-red-300 text-sm font-medium cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 pb-20 lg:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>
      </main>

      {/* Mobile Compact Bottom Quick Bar (<= 64px height) */}
      <nav
        aria-label="Mobile Quick Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-[#101619] border-t border-white/10 grid grid-cols-5 px-1"
      >
        {(
          [
            { id: 'overview', label: 'Home', icon: LayoutDashboard },
            { id: 'anatomy', label: '3D Body', icon: Scan },
            { id: 'ai-coach', label: 'Coach', icon: Bot },
            { id: 'live-workout', label: 'Live', icon: Play },
            { id: 'nutrition', label: 'Nutrition', icon: Utensils },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
                active ? 'text-[#B7FF67]' : 'text-[#A0AAA7]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
