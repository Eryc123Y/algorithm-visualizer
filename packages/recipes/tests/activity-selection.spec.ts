/**
 * Activity selection against an independent reference: the largest set
 * of activities that do not overlap, found by trying every subset (at
 * most 4,096). The chosen activities must not overlap, and must be as
 * many as that.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { VisualizationInput } from '@algomotion/spec';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import { recipe } from './recipe-properties.ts';

type Activity = [number, number];

/** The most activities, of `all`, that pairwise do not overlap. */
function most(all: readonly Activity[]): number {
  let best = 0;
  for (let mask = 0; mask < 1 << all.length; mask++) {
    const set = all.filter((_, k) => mask & (1 << k));
    const fine = set.every(([s1, f1], a) =>
      set.every(([s2, f2], b) => a === b || f1 <= s2 || f2 <= s1),
    );
    if (fine) best = Math.max(best, set.length);
  }
  return best;
}

function check(doc: VisualizationInput, activities: readonly Activity[]): void {
  const trace = replay(doc);
  const table = stateOf(trace, 'activities', 'table');
  const [s, f] = table.data as number[][];
  const picked = stateOf(trace, 'A', 'array')
    .data.map((e) => e.value)
    .filter((v) => v !== '')
    .map((v) => Number(String(v).slice(1)) - 1);
  expect(picked.length).toBe(most(activities));
  // In order of finish, each starts no earlier than the one before ends.
  picked
    .slice(1)
    .forEach((m, t) => expect(s![m]!).toBeGreaterThanOrEqual(f![picked[t]!]!));
  // The table lists the activities sorted by finish time.
  expect([...f!]).toEqual(
    [...activities.map((a) => a[1])].sort((x, y) => x - y),
  );
  expect(table.marks.settled).toHaveLength(2 * picked.length);
}

describe('activity-selection', () => {
  it('chooses a1, a4, a8 and a11 from CLRS’s eleven activities', () => {
    const doc = runOk('activity-selection', undefined).document;
    const trace = replay(doc);
    expect(
      stateOf(trace, 'A', 'array')
        .data.map((e) => e.value)
        .slice(0, 4),
    ).toEqual(['a1', 'a4', 'a8', 'a11']);
  });

  it('sorts unsorted activities by finish time first', () => {
    const activities: Activity[] = [
      [5, 9],
      [1, 2],
      [3, 4],
      [0, 6],
    ];
    const doc = runOk('activity-selection', activities).document;
    check(doc, activities);
    expect(doc.steps[0]!.meta!.narration).toMatch(
      /^Sorted by finish time, a1 to a4 are the given activities 2, 3, 4, 1\./,
    );
  });

  it('chooses as many as any subset holds, on random activities', () => {
    fc.assert(
      fc.property(inputs, (a) =>
        check(runOk('activity-selection', { activities: a }).document, a),
      ),
      fuzz,
    );
  });

  it('takes 1 to 12 activities that start before they finish', () => {
    expect(runError('activity-selection', { activities: [[3, 3]] }).path).toBe(
      '$.input.activities[0]',
    );
    expect(runError('activity-selection', { activities: [] }).path).toBe(
      '$.input.activities',
    );
    expect(
      runError('activity-selection', { activities: [[0, 100]] }).path,
    ).toBe('$.input.activities[0][1]');
  });
});

const activity = fc
  .tuple(fc.integer({ min: 0, max: 30 }), fc.integer({ min: 1, max: 8 }))
  .map(([s, d]): Activity => [s, s + d]);
const inputs = fc.oneof(
  fc.array(activity, { minLength: 1, maxLength: 12 }),
  // Equal finish times and repeated activities.
  fc.array(fc.tuple(fc.integer({ min: 0, max: 4 }), fc.constantFrom(5, 6)), {
    minLength: 1,
    maxLength: 10,
  }),
);

recipe(
  'activity-selection',
  inputs,
  (a) => runOk('activity-selection', { activities: a }).document,
  (trace, a) => check(trace.visualization, a),
);
