/**
 * The sorting modules against independent references: the sorted order
 * from Array.prototype.sort, inversion counts, and the invariants of each
 * CLRS procedure. `properties.spec.ts` runs them on random inputs.
 */
import { describe, expect, it } from 'vitest';

import type { Trace } from '@algomotion/core';
import type { VisualizationInput } from '@algomotion/spec';

import { randomInts, replay, runError, runOk, stateOf } from './helpers.ts';

const inputs = [
  [1],
  [2, 1],
  [5, 3, 8, 1, 9, 2],
  [3, 3, 1, 3, 2],
  [1, 2, 3, 4, 5],
  [5, 4, 3, 2, 1],
  [-2.5, 0, 7, -2.5, 1e9],
  ...[1, 2, 3, 4, 5].map((seed) => randomInts(seed, 9, 20)),
];

const ascending = (xs: readonly number[]) => [...xs].sort((x, y) => x - y);

/** Pairs i < j with xs[i] > xs[j]: the swaps or shifts some sorts need. */
const inversions = (xs: readonly number[]) =>
  xs.reduce(
    (sum, x, i) => sum + xs.slice(i + 1).filter((y) => x > y).length,
    0,
  );

const document = (id: string, values: readonly number[]) =>
  runOk(id, { values }).document;
const ids = (doc: VisualizationInput) => doc.steps.map((s) => s.meta?.id);
const count = (doc: VisualizationInput, id: string) =>
  ids(doc).filter((x) => x === id).length;
/** Values of array `name` after `frame` steps (default all). */
const valuesAt = (trace: Trace, name: string, frame?: number) =>
  stateOf(trace, name, 'array', frame).data.map((e) => e.value);

describe.each([
  ['insertion-sort', 'a'],
  ['merge-sort', 'a'],
  ['heapsort', 'a'],
  ['quicksort', 'a'],
  ['bubble-sort', 'a'],
  ['selection-sort', 'a'],
] as const)('%s', (id, name) => {
  it.each(inputs.map((input) => [JSON.stringify(input), input]))(
    'sorts %s and settles every element',
    (_, input) => {
      const trace = replay(document(id, input));
      const state = stateOf(trace, name, 'array');
      expect(state.data.map((e) => e.value)).toEqual(ascending(input));
      expect([...state.marks.settled].sort()).toEqual(
        state.data.map((e) => e.id).sort(),
      );
    },
  );

  it('takes 1 to 32 finite numbers', () => {
    for (const values of [[], Array.from({ length: 33 }, () => 1)])
      expect(runError(id, { values })).toMatchObject({
        code: 'INVALID_SHAPE',
        path: '$.input.values',
      });
    expect(runError(id, { values: [1, Number.NaN] }).path).toBe(
      '$.input.values[1]',
    );
  });
});

describe('insertion-sort', () => {
  it('shifts once per inversion, with the key held in its own cell', () => {
    for (const input of inputs) {
      const doc = document('insertion-sort', input);
      expect(count(doc, 'shift')).toBe(inversions(input));
      expect(count(doc, 'key')).toBe(input.length - 1);
      // Each pass tests once per shift, and once more where it stops.
      expect(count(doc, 'compare')).toBe(inversions(input) + input.length - 1);
      const trace = replay(doc);
      expect(valuesAt(trace, 'key')).toEqual(['']);
    }
  });

  it('shows the copy a shift leaves behind, as the code does', () => {
    const doc = document('insertion-sort', [2, 1]);
    const shift = ids(doc).indexOf('shift') + 1;
    const trace = replay(doc);
    expect(valuesAt(trace, 'a', shift)).toEqual([2, 2]);
    expect(valuesAt(trace, 'key', shift)).toEqual([1]);
  });
});

describe('bubble-sort', () => {
  it('compares every pair of a pass and swaps once per inversion', () => {
    for (const input of inputs) {
      const doc = document('bubble-sort', input);
      const n = input.length;
      expect(count(doc, 'compare')).toBe((n * (n - 1)) / 2);
      expect(count(doc, 'swap')).toBe(inversions(input));
    }
  });

  it('bubbles the smallest remaining value to the front on each pass', () => {
    const input = [5, 3, 8, 1, 9, 2];
    const doc = document('bubble-sort', input);
    const trace = replay(doc);
    const sorted = ascending(input);
    ids(doc).forEach((step, k) => {
      if (step !== 'in-place') return;
      const settled = stateOf(trace, 'a', 'array', k + 1).marks.settled;
      const values = valuesAt(trace, 'a', k + 1);
      // After pass i, a[0..i] holds the i + 1 smallest values, in order.
      expect(values.slice(0, settled.length)).toEqual(
        sorted.slice(0, settled.length),
      );
    });
  });
});

describe('narrations', () => {
  /** Each compare step's narration, against the array it shows. */
  const narrated = (id: string, input: readonly number[]) => {
    const doc = document(id, input);
    const trace = replay(doc);
    return doc.steps.flatMap((step, k) => {
      if (step.meta?.id !== 'compare') return [];
      const a = valuesAt(trace, 'a', k + 1);
      const vars = step.meta.vars as Record<string, number>;
      return [{ narration: step.meta.narration, a, vars }];
    });
  };

  it('name the values the array holds at that step', () => {
    for (const input of inputs) {
      for (const { narration, a, vars } of narrated('bubble-sort', input))
        expect(narration).toBe(
          `Compare ${a[vars['j']! - 1]} and ${a[vars['j']!]}.`,
        );
      for (const { narration, a, vars } of narrated('selection-sort', input))
        expect(narration).toBe(
          `Compare ${a[vars['j']!]} with the smallest so far, ${a[vars['smallest']!]}.`,
        );
      for (const { narration, a, vars } of narrated('quicksort', input))
        expect(narration).toMatch(
          new RegExp(
            `^${String(a[vars['j']!]).replace(/[.+]/g, '\\$&')} [≤>] `,
          ),
        );
    }
  });
});

