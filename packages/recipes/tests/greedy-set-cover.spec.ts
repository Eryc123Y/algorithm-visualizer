/**
 * GREEDY-SET-COVER against a brute force over every choice of subsets: the
 * chosen subsets cover X, each one covered the most of what was left when
 * it was chosen, and the cover is at most H(d) times the smallest.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

type Family = [string, string[]][];

/** The fewest subsets that cover every element. */
function fewest(sets: Family): number {
  const all = new Set(sets.flatMap(([, m]) => m));
  let best = sets.length;
  for (let mask = 1; mask < 1 << sets.length; mask++) {
    const picked = sets.filter((_, k) => mask & (1 << k));
    if (picked.length >= best) continue;
    const covered = new Set(picked.flatMap(([, m]) => m));
    if (covered.size === all.size) best = picked.length;
  }
  return best;
}

const families = fc
  .array(
    fc.subarray(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], {
      minLength: 1,
    }),
    {
      minLength: 1,
      maxLength: 8,
    },
  )
  .map((ms): Family => ms.map((m, k) => [`S${k}`, m]));

describe('greedy-set-cover', () => {
  it('takes 4 subsets in the example, where 3 suffice', () => {
    const { results } = runOk('greedy-set-cover', {
      subsets:
        'S1: 1 2 3 4 5 6, S2: 5 6 8 9, S3: 1 4 7 10, S4: 2 5 7 8 11, S5: 3 6 9 12, S6: 10 11',
    });
    // S1, then S4, S5 and S3; S3, S4 and S5 alone cover X.
    expect(results).toEqual([4]);
  });

  it('covers X greedily, within H(d) of the fewest', () => {
    fc.assert(
      fc.property(families, (sets) => {
        const { document, results } = runOk('greedy-set-cover', {
          subsets: sets,
        });
        const trace = replay(document);
        const rows = stateOf(trace, 'F', 'table').data;
        const count = rows[0]!.length - 1;
        const chosen = sets.filter((_, k) => rows[k]![count] === '✓');
        expect(results).toEqual([chosen.length]);
        const all = new Set(sets.flatMap(([, m]) => m));
        expect(new Set(chosen.flatMap(([, m]) => m)).size).toBe(all.size);
        // Each pick step: the highlighted row has the largest count.
        document.steps.forEach((step, s) => {
          if (step.meta?.at !== 'pick') return;
          const lit = step.actions.find(
            (a) => a.type === 'highlight',
          ) as unknown as {
            cells: [number, number][];
          };
          const row = lit.cells[0]![0];
          const counts = stateOf(trace, 'F', 'table', s + 1).data.map(
            (r) => r[count],
          );
          for (const c of counts)
            if (typeof c === 'number')
              expect(c).toBeLessThanOrEqual(counts[row] as number);
        });
        const d = Math.max(...sets.map(([, m]) => m.length));
        const h = Array.from({ length: d }, (_, k) => 1 / (k + 1)).reduce(
          (a, b) => a + b,
          0,
        );
        expect(chosen.length).toBeLessThanOrEqual(h * fewest(sets) + 1e-9);
      }),
      fuzz,
    );
  });

  it('refuses a repeated name or element, and too many elements', () => {
    expect(runError('greedy-set-cover', 'A: 1, A: 2').message).toMatch(
      /names two/,
    );
    expect(runError('greedy-set-cover', 'A: 1 1').message).toMatch(/twice/);
    const many = Array.from({ length: 17 }, (_, k) => `x${k}`).join(' ');
    expect(runError('greedy-set-cover', `A: ${many}`).message).toMatch(
      /at most 16/,
    );
    expect(runError('greedy-set-cover', 'A:').message).toMatch(/no elements/);
  });
});
