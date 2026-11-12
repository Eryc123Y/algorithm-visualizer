/**
 * B-trees (ADR 0035) against an independent textbook implementation:
 * CLRS's deletion figure case by case, insertion with root splits, search
 * results, refusals, and random runs whose every tree matches the
 * reference and is a B-tree: key counts within bounds, leaves level, keys
 * in order.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { BTreeState, Trace } from '@algomotion/core';

import { RefBTree } from './b-tree-reference.ts';
import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

const CLRS =
  '[P] ([C G M] ([A B] [D E F] [J K L] [N O]) [T X] ([Q R S] [U V] [Y Z]))';

/** The drawn tree in the notation. */
function drawn(s: BTreeState): string {
  const byId = new Map(s.data.nodes.map((n) => [n.id, n]));
  const show = (id: string): string => {
    const n = byId.get(id)!;
    const keys = `[${n.keys.map((k) => String(k.value)).join(' ')}]`;
    return n.children.length === 0
      ? keys
      : `${keys} (${n.children.map(show).join(' ')})`;
  };
  return show(s.data.root);
}

/** Problems with a drawn tree as a B-tree of minimum degree `t`. */
function bTreeProblems(s: BTreeState, t: number): string[] {
  const byId = new Map(s.data.nodes.map((n) => [n.id, n]));
  const problems: string[] = [];
  const depths = new Set<number>();
  const keys: (number | string)[] = [];
  const walk = (id: string, depth: number, root: boolean) => {
    const n = byId.get(id)!;
    if (n.keys.length > 2 * t - 1) problems.push(`${id} is overfull`);
    if (!root && n.keys.length < t - 1) problems.push(`${id} is underfull`);
    if (n.children.length === 0) {
      depths.add(depth);
      keys.push(...n.keys.map((k) => k.value as number | string));
    } else
      n.children.forEach((c, i) => {
        walk(c, depth + 1, false);
        if (i < n.keys.length) keys.push(n.keys[i]!.value as number | string);
      });
  };
  walk(s.data.root, 0, true);
  if (depths.size > 1) problems.push('leaves at different depths');
  const less = (a: number | string, b: number | string) =>
    typeof a === 'number' && typeof b === 'number'
      ? a < b
      : String(a) < String(b);
  for (let k = 1; k < keys.length; k++)
    if (!less(keys[k - 1]!, keys[k]!)) problems.push('keys out of order');
  return problems;
}

const treeOf = (trace: Trace, frame?: number) =>
  stateOf(trace, 'T', 'btree', frame);
const ids = (trace: Trace) => trace.visualization.steps.map((s) => s.meta?.id);