describe('selection-sort', () => {
  it('compares every pair once and swaps at most n - 1 times', () => {
    for (const input of inputs) {
      const doc = document('selection-sort', input);
      const n = input.length;
      expect(count(doc, 'compare')).toBe((n * (n - 1)) / 2);
      expect(count(doc, 'swap')).toBe(Math.max(0, n - 1));
      // A swap step swaps unless a[i] already is the smallest.
      expect(
        doc.steps.filter((s) => s.actions.some((a) => a.type === 'swap')),
      ).toHaveLength(Math.max(0, n - 1) - countFixedPositions(input));
    }
  });
});

/**
 * Positions selection sort leaves alone: where a[i] is already the
 * smallest of a[i..n-1] when its turn comes (an independent simulation).
 */
function countFixedPositions(input: readonly number[]): number {
  const a = [...input];
  let fixed = 0;
  for (let i = 0; i < a.length - 1; i++) {
    let m = i;
    for (let j = i + 1; j < a.length; j++) if (a[j]! < a[m]!) m = j;
    if (m === i) fixed += 1;
    else [a[i], a[m]] = [a[m]!, a[i]!];
  }
  return fixed;
}

describe('merge-sort', () => {
  it('splits and merges n - 1 times, and empties the buffer', () => {
    for (const input of inputs) {
      const doc = document('merge-sort', input);
      const n = input.length;
      expect(count(doc, 'split')).toBe(n - 1);
      expect(count(doc, 'merged')).toBe(n - 1);
      expect(count(doc, 'single')).toBe(n === 1 ? 1 : 0);
      expect(valuesAt(replay(doc), 'aux')).toEqual(input.map(() => ''));
    }
  });

  it('takes from the left on ties, so it is stable', () => {
    const doc = document('merge-sort', [1, 1]);
    // The tie goes left; then the left half is used up.
    expect(ids(doc)).toEqual([
      'split',
      'copy',
      'take-left',
      'take-right',
      'merged',
    ]);
  });
});

describe('quicksort', () => {
  it('puts each pivot at its final position when it places it', () => {
    for (const input of inputs) {
      const doc = document('quicksort', input);
      const trace = replay(doc);
      const sorted = ascending(input);
      ids(doc).forEach((step, k) => {
        if (step !== 'place' && step !== 'single') return;
        const before = stateOf(trace, 'a', 'array', k).marks.settled;
        const after = stateOf(trace, 'a', 'array', k + 1);
        const added = after.marks.settled.filter((x) => !before.includes(x));
        expect(added).toHaveLength(1);
        const at = after.data.findIndex((e) => e.id === added[0]);
        expect(after.data[at]!.value).toBe(sorted[at]);
      });
    }
  });

  it('keeps values equal to the pivot on its left, as CLRS does', () => {
    // With ≤, every value of [2, 2, 2] joins the left part.
    const doc = document('quicksort', [2, 2, 2]);
    expect(
      doc.steps.find((s) => s.meta?.id === 'compare')?.meta?.narration,
    ).toBe('2 ≤ 2: it belongs on the left.');
  });
});

describe('heapsort', () => {
  it('has a max-heap before the first maximum moves to the end', () => {
    for (const input of inputs.filter((i) => i.length > 1)) {
      const doc = document('heapsort', input);
      const trace = replay(doc);
      const heap = valuesAt(
        trace,
        'a',
        ids(doc).indexOf('extract'),
      ) as number[];
      heap.forEach((x, i) =>
        expect(i === 0 || heap[(i - 1) >> 1]! >= x).toBe(true),
      );
      expect(count(doc, 'extract')).toBe(input.length - 1);
    }
  });
});

describe('counting-sort', () => {
  const countable = [
    [0],
    [3, 1, 4, 1, 5, 2, 0, 2],
    [99, 0, 99],
    ...[1, 2, 3].map((seed) => randomInts(seed, 12, 9)),
  ];

  it.each(countable.map((input) => [JSON.stringify(input), input]))(
    'sorts %s into b, leaving in c how many values are smaller',
    (_, input) => {
      const trace = replay(document('counting-sort', input));
      const b = stateOf(trace, 'b', 'array');
      expect(b.data.map((e) => e.value)).toEqual(ascending(input));
      expect(b.marks.settled).toHaveLength(input.length);
      expect(valuesAt(trace, 'a')).toEqual(input);
      const c = valuesAt(trace, 'c');
      expect(c).toHaveLength(Math.max(...input) + 1);
      c.forEach((x, v) => expect(x).toBe(input.filter((y) => y < v).length));
    },
  );

  it('places equal values from the last to the first, so it is stable', () => {
    const input = [2, 1, 2, 2];
    const doc = document('counting-sort', input);
    const placed = doc.steps
      .filter((s) => s.meta?.id === 'place')
      .map((s) => s.meta?.vars?.['j']);
    expect(placed).toEqual([3, 2, 1, 0]);
    expect(
      doc.steps
        .filter((s) => s.meta?.id === 'place')
        .map((s) => s.meta?.narration),
    ).toEqual([
      'c[2] drops to 3: place 2 at b[3].',
      'c[2] drops to 2: place 2 at b[2].',
      'c[1] drops to 0: place 1 at b[0].',
      'c[2] drops to 1: place 2 at b[1].',
    ]);
  });

  it('takes integers from 0 to 99', () => {
    for (const bad of [100, -1, 1.5])
      expect(runError('counting-sort', { values: [1, bad] })).toMatchObject({
        code: 'INVALID_SHAPE',
        path: '$.input.values[1]',
      });
  });
});
