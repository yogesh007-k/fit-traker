import React, { useState } from 'react';
import {
  Bluetooth,
  Brain,
  Download,
  Lock,
  Plus,
  Trash2,
  Watch,
} from 'lucide-react';
import { useFitness } from '../context/FitnessContext';
import { api, ApiError } from '../services/api';
import {
  Card,
  ConfirmDialog,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from '../components/ui/Primitives';

export const SettingsPage: React.FC = () => {
  const { profile, aiMemory, refreshBootstrap, signOut, notify } = useFitness();

  const [units, setUnits] = useState<'metric' | 'imperial'>(profile?.units || 'metric');
  const [language, setLanguage] = useState<'en' | 'ta'>(profile?.language || 'en');
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    profile?.notificationsEnabled ?? true
  );
  const [aiMemoryEnabled, setAiMemoryEnabled] = useState(profile?.aiMemoryEnabled ?? true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // AI Memory
  const [memKey, setMemKey] = useState('');
  const [memValue, setMemValue] = useState('');

  // Password Change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Wearable Command Center (Honest Status)
  const [btStatus, setBtStatus] = useState<string>(
    typeof navigator !== 'undefined' && 'bluetooth' in navigator
      ? 'Web Bluetooth API available for standard BLE Heart Rate monitors (0x180D).'
      : 'Web Bluetooth API is unavailable in this browser. Apple Health / Google Fit native SDKs require mobile app bridges.'
  );
  const [manualHr, setManualHr] = useState('62');
  const [manualSteps, setManualSteps] = useState('8400');

  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleSavePrefs = async () => {
    if (!profile) return;
    setSavingPrefs(true);
    try {
      await api.updateProfile({
        ...profile,
        units,
        language,
        notificationsEnabled,
        aiMemoryEnabled,
      });
      await refreshBootstrap();
      notify('System preferences saved.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save preferences.', 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memKey.trim() || !memValue.trim()) return;
    try {
      await api.addAiMemory(memKey.trim(), memValue.trim());
      setMemKey('');
      setMemValue('');
      await refreshBootstrap();
      notify('AI coaching memory added.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to add memory.', 'error');
    }
  };

  const handleDeleteMemory = async (id: string) => {
    await api.deleteAiMemory(id);
    await refreshBootstrap();
    notify('AI memory item removed.', 'info');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwLoading(true);
    try {
      await api.resetPassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      notify('Password updated successfully.', 'success');
    } catch (err) {
      notify(
        err instanceof ApiError ? err.message : 'Failed to update password.',
        'error'
      );
    } finally {
      setPwLoading(false);
    }
  };

  const handleScanBleHeartRate = async () => {
    const nav = navigator as Navigator & {
      bluetooth?: { requestDevice: (opts: unknown) => Promise<{ name?: string }> };
    };
    if (!nav.bluetooth) {
      setBtStatus('Web Bluetooth is not supported in this browser environment.');
      return;
    }
    try {
      const device = await nav.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
      });
      setBtStatus(`Paired BLE Heart Rate Sensor: ${device.name || 'Unnamed Sensor'}`);
    } catch (err) {
      setBtStatus(
        err instanceof Error
          ? `Bluetooth scan cancelled or unavailable: ${err.message}`
          : 'Bluetooth scan cancelled.'
      );
    }
  };

  const handleExportJson = () => {
    window.location.assign('/api/account/export');
  };

  const handleDeleteAccount = async () => {
    try {
      await api.deleteAccount();
      setDeleteOpen(false);
      await signOut();
    } catch (err) {
      setDeleteOpen(false);
      notify(err instanceof Error ? err.message : 'Failed to delete account.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings & Command Center"
        subtitle="Manage units, bilingual coach language, persistent AI memory, wearable input modes, data export, and account security."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Preferences */}
        <Card className="lg:col-span-6 space-y-4">
          <h2 className="text-base font-semibold text-[#F5F7F5]">Preferences & Localization</h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[#A0AAA7] mb-1">Measurement Units</label>
              <select
                value={units}
                onChange={(e) => setUnits(e.target.value as 'metric' | 'imperial')}
                className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-sm text-[#F5F7F5]"
              >
                <option value="metric">Metric (kg / cm)</option>
                <option value="imperial">Imperial (lb / in)</option>
              </select>
            </div>
            <div>
              <label className="block text-[#A0AAA7] mb-1">AI Coach Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'en' | 'ta')}
                className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-sm text-[#F5F7F5]"
              >
                <option value="en">English</option>
                <option value="ta">தமிழ் (Tamil)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2.5 text-xs pt-2">
            <label className="flex items-center justify-between bg-[#080B0D] border border-white/10 rounded-xl px-3.5 py-2.5 cursor-pointer">
              <span>Workout & Hydration Reminders</span>
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="accent-[#B7FF67]"
              />
            </label>
            <label className="flex items-center justify-between bg-[#080B0D] border border-white/10 rounded-xl px-3.5 py-2.5 cursor-pointer">
              <span>Enable Persistent AI Coach Memory</span>
              <input
                type="checkbox"
                checked={aiMemoryEnabled}
                onChange={(e) => setAiMemoryEnabled(e.target.checked)}
                className="accent-[#B7FF67]"
              />
            </label>
          </div>

          <PrimaryButton onClick={handleSavePrefs} loading={savingPrefs}>
            Save Preferences
          </PrimaryButton>
        </Card>

        {/* Wearable Command Center */}
        <Card className="lg:col-span-6 space-y-4">
          <h2 className="text-base font-semibold text-[#F5F7F5] flex items-center gap-2">
            <Watch className="w-4 h-4 text-[#40E0D0]" /> Wearable Command Center
          </h2>
          <p className="text-xs text-[#A0AAA7] leading-relaxed">
            Honest Integration Status: Apple Health, Google Fit, and Garmin Connect OAuth bridges
            are not provisioned in this web runtime. Use direct Web Bluetooth HR scanning (where
            browser supports it) or manual biometric entry below.
          </p>

          <div className="bg-[#080B0D] border border-white/10 rounded-xl p-3.5 text-xs space-y-3">
            <div className="text-[#40E0D0]">{btStatus}</div>
            <SecondaryButton onClick={handleScanBleHeartRate} className="text-xs py-2">
              <Bluetooth className="w-3.5 h-3.5" /> Scan Web Bluetooth HR Sensor
            </SecondaryButton>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[#A0AAA7] mb-1">Manual Resting HR (bpm)</label>
              <input
                type="number"
                value={manualHr}
                onChange={(e) => setManualHr(e.target.value)}
                className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 font-mono text-[#F5F7F5]"
              />
            </div>
            <div>
              <label className="block text-[#A0AAA7] mb-1">Manual Daily Steps</label>
              <input
                type="number"
                value={manualSteps}
                onChange={(e) => setManualSteps(e.target.value)}
                className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 font-mono text-[#F5F7F5]"
              />
            </div>
          </div>
        </Card>
      </div>

      {/* AI Persistent Memory Controls */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-[#F5F7F5] flex items-center gap-2">
          <Brain className="w-4 h-4 text-[#B7FF67]" /> Persistent AI Memory ({aiMemory.length})
        </h2>
        <form onSubmit={handleAddMemory} className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
          <input
            type="text"
            value={memKey}
            onChange={(e) => setMemKey(e.target.value)}
            placeholder="Topic (e.g., Knee Sensitivity)"
            className="sm:col-span-4 bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-[#F5F7F5]"
          />
          <input
            type="text"
            value={memValue}
            onChange={(e) => setMemValue(e.target.value)}
            placeholder="Instruction for AI Coach (e.g., Avoid deep forward lunges)"
            className="sm:col-span-6 bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-[#F5F7F5]"
          />
          <PrimaryButton type="submit" className="sm:col-span-2 text-xs py-2">
            <Plus className="w-3.5 h-3.5" /> Add Memory
          </PrimaryButton>
        </form>

        <div className="space-y-2">
          {aiMemory.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 bg-[#080B0D] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs"
            >
              <div>
                <span className="font-semibold text-[#B7FF67]">{item.memoryKey}: </span>
                <span className="text-[#F5F7F5]">{item.memoryValue}</span>
              </div>
              <button
                type="button"
                aria-label="Delete AI memory"
                onClick={() => handleDeleteMemory(item.id)}
                className="text-[#A0AAA7] hover:text-red-400 cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Account Security, Export & Deletion */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-6 space-y-4">
          <h2 className="text-base font-semibold text-[#F5F7F5] flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#40E0D0]" /> Update Account Password
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5]"
            />
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
              className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5]"
            />
            <SecondaryButton type="submit" disabled={pwLoading}>
              {pwLoading ? 'Updating...' : 'Update Password'}
            </SecondaryButton>
          </form>
        </Card>

        <Card className="lg:col-span-6 space-y-4">
          <h2 className="text-base font-semibold text-[#F5F7F5]">Data Portability & Privacy</h2>
          <p className="text-xs text-[#A0AAA7]">
            Export a complete JSON archive of your workouts, plans, nutrition diary, recovery
            check-ins, and measurements, or permanently delete a personal account.
          </p>
          <div className="flex flex-wrap gap-3">
            <SecondaryButton onClick={handleExportJson}>
              <Download className="w-4 h-4 text-[#B7FF67]" /> Export JSON Archive
            </SecondaryButton>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Delete Account
            </button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Permanently Delete Account?"
        message="All personal workouts, nutrition logs, measurements, and AI conversations will be permanently erased from SQLite. (The shared Demo Athlete account cannot be deleted.)"
        confirmLabel="Delete Permanently"
        danger
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
};
