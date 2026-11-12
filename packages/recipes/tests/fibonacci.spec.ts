/**
 * The Fibonacci heap (ADR 0034) against an independent implementation:
 * every operation ends in the same forest, root order and marks
 * included, extract-min returns the least key, and the drawing agrees
 * with the state the module describes: the forest, `min` above the least
 * root, the marks as notes, and CONSOLIDATE's array A. Random runs check
 * all of it together, with the heap order and the degree bound.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Trace, TreeState } from '@algoviz/core';

import { parseForest } from '../src/structures/fibonacci-heap/notation.ts';
import { RefFibHeap } from './fibonacci-reference.ts';
import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

const SAMPLE = '23 7 3(18*(39*) 52 38(41)) 17(30) 24(26*(35) 46)';

/** The drawn heap in the forest notation, with marks from the notes. */
function drawn(tree: TreeState): string {
  const byId = new Map(tree.data.nodes.map((n) => [n.id, n]));
  const show = (id: string): string => {
    const n = byId.get(id)!;
    const marked = tree.marks.namedNotes[id]?.['mark'] === 'marked';
    const kids = n.children.filter((c) => c !== null).map(show);
    return `${n.value === '-∞' ? '−∞' : String(n.value)}${marked ? '*' : ''}${kids.length === 0 ? '' : `(${kids.join(' ')})`}`;
  };
  return tree.data.roots.map(show).join(' ');
}

const heapAt = (trace: Trace, frame?: number) =>
  stateOf(trace, 'H', 'tree', frame);

/** Problems with a drawn heap: order, `min`, and the degree bound. */
function heapProblems(tree: TreeState): string[] {
  const problems: string[] = [];
  const byId = new Map(tree.data.nodes.map((n) => [n.id, n]));
  const num = (id: string) => {
    const v = byId.get(id)!.value;
    return v === '-∞' ? -Infinity : (v as number);
  };
  for (const n of tree.data.nodes)
    for (const c of n.children)
      if (c !== null && num(c) < num(n.id))
        problems.push(`${String(byId.get(c)!.value)} below ${String(n.value)}`);
  const roots = tree.data.roots;
  if (roots.length > 0) {
    const least = roots.reduce((m, r) => (num(r) < num(m) ? r : m));
    if (tree.marks.pointers['min'] !== least)
      problems.push(`min is not at the least root`);
  }
  const phi = (1 + Math.sqrt(5)) / 2;
  const n = tree.data.nodes.length;
  const bound = n <= 1 ? 0 : Math.floor(Math.log(n) / Math.log(phi) + 1e-9);
  for (const node of tree.data.nodes)
    if (node.children.length > bound)
      problems.push(
        `${String(node.value)} has degree ${node.children.length} > D(${n})`,
      );
  return problems;
}

