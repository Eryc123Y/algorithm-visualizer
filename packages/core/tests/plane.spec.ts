/**
 * The `plane` kind (ADR 0038) in the engine: each action against states
 * worked out by hand, the refusals, marks going with what they name, and
 * the drawing: points at their scaled coordinates with y up, one region
 * for the whole trace, lines across it, and nothing outside the block.
 */
import { describe, expect, it } from 'vitest';

import {
  layoutTrace,
  loadTrace,
  type PlaneState,
  type SceneEdge,
  type SceneNode,
  type Trace,
} from '../src/index.ts';
import { fitProblems, overlapProblems, sceneProblems } from './scene-check.ts';

type Action = Record<string, unknown>;

const points = [
  { id: 'a', x: 0, y: 0 },
  { id: 'b', x: 4, y: 1 },
  { id: 'c', x: 3, y: 4 },
];

const doc = (steps: Action[][], extra: Record<string, unknown> = {}) => ({
  version: '0.9',
  structures: { P: { kind: 'plane', points, ...extra } },
  steps: steps.map((actions) => ({
    actions: actions.map((a) => ({ target: 'P', ...a })),
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
  trace.frame(frame).state['P']!.state as PlaneState;

describe('plane', () => {
  it('adds, labels and removes points and segments', () => {
    const trace = mustLoad(
      doc([
        [
          { type: 'addSegment', segment: { id: 'ab', from: 'a', to: 'b' } },
          { type: 'addPoint', point: { id: 'd', x: -1, y: 2, label: 'p3' } },
        ],
        [{ type: 'label', segment: 'ab', text: '4.12' }],
        [{ type: 'label', segment: 'ab', text: null }],
        [
          { type: 'removeSegment', id: 'ab' },
          { type: 'removePoint', id: 'd' },
        ],
      ]),
    );
    expect(stateAt(trace, 1).data.points.map((p) => p.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(stateAt(trace, 2).data.segments).toEqual([
      { id: 'ab', from: 'a', to: 'b', label: '4.12' },
    ]);
    expect(stateAt(trace, 3).data.segments).toEqual([
      { id: 'ab', from: 'a', to: 'b' },
    ]);
    expect(stateAt(trace).data).toEqual({ points, segments: [] });
  });

  it('keeps marks while what they name is there, and drops them after', () => {
    const trace = mustLoad(
      doc(
        [
          [
            { type: 'visit', point: 'c' },
            { type: 'settle', point: 'a' },
            { type: 'select', segment: 'bc', on: true },
            { type: 'pointer', name: 'top', point: 'c' },
            { type: 'line', name: 'sweep', x: 2 },
            { type: 'compare', points: ['a', 'b', 'c'] },
          ],
          [{ type: 'line', name: 'sweep', x: 3.5 }],
          [
            { type: 'removeSegment', id: 'bc' },
            { type: 'removePoint', id: 'c' },
          ],
        ],
        { segments: [{ id: 'bc', from: 'b', to: 'c' }] },
      ),
    );
    expect(stateAt(trace, 1).marks).toMatchObject({
      compare: ['a', 'b', 'c'],
      visited: ['c'],
      settled: ['a'],
      selected: ['bc'],
      pointers: { top: 'c' },
      lines: { sweep: 2 },
    });
    // The compare mark lasts one step; the line moves.
    expect(stateAt(trace, 2).marks).toMatchObject({
      compare: [],
      lines: { sweep: 3.5 },
    });
    expect(stateAt(trace).marks).toMatchObject({
      visited: [],
      settled: ['a'],
      selected: [],
      pointers: {},
    });
  });

  it('refuses what the plane cannot hold', () => {
    const one = (a: Action, extra?: Record<string, unknown>) =>
      errorsOf(doc([[a]], extra));
    const at = (f: string) => `$.steps[0].actions[0]${f}`;
    expect(one({ type: 'addPoint', point: { id: 'd', x: 4, y: 1 } })).toEqual([
      { code: 'INVALID_OPERATION', path: at('.point') },
    ]);
    expect(
      one({ type: 'addSegment', segment: { id: 's', from: 'a', to: 'z' } }),
    ).toEqual([{ code: 'NOT_FOUND', path: at('.segment.to') }]);
    expect(
      one(
        { type: 'addSegment', segment: { id: 's', from: 'b', to: 'a' } },
        { segments: [{ id: 'ab', from: 'a', to: 'b' }] },
      ),
    ).toEqual([{ code: 'INVALID_OPERATION', path: at('.segment') }]);
    expect(
      one(
        { type: 'removePoint', id: 'a' },
        {
          segments: [{ id: 'ab', from: 'a', to: 'b' }],
        },
      ),
    ).toEqual([{ code: 'INVALID_OPERATION', path: at('.id') }]);
    expect(one({ type: 'highlight', points: ['a', 'z'] })).toEqual([
      { code: 'NOT_FOUND', path: at('.points[1]') },
    ]);
    expect(one({ type: 'select', segment: 'z', on: true })).toEqual([
      { code: 'NOT_FOUND', path: at('.segment') },
    ]);
    const lines = Array.from({ length: 9 }, (_, k) => ({
      type: 'line',
      name: `l${k}`,
      x: k,
    }));
    expect(errorsOf(doc([lines]))).toEqual([
      { code: 'LIMIT_EXCEEDED', path: '$.steps[0].actions[8].name' },
    ]);
  });

  it('draws points where they are, y up, in one region for every frame', () => {
    const trace = mustLoad(
      doc(
        [
          [{ type: 'line', name: 'sweep', x: 1 }],
          [
            { type: 'addPoint', point: { id: 'd', x: 10, y: -2 } },
            { type: 'line', name: 'sweep', x: 6 },
            { type: 'pointer', name: 'p0', point: 'a' },
          ],
        ],
        { segments: [{ id: 'ab', from: 'a', to: 'b' }], axes: true },
      ),
    );
    const layout = layoutTrace(trace);
    const scenes = [0, 1, 2].map((k) => layout.sceneAt(k));
    const node = (k: number, id: string) =>
      scenes[k]!.items.find((i) => i.key === `P/point/${id}`) as SceneNode;
    // The region holds d, added later, from the first frame on.
    expect(node(0, 'a').x).toBe(node(2, 'a').x);
    expect(node(0, 'a').y).toBe(node(2, 'a').y);
    // y up: c (y 4) above a (y 0); x right: b right of a.
    expect(node(0, 'c').y).toBeLessThan(node(0, 'a').y);
    expect(node(0, 'b').x).toBeGreaterThan(node(0, 'a').x);
    // One scale on both axes.
    const ab = node(0, 'b').x - node(0, 'a').x;
    const ac = node(0, 'a').y - node(0, 'c').y;
    expect(ab / 4).toBeCloseTo(ac / 4, 6);
    // The line spans the region, bottom to top, and slides.
    const line = (k: number) =>
      scenes[k]!.items.find((i) => i.key === 'P/line/sweep') as SceneEdge;
    expect(line(1).y1).toBeGreaterThan(line(1).y2);
    expect(line(2).x1).toBeGreaterThan(line(1).x1);
    expect(new Set(scenes.map((s) => `${s.width}×${s.height}`)).size).toBe(1);
    for (const scene of scenes) {
      expect(sceneProblems(scene)).toEqual([]);
      expect(fitProblems(scene)).toEqual([]);
      expect(overlapProblems(scene)).toEqual([]);
    }
  });
});
