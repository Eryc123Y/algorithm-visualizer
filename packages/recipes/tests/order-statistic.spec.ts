/**
 * The order-statistic tree (ADR 0034) against independent references:
 * selection and rank against the sorted keys, the tree after insertions
 * and deletions against the textbook red–black tree, and every size note
 * against the subtree sizes counted from scratch, at the end of every
 * operation. Random runs check all of it together.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Trace, TreeState } from '@algoviz/core';

import { ordinal } from '../src/structures/red-black/order-statistic-tree.ts';
import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import {
  drawnShape,
  RefTree,
  redBlackProblems,
} from './red-black-reference.ts';

const SAMPLE = [
  26, 17, 41, 14, 21, 30, 47, 10, 16, 19, 23, 28, 38, 7, 12, 20, 35, 39, 3,
];
const sorted = [...SAMPLE].sort((a, b) => a - b);
const less = (a: unknown, b: unknown) => (a as number) < (b as number);

/** Problems with the size notes of a drawn tree. */
function sizeProblems(tree: TreeState): string[] {
  const byId = new Map(tree.data.nodes.map((n) => [n.id, n]));
  const problems: string[] = [];
  const size = (id: string | null): number => {
    if (id === null) return 0;
    const n = byId.get(id)!;
    const s = 1 + size(n.children[0] ?? null) + size(n.children[1] ?? null);
    const note = tree.marks.namedNotes[id]?.['size'];
    if (note !== `s=${s}`)
      problems.push(`${String(n.value)}: ${note} for ${s}`);
    return s;
  };
  for (const root of tree.data.roots) size(root);
  return problems;
}

/** The tree at the end of every operation of a run, and at the end. */
function ends(trace: Trace): TreeState[] {
  const sections = trace.visualization.sections ?? [];
  return [
    ...sections.slice(1).map(({ start }) => stateOf(trace, 'T', 'tree', start)),
    stateOf(trace, 'T', 'tree'),
  ];
}

