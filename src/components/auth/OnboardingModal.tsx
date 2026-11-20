import React, { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { useFitness } from '../../context/FitnessContext';
import { api } from '../../services/api';
import { ExperienceLevel, FitnessGoal, UserProfile, WorkoutLocation } from '../../types/fitness';
import { PrimaryButton, SecondaryButton } from '../ui/Primitives';

const EQUIPMENT_OPTIONS = [
  'Bodyweight',
  'Dumbbells',
  'Barbell',
  'Bench',
  'Pull-up Bar',
  'Cables',
  'Machines',
  'Kettlebells',
  'Resistance Bands',
];

export const OnboardingModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { profile, refreshBootstrap, notify } = useFitness();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [age, setAge] = useState<string>('27');
  const [heightCm, setHeightCm] = useState<string>('175');
  const [weightKg, setWeightKg] = useState<string>('74');
  const [experience, setExperience] = useState<ExperienceLevel>('intermediate');
  const [goal, setGoal] = useState<FitnessGoal>('muscle_gain');
  const [location, setLocation] = useState<WorkoutLocation>('both');
  const [weeklyDays, setWeeklyDays] = useState<number>(4);
  const [preferredDurationMin, setPreferredDurationMin] = useState<number>(55);
  const [equipment, setEquipment] = useState<string[]>(['Dumbbells', 'Barbell', 'Bench', 'Bodyweight']);
  const [dietaryPref, setDietaryPref] = useState<UserProfile['dietaryPref']>('non_veg');
  const [activityLevel, setActivityLevel] = useState<UserProfile['activityLevel']>('moderate');
  const [limitations, setLimitations] = useState('');

  useEffect(() => {
    if (profile && open) {
      setStep(1);
      setName(profile.name || '');
      setAge(profile.age ? String(profile.age) : '27');
      setHeightCm(profile.heightCm ? String(profile.heightCm) : '175');
      setWeightKg(profile.weightKg ? String(profile.weightKg) : '74');
      setExperience(profile.experience || 'beginner');
      setGoal(profile.goal || 'muscle_gain');
      setLocation(profile.location || 'both');
      setWeeklyDays(profile.weeklyDays || 4);
      setPreferredDurationMin(profile.preferredDurationMin || 50);
      setEquipment(profile.equipment.length ? profile.equipment : ['Bodyweight', 'Dumbbells']);
      setDietaryPref(profile.dietaryPref || 'non_veg');
      setActivityLevel(profile.activityLevel || 'moderate');
      setLimitations(profile.limitations || '');
    }
  }, [profile, open]);

  if (!open || !profile) return null;

  const toggleEquipment = (item: string) => {
    setEquipment((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      await api.updateProfile({ ...profile, onboardingCompleted: true });
      await refreshBootstrap();
      onClose();
    } catch {
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateProfile({
        name: name.trim() || profile.name,
        age: Number(age) || null,
        heightCm: Number(heightCm) || null,
        weightKg: Number(weightKg) || null,
        experience,
        goal,
        location,
        weeklyDays,
        preferredDurationMin,
        equipment,
        dietaryPref,
        activityLevel,
        limitations,
        onboardingCompleted: true,
      });
      await refreshBootstrap();
      notify('Athlete calibration saved.', 'success');
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save calibration.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Athlete Calibration Wizard"
    >
      <div className="bg-[#101619] border border-white/15 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl my-auto">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#B7FF67]">
              <Sparkles className="w-3.5 h-3.5" /> Step {step} of 3
            </div>
            <h2 className="text-xl font-bold text-[#F5F7F5] mt-1">
              Calibrate Your FITTRACK X ULTRA System
            </h2>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            aria-label="Skip onboarding"
            className="text-[#A0AAA7] hover:text-[#F5F7F5] p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#A0AAA7] mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5] focus:border-[#B7FF67] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A0AAA7] mb-1.5">Age (years)</label>
                  <input
                    type="number"
                    min={13}
                    max={100}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5] font-mono tabular-nums focus:border-[#B7FF67] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A0AAA7] mb-1.5">Height (cm)</label>
                  <input
                    type="number"
                    min={100}
                    max={250}
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5] font-mono tabular-nums focus:border-[#B7FF67] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A0AAA7] mb-1.5">Weight (kg)</label>
                  <input
                    type="number"
                    min={30}
                    max={300}
                    step="0.5"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5] font-mono tabular-nums focus:border-[#B7FF67] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#A0AAA7] mb-2">Daily Activity Level</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(
                    [
                      { id: 'sedentary', label: 'Sedentary' },
                      { id: 'light', label: 'Light' },
                      { id: 'moderate', label: 'Moderate' },
                      { id: 'active', label: 'Active' },
                      { id: 'athlete', label: 'Athlete' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setActivityLevel(opt.id)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        activityLevel === opt.id
                          ? 'bg-[#B7FF67]/15 border-[#B7FF67] text-[#B7FF67]'
                          : 'bg-[#080B0D] border-white/10 text-[#A0AAA7] hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#A0AAA7] mb-2">Experience Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['beginner', 'intermediate', 'advanced'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setExperience(lvl)}
                      className={`py-3 px-4 rounded-xl text-sm font-semibold capitalize border transition-colors cursor-pointer ${
                        experience === lvl
                          ? 'bg-[#B7FF67]/15 border-[#B7FF67] text-[#B7FF67]'
                          : 'bg-[#080B0D] border-white/10 text-[#A0AAA7] hover:text-white'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#A0AAA7] mb-2">Primary Fitness Goal</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: 'muscle_gain', label: 'Muscle Gain' },
                      { id: 'fat_loss', label: 'Fat Loss' },
                      { id: 'strength', label: 'Strength' },
                      { id: 'recomposition', label: 'Recomposition' },
                      { id: 'endurance', label: 'Endurance' },
                      { id: 'general_health', label: 'General Health' },
                    ] as const
                  ).map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGoal(g.id)}
                      className={`py-2.5 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        goal === g.id
                          ? 'bg-[#40E0D0]/15 border-[#40E0D0] text-[#40E0D0]'
                          : 'bg-[#080B0D] border-white/10 text-[#A0AAA7] hover:text-white'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-[#A0AAA7] mb-1.5">Training Environment</label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value as WorkoutLocation)}
                    className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5]"
                  >
                    <option value="both">Gym + Home</option>
                    <option value="gym">Commercial Gym</option>
                    <option value="home">Home Setup</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#A0AAA7] mb-1.5">Days / Week ({weeklyDays})</label>
                  <input
                    type="range"
                    min={1}
                    max={7}
                    value={weeklyDays}
                    onChange={(e) => setWeeklyDays(Number(e.target.value))}
                    className="w-full accent-[#B7FF67] mt-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#A0AAA7] mb-1.5">
                    Duration ({preferredDurationMin} min)
                  </label>
                  <input
                    type="range"
                    min={20}
                    max={120}
                    step={5}
                    value={preferredDurationMin}
                    onChange={(e) => setPreferredDurationMin(Number(e.target.value))}
                    className="w-full accent-[#40E0D0] mt-2"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#A0AAA7] mb-2">Available Equipment</label>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT_OPTIONS.map((item) => {
                    const active = equipment.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleEquipment(item)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#B7FF67]/15 border-[#B7FF67] text-[#B7FF67]'
                            : 'bg-[#080B0D] border-white/10 text-[#A0AAA7] hover:text-white'
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5" />}
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#A0AAA7] mb-1.5">Dietary Preference</label>
                <select
                  value={dietaryPref}
                  onChange={(e) => setDietaryPref(e.target.value as UserProfile['dietaryPref'])}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5]"
                >
                  <option value="non_veg">Non-Vegetarian (All Proteins)</option>
                  <option value="vegetarian">Vegetarian (Dairy & Plant)</option>
                  <option value="eggetarian">Eggetarian</option>
                  <option value="pescatarian">Pescatarian</option>
                  <option value="vegan">Vegan (100% Plant-Based)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#A0AAA7] mb-1.5">
                  Injuries, Joint Sensitivities, or Limitations (Optional)
                </label>
                <textarea
                  rows={2}
                  value={limitations}
                  onChange={(e) => setLimitations(e.target.value)}
                  placeholder="e.g., Mild left knee discomfort on deep lunges, prefer neutral grip presses"
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-sm text-[#F5F7F5] focus:border-[#B7FF67] focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-5 mt-6">
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="text-xs text-[#A0AAA7] hover:text-white underline cursor-pointer"
          >
            Skip for now
          </button>

          <div className="flex items-center gap-3">
            {step > 1 && (
              <SecondaryButton type="button" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="w-4 h-4" /> Back
              </SecondaryButton>
            )}
            {step < 3 ? (
              <PrimaryButton type="button" onClick={() => setStep((s) => s + 1)}>
                Continue <ChevronRight className="w-4 h-4" />
              </PrimaryButton>
            ) : (
              <PrimaryButton type="button" onClick={handleSave} loading={saving}>
                Complete Setup <Check className="w-4 h-4" />
              </PrimaryButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
