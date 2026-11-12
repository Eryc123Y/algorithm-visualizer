/**
 * An array's pattern (ADR 0037) in the engine: `align` and `check`
 * against states worked out by hand, the refusals, the compare mark
 * lasting one step, a fixed text, and the drawing: the pattern under the
 * text at its shift, keyed by id so it slides, with the pointers under it
 * and one width for every frame.
 */
import { describe, expect, it } from 'vitest';

import {
  layoutTrace,
  loadTrace,
  type ArrayState,
  type SceneBox,
  type Trace,
} from '../src/index.ts';
import { fitProblems, overlapProblems, sceneProblems } from './scene-check.ts';

type Action = Record<string, unknown>;

const doc = (steps: Action[][], extra: Record<string, unknown> = {}) => ({
  version: '1.0',
  structures: {
    T: {
      kind: 'array',
      initial: ['a', 'b', 'a', 'b', 'a', 'c'],
      pattern: ['a', 'b', 'a', 'c'],
      ...extra,
    },
  },
  steps: steps.map((actions) => ({
    actions: actions.map((a) => ({ target: 'T', ...a })),
  })),
});

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

const stateAt = (trace: Trace, frame = trace.length) =>
  trace.frame(frame).state['T']!.state as ArrayState;

describe('array pattern', () => {
  it('checks characters and keeps the matches until the next align', () => {
    const trace = mustLoad(
      doc([
        [{ type: 'check', j: 0 }],
        [{ type: 'check', j: 1 }],
        [{ type: 'check', j: 2 }],
        [{ type: 'check', j: 3 }],
        [{ type: 'align', shift: 2, matched: 3 }],
        [{ type: 'check', j: 3 }],
      ]),
    );
    expect(stateAt(trace, 0).pattern).toMatchObject({
      shift: 0,
      matched: [],
      compared: null,
    });
    expect(stateAt(trace, 3).pattern).toMatchObject({
      matched: [0, 1, 2],
      compared: 2,
    });
    // a b a c against a b a b: the last one differs.
    expect(stateAt(trace, 4).pattern).toMatchObject({
      matched: [0, 1, 2],
      compared: 3,
    });
    // Shift 2 with three known to match, as KMP would do it.
    expect(stateAt(trace, 5).pattern).toMatchObject({
      shift: 2,
      matched: [0, 1, 2],
      compared: null,
    });
    expect(stateAt(trace, 6).pattern).toMatchObject({
      matched: [0, 1, 2, 3],
      compared: 3,
    });
  });

  it('clears the compare mark when the next step begins', () => {
    const trace = mustLoad(doc([[{ type: 'check', j: 0 }], []]));
    expect(stateAt(trace, 1).pattern?.compared).toBe(0);
    expect(stateAt(trace, 2).pattern?.compared).toBe(null);
    expect(stateAt(trace, 2).pattern?.matched).toEqual([0]);
  });

  it('refuses what the alignment cannot be', () => {
    const one = (a: Action, extra?: Record<string, unknown>) =>
      errorsOf(doc([[a]], extra));
    const at = (field: string) => `$.steps[0].actions[0]${field}`;
    expect(one({ type: 'align', shift: 7 })).toEqual([
      { code: 'OUT_OF_RANGE', path: at('.shift') },
    ]);
    expect(one({ type: 'align', shift: 0, matched: 5 })).toEqual([
      { code: 'OUT_OF_RANGE', path: at('.matched') },
    ]);
    expect(one({ type: 'align', shift: 4, matched: 3 })).toEqual([
      { code: 'OUT_OF_RANGE', path: at('.matched') },
    ]);
    // a b a c at shift 0 matches a b a, not four.
    expect(one({ type: 'align', shift: 0, matched: 4 })).toEqual([
      { code: 'INVALID_OPERATION', path: at('.matched') },
    ]);
    expect(one({ type: 'check', j: 4 })).toEqual([
      { code: 'OUT_OF_RANGE', path: at('.j') },
    ]);
    expect(
      errorsOf(doc([[{ type: 'align', shift: 4 }], [{ type: 'check', j: 2 }]])),
    ).toEqual([{ code: 'OUT_OF_RANGE', path: '$.steps[1].actions[0].j' }]);
    // The text is fixed under a pattern.
    for (const a of [
      { type: 'set', index: 0, value: 'z' },
      { type: 'swap', i: 0, j: 1 },
      { type: 'insert', index: 0, element: 'z' },
      { type: 'remove', index: 0 },
    ])
      expect(one(a)).toEqual([
        { code: 'INVALID_OPERATION', path: '$.steps[0].actions[0]' },
      ]);
    // An array without a pattern has nothing to align.
    expect(
      errorsOf({
        version: '1.0',
        structures: { T: { kind: 'array', initial: [1, 2] } },
        steps: [{ actions: [{ target: 'T', type: 'check', j: 0 }] }],
      }),
    ).toEqual([{ code: 'INVALID_OPERATION', path: '$.steps[0].actions[0]' }]);
  });

  it('keeps matches in order and never changes the state it is given', () => {
    const trace = mustLoad(
      doc([[{ type: 'check', j: 2 }], [{ type: 'check', j: 0 }]]),
    );
    const before = stateAt(trace, 1);
    const copy = JSON.parse(JSON.stringify(before)) as unknown;
    expect(stateAt(trace, 2).pattern?.matched).toEqual([0, 2]);
    expect(JSON.parse(JSON.stringify(before))).toEqual(copy);
    // Elements given with their ids keep them.
    const own = mustLoad(
      doc([], {
        pattern: [
          { id: 'x', value: 'a' },
          { id: 'y', value: 'b' },
        ],
      }),
    );
    expect(stateAt(own, 0).pattern?.elements.map((e) => e.id)).toEqual([
      'x',
      'y',
    ]);
  });

  it('lets the stronger mark win on a text cell', () => {
    const trace = mustLoad(
      doc([
        [
          { type: 'check', j: 0 },
          { type: 'check', j: 1 },
          { type: 'settle', index: 0 },
          { type: 'compare', i: 1, j: 5 },
        ],
      ]),
    );
    const scene = layoutTrace(trace).sceneAt(1);
    const cell = (i: number) =>
      scene.items.find((x) => x.key === `T/element/e${i}`) as SceneBox;
    // Matched and settled: matched is drawn, the settled check kept.
    expect([cell(0).role, cell(0).settled]).toEqual(['highlight', true]);
    // Matched and compared by the array itself: compare wins.
    expect(cell(1).role).toBe('compare');
  });

  it('sizes cells for the pattern’s values, and drops its indices with the text’s', () => {
    const wide = mustLoad(doc([], { initial: [1, 2, 3], pattern: [123456] }));
    const scene = layoutTrace(wide).sceneAt(0);
    expect(fitProblems(scene)).toEqual([]);
    const plain = mustLoad(doc([]));
    const shown = layoutTrace(plain).sceneAt(0);
    const hidden = layoutTrace(plain, { showIndices: false }).sceneAt(0);
    expect(hidden.items.some((i) => i.key.startsWith('T/pattern-index/'))).toBe(
      false,
    );
    expect(hidden.height).toBeLessThan(shown.height);
    for (const s of [shown, hidden]) expect(overlapProblems(s)).toEqual([]);
  });

  it('draws the pattern under the text at its shift, keyed by id', () => {
    const trace = mustLoad(
      doc([
        [
          { type: 'pointer', name: 'i', index: 0 },
          { type: 'check', j: 0 },
        ],
        [
          { type: 'align', shift: 2, matched: 3 },
          { type: 'pointer', name: 'i', index: 5 },
          { type: 'check', j: 3 },
        ],
        // Hanging past the end, as an automaton may leave it.
        [{ type: 'align', shift: 6 }],
      ]),
    );
    const layout = layoutTrace(trace);
    const scenes = [0, 1, 2, 3].map((k) => layout.sceneAt(k));
    const box = (k: number, key: string) =>
      scenes[k]!.items.find((i) => i.key === key) as SceneBox;
    const text = (k: number, i: number) => box(k, `T/element/e${i}`);
    const pat = (k: number, j: number) => box(k, `T/pattern/p${j}`);
    // Column by column under the text, below it.
    expect(pat(1, 0).x).toBe(text(1, 0).x);
    expect(pat(1, 0).y).toBeGreaterThan(text(1, 0).y + text(1, 0).height);
    expect(pat(2, 0).x).toBe(text(2, 2).x);
    expect(pat(2, 3).x).toBe(text(2, 5).x);
    // Roles: the compared pair, the matched ones and the text above them.
    expect([pat(1, 0).role, text(1, 0).role]).toEqual(['compare', 'compare']);
    expect([pat(2, 1).role, text(2, 3).role]).toEqual([
      'highlight',
      'highlight',
    ]);
    expect([pat(2, 3).role, text(2, 5).role]).toEqual(['compare', 'compare']);
    // One size for every frame, though the pattern hangs past the end.
    expect(new Set(scenes.map((s) => `${s.width}×${s.height}`)).size).toBe(1);
    const pitch = text(0, 1).x - text(0, 0).x;
    expect(pat(3, 3).x).toBe(text(3, 0).x + 9 * pitch);
    for (const scene of scenes) {
      expect(sceneProblems(scene)).toEqual([]);
      expect(fitProblems(scene)).toEqual([]);
      expect(overlapProblems(scene)).toEqual([]);
    }
    // The pointer is under the pattern.
    const badge = scenes[1]!.items.find(
      (i) => i.type === 'badge' && i.text === 'i',
    )!;
    expect((badge as { y: number }).y).toBeGreaterThan(
      pat(1, 0).y + pat(1, 0).height,
    );
  });
});