describe('order-statistic-tree', () => {
  it('selects every rank, against the sorted keys', () => {
    for (let i = 1; i <= sorted.length; i++) {
      const { results, document } = runOk('order-statistic-tree.select', {
        from: SAMPLE,
        i,
      });
      expect(results, `select ${i}`).toEqual([sorted[i - 1]]);
      expect(document.steps.at(-1)?.meta?.id).toBe('found');
    }
  });

  it('ranks every key, and says when a key is missing', () => {
    for (const [k, key] of sorted.entries())
      expect(
        runOk('order-statistic-tree.rank', { from: SAMPLE, key }).results,
        `rank ${key}`,
      ).toEqual([k + 1]);
    const missing = runOk('order-statistic-tree.rank', {
      from: SAMPLE,
      key: 11,
    });
    expect(missing.results).toEqual([null]);
    expect(missing.document.steps.at(-1)?.meta?.id).toBe('missing');
  });

  it('keeps every size through insertion and deletion', () => {
    for (const [id, args] of [
      ['order-statistic-tree.insert', { key: 15 }],
      ['order-statistic-tree.delete', { key: 17 }],
      ['order-statistic-tree.delete', { key: 3 }],
    ] as const) {
      const { document } = runOk(id, { from: SAMPLE, ...args });
      const trace = replay(document);
      const last = stateOf(trace, 'T', 'tree');
      expect(sizeProblems(last), id).toEqual([]);
      expect(redBlackProblems(last, less), id).toEqual([]);
    }
    // Sizes are shown from the first step, which a declaration cannot do.
    const { document } = runOk('order-statistic-tree.select', {
      from: SAMPLE,
      i: 3,
    });
    const trace = replay(document);
    expect(
      Object.keys(stateOf(trace, 'T', 'tree', 0).marks.namedNotes),
    ).toEqual([]);
    expect(sizeProblems(stateOf(trace, 'T', 'tree', 1))).toEqual([]);
  });

  it('names its steps, the fixups’ at the line that calls them', () => {
    const steps = (id: string, input: object) =>
      runOk(id, input).document.steps.map((s) => [s.meta?.id, s.meta?.at]);
    expect(
      steps('order-statistic-tree.insert', { from: [1, 2], key: 3 }),
    ).toEqual([
      ['go', 'go'],
      ['go', 'go'],
      ['new', 'new'],
      ['case-3', 'fixup'],
      ['fixed', 'fixup'],
    ]);
    expect(
      steps('order-statistic-tree.delete', { from: SAMPLE, key: 17 }).map(
        ([id]) => id,
      ),
    ).toContain('update');
    // Every climb from a node to its parent is one `up` step.
    const rank = steps('order-statistic-tree.rank', { from: SAMPLE, key: 38 });
    const ids = rank.map(([id]) => id);
    expect(ids.filter((id) => id === 'up')).toHaveLength(
      ids.filter((id) => id === 'find').length - 1,
    );
    expect(ids.at(-1)).toBe('rank');
  });

  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 111, 112].map(ordinal)).toEqual(
      [
        '1st',
        '2nd',
        '3rd',
        '4th',
        '11th',
        '12th',
        '13th',
        '21st',
        '22nd',
        '23rd',
        '111th',
        '112th',
      ],
    );
  });

  it('refuses ranks outside the tree', () => {
    expect(
      runError('order-statistic-tree.select', { from: SAMPLE, i: 0 }).message,
    ).toMatch(/from 1 to 19, not 0/);
    expect(
      runError('order-statistic-tree.select', { from: SAMPLE, i: 20 }).message,
    ).toMatch(/from 1 to 19/);
    expect(
      runError('order-statistic-tree.select', { from: [], i: 1 }).message,
    ).toMatch(/empty/);
  });

  it('agrees with the references on random runs', () => {
    const call = fc.oneof(
      fc.record({
        op: fc.constant('insert'),
        key: fc.integer({ min: 0, max: 40 }),
      }),
      fc.record({
        op: fc.constant('delete'),
        key: fc.integer({ min: 0, max: 40 }),
      }),
      fc.record({
        op: fc.constant('rank'),
        key: fc.integer({ min: 0, max: 40 }),
      }),
      fc.record({
        op: fc.constant('select'),
        i: fc.integer({ min: 1, max: 40 }),
      }),
    );
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 40 }), {
          minLength: 4,
          maxLength: 24,
        }),
        fc.array(call, { minLength: 1, maxLength: 8 }),
        (from, ops) => {
          const ref = new RefTree<number>((a, b) => a < b);
          for (const key of from) ref.insert(key);
          // A select asks for a rank the tree has at that point: i modulo
          // its size; an empty tree has none, and that call is dropped.
          const calls: typeof ops = [];
          const expected = ops.flatMap((o) => {
            if (o.op === 'select') {
              const keys = ref.keys();
              if (keys.length === 0) return [];
              const i = ((o.i - 1) % keys.length) + 1;
              calls.push({ op: 'select', i });
              return [keys[i - 1]];
            }
            calls.push(o);
            if (o.op === 'insert') ref.insert(o.key);
            else if (o.op === 'delete') ref.delete(o.key);
            else {
              const k = ref.keys().indexOf(o.key);
              return [k < 0 ? null : k + 1];
            }
            return [null];
          });
          if (calls.length === 0) return;
          const { document, results } = runOk('order-statistic-tree', {
            from,
            ops: calls,
          });
          expect(results).toEqual(expected);
          const trace = replay(document);
          expect(drawnShape(stateOf(trace, 'T', 'tree'))).toEqual(ref.shape());
          for (const tree of ends(trace)) {
            expect(sizeProblems(tree)).toEqual([]);
            expect(redBlackProblems(tree, less)).toEqual([]);
          }
        },
      ),
      fuzz,
    );
  });
});
