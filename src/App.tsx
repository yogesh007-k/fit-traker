/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { FitnessProvider, useFitness } from './context/FitnessContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { OnboardingModal } from './components/auth/OnboardingModal';
import { AppShell } from './components/layout/AppShell';
import { ToastContainer } from './components/ui/Primitives';
import { OverviewPage } from './pages/OverviewPage';
import { AICoachPage } from './pages/AICoachPage';
import { AnatomyPage } from './pages/AnatomyPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { PlannerPage } from './pages/PlannerPage';
import { LiveWorkoutPage } from './pages/LiveWorkoutPage';
import { FormLabPage } from './pages/FormLabPage';
import { NutritionPage } from './pages/NutritionPage';
import { RecoveryPage } from './pages/RecoveryPage';
import { TransformationPage } from './pages/TransformationPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';

const FitTrackWorkspace: React.FC = () => {
  const { loadingAuth, user, profile, activePage, toasts, dismissToast } = useFitness();
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    if (user && profile && !profile.onboardingCompleted) {
      setOnboardingOpen(true);
    }
  }, [user, profile?.onboardingCompleted]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#080B0D] text-[#F5F7F5] flex flex-col items-center justify-center gap-3">
        <div className="w-9 h-9 border-2 border-[#B7FF67]/30 border-t-[#B7FF67] rounded-full animate-spin" />
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-[#A0AAA7]">
          Initializing FITTRACK X ULTRA...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthScreen />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case 'overview':
        return <OverviewPage />;
      case 'ai-coach':
        return <AICoachPage />;
      case 'anatomy':
        return <AnatomyPage />;
      case 'exercises':
        return <ExercisesPage />;
      case 'planner':
        return <PlannerPage />;
      case 'live-workout':
        return <LiveWorkoutPage />;
      case 'form-lab':
        return <FormLabPage />;
      case 'nutrition':
        return <NutritionPage />;
      case 'recovery':
        return <RecoveryPage />;
      case 'transformation':
        return <TransformationPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'achievements':
        return <AchievementsPage />;
      case 'profile':
        return <ProfilePage onOpenOnboarding={() => setOnboardingOpen(true)} />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <>
      <AppShell>{renderPage()}</AppShell>
      <OnboardingModal open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
};

export default function App() {
  return (
    <FitnessProvider>
      <FitTrackWorkspace />
    </FitnessProvider>
  );
}
