import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, EXERCISE_BY_ID } from './exercises';
import { MUSCLE_BY_ID } from './muscles';

test('EXERCISES contains at least 150 genuinely distinct exercises', () => {
  assert.ok(EXERCISES.length >= 150, `Expected >= 150 exercises, got ${EXERCISES.length}`);
  const ids = new Set(EXERCISES.map((e) => e.id));
  const names = new Set(EXERCISES.map((e) => e.name.toLowerCase().trim()));
  assert.equal(ids.size, EXERCISES.length, 'Duplicate exercise IDs detected');
  assert.equal(names.size, EXERCISES.length, 'Duplicate exercise names detected');
});

test('All exercise muscle references map to valid MUSCLE_BY_ID entries', () => {
  for (const ex of EXERCISES) {
    assert.ok(ex.primaryMuscles.length > 0, `${ex.id} has no primaryMuscles`);
    for (const m of ex.primaryMuscles) {
      assert.ok(MUSCLE_BY_ID[m], `${ex.id} references unknown primaryMuscle: ${m}`);
    }
    for (const m of ex.secondaryMuscles) {
      assert.ok(MUSCLE_BY_ID[m], `${ex.id} references unknown secondaryMuscle: ${m}`);
    }
    for (const alt of ex.alternatives) {
      assert.ok(EXERCISE_BY_ID[alt], `${ex.id} references unknown alternative: ${alt}`);
    }
    assert.ok(ex.steps.length >= 2, `${ex.id} should have step-by-step instructions`);
    assert.ok(ex.commonMistakes.length >= 1, `${ex.id} should have common mistakes`);
  }
});