describe('b-tree', () => {
  it('deletes as CLRS’s figure does, case by case', () => {
    const cases: [string, string, string][] = [
      [
        'F',
        'case-1',
        '[P] ([C G M] ([A B] [D E] [J K L] [N O]) [T X] ([Q R S] [U V] [Y Z]))',
      ],
      [
        'M',
        'case-2a',
        '[P] ([C G L] ([A B] [D E] [J K] [N O]) [T X] ([Q R S] [U V] [Y Z]))',
      ],
      [
        'G',
        'case-2c',
        '[P] ([C L] ([A B] [D E J K] [N O]) [T X] ([Q R S] [U V] [Y Z]))',
      ],
      ['D', 'case-3b', '[C L P T X] ([A B] [E J K] [N O] [Q R S] [U V] [Y Z])'],
      ['B', 'case-3a', '[E L P T X] ([A C] [J K] [N O] [Q R S] [U V] [Y Z])'],
    ];
    let from = CLRS;
    for (const [key, name, expected] of cases) {
      const { document, after } = runOk('b-tree.delete', {
        from: { t: 3, tree: from },
        key,
      });
      expect(ids(replay(document)), key).toContain(name);
      expect((after as { tree: string }).tree, key).toBe(expected);
      from = expected;
    }
  });

  it('inserts with splits as a reference B-tree does', () => {
    const keys = 'F S Q K C L H T V W M R N P A B X Y D Z E'.split(' ');
    const ref = new RefBTree(3);
    for (const k of keys) ref.insert(k);
    const { document, after } = runOk('b-tree', {
      from: { t: 3, keys: keys.slice(0, -3) },
      ops: keys.slice(-3).map((key) => ({ op: 'insert', key })),
    });
    expect((after as { tree: string }).tree).toBe(ref.print());
    const trace = replay(document);
    expect(drawn(treeOf(trace))).toBe(ref.print());
    expect(bTreeProblems(treeOf(trace), 3)).toEqual([]);
    const grown = runOk('b-tree.insert', {
      from: { t: 2, keys: [10, 20, 30] },
      key: 40,
    });
    expect(ids(replay(grown.document))).toContain('grow');
  });

  it('reaches case 2b, both borrows and both merges', () => {
    const cases: [string, string, string, string[]][] = [
      [
        '[M] ([A B] [N O P Q])',
        'M',
        '[N] ([A B] [O P Q])',
        ['case-2b', 'lift-succ'],
      ],
      ['[M] ([A B] [N O P])', 'A', '[N] ([B M] [O P])', ['case-3a']],
      ['[M] ([A B C] [N O])', 'N', '[C] ([A B] [M O])', ['case-3a']],
      ['[M] ([A B] [N O])', 'N', '[A B M O]', ['case-3b', 'shrink']],
      ['[M] ([A B] [N O])', 'A', '[B M N O]', ['case-3b', 'shrink']],
    ];
    for (const [tree, key, expected, names] of cases) {
      const ref = new RefBTree(3);
      for (const k of tree.replace(/[^A-Z]/g, '')) ref.insert(k);
      const { document, after } = runOk('b-tree.delete', {
        from: { t: 3, tree },
        key,
      });
      expect((after as { tree: string }).tree, `${tree} − ${key}`).toBe(
        expected,
      );
      const got = ids(replay(document));
      for (const name of names) expect(got, `${tree} − ${key}`).toContain(name);
    }
  });

  it('searches, and says when a key is missing', () => {
    expect(runOk('b-tree.search', { from: CLRS, key: 'R' }).results).toEqual([
      true,
    ]);
    expect(runOk('b-tree.search', { from: CLRS, key: 'H' }).results).toEqual([
      false,
    ]);
  });

  it('refuses what a B-tree cannot be or do', () => {
    const msg = (input: object) =>
      runError('b-tree.insert', { key: 'A', ...input }).message;
    expect(msg({ from: { t: 3, tree: '[P] ([C] [T X])' } })).toMatch(
      /at least t − 1 = 2/,
    );
    expect(msg({ from: { t: 2, tree: '[P] ([A B C D] [T X])' } })).toMatch(
      /at most 2t − 1 = 3/,
    );
    expect(msg({ from: { t: 3, tree: '[P] ([A B] [Q R] [S T])' } })).toMatch(
      /needs 2/,
    );
    expect(msg({ from: { t: 2, tree: '[M] ([B] [P] ([N] [Q]))' } })).toMatch(
      /one depth/,
    );
    expect(msg({ from: { t: 3, tree: '[P] ([X Y] [A B])' } })).toMatch(
      /not a search tree/,
    );
    expect(msg({ from: { t: 6, keys: [] } })).toMatch(/5/);
    expect(runError('b-tree.insert', { from: CLRS, key: 5 }).message).toMatch(
      /words/,
    );
    expect(msg({ from: '[P] ([A B] [Q R' })).toMatch(/not closed/);
    expect(msg({ from: { t: 3, tree: '[] ([A B])' } })).toMatch(/no keys/);
    // Numeric words are numbers, in a list as in a string.
    const numbers = runOk('b-tree.insert', {
      from: { t: 2, keys: ['1', '2', '10', '9'] },
      key: 3,
    });
    expect((numbers.after as { tree: string }).tree).toBe(
      (
        runOk('b-tree.insert', { from: { t: 2, keys: '1 2 10 9' }, key: 3 })
          .after as { tree: string }
      ).tree,
    );
  });

  it('agrees with the reference on random runs', { timeout: 600_000 }, () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 4 }),
        fc.uniqueArray(fc.integer({ min: 0, max: 60 }), { maxLength: 24 }),
        fc.array(
          fc.record({
            op: fc.constantFrom('insert', 'delete', 'search'),
            key: fc.integer({ min: 0, max: 60 }),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        (t, keys, ops) => {
          const ref = new RefBTree(t);
          for (const k of keys) ref.insert(k);
          // The reference tree after each operation.
          const snapshots: string[] = [];
          const expected = ops.map(({ op, key }) => {
            const result = op === 'search' ? ref.has(key) : null;
            if (op === 'insert') ref.insert(key);
            if (op === 'delete') ref.delete(key);
            snapshots.push(ref.print());
            return result;
          });
          const { document, results, after } = runOk('b-tree', {
            from: { t, keys },
            ops,
          });
          expect(results).toEqual(expected);
          expect((after as { tree: string }).tree).toBe(ref.print());
          const trace = replay(document);
          // Each operation is a section: the drawn tree at the start of
          // the next one is the reference's after it, and a B-tree.
          const sections = trace.visualization.sections ?? [];
          expect(sections).toHaveLength(ops.length);
          sections.slice(1).forEach(({ start }, k) => {
            expect(drawn(treeOf(trace, start))).toBe(snapshots[k]);
            expect(bTreeProblems(treeOf(trace, start), t)).toEqual([]);
          });
          expect(drawn(treeOf(trace))).toBe(ref.print());
          expect(bTreeProblems(treeOf(trace), t)).toEqual([]);
        },
      ),
      fuzz,
    );
  });
});
