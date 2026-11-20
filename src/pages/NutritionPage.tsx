import React, { useMemo, useState } from 'react';
import {
  Droplets,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  Utensils,
} from 'lucide-react';
import { useFitness } from '../context/FitnessContext';
import { FOOD_DATABASE, FoodItem } from '../data/foods';
import { api, ApiError } from '../services/api';
import { MealType } from '../types/fitness';
import {
  Card,
  PageHeader,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
} from '../components/ui/Primitives';

const MEAL_TYPES: Array<{ id: MealType; label: string }> = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snacks' },
];

export const NutritionPage: React.FC = () => {
  const { nutritionLogs, waterLogs, macroTargets, refreshBootstrap, notify } = useFitness();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [foodSearch, setFoodSearch] = useState('');
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'vegan'>('all');

  // Custom Food Form
  const [customName, setCustomName] = useState('');
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [customUnit, setCustomUnit] = useState('1 serving');

  // AI Meal Ideas
  const [mealFocus, setMealFocus] = useState('');
  const [aiMeals, setAiMeals] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const dayLogs = useMemo(
    () => nutritionLogs.filter((n) => n.logDate === selectedDate),
    [nutritionLogs, selectedDate]
  );

  const dayTotals = useMemo(
    () =>
      dayLogs.reduce(
        (acc, n) => ({
          calories: acc.calories + n.calories,
          proteinG: acc.proteinG + n.proteinG,
          carbsG: acc.carbsG + n.carbsG,
          fatG: acc.fatG + n.fatG,
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
      ),
    [dayLogs]
  );

  const dayWaterMl = useMemo(
    () => waterLogs.find((w) => w.logDate === selectedDate)?.amountMl ?? 0,
    [waterLogs, selectedDate]
  );

  const filteredFoods = useMemo(() => {
    const q = foodSearch.trim().toLowerCase();
    return FOOD_DATABASE.filter((f) => {
      if (dietFilter === 'veg' && !f.vegetarian) return false;
      if (dietFilter === 'vegan' && !f.vegan) return false;
      if (q && !f.name.toLowerCase().includes(q) && !f.category.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [foodSearch, dietFilter]);

  const favoriteEntries = useMemo(() => {
    const seen = new Set<string>();
    return nutritionLogs.filter((n) => {
      if (!n.isFavorite || seen.has(n.foodName)) return false;
      seen.add(n.foodName);
      return true;
    });
  }, [nutritionLogs]);

  const handleLogFood = async (food: FoodItem) => {
    try {
      await api.addNutrition({
        logDate: selectedDate,
        mealType,
        foodName: food.name,
        servingQty: 1,
        servingUnit: food.servingUnit,
        calories: food.calories,
        proteinG: food.proteinG,
        carbsG: food.carbsG,
        fatG: food.fatG,
      });
      await refreshBootstrap();
      notify(`Logged ${food.name} to ${mealType}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to log food.', 'error');
    }
  };

  const handleLogCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    try {
      await api.addNutrition({
        logDate: selectedDate,
        mealType,
        foodName: customName.trim(),
        servingQty: 1,
        servingUnit: customUnit.trim() || '1 serving',
        calories: Number(customCalories) || 0,
        proteinG: Number(customProtein) || 0,
        carbsG: Number(customCarbs) || 0,
        fatG: Number(customFat) || 0,
      });
      setCustomName('');
      setCustomCalories('');
      setCustomProtein('');
      setCustomCarbs('');
      setCustomFat('');
      await refreshBootstrap();
      notify('Custom food logged.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to log custom food.', 'error');
    }
  };

  const handleUpdateQty = async (id: string, delta: number, currentQty: number) => {
    const nextQty = Math.max(0.5, Math.round((currentQty + delta) * 10) / 10);
    await api.updateNutrition(id, { servingQty: nextQty });
    await refreshBootstrap();
  };

  const handleToggleFav = async (id: string, current: boolean) => {
    await api.updateNutrition(id, { isFavorite: !current });
    await refreshBootstrap();
  };

  const handleDeleteEntry = async (id: string) => {
    await api.deleteNutrition(id);
    await refreshBootstrap();
    notify('Food entry removed.', 'info');
  };

  const handleWaterAdjust = async (nextMl: number) => {
    await api.setWater(selectedDate, Math.max(0, nextMl));
    await refreshBootstrap();
  };

  const handleGetAiMeals = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await api.aiMealIdeas(
        mealFocus.trim() || 'High-protein balanced meal ideas matching my remaining macros'
      );
      setAiMeals(res.suggestions);
    } catch (err) {
      setAiError(
        err instanceof ApiError ? err.message : 'Unable to fetch AI meal ideas.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nutrition & Macro Intelligence"
        subtitle="Calorie and macronutrient targets calculated via Mifflin-St Jeor + goal offset, paired with USDA-grounded food items."
        actions={
          <input
            type="date"
            aria-label="Nutrition log date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-[#101619] border border-white/15 rounded-lg px-3 py-2 text-sm text-[#F5F7F5] font-mono"
          />
        }
      />

      {/* Macro Targets & Hydration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#F5F7F5]">Daily Macro Targets</h2>
            <span className="text-xs font-mono text-[#A0AAA7]">
              BMR {macroTargets.bmr} · TDEE {macroTargets.tdee} kcal
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProgressBar
              value={dayTotals.calories}
              max={macroTargets.calories}
              color="lime"
              label="Calories (kcal)"
            />
            <ProgressBar
              value={dayTotals.proteinG}
              max={macroTargets.proteinG}
              color="cyan"
              label="Protein (g)"
            />
            <ProgressBar
              value={dayTotals.carbsG}
              max={macroTargets.carbsG}
              color="amber"
              label="Carbohydrates (g)"
            />
            <ProgressBar
              value={dayTotals.fatG}
              max={macroTargets.fatG}
              color="lime"
              label="Fats (g)"
            />
          </div>
        </Card>

        <Card className="lg:col-span-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#F5F7F5] flex items-center gap-2">
                <Droplets className="w-4 h-4 text-[#40E0D0]" /> Hydration
              </h2>
              <span className="text-sm font-mono tabular-nums text-[#40E0D0] font-bold">
                {dayWaterMl} ml
              </span>
            </div>
            <div className="mt-3">
              <ProgressBar
                value={dayWaterMl}
                max={macroTargets.waterMl}
                color="cyan"
                label="Daily Target (ml)"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <PrimaryButton
              type="button"
              onClick={() => handleWaterAdjust(dayWaterMl + 250)}
              className="flex-1 text-xs py-2"
            >
              +250 ml
            </PrimaryButton>
            <SecondaryButton
              type="button"
              onClick={() => handleWaterAdjust(dayWaterMl + 500)}
              className="flex-1 text-xs py-2"
            >
              +500 ml
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={() => handleWaterAdjust(0)}
              className="text-xs py-2 px-3"
            >
              Reset
            </SecondaryButton>
          </div>
        </Card>
      </div>

      {/* Food Database Search + Custom Food + Diary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Add Food & AI Meal Ideas */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#F5F7F5]">Quick-Add Food</h3>
              <select
                aria-label="Target meal slot"
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
                className="bg-[#080B0D] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-[#B7FF67] font-semibold"
              >
                {MEAL_TYPES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#A0AAA7] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={foodSearch}
                  onChange={(e) => setFoodSearch(e.target.value)}
                  placeholder="Search chicken, paneer, oats, idli..."
                  className="w-full bg-[#080B0D] border border-white/15 rounded-lg pl-8 pr-3 py-2 text-xs text-[#F5F7F5]"
                />
              </div>
              <select
                aria-label="Dietary filter"
                value={dietFilter}
                onChange={(e) => setDietFilter(e.target.value as 'all' | 'veg' | 'vegan')}
                className="bg-[#080B0D] border border-white/15 rounded-lg px-2.5 py-2 text-xs text-[#F5F7F5]"
              >
                <option value="all">All</option>
                <option value="veg">Veg</option>
                <option value="vegan">Vegan</option>
              </select>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredFoods.map((food) => (
                <div
                  key={food.id}
                  className="flex items-center justify-between gap-2 bg-[#080B0D] border border-white/10 rounded-lg px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#F5F7F5] truncate">{food.name}</div>
                    <div className="text-[11px] text-[#A0AAA7] font-mono tabular-nums">
                      {food.servingUnit} · {food.calories} kcal · P{food.proteinG} C{food.carbsG} F
                      {food.fatG}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLogFood(food)}
                    className="px-2.5 py-1.5 rounded-md bg-[#B7FF67] text-[#080B0D] font-semibold shrink-0 cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-[#F5F7F5] mb-3">Log Custom Food</h3>
            <form onSubmit={handleLogCustom} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Food name"
                  className="bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-[#F5F7F5]"
                />
                <input
                  type="text"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="Serving (e.g., 1 bowl)"
                  className="bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-[#F5F7F5]"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <input
                  type="number"
                  required
                  min={0}
                  value={customCalories}
                  onChange={(e) => setCustomCalories(e.target.value)}
                  placeholder="kcal"
                  className="bg-[#080B0D] border border-white/15 rounded-lg px-2.5 py-2 font-mono text-[#F5F7F5]"
                />
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={customProtein}
                  onChange={(e) => setCustomProtein(e.target.value)}
                  placeholder="Pro (g)"
                  className="bg-[#080B0D] border border-white/15 rounded-lg px-2.5 py-2 font-mono text-[#F5F7F5]"
                />
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={customCarbs}
                  onChange={(e) => setCustomCarbs(e.target.value)}
                  placeholder="Carb (g)"
                  className="bg-[#080B0D] border border-white/15 rounded-lg px-2.5 py-2 font-mono text-[#F5F7F5]"
                />
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={customFat}
                  onChange={(e) => setCustomFat(e.target.value)}
                  placeholder="Fat (g)"
                  className="bg-[#080B0D] border border-white/15 rounded-lg px-2.5 py-2 font-mono text-[#F5F7F5]"
                />
              </div>
              <SecondaryButton type="submit" className="w-full py-2 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Custom Entry to {mealType}
              </SecondaryButton>
            </form>
          </Card>

          <Card className="space-y-3">
            <h3 className="text-sm font-semibold text-[#F5F7F5] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#B7FF67]" /> Gemini AI Meal Suggestions
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={mealFocus}
                onChange={(e) => setMealFocus(e.target.value)}
                placeholder="e.g., Post-workout 40g protein South Indian dinner"
                className="flex-1 bg-[#080B0D] border border-white/15 rounded-lg px-3 py-2 text-xs text-[#F5F7F5]"
              />
              <PrimaryButton onClick={handleGetAiMeals} loading={aiLoading} className="text-xs py-2">
                Suggest
              </PrimaryButton>
            </div>
            {aiError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                {aiError}
              </div>
            )}
            {aiMeals && (
              <div className="p-3 rounded-lg bg-[#080B0D] border border-white/10 text-xs text-[#F5F7F5] whitespace-pre-wrap max-h-52 overflow-y-auto">
                {aiMeals}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Daily Meal Diary */}
        <div className="lg:col-span-7 space-y-4">
          {favoriteEntries.length > 0 && (
            <Card>
              <div className="text-xs font-semibold text-[#40E0D0] mb-2">
                Quick-Log Saved Favorites
              </div>
              <div className="flex flex-wrap gap-2">
                {favoriteEntries.slice(0, 6).map((fav) => (
                  <button
                    key={fav.id}
                    type="button"
                    onClick={() =>
                      api
                        .addNutrition({
                          logDate: selectedDate,
                          mealType,
                          foodName: fav.foodName,
                          servingQty: fav.servingQty,
                          servingUnit: fav.servingUnit,
                          calories: fav.calories,
                          proteinG: fav.proteinG,
                          carbsG: fav.carbsG,
                          fatG: fav.fatG,
                        })
                        .then(() => {
                          refreshBootstrap();
                          notify(`Re-logged ${fav.foodName}.`, 'success');
                        })
                    }
                    className="px-3 py-1.5 rounded-lg bg-[#080B0D] border border-white/10 hover:border-[#B7FF67] text-xs cursor-pointer"
                  >
                    + {fav.foodName} ({fav.calories} kcal)
                  </button>
                ))}
              </div>
            </Card>
          )}

          {MEAL_TYPES.map((slot) => {
            const entries = dayLogs.filter((n) => n.mealType === slot.id);
            const slotCalories = entries.reduce((acc, e) => acc + e.calories, 0);

            return (
              <Card key={slot.id}>
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#F5F7F5]">
                    <Utensils className="w-4 h-4 text-[#B7FF67]" /> {slot.label}
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[#40E0D0]">
                    {Math.round(slotCalories)} kcal
                  </span>
                </div>

                {entries.length === 0 ? (
                  <p className="text-xs text-[#A0AAA7]">No foods logged for {slot.label} on {selectedDate}.</p>
                ) : (
                  <div className="space-y-2">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex flex-wrap items-center justify-between gap-2 bg-[#080B0D] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[#F5F7F5]">{entry.foodName}</div>
                          <div className="text-[11px] text-[#A0AAA7] font-mono tabular-nums">
                            {entry.servingQty} × {entry.servingUnit} · {Math.round(entry.calories)}{' '}
                            kcal · P{entry.proteinG}g C{entry.carbsG}g F{entry.fatG}g
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(entry.id, -0.5, entry.servingQty)}
                            className="px-2 py-1 rounded bg-[#151D20] border border-white/10 text-[#A0AAA7] hover:text-white cursor-pointer"
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(entry.id, 0.5, entry.servingQty)}
                            className="px-2 py-1 rounded bg-[#151D20] border border-white/10 text-[#A0AAA7] hover:text-white cursor-pointer"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            aria-label="Favorite meal"
                            onClick={() => handleToggleFav(entry.id, entry.isFavorite)}
                            className="p-1.5 text-[#A0AAA7] hover:text-amber-300 cursor-pointer"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                entry.isFavorite ? 'fill-amber-300 text-amber-300' : ''
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete food log"
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="p-1.5 text-[#A0AAA7] hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
