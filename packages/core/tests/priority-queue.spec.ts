/**
 * The `priorityQueue` kind (ADR 0029): items in key order with ties in
 * insertion order, null keys last, and the drawing in a row or, in the side
 * column of a wide figure, a column.
 */
import { describe, expect, it } from 'vitest';

import {
  defaultLayoutOptions,
  layoutTrace,
  loadTrace,
  queueOrder,
  type PriorityQueueState,
  type Scene,
  type SceneBox,
  type Trace,
} from '../src/index.ts';
import { fitProblems, sceneProblems } from './scene-check.ts';

function mustLoad(input: unknown): Trace {
  const result = loadTrace(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const errorsOf = (input: unknown) => {
  const result = loadTrace(input);
  return result.ok
    ? []
    : result.error.map(({ code, path }) => ({ code, path }));
};

type Action = Record<string, unknown>;

/** Dijkstra's queue on four vertices, with steps of the given actions. */
const doc = (steps: Action[][], extra: Record<string, unknown> = {}) => ({
  version: '1.0',
  structures: {
    Q: {
      kind: 'priorityQueue',
      initial: [
        { id: 'A', value: 'A', key: 0 },
        { id: 'B', value: 'B', key: null },
        { id: 'C', value: 'C', key: null },
        { id: 'D', value: 'D', key: 5 },
      ],
      ...extra,
    },
  },
  steps: steps.map((actions) => ({
    actions: actions.map((a) => ({ target: 'Q', ...a })),
  })),
});

const stateAt = (trace: Trace, frame: number) =>
  trace.frame(frame).state['Q']!.state as PriorityQueueState;

/** The ids front first, and the keys in that order. */
const order = (trace: Trace, frame: number) =>
  queueOrder(stateAt(trace, frame).data).map((i) => `${i.id}:${i.key}`);

describe('priorityQueue order', () => {
  it('puts the least key in front, null keys last, ties in insertion order', () => {
    const trace = mustLoad(doc([]));
    expect(order(trace, 0)).toEqual(['A:0', 'D:5', 'B:null', 'C:null']);
  });

  it('extracts the front, and moves an item when its key changes', () => {
    const trace = mustLoad(
      doc([
        [{ type: 'extract' }],
        [{ type: 'setKey', id: 'C', key: 5 }],
        [{ type: 'setKey', id: 'B', key: 5 }],
        [{ type: 'extract' }],
      ]),
    );
    expect(order(trace, 1)).toEqual(['D:5', 'B:null', 'C:null']);
    // C gets the key D has: C was inserted before D, so it goes in front.
    expect(order(trace, 2)).toEqual(['C:5', 'D:5', 'B:null']);
    // B, inserted before both, goes before them at the same key.
    expect(order(trace, 3)).toEqual(['B:5', 'C:5', 'D:5']);
    expect(order(trace, 4)).toEqual(['C:5', 'D:5']);
  });

  it('puts the greatest key in front in a max-queue, null keys still last', () => {
    const trace = mustLoad(
      doc([[{ type: 'insert', element: { id: 'E', value: 'E' }, key: 9 }]], {
        order: 'max',
      }),
    );
    expect(order(trace, 0)).toEqual(['D:5', 'A:0', 'B:null', 'C:null']);
    expect(order(trace, 1)).toEqual(['E:9', 'D:5', 'A:0', 'B:null', 'C:null']);
  });

  it('inserts after the items of equal key', () => {
    const trace = mustLoad(
      doc([[{ type: 'insert', element: { id: 'E', value: 'E' }, key: 0 }]]),
    );
    expect(order(trace, 1)).toEqual(['A:0', 'E:0', 'D:5', 'B:null', 'C:null']);
  });
});

describe('priorityQueue marks', () => {
  it('highlights a changed key, a peeked front and named items for one step', () => {
    const trace = mustLoad(
      doc([
        [{ type: 'setKey', id: 'B', key: 2 }],
        [{ type: 'peek' }],
        [{ type: 'highlight', ids: ['C', 'D'] }],
        [],
      ]),
    );
    const marks = (f: number) => stateAt(trace, f).marks.highlight;
    expect(marks(1)).toEqual(['B']);
    expect(marks(2)).toEqual(['A']);
    expect(marks(3)).toEqual(['C', 'D']);
    expect(marks(4)).toEqual([]);
  });

  it('drops the mark of an item that leaves', () => {
    const trace = mustLoad(
      doc([[{ type: 'setKey', id: 'A', key: -1 }, { type: 'extract' }]]),
    );
    expect(stateAt(trace, 1).marks.highlight).toEqual([]);
    expect(order(trace, 1)).toEqual(['D:5', 'B:null', 'C:null']);
  });
});

describe('priorityQueue errors', () => {
  const empty = (steps: Action[][]) => ({
    ...doc(steps),
    structures: { Q: { kind: 'priorityQueue', initial: [] } },
  });

  it('refuses to extract from or peek at an empty queue', () => {
    expect(errorsOf(empty([[{ type: 'extract' }]]))).toEqual([
      { code: 'EMPTY', path: '$.steps[0].actions[0]' },
    ]);
    expect(errorsOf(empty([[{ type: 'peek' }]]))).toEqual([
      { code: 'EMPTY', path: '$.steps[0].actions[0]' },
    ]);
  });

  it('refuses ids that are not in the queue', () => {
    expect(
      errorsOf(
        doc([[{ type: 'extract' }], [{ type: 'setKey', id: 'A', key: 1 }]]),
      ),
    ).toEqual([{ code: 'NOT_FOUND', path: '$.steps[1].actions[0].id' }]);
    expect(errorsOf(doc([[{ type: 'highlight', ids: ['B', 'Z'] }]]))).toEqual([
      { code: 'NOT_FOUND', path: '$.steps[0].actions[0].ids[1]' },
    ]);
  });
});

describe('priorityQueue layout', () => {
  const boxes = (scene: Scene) =>
    scene.items.filter((i): i is SceneBox => i.type === 'box');
  const sided = (steps: Action[][]) => ({
    ...doc(steps),
    structures: {
      a: { kind: 'array', initial: [1, 2, 3] },
      Q: { ...doc([]).structures.Q, place: 'side' },
    },
  });
  const steps = [
    [{ type: 'extract' }],
    [{ type: 'setKey', id: 'C', key: 1 }],
    [{ type: 'insert', element: { id: 'E', value: 'E' }, key: 12345 }],
  ];

  it('draws a row in front order: each value over its key, "min" at the front', () => {
    const scene = layoutTrace(mustLoad(doc(steps))).sceneAt(2);
    const values = boxes(scene).filter((b) => b.key.startsWith('Q/element/'));
    const keys = boxes(scene).filter((b) => b.key.startsWith('Q/key/'));
    expect(values.map((b) => b.text)).toEqual(['C', 'D', 'B']);
    expect(keys.map((b) => b.text)).toEqual(['1', '5', '∞']);
    // In a row: left to right, each key cell right under its value cell.
    expect(values.map((b) => b.x)).toEqual(
      [...values.map((b) => b.x)].sort((p, q) => p - q),
    );
    values.forEach((v, k) => {
      expect(keys[k]!.x).toBe(v.x);
      expect(keys[k]!.y).toBe(v.y + v.height);
      expect(keys[k]!.fontSize).toBeLessThan(v.fontSize);
    });
    // C's key changed this step: both its cells are highlighted.
    expect(values[0]!.role).toBe('highlight');
    expect(keys[0]!.role).toBe('highlight');
    expect(scene.items.some((i) => 'text' in i && i.text === 'min')).toBe(true);
  });

  it('draws a column in the side panel of a wide figure, and a row in a narrow one', () => {
    const trace = mustLoad(sided(steps));
    const wide = layoutTrace(trace).sceneAt(2);
    const narrow = layoutTrace(trace, { layout: 'narrow' }).sceneAt(2);
    const values = (scene: Scene) =>
      boxes(scene).filter((b) => b.key.startsWith('Q/element/'));
    const column = values(wide);
    expect(new Set(column.map((b) => b.x)).size).toBe(1);
    expect(column.map((b) => b.y)).toEqual(
      [...column.map((b) => b.y)].sort((p, q) => p - q),
    );
    const keyOf = (scene: Scene, id: string) =>
      boxes(scene).find((b) => b.key === `Q/key/${id}`)!;
    // In a column the key cell is right of its value cell.
    expect(keyOf(wide, 'C').x).toBe(column[0]!.x + column[0]!.width);
    expect(keyOf(wide, 'C').y).toBe(column[0]!.y);
    const row = values(narrow);
    expect(new Set(row.map((b) => b.y)).size).toBe(1);
  });

  it.each(['wide', 'narrow'] as const)(
    'keeps one size in every frame, with text that fits (%s)',
    (layout) => {
      const trace = mustLoad(sided(steps));
      const figure = layoutTrace(trace, { layout });
      const first = figure.sceneAt(0);
      for (let f = 0; f <= trace.length; f++) {
        const scene = figure.sceneAt(f);
        expect([scene.width, scene.height]).toEqual([
          first.width,
          first.height,
        ]);
        expect(sceneProblems(scene), `frame ${f}`).toEqual([]);
        expect(fitProblems(scene), `frame ${f}`).toEqual([]);
      }
    },
  );

  it('says when the queue is empty, and draws −∞ in a max-queue', () => {
    const scene = layoutTrace(
      mustLoad({
        version: '1.0',
        structures: {
          Q: {
            kind: 'priorityQueue',
            order: 'max',
            initial: [{ id: 'A', value: 'A', key: null }],
          },
        },
        steps: [{ actions: [{ target: 'Q', type: 'extract' }] }],
      }),
    );
    const texts = (f: number) =>
      scene.sceneAt(f).items.flatMap((i) => ('text' in i ? [i.text] : []));
    expect(texts(0)).toContain('−∞');
    expect(texts(0)).toContain('max');
    expect(texts(1)).toContain('(empty)');
    expect(defaultLayoutOptions.layout).toBe('wide');
  });
});
