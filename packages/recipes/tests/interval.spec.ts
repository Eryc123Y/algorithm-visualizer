/**
 * The interval tree (ADR 0034) against independent references: search
 * against a scan of every interval (it finds one exactly when one
 * overlaps, and what it finds overlaps), the tree after insertions and
 * deletions against the textbook red–black tree, and every max note
 * against the maxima computed from scratch at the end of every operation.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Trace, TreeState } from '@algomotion/core';

import { parseIntervals } from '../src/structures/red-black/interval-tree.ts';
import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import {
  drawnShape,
  RefTree,
  redBlackProblems,
} from './red-black-reference.ts';

type Interval = [number, number];

const SAMPLE: Interval[] = [
  [16, 21],
  [8, 9],
  [25, 30],
  [5, 8],
  [15, 23],
  [17, 19],
  [26, 26],
  [0, 3],
  [6, 10],
  [19, 20],
];

const value = ([a, b]: Interval) => `[${a},${b}]`;
const parse = (v: unknown): Interval =>
  (v as string).slice(1, -1).split(',').map(Number) as Interval;
const before = (a: Interval, b: Interval) =>
  a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
const less = (a: unknown, b: unknown) => before(parse(a), parse(b));
const overlaps = (a: Interval, b: Interval) => a[0] <= b[1] && b[0] <= a[1];

/** Problems with the max notes of a drawn tree. */
function maxProblems(tree: TreeState): string[] {
  const byId = new Map(tree.data.nodes.map((n) => [n.id, n]));
  const problems: string[] = [];
  const max = (id: string | null): number => {
    if (id === null) return -Infinity;
    const n = byId.get(id)!;
    const m = Math.max(
      parse(n.value)[1],
      max(n.children[0] ?? null),
      max(n.children[1] ?? null),
    );
    const note = tree.marks.namedNotes[id]?.['max'];
    if (note !== `max=${m}`)
      problems.push(`${String(n.value)}: ${note} for ${m}`);
    return m;
  };
  for (const root of tree.data.roots) max(root);
  return problems;
}

function ends(trace: Trace): TreeState[] {
  const sections = trace.visualization.sections ?? [];
  return [
    ...sections.slice(1).map(({ start }) => stateOf(trace, 'T', 'tree', start)),
    stateOf(trace, 'T', 'tree'),
  ];
}

const reference = (from: readonly Interval[]) => {
  const t = new RefTree<Interval>(before);
  for (const i of from) t.insert(i);
  return t;
};

