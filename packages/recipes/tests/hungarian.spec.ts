/**
 * The Hungarian algorithm against a brute force over every perfect
 * matching: the weight it finds is the greatest. Its trace keeps the
 * algorithm's own promises at every frame: the labels are feasible
 * (h(l) + h(r) ≥ w(l, r) for every pair), the graph's edges are exactly
 * the tight pairs, the equality subgraph, with no pair twice; and the
 * matched edges share no vertex and never get fewer. At the end the
 * matching is perfect and its weight equals the sum of the labels.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { replay, fuzz, runError, runOk, stateOf } from './helpers.ts';

type Matrix = number[][];

/** Every permutation of 0 … n − 1. */
function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  return permutations(n - 1).flatMap((p) =>
    Array.from({ length: n }, (_, k) => [
      ...p.slice(0, k),
      n - 1,
      ...p.slice(k),
    ]),
  );
}

/** The greatest weight of a perfect matching. */
const best = (w: Matrix) =>
  Math.max(
    ...permutations(w.length).map((p) =>
      p.reduce((sum, c, r) => sum + w[r]![c]!, 0),
    ),
  );

const LEFT = ['a', 'b', 'c', 'd', 'e', 'f'];
const RIGHT = ['p', 'q', 'r', 's', 't', 'u'];

const matrices = fc.integer({ min: 1, max: 5 }).chain((n) =>
  fc.array(
    fc.array(fc.integer({ min: -20, max: 20 }), {
      minLength: n,
      maxLength: n,
    }),
    { minLength: n, maxLength: n },
  ),
);

/** Checks every frame of a run on `w`, and returns the final matching. */
function checkTrace(w: Matrix) {
  const n = w.length;
  const { document, results } = runOk('hungarian', { weights: w });
  const trace = replay(document);
  const at = (v: string) =>
    LEFT.includes(v) ? LEFT.indexOf(v) : RIGHT.indexOf(v);
  let size = 0;
  for (let f = 1; f <= trace.length; f++) {
    const g = stateOf(trace, 'g', 'graph', f);
    const ends = g.data.edges
      .filter((e) => g.marks.edgeMarks[e.id] === 'selected')
      .flatMap((e) => [e.from, e.to]);
    expect(new Set(ends).size).toBe(ends.length);
    expect(ends.length / 2).toBeGreaterThanOrEqual(size);
    size = ends.length / 2;
    const h = (v: string) => Number(g.marks.notes[v]!.replace('−', '-'));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        expect(h(LEFT[i]!) + h(RIGHT[j]!)).toBeGreaterThanOrEqual(w[i]![j]!);
    const tight = new Set(
      LEFT.slice(0, n).flatMap((l, i) =>
        RIGHT.slice(0, n).flatMap((r, j) =>
          h(l) + h(r) === w[i]![j] ? [`${l} ${r}`] : [],
        ),
      ),
    );
    const drawn = g.data.edges.map((e) => `${e.from} ${e.to}`);
    expect(new Set(drawn).size).toBe(drawn.length);
    expect(new Set(drawn), `frame ${f}`).toEqual(tight);
  }
  const g = stateOf(trace, 'g', 'graph');
  const matched = g.data.edges.filter(
    (e) => g.marks.edgeMarks[e.id] === 'selected',
  );
  const labels = Object.values(g.marks.notes).reduce(
    (s, x) => s + Number(x.replace('−', '-')),
    0,
  );
  const weight = matched.reduce((s, e) => s + w[at(e.from)]![at(e.to)]!, 0);
  return { results, matched, labels, weight };
}

describe('hungarian', () => {
  it('finds the heaviest perfect matching in the example', () => {
    const w = [
      [3, 8, 4, 6],
      [7, 2, 9, 5],
      [6, 4, 5, 8],
      [2, 7, 3, 4],
    ];
    const { results, matched, labels, weight } = checkTrace(w);
    expect(results).toEqual([best(w)]);
    expect(matched).toHaveLength(4);
    expect(weight).toBe(best(w));
    expect(labels).toBe(best(w));
  });

  it('agrees with a brute force, and keeps its labels feasible and tight', () => {
    fc.assert(
      fc.property(matrices, (w) => {
        const { results, matched, labels, weight } = checkTrace(w);
        expect(results).toEqual([best(w)]);
        expect(matched).toHaveLength(w.length);
        const ends = matched.flatMap((e) => [e.from, e.to]);
        expect(new Set(ends).size).toBe(ends.length);
        expect(weight).toBe(best(w));
        expect(labels).toBe(best(w));
      }),
      fuzz,
    );
  });

  it('gives a pair that leaves the equality subgraph and comes back a new id', () => {
    // Found by search: no matrix up to 4 × 4 does this.
    const w = [
      [6, 8, -8, -8, 1],
      [4, 7, 10, 6, 7],
      [8, -8, 9, -9, -2],
      [-2, -2, 8, 0, -5],
      [-7, 9, 8, 4, 1],
    ];
    const { results, weight } = checkTrace(w);
    expect(results).toEqual([best(w)]);
    expect(weight).toBe(best(w));
    const added = runOk('hungarian', { weights: w }).document.steps.flatMap(
      (s) =>
        s.actions.flatMap((a) =>
          a.type === 'addEdge' ? [(a as { edge: { id: string } }).edge.id] : [],
        ),
    );
    expect(added.some((id) => id.endsWith('.2'))).toBe(true);
  });

  it('keeps every step within its action limit at 6 × 6', () => {
    // Equal weights: every pair is tight at the start.
    const flat = Array.from({ length: 6 }, () => Array<number>(6).fill(5));
    // Weights that make many relabellings.
    const spread = Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) => ((i * j * 37) % 23) - 11),
    );
    for (const w of [flat, spread]) {
      const { document, results } = runOk('hungarian', { weights: w });
      expect(results).toEqual([best(w)]);
      for (const step of document.steps)
        expect(step.actions.length).toBeLessThanOrEqual(100);
    }
  });

  it('reads the matrix notation, and refuses what is not square', () => {
    expect(runOk('hungarian', { weights: '1 2; 3 4' }).results).toEqual([5]);
    expect(runOk('hungarian', { weights: '-7' }).results).toEqual([-7]);
    expect(runError('hungarian', { weights: '1 2; 3' }).message).toMatch(
      /square/,
    );
    expect(
      runError('hungarian', {
        weights: Array.from({ length: 7 }, () => Array<number>(7).fill(1)),
      }).message,
    ).toMatch(/6/);
  });
});