describe('fibonacci-heap', () => {
  it('extracts the minimum of CLRS’s heap as its figure shows', () => {
    const from = '23 7 21 3(18*(39*) 52 38(41)) 17(30) 24(26*(35) 46)';
    const { document, results, after } = runOk('fibonacci-heap.extract-min', {
      from,
    });
    expect(results).toEqual([3]);
    const ref = RefFibHeap.parse(from);
    ref.extractMin();
    expect(after).toBe(ref.print());
    const trace = replay(document);
    expect(drawn(heapAt(trace))).toBe(ref.print());
    expect(heapProblems(heapAt(trace))).toEqual([]);
    // CLRS's trees, rooted at 7, 18 and 38, here in A's order, children
    // in the order they were linked.
    expect(after).toBe('38(41) 18*(39* 21(52)) 7(23 17(30) 24(26*(35) 46))');
    const ids = document.steps.map((s) => s.meta?.id);
    expect(ids.slice(0, 3)).toEqual(['children', 'remove', 'array']);
    expect(ids).toContain('link');
    expect(ids.at(-1)).toBe('rebuild');
    // A holds each stored root's key, by degree.
    const A = stateOf(trace, 'A', 'array');
    expect(A.data.map((e) => e.value).filter((v) => v !== '')).toHaveLength(3);
  });

  it('cuts with cascading cuts as CLRS’s figure shows', () => {
    const from = '7(24(26*(35) 46) 17(30) 23) 18*(39*) 38(41)';
    const first = runOk('fibonacci-heap', {
      from,
      ops: [
        { op: 'decrease-key', key: 46, to: 15 },
        { op: 'decrease-key', key: 35, to: 5 },
      ],
    });
    // 46→15 marks 24; 35→5 cuts 26 and 24 too, then stops at the root 7.
    expect(first.after).toBe('15 5 26 24 7(17(30) 23) 18*(39*) 38(41)');
    const ref = RefFibHeap.parse(from);
    ref.decreaseKey(46, 15);
    ref.decreaseKey(35, 5);
    expect(first.after).toBe(ref.print());
    const ids = first.document.steps.map((s) => s.meta?.id);
    expect(ids).toEqual([
      'decrease',
      'cut',
      'mark',
      'decrease',
      'cut',
      'cascade',
      'cascade',
      'new-min',
    ]);
  });

  it('inserts left of min, unites, and deletes through −∞', () => {
    const ins = runOk('fibonacci-heap.insert', { from: SAMPLE, key: 21 });
    expect(ins.after).toBe(
      '23 7 21 3(18*(39*) 52 38(41)) 17(30) 24(26*(35) 46)',
    );
    const uni = runOk('fibonacci-heap.union', {
      from: '3(18 52) 17(30) 24',
      with: '5(8) 21 14(19)',
    });
    expect(uni.after).toBe('3(18 52) 17(30) 24 5(8) 21 14(19)');
    const trace = replay(uni.document);
    expect(stateOf(trace, 'H2', 'tree').data.nodes).toEqual([]);
    const del = runOk('fibonacci-heap.delete', { from: SAMPLE, key: 26 });
    const ref = RefFibHeap.parse(SAMPLE);
    ref.delete(26);
    expect(del.after).toBe(ref.print());
    // The decreased key shows as −∞ before it goes.
    const values = replay(del.document).frame(1).state['H']!.state as TreeState;
    expect(values.data.nodes.some((n) => n.value === '-∞')).toBe(true);
  });

  it('refuses what a heap cannot do', () => {
    const msg = (id: string, input: object) => runError(id, input).message;
    expect(msg('fibonacci-heap.extract-min', { from: '' })).toMatch(/empty/);
    expect(msg('fibonacci-heap.insert', { from: SAMPLE, key: 7 })).toMatch(
      /already holds 7/,
    );
    expect(
      msg('fibonacci-heap.decrease-key', { from: SAMPLE, key: 46, to: 50 }),
    ).toMatch(/smaller key/);
    expect(
      msg('fibonacci-heap.decrease-key', { from: SAMPLE, key: 46, to: 7 }),
    ).toMatch(/already holds 7/);
    expect(msg('fibonacci-heap.delete', { from: SAMPLE, key: 99 })).toMatch(
      /does not hold 99/,
    );
    expect(
      msg('fibonacci-heap.union', { from: SAMPLE, with: '7 100' }),
    ).toMatch(/Both heaps hold 7/);
    expect(msg('fibonacci-heap.insert', { from: '5(3)', key: 1 })).toMatch(
      /below 5/,
    );
    expect(msg('fibonacci-heap.insert', { from: '5 5', key: 1 })).toMatch(
      /twice/,
    );
    expect(msg('fibonacci-heap.insert', { from: '5(', key: 1 })).toMatch(
      /not closed/,
    );
  });

  it('agrees with the reference on random runs', () => {
    const key = fc.integer({ min: 0, max: 60 });
    const call = fc.oneof(
      fc.record({ op: fc.constant('insert'), key }),
      fc.record({ op: fc.constant('extract-min') }),
      fc.record({
        op: fc.constant('decrease-key'),
        key,
        by: fc.integer({ min: 1, max: 30 }),
      }),
      fc.record({ op: fc.constant('delete'), key }),
    );
    fc.assert(
      fc.property(
        fc.uniqueArray(key, { maxLength: 16 }),
        fc.array(call, { minLength: 1, maxLength: 8 }),
        (keys, raw) => {
          const ref = new RefFibHeap();
          for (const k of keys) ref.insert(k);
          const from = ref.print();
          // Keep the calls the heap allows, as the reference sees them.
          const ops: Record<string, unknown>[] = [];
          const expected: (number | null)[] = [];
          for (const c of raw) {
            const held = new Set(ref.keys());
            if (c.op === 'insert') {
              if (held.has(c.key) || held.size >= 32) continue;
              ref.insert(c.key);
              ops.push({ op: 'insert', key: c.key });
              expected.push(null);
            } else if (c.op === 'extract-min') {
              if (held.size === 0) continue;
              expected.push(ref.extractMin());
              ops.push({ op: 'extract-min' });
            } else {
              const ks = [...held].sort((a, b) => a - b);
              if (ks.length === 0) continue;
              const k = ks[c.key % ks.length]!;
              if (c.op === 'delete') {
                ref.delete(k);
                ops.push({ op: 'delete', key: k });
              } else {
                const to = k - c.by;
                if (held.has(to)) continue;
                ref.decreaseKey(k, to);
                ops.push({ op: 'decrease-key', key: k, to });
              }
              expected.push(null);
            }
          }
          if (ops.length === 0) return;
          const { document, results, after } = runOk('fibonacci-heap', {
            from: parseForest(from),
            ops,
          });
          expect(results).toEqual(expected);
          expect(after).toBe(ref.print());
          const trace = replay(document);
          expect(drawn(heapAt(trace))).toBe(ref.print());
          for (const { start } of (trace.visualization.sections ?? []).slice(1))
            expect(heapProblems(heapAt(trace, start))).toEqual([]);
          expect(heapProblems(heapAt(trace))).toEqual([]);
        },
      ),
      fuzz,
    );
  });
});
