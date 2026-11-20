import React, { useState } from 'react';
import { ArrowRight, Dumbbell, Lock, Mail, ShieldCheck, Sparkles, User, Zap } from 'lucide-react';
import { api, ApiError, setInMemoryToken } from '../../services/api';
import { useFitness } from '../../context/FitnessContext';
import { PrimaryButton, SecondaryButton } from '../ui/Primitives';

type AuthMode = 'login' | 'register' | 'forgot';

export const AuthScreen: React.FC = () => {
  const { refreshBootstrap, signInDemo, notify } = useFitness();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);

    if (mode === 'forgot') {
      setInfoMsg(
        'Password reset emails require an external email provider (SMTP/Firebase Auth), which is not provisioned in this local SQLite workspace. Once signed in, you can update your password anytime in Settings.'
      );
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const res = await api.register({ name: name.trim(), email: email.trim(), password });
        setInMemoryToken(res.token);
        await refreshBootstrap();
        notify('Account created. Welcome to FITTRACK X ULTRA.', 'success');
      } else {
        const res = await api.login({ email: email.trim(), password });
        setInMemoryToken(res.token);
        await refreshBootstrap();
        notify(`Welcome back, ${res.user.name}.`, 'success');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to reach the authentication server.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setDemoLoading(true);
    try {
      await signInDemo();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080B0D] text-[#F5F7F5] flex flex-col lg:flex-row">
      {/* Left Brand Showcase */}
      <div className="relative lg:w-[54%] p-6 sm:p-10 lg:p-14 flex flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10">
        <img
          src="/src/assets/images/hero_fitness_os_1795206871132.jpg"
          alt="FITTRACK X ULTRA Training Studio"
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080B0D] via-[#080B0D]/80 to-[#080B0D]/60" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#B7FF67] text-[#080B0D] flex items-center justify-center font-bold">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display font-bold tracking-wider text-lg text-[#F5F7F5]">
              FITTRACK <span className="text-[#B7FF67]">X ULTRA</span>
            </div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#A0AAA7]">
              Personal Fitness Operating System
            </div>
          </div>
        </div>

        <div className="relative z-10 my-10 lg:my-0 max-w-xl">
          <p className="text-xs font-mono uppercase tracking-[0.22em] text-[#40E0D0] mb-3">
            YOUR BODY. YOUR INTELLIGENCE. YOUR EVOLUTION.
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.1] text-[#F5F7F5]">
            Precision biomechanics, 3D anatomy & adaptive AI coaching.
          </h1>
          <p className="text-sm sm:text-base text-[#A0AAA7] mt-4 leading-relaxed">
            Inspect 40 interactive 3D muscle groups, explore 181 biomechanically structured exercises,
            run live workouts with automatic PR tracking, and calibrate your nutrition and recovery in
            one unified workspace.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            {[
              { label: '3D Muscle Regions', value: '40' },
              { label: 'Exercise Library', value: '181' },
              { label: 'AI Form & Coach', value: 'Gemini' },
              { label: 'Storage', value: 'SQLite' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-[#101619]/90 border border-white/10 rounded-xl px-3.5 py-3"
              >
                <div className="text-lg font-bold font-mono tabular-nums text-[#B7FF67]">
                  {stat.value}
                </div>
                <div className="text-xs text-[#A0AAA7] mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs text-[#A0AAA7]">
          <ShieldCheck className="w-4 h-4 text-[#40E0D0] shrink-0" />
          <span>
            Private workspace backed by local SQLite persistence and server-side AI routing.
          </span>
        </div>
      </div>

      {/* Right Authentication Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-14 bg-[#080B0D]">
        <div className="w-full max-w-md bg-[#101619] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex gap-1 p-1 bg-[#080B0D] rounded-xl border border-white/10 mb-6">
            {(
              [
                { id: 'login', label: 'Sign In' },
                { id: 'register', label: 'Create Account' },
                { id: 'forgot', label: 'Recovery' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMode(tab.id);
                  setError(null);
                  setInfoMsg(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  mode === tab.id
                    ? 'bg-[#B7FF67] text-[#080B0D]'
                    : 'text-[#A0AAA7] hover:text-[#F5F7F5]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <h2 className="text-xl font-bold text-[#F5F7F5]">
            {mode === 'login'
              ? 'Access Your Training OS'
              : mode === 'register'
                ? 'Initialize Athlete Profile'
                : 'Account Recovery'}
          </h2>
          <p className="text-xs text-[#A0AAA7] mt-1 mb-6">
            {mode === 'login'
              ? 'Sign in with your account credentials or launch the seeded Demo Athlete workspace.'
              : mode === 'register'
                ? 'Your workouts, nutrition logs, and measurements are saved privately to your account.'
                : 'Local workspace password policy and recovery options.'}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
              {error}
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 p-3 rounded-lg bg-[#40E0D0]/10 border border-[#40E0D0]/30 text-xs text-[#40E0D0]">
              {infoMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-medium text-[#A0AAA7] mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#A0AAA7] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-name"
                    type="text"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Mercer"
                    className="w-full bg-[#080B0D] border border-white/15 rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#F5F7F5] focus:outline-none focus:border-[#B7FF67]"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-[#A0AAA7] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#A0AAA7] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="athlete@fittrack.ultra"
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#F5F7F5] focus:outline-none focus:border-[#B7FF67]"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-medium text-[#A0AAA7] mb-1.5"
                >
                  Password {mode === 'register' && '(min 8 characters)'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#A0AAA7] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#080B0D] border border-white/15 rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#F5F7F5] focus:outline-none focus:border-[#B7FF67]"
                  />
                </div>
              </div>
            )}

            <PrimaryButton type="submit" loading={loading} className="w-full py-3">
              {mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                  ? 'Create Athlete Account'
                  : 'Check Recovery Options'}
              <ArrowRight className="w-4 h-4" />
            </PrimaryButton>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-[#101619] text-[#A0AAA7]">Instant Exploration</span>
            </div>
          </div>

          <SecondaryButton
            type="button"
            onClick={handleDemo}
            disabled={demoLoading}
            className="w-full py-3 border-[#B7FF67]/35 text-[#B7FF67] hover:border-[#B7FF67] hover:text-[#B7FF67]"
          >
            <Sparkles className="w-4 h-4" />
            {demoLoading ? 'Launching Demo Athlete...' : 'Launch Demo Athlete (Alex Mercer)'}
          </SecondaryButton>

          <div className="mt-5 p-3 rounded-lg bg-[#080B0D] border border-white/5 text-[11px] text-[#A0AAA7] leading-relaxed flex items-start gap-2">
            <Dumbbell className="w-3.5 h-3.5 text-[#40E0D0] shrink-0 mt-0.5" />
            <span>
              Demo Athlete includes seeded training sessions, 3D muscle recovery history, body
              measurements, and nutrition entries. Google Sign-In & Cloud Firestore sync are disabled
              because Firebase provisioning was declined.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
