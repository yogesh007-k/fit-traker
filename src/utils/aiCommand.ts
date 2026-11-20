export type DirectCommandAction =
  | { type: 'pause-workout' }
  | { type: 'resume-workout' }
  | { type: 'navigate'; page: 'anatomy' | 'live-workout' | 'planner' | 'nutrition' | 'recovery' | 'analytics'; label: string };

/**
 * Matches only explicit short imperative app-control commands (e.g., "pause workout",
 * "open 3D anatomy"), never normal coaching questions like "Should I pause my workout if sore?".
 */
export function matchDirectAppCommand(
  input: string,
  hasActiveWorkout: boolean
): DirectCommandAction | null {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');

  if (!normalized || normalized.length > 42 || normalized.includes('?')) {
    return null;
  }

  if (
    hasActiveWorkout &&
    /^(please\s+)?(pause|stop)\s+(my\s+|the\s+|live\s+)?workout$/.test(normalized)
  ) {
    return { type: 'pause-workout' };
  }

  if (
    hasActiveWorkout &&
    /^(please\s+)?(resume|continue|unpause)\s+(my\s+|the\s+|live\s+)?workout$/.test(normalized)
  ) {
    return { type: 'resume-workout' };
  }

  if (/^(open|show|go to)\s+(the\s+)?(3d\s+)?(muscle\s+)?anatomy(\s+explorer)?$/.test(normalized)) {
    return { type: 'navigate', page: 'anatomy', label: '3D Muscle Anatomy' };
  }

  if (/^(open|start|launch|go to)\s+(the\s+)?live\s+workout$/.test(normalized)) {
    return { type: 'navigate', page: 'live-workout', label: 'Live Workout' };
  }

  if (/^(open|show|go to)\s+(the\s+)?workout\s+planner$/.test(normalized)) {
    return { type: 'navigate', page: 'planner', label: 'Workout Planner' };
  }

  if (/^(open|show|go to)\s+(the\s+)?nutrition(\s+page|\s+diary)?$/.test(normalized)) {
    return { type: 'navigate', page: 'nutrition', label: 'Nutrition' };
  }

  return null;
}
