/**
 * The red–black tree (ADR 0034) against an independent textbook
 * implementation: every insertion and deletion ends in the same tree with
 * the same colours, every fixup case is reached and named, deletion points
 * `x` at NIL when an empty leaf moves up, and the structure meets the
 * checks of ADR 0018. `properties.spec.ts` runs it on random inputs too.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { TreeState } from '@algoviz/core';
import type { VisualizationInput } from '@algoviz/spec';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import {
  drawnShape,
  RefTree,
  redBlackProblems,
} from './red-black-reference.ts';

const SAMPLE = [11, 2, 14, 1, 7, 15, 5, 8];
const less = (a: unknown, b: unknown) => (a as number) < (b as number);

const treeAt = (doc: VisualizationInput, frame?: number): TreeState =>
  stateOf(replay(doc), 'T', 'tree', frame);
const names = (doc: VisualizationInput) =>
  doc.steps.map((s) => s.meta?.id ?? '');

/** The reference after inserting `from`, then running `ops`. */
function reference(
  from: readonly number[],
  ops: readonly { op: string; key: number }[] = [],
): RefTree<number> {
  const t = new RefTree<number>((a, b) => a < b);
  for (const key of from) t.insert(key);
  for (const { op, key } of ops)
    if (op === 'insert') t.insert(key);
    else t.delete(key);
  return t;
}

