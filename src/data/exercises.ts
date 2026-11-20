import { Exercise, ExerciseCategory } from '../types/fitness';
import { UPPER_EXERCISES } from './exercisesUpper';
import { LOWER_CORE_EXERCISES } from './exercisesLowerCore';

export const EXERCISES: Exercise[] = [...UPPER_EXERCISES, ...LOWER_CORE_EXERCISES];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(
  EXERCISES.map((item) => [item.id, item])
);

export const EXERCISE_CATEGORIES: ExerciseCategory[] = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Abs',
  'Obliques',
  'Quadriceps',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Full Body',
  'Cardio',
  'Mobility',
];

export function getExercisesForMuscle(muscleId: string): {
  primary: Exercise[];
  secondary: Exercise[];
} {
  return {
    primary: EXERCISES.filter((e) => e.primaryMuscles.includes(muscleId)),
    secondary: EXERCISES.filter(
      (e) => !e.primaryMuscles.includes(muscleId) && e.secondaryMuscles.includes(muscleId)
    ),
  };
}
