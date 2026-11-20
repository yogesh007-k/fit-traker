import React, { useEffect, useState } from 'react';
import { Check, Save, Sparkles } from 'lucide-react';
import { useFitness } from '../context/FitnessContext';
import { api } from '../services/api';
import { ExperienceLevel, FitnessGoal, UserProfile, WorkoutLocation } from '../types/fitness';
import { Card, PageHeader, PrimaryButton, SecondaryButton } from '../components/ui/Primitives';

const EQUIPMENT_LIST = [
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

export const ProfilePage: React.FC<{ onOpenOnboarding: () => void }> = ({ onOpenOnboarding }) => {
  const { profile, user, macroTargets, refreshBootstrap, notify } = useFitness();

  const [name, setName] = useState(profile?.name || '');
  const [age, setAge] = useState(String(profile?.age || ''));
  const [heightCm, setHeightCm] = useState(String(profile?.heightCm || ''));
  const [weightKg, setWeightKg] = useState(String(profile?.weightKg || ''));
  const [experience, setExperience] = useState<ExperienceLevel>(profile?.experience || 'beginner');
  const [goal, setGoal] = useState<FitnessGoal>(profile?.goal || 'muscle_gain');
  const [location, setLocation] = useState<WorkoutLocation>(profile?.location || 'both');
  const [weeklyDays, setWeeklyDays] = useState(profile?.weeklyDays || 4);
  const [preferredDurationMin, setPreferredDurationMin] = useState(
    profile?.preferredDurationMin || 50
  );
  const [equipment, setEquipment] = useState<string[]>(profile?.equipment || []);
  const [dietaryPref, setDietaryPref] = useState<UserProfile['dietaryPref']>(
    profile?.dietaryPref || 'non_veg'
  );
  const [activityLevel, setActivityLevel] = useState<UserProfile['activityLevel']>(
    profile?.activityLevel || 'moderate'
  );
  const [limitations, setLimitations] = useState(profile?.limitations || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setAge(profile.age ? String(profile.age) : '');
    setHeightCm(profile.heightCm ? String(profile.heightCm) : '');
    setWeightKg(profile.weightKg ? String(profile.weightKg) : '');
    setExperience(profile.experience);
    setGoal(profile.goal);
    setLocation(profile.location);
    setWeeklyDays(profile.weeklyDays);
    setPreferredDurationMin(profile.preferredDurationMin);
    setEquipment(profile.equipment);
    setDietaryPref(profile.dietaryPref);
    setActivityLevel(profile.activityLevel);
    setLimitations(profile.limitations);
  }, [profile]);

  const toggleEquipment = (item: string) => {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile({
        ...profile,
        name: name.trim(),
        age: age ? Number(age) : null,
        heightCm: heightCm ? Number(heightCm) : null,
        weightKg: weightKg ? Number(weightKg) : null,
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
      notify('Athlete profile updated. Macro targets recalculated.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Athlete Profile & Biometrics"
        subtitle="Your profile drives calorie/macro calculations, AI coaching recommendations, and workout plan generation."
        actions={
          <SecondaryButton onClick={onOpenOnboarding}>
            <Sparkles className="w-4 h-4 text-[#B7FF67]" /> Launch Setup Wizard
          </SecondaryButton>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-4 space-y-4">
          <div className="flex items-center gap-4">
            <img
              src="/src/assets/images/avatar_athlete_1795206869953.jpg"
              alt={profile?.name || 'Athlete'}
              className="w-16 h-16 rounded-2xl object-cover border border-white/20"
            />
            <div>
              <h2 className="text-lg font-bold text-[#F5F7F5]">{profile?.name}</h2>
              <p className="text-xs text-[#A0AAA7]">{user?.email}</p>
              <p className="text-xs font-mono text-[#B7FF67] capitalize mt-0.5">
                {profile?.experience} · {profile?.goal.replace('_', ' ')}
              </p>
            </div>
          </div>

          <div className="bg-[#080B0D] border border-white/10 rounded-xl p-4 space-y-2 text-xs">
            <div className="font-semibold text-[#40E0D0]">Calculated Daily Targets</div>
            <div className="flex justify-between font-mono">
              <span className="text-[#A0AAA7]">Calories</span>
              <span className="text-[#F5F7F5]">{macroTargets.calories} kcal</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-[#A0AAA7]">Protein</span>
              <span className="text-[#B7FF67]">{macroTargets.proteinG} g</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-[#A0AAA7]">Carbs / Fats</span>
              <span className="text-[#F5F7F5]">
                {macroTargets.carbsG}g / {macroTargets.fatG}g
              </span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-[#A0AAA7]">Water Target</span>
              <span className="text-[#40E0D0]">{macroTargets.waterMl} ml</span>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-8">
          <form onSubmit={handleSave} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[#A0AAA7] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Age</label>
                <input
                  type="number"
                  min={13}
                  max={105}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm font-mono text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Height (cm)</label>
                <input
                  type="number"
                  min={100}
                  max={250}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm font-mono text-[#F5F7F5]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[#A0AAA7] mb-1">Current Weight (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm font-mono text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Experience</label>
                <select
                  value={experience}
                  onChange={(e) => setExperience(e.target.value as ExperienceLevel)}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5]"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Primary Goal</label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as FitnessGoal)}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5]"
                >
                  <option value="muscle_gain">Muscle Gain</option>
                  <option value="fat_loss">Fat Loss</option>
                  <option value="strength">Strength</option>
                  <option value="recomposition">Recomposition</option>
                  <option value="endurance">Endurance</option>
                  <option value="general_health">General Health</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[#A0AAA7] mb-1">Location</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value as WorkoutLocation)}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5]"
                >
                  <option value="both">Gym + Home</option>
                  <option value="gym">Gym</option>
                  <option value="home">Home</option>
                </select>
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Days / Week</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={weeklyDays}
                  onChange={(e) => setWeeklyDays(Number(e.target.value))}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm font-mono text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Session Min</label>
                <input
                  type="number"
                  min={15}
                  max={180}
                  value={preferredDurationMin}
                  onChange={(e) => setPreferredDurationMin(Number(e.target.value))}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm font-mono text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-[#A0AAA7] mb-1">Dietary Pref</label>
                <select
                  value={dietaryPref}
                  onChange={(e) => setDietaryPref(e.target.value as UserProfile['dietaryPref'])}
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5]"
                >
                  <option value="non_veg">Non-Veg</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="eggetarian">Eggetarian</option>
                  <option value="pescatarian">Pescatarian</option>
                  <option value="vegan">Vegan</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[#A0AAA7] mb-1.5">Available Equipment</label>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_LIST.map((item) => {
                  const active = equipment.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleEquipment(item)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer ${
                        active
                          ? 'bg-[#B7FF67]/15 border-[#B7FF67] text-[#B7FF67]'
                          : 'bg-[#080B0D] border-white/10 text-[#A0AAA7]'
                      }`}
                    >
                      {active && <Check className="w-3 h-3" />}
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[#A0AAA7] mb-1">Activity Level</label>
              <select
                value={activityLevel}
                onChange={(e) =>
                  setActivityLevel(e.target.value as UserProfile['activityLevel'])
                }
                className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2.5 text-sm text-[#F5F7F5]"
              >
                <option value="sedentary">Sedentary</option>
                <option value="light">Lightly Active</option>
                <option value="moderate">Moderately Active</option>
                <option value="active">Very Active</option>
                <option value="athlete">High-Volume Athlete</option>
              </select>
            </div>

            <div>
              <label className="block text-[#A0AAA7] mb-1">Injuries / Limitations</label>
              <textarea
                rows={2}
                value={limitations}
                onChange={(e) => setLimitations(e.target.value)}
                className="w-full bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-sm text-[#F5F7F5]"
              />
            </div>

            <div className="flex justify-end">
              <PrimaryButton type="submit" loading={saving}>
                <Save className="w-4 h-4" /> Save Profile Changes
              </PrimaryButton>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
