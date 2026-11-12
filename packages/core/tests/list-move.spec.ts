/**
 * `move` on a linked list (ADR 0036) in the engine: nodes move along the
 * row with their ids, links stay as they are, id-kept marks follow their
 * nodes, the step's highlights are reindexed, and the drawing keys each
 * node by id so it slides.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { afterMove } from '../src/kinds/common.ts';
import {
  layoutTrace,
  loadTrace,
  type LinkedListState,
  type SceneBox,
  type Trace,
} from '../src/index.ts';

const doc = (actions: Record<string, unknown>[][], initial = [4, 2, 7, 1]) => ({
  version: '0.7',
  structures: { l: { kind: 'linkedList', initial } },
  steps: actions.map((step) => ({
    actions: step.map((a) => ({ target: 'l', ...a })),
  })),
});

function mustLoad(input: unknown): Trace {
  const result = loadTrace(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const listAt = (trace: Trace, frame = trace.length) =>
  trace.frame(frame).state['l']!.state as LinkedListState;
const row = (s: LinkedListState) => s.data.map((n) => n.value).join(' ');
const nexts = (s: LinkedListState) =>
  Object.fromEntries(s.data.map((n) => [n.id, n.next]));

describe('linkedList move', () => {
  it('moves a node forwards and backwards, links unchanged', () => {
    const start = listAt(mustLoad(doc([])), 0);
    const front = listAt(mustLoad(doc([[{ type: 'move', from: 2, to: 0 }]])));
    expect(row(front)).toBe('7 4 2 1');
    expect(nexts(front)).toEqual(nexts(start));
    const back = listAt(mustLoad(doc([[{ type: 'move', from: 0, to: 3 }]])));
    expect(row(back)).toBe('2 7 1 4');
    expect(nexts(back)).toEqual(nexts(start));
    const still = listAt(mustLoad(doc([[{ type: 'move', from: 1, to: 1 }]])));
    expect(still).toEqual(listAt(mustLoad(doc([[]]))));
  });

  it('keeps visits, settled marks and pointers on their nodes', () => {
    const trace = mustLoad(
      doc([
        [
          { type: 'visit', index: 2 },
          { type: 'settle', index: 3 },
          { type: 'pointer', name: 'x', index: 2 },
          { type: 'pointer', name: 'head', index: 0 },
        ],
        [{ type: 'move', from: 2, to: 0 }],
      ]),
    );
    const s = listAt(trace);
    expect(s.marks.visited).toEqual(['e2']);
    expect(s.marks.settled).toEqual(['e3']);
    expect(s.marks.pointers).toEqual({ x: 'e2', head: 'e0' });
  });

  it('reindexes the step’s highlights', () => {
    const s = listAt(
      mustLoad(
        doc([
          [
            { type: 'highlight', indices: [0, 2, 3] },
            { type: 'move', from: 3, to: 1 },
          ],
        ]),
      ),
    );
    expect(s.marks.highlight).toEqual([0, 3, 1]);
    // Forwards: the ends of the range and positions on both sides of it.
    const forwards = listAt(
      mustLoad(
        doc(
          [
            [
              { type: 'highlight', indices: [0, 1, 2, 4, 5] },
              { type: 'move', from: 1, to: 4 },
            ],
          ],
          [10, 11, 12, 13, 14, 15],
        ),
      ),
    );
    expect(forwards.marks.highlight).toEqual([0, 4, 1, 3, 5]);
    expect(row(forwards)).toBe('10 12 13 14 11 15');
  });

  it('refuses positions outside the row', () => {
    const codes = (a: Record<string, unknown>, initial?: number[]) => {
      const r = loadTrace(doc([[a]], initial));
      return r.ok ? [] : r.error.map(({ code, path }) => ({ code, path }));
    };
    expect(codes({ type: 'move', from: 4, to: 0 })).toEqual([
      { code: 'OUT_OF_RANGE', path: '$.steps[0].actions[0].from' },
    ]);
    expect(codes({ type: 'move', from: 0, to: 4 })).toEqual([
      { code: 'OUT_OF_RANGE', path: '$.steps[0].actions[0].to' },
    ]);
    expect(codes({ type: 'move', from: 0, to: 0 }, [])).toEqual([
      { code: 'OUT_OF_RANGE', path: '$.steps[0].actions[0].from' },
    ]);
  });

  it('reindexes positions as a bijection that sends from to to', () => {
    fc.assert(
      fc.property(
        fc
          .integer({ min: 1, max: 20 })
          .chain((n) =>
            fc.tuple(
              fc.constant(n),
              fc.integer({ min: 0, max: n - 1 }),
              fc.integer({ min: 0, max: n - 1 }),
            ),
          ),
        ([n, from, to]) => {
          const f = afterMove(from, to);
          const image = Array.from({ length: n }, (_, k) => f(k)!);
          expect([...image].sort((a, b) => a - b)).toEqual(
            Array.from({ length: n }, (_, k) => k),
          );
          expect(f(from)).toBe(to);
          // Same as removing and inserting in a list.
          const items = Array.from({ length: n }, (_, k) => k);
          const moved = items.filter((k) => k !== from);
          moved.splice(to, 0, from);
          items.forEach((k) => expect(moved[f(k)!]).toBe(k));
        },
      ),
    );
  });

  it('draws each node under its id, so a moved node slides', () => {
    const trace = mustLoad(doc([[{ type: 'move', from: 3, to: 0 }]]));
    const layout = layoutTrace(trace);
    const x = (frame: number, id: string) =>
      (
        layout
          .sceneAt(frame)
          .items.find((i) => i.key === `l/element/${id}`) as SceneBox
      ).x;
    expect(x(1, 'e3')).toBe(x(0, 'e0'));
    expect(x(1, 'e0')).toBe(x(0, 'e1'));
    expect(x(1, 'e2')).toBe(x(0, 'e3'));
  });
});