describe('interval-tree', () => {
  it('finds CLRS’s overlap for [22, 25], and none for [11, 14]', () => {
    const found = runOk('interval-tree.search', {
      from: SAMPLE,
      interval: [22, 25],
    });
    expect(found.results).toEqual([true]);
    const trace = replay(found.document);
    const x = stateOf(trace, 'T', 'tree').marks.pointers['x'] as string;
    const node = stateOf(trace, 'T', 'tree').data.nodes.find(
      (n) => n.id === x,
    )!;
    expect(overlaps(parse(node.value), [22, 25])).toBe(true);

    const none = runOk('interval-tree.search', {
      from: SAMPLE,
      interval: [11, 14],
    });
    expect(none.results).toEqual([false]);
    const last = stateOf(replay(none.document), 'T', 'tree');
    // The search ends at an empty leaf, drawn as a pointer at NIL (S2).
    expect(last.marks.pointers['x']).toMatchObject({
      parent: expect.any(String),
    });
  });

  it('builds the same tree as the reference, and keeps every max', () => {
    for (const [id, interval] of [
      ['interval-tree.insert', [12, 13]],
      ['interval-tree.delete', [16, 21]],
      ['interval-tree.delete', [0, 3]],
    ] as const) {
      const { document } = runOk(id, { from: SAMPLE, interval });
      const tree = stateOf(replay(document), 'T', 'tree');
      const ref = reference(SAMPLE);
      if (id.endsWith('insert')) ref.insert([...interval]);
      else ref.delete([...interval]);
      expect(drawnShape(tree), id).toEqual(ref.shape(value));
      expect(maxProblems(tree), id).toEqual([]);
      expect(redBlackProblems(tree, less), id).toEqual([]);
    }
  });

  it('reads intervals as text, and refuses a reversed one', () => {
    expect(parseIntervals('[16,21] [8, 9], [25 30]')).toEqual([
      [16, 21],
      [8, 9],
      [25, 30],
    ]);
    expect(() => parseIntervals('[1,2] 3')).toThrow(/in brackets/);
    expect(parseIntervals('[-5 -1] [0.5,2][3,4]')).toEqual([
      [-5, -1],
      [0.5, 2],
      [3, 4],
    ]);
    expect(parseIntervals('')).toEqual([]);
    const at = (text: string) => {
      try {
        parseIntervals(text);
      } catch (e) {
        return (e as { at: number }).at;
      }
      return undefined;
    };
    expect(at('[1, abc]')).toBe(4);
    expect(at('[ abc, 1]')).toBe(2);
    expect(() => parseIntervals('[1,,2]')).toThrow(/two endpoints/);
    expect(() => parseIntervals('[,1,2]')).toThrow(/two endpoints/);
    expect(() => parseIntervals('[]')).toThrow(/two endpoints/);
    expect(() => parseIntervals('[1,2')).toThrow(/Expected "]"/);
    expect(() => parseIntervals('[1,2]x')).toThrow(/in brackets/);
    expect(() => parseIntervals('[1,2,3]')).toThrow(/two endpoints/);
    expect(
      runOk('interval-tree.search', { from: '[16,21] [8,9]', interval: [8, 8] })
        .results,
    ).toEqual([true]);
    expect(
      runError('interval-tree.search', { from: SAMPLE, interval: [5, 4] })
        .message,
    ).toMatch(/low ≤ high/);
  });

  it('starts from a level order with every max shown from the first step', () => {
    const from = {
      levelOrder: [
        [16, 21],
        [8, 9],
        [25, 30],
        [5, 8],
        [15, 23],
      ],
      red: [
        [5, 8],
        [15, 23],
      ],
    };
    const { document } = runOk('interval-tree.search', {
      from,
      interval: [-3.5, -1],
    });
    const trace = replay(document);
    expect(maxProblems(stateOf(trace, 'T', 'tree', 1))).toEqual([]);
    expect(stateOf(trace, 'T', 'tree', 1).marks.namedNotes).not.toEqual({});
  });

  it('agrees with a scan and the reference on random runs', () => {
    const interval = fc
      .tuple(fc.integer({ min: 0, max: 30 }), fc.integer({ min: 0, max: 8 }))
      .map(([low, length]): Interval => [low, low + length]);
    const call = fc.oneof(
      fc.record({ op: fc.constant('insert'), interval }),
      fc.record({ op: fc.constant('delete'), interval }),
      fc.record({ op: fc.constant('search'), interval }),
    );
    fc.assert(
      fc.property(
        fc.uniqueArray(interval, {
          maxLength: 20,
          selector: (i) => `${i[0]},${i[1]}`,
        }),
        fc.array(call, { minLength: 1, maxLength: 8 }),
        (from, ops) => {
          const ref = reference(from);
          const expected = ops.map(({ op, interval: i }) => {
            if (op === 'insert') ref.insert(i);
            else if (op === 'delete') ref.delete(i);
            else return ref.keys().some((k) => overlaps(k, i));
            return null;
          });
          const { document, results } = runOk('interval-tree', { from, ops });
          expect(results).toEqual(expected);
          const trace = replay(document);
          expect(drawnShape(stateOf(trace, 'T', 'tree'))).toEqual(
            ref.shape(value),
          );
          for (const tree of ends(trace)) {
            expect(maxProblems(tree)).toEqual([]);
            expect(redBlackProblems(tree, less)).toEqual([]);
          }
        },
      ),
      fuzz,
    );
  });
});
