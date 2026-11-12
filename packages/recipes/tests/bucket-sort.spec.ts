/**
 * Bucket sort against independent references: each value lands in bucket
 * ⌊n·x⌋, each chain ends sorted, the output is the sorted input, and
 * insertion sort moves exactly the values that follow a larger one in
 * their bucket.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Trace } from '@algoviz/core';
import type { VisualizationInput } from '@algoviz/spec';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import { recipe } from './recipe-properties.ts';

function check(doc: VisualizationInput, values: readonly number[]): void {
  const trace: Trace = replay(doc);
  const n = values.length;
  const sorted = [...values].sort((x, y) => x - y);
  const out = stateOf(trace, 'out', 'array');
  expect(out.data.map((e) => e.value)).toEqual(sorted);
  expect(out.marks.settled).toHaveLength(n);
  const table = stateOf(trace, 'b', 'hashTable');
  const expected = Array.from({ length: n }, (_, k) =>
    sorted.filter((x) => Math.floor(n * x) === k),
  );
  expect(table.data.map((chain) => chain.map((e) => e.value))).toEqual(
    expected,
  );
  // Insertion sort in a bucket checks every value after the first, and
  // the values it moves are those smaller than one before them.
  const byBucket = Array.from({ length: n }, (_, k) =>
    values.filter((x) => Math.floor(n * x) === k),
  );
  const sorts = doc.steps.filter((s) => s.meta?.id === 'sort');
  expect(sorts).toHaveLength(
    byBucket.reduce((s, b) => s + Math.max(0, b.length - 1), 0),
  );
  const moved = sorts.filter((s) =>
    s.actions.some((a) => a.target === 'b' && a.type === 'remove'),
  ).length;
  const firstPlaces = byBucket.reduce(
    (s, b) => s + b.filter((x, j) => b.slice(0, j).some((y) => y > x)).length,
    0,
  );
  expect(moved).toBe(firstPlaces);
}

describe('bucket-sort', () => {
  it('sorts CLRS’s example of ten values', () => {
    const values = [0.78, 0.17, 0.39, 0.26, 0.72, 0.94, 0.21, 0.12, 0.23, 0.68];
    const doc = runOk('bucket-sort', undefined).document;
    check(doc, values);
    expect(doc.steps.filter((s) => s.meta?.id === 'concat')).toHaveLength(6);
  });

  it('puts every value in one bucket when they are close', () => {
    check(
      runOk('bucket-sort', '0.13 0.11 0.19 0.1').document,
      [0.13, 0.11, 0.19, 0.1],
    );
  });

  it('sorts random values in [0, 1)', () => {
    fc.assert(
      fc.property(inputs, (values) =>
        check(runOk('bucket-sort', { values }).document, values),
      ),
      fuzz,
    );
  });

  it('sorts the edges: one value, values next to 1, and 16 values', () => {
    for (const values of [
      [0],
      [0.999999999, 0],
      [1 - 2 ** -53, 0.5],
      Array.from({ length: 16 }, (_, k) => (15 - k) / 16),
    ])
      check(runOk('bucket-sort', { values }).document, values);
    // 1 − 2⁻⁵³ lands in the last bucket, as ⌊2(1 − 2⁻⁵³)⌋ = 1.
    const doc = runOk('bucket-sort', { values: [1 - 2 ** -53, 0.5] }).document;
    expect(doc.steps[0]!.meta!.narration).toContain('bucket 1');
  });

  it('takes 1 to 16 numbers from 0 up to 1', () => {
    expect(
      runError('bucket-sort', { values: Array.from({ length: 17 }, () => 0.5) })
        .path,
    ).toBe('$.input.values');
    expect(runError('bucket-sort', { values: [0.5, 1] }).path).toBe(
      '$.input.values[1]',
    );
    expect(runError('bucket-sort', { values: [-0.1] }).path).toBe(
      '$.input.values[0]',
    );
    expect(runError('bucket-sort', { values: [] }).path).toBe('$.input.values');
  });
});

const unit = fc.integer({ min: 0, max: 99 }).map((k) => k / 100);
const inputs = fc.oneof(
  fc.array(unit, { minLength: 1, maxLength: 16 }),
  fc.array(
    fc.integer({ min: 0, max: 9 }).map((k) => 0.3 + k / 100),
    {
      minLength: 1,
      maxLength: 8,
    },
  ),
  fc.array(
    fc
      .double({ min: 0, max: 1, maxExcluded: true, noNaN: true })
      .map((x) => x + 0),
    {
      minLength: 1,
      maxLength: 6,
    },
  ),
);

recipe(
  'bucket-sort',
  inputs,
  (values) => runOk('bucket-sort', { values }).document,
  (trace, values) => check(trace.visualization, values),
);