describe('red-black-tree', () => {
  it('builds CLRS’s tree for insertion, then inserts 4 through all three cases', () => {
    const { document } = runOk('red-black-tree.insert', {
      from: SAMPLE,
      key: 4,
    });
    expect(drawnShape(treeAt(document, 0))).toEqual(reference(SAMPLE).shape());
    expect(drawnShape(treeAt(document))).toEqual(
      reference([...SAMPLE, 4]).shape(),
    );
    expect(names(document)).toEqual([
      'go',
      'go',
      'go',
      'go',
      'new',
      'case-1',
      'case-2',
      'case-3',
      'fixed',
    ]);
  });

  it('points x at NIL when an empty leaf takes a black node’s place', () => {
    const { document } = runOk('red-black-tree.delete', {
      from: SAMPLE,
      key: 1,
    });
    expect(drawnShape(treeAt(document))).toEqual(
      reference(SAMPLE, [{ op: 'delete', key: 1 }]).shape(),
    );
    const trace = replay(document);
    const nils = Array.from({ length: trace.length + 1 }, (_, k) =>
      Object.values(stateOf(trace, 'T', 'tree', k).marks.pointers),
    ).flat();
    expect(nils).toContainEqual({ parent: expect.any(String), slot: 0 });
    expect(names(document)).toContain('case-4');
  });

  it('reaches every case of both fixups, on both sides', () => {
    const seen = new Set<string>();
    const sides = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const keys = shuffle(
        [...Array(20).keys()].map((k) => k * 3),
        seed,
      );
      const ops = shuffle(keys, seed * 7)
        .slice(0, 8)
        .map((key) => ({ op: 'delete', key }));
      const { document } = runOk('red-black-tree', { from: keys, ops });
      for (const step of document.steps) {
        const id = step.meta?.id ?? '';
        seen.add(id);
        if (id.startsWith('case-'))
          sides.add(
            `${id}:${/left|right/.exec(step.meta?.narration ?? '')?.[0]}`,
          );
      }
      const drawn = drawnShape(treeAt(document));
      expect(drawn).toEqual(reference(keys, ops).shape());
      expect(redBlackProblems(treeAt(document), less)).toEqual([]);
    }
    for (const name of [
      'case-1',
      'case-2',
      'case-3',
      'case-4',
      'no-left',
      'no-right',
      'successor',
      'move-up',
      'done',
      'x-black',
    ])
      expect(seen, name).toContain(name);
    for (const c of ['case-1', 'case-2', 'case-3', 'case-4'])
      for (const side of ['left', 'right'])
        expect(sides, `${c} ${side}`).toContain(`${c}:${side}`);
  });

  it('starts from a tree in level order with its red keys', () => {
    const from = { levelOrder: [7, 3, 18, null, null, 10, 22], red: [18] };
    const { document, after } = runOk('red-black-tree.delete', {
      from,
      key: 3,
    });
    expect(drawnShape(treeAt(document, 0))).toEqual([
      7,
      'black',
      [3, 'black', null, null],
      [18, 'red', [10, 'black', null, null], [22, 'black', null, null]],
    ]);
    // `after` rebuilds the final tree exactly, colours included.
    const again = runOk('red-black-tree.insert', { from: after, key: 3 });
    expect(drawnShape(treeAt(again.document, 0))).toEqual(
      drawnShape(treeAt(document)),
    );
  });

  it('refuses a starting tree that is not a red–black tree, naming the node', () => {
    const bad = (levelOrder: (number | null)[], red: number[]) =>
      runError('red-black-tree.insert', { from: { levelOrder, red }, key: 1 })
        .message;
    expect(bad([5], [5])).toMatch(/root 5 is red/);
    expect(bad([5, 3, 8, 2], [3, 2])).toMatch(/3 is red and so is its child 2/);
    expect(bad([5, 3], [])).toMatch(/different numbers of black nodes/);
    expect(bad([5, 8, 3], [8, 3])).toMatch(/not a search tree/);
    expect(bad([5, 3, 5], [3])).toMatch(/twice/);
    expect(bad([5, null, null, 4], [])).toMatch(/4 has no parent/);
    expect(bad([5, 3, 8], [9])).toMatch(/9 is listed as red/);
    expect(bad([null, 5], [])).toMatch(/5 has no parent/);
    // A perfect black tree of 63 keys is a red–black tree, but too big.
    const perfect = (lo: number, hi: number, depth: number): number[][] =>
      depth === 0
        ? []
        : [
            [Math.floor((lo + hi) / 2)],
            ...perfect(lo, Math.floor((lo + hi) / 2) - 1, depth - 1).map(
              (row, k) => [
                ...row,
                ...(perfect(Math.floor((lo + hi) / 2) + 1, hi, depth - 1)[k] ??
                  []),
              ],
            ),
          ];
    expect(bad(perfect(1, 63, 6).flat(), [])).toMatch(/at most 32 keys/);
  });

  it('changes nothing for a key it holds or lacks, and refuses a full tree', () => {
    const present = runOk('red-black-tree.insert', { from: SAMPLE, key: 7 });
    expect(names(present.document).at(-1)).toBe('present');
    const missing = runOk('red-black-tree.delete', { from: SAMPLE, key: 6 });
    expect(names(missing.document).at(-1)).toBe('missing');
    expect(present.after).toEqual(missing.after);
    expect(drawnShape(treeAt(missing.document))).toEqual(
      reference(SAMPLE).shape(),
    );
    const full = [...Array(32).keys()];
    expect(
      runError('red-black-tree.insert', { from: full, key: 99 }).message,
    ).toMatch(/full/);
  });

  it('chains runs: two operations in one run end where two runs end', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 0, max: 60 }), { maxLength: 20 }),
        fc.array(
          fc.record({
            op: fc.constantFrom('insert', 'delete'),
            key: fc.integer({ min: 0, max: 60 }),
          }),
          { minLength: 2, maxLength: 6 },
        ),
        (from, ops) => {
          const whole = runOk('red-black-tree', { from, ops });
          let after: unknown = from;
          for (const call of ops)
            after = runOk('red-black-tree', { from: after, ops: [call] }).after;
          expect(whole.after).toEqual(after);
          expect(drawnShape(treeAt(whole.document))).toEqual(
            reference(from, ops).shape(),
          );
        },
      ),
      fuzz,
    );
  });
});

/** A deterministic shuffle. */
function shuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let x = seed;
  for (let k = out.length - 1; k > 0; k--) {
    x = (x * 1103515245 + 12345) % 2147483648;
    const j = x % (k + 1);
    [out[k], out[j]] = [out[j]!, out[k]!];
  }
  return out;
}
