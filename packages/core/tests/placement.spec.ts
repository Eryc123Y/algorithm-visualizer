/**
 * Placement (ADR 0029): structures with `place: "side"` go right of the
 * main ones in a wide figure and below them in a narrow one; without side
 * structures both layouts are the single column of before.
 */
import { describe, expect, it } from 'vitest';

import type { VisualizationInput } from '@algoviz/spec';

import {
  arrangeStructures,
  defaultLayoutOptions,
  layoutTrace,
  loadTrace,
  type FigureLayout,
  type Scene,
  type Trace,
} from '../src/index.ts';
import { extent, overlapProblems, sceneProblems } from './scene-check.ts';

function mustLoad(input: unknown): Trace {
  const result = loadTrace(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

/** The extent of every item of structure `name`: [x1, y1, x2, y2]. */
function boundsOf(
  scene: Scene,
  name: string,
): [number, number, number, number] {
  const own = scene.items.filter((i) => i.key.startsWith(`${name}/`));
  expect(own.length, name).toBeGreaterThan(0);
  return own
    .map(extent)
    .reduce((p, q) => [
      Math.min(p[0], q[0]),
      Math.min(p[1], q[1]),
      Math.max(p[2], q[2]),
      Math.max(p[3], q[3]),
    ]);
}

const titleOf = (scene: Scene, name: string) => {
  const title = scene.items.find((i) => i.key === `${name}/title`);
  if (title?.type !== 'text') throw new Error(`no title for ${name}`);
  return { x: title.x, y: title.y };
};

const steps: VisualizationInput['steps'] = [
  {
    actions: [
      { target: 'calls', type: 'push', element: 'visit A' },
      { target: 'a', type: 'swap', i: 0, j: 1 },
    ],
  },
  {
    actions: [
      { target: 'calls', type: 'push', element: 'visit B' },
      { target: 'a', type: 'insert', index: 3, element: 12 },
    ],
  },
  { actions: [{ target: 'calls', type: 'pop' }] },
];

/** An array, a stack in the side panel and a second main array. */
const sided = (side = true) => ({
  version: '1.0',
  structures: {
    a: { kind: 'array', initial: [5, 3, 8] },
    calls: {
      kind: 'stack',
      initial: [],
      ...(side ? { place: 'side' } : {}),
    },
    out: { kind: 'array', initial: [1, 2] },
  },
  steps,
});

const layoutOf = (input: unknown, layout: FigureLayout) =>
  layoutTrace(mustLoad(input), { layout });

describe('placement (ADR 0029)', () => {
  const { padding, columnGap } = defaultLayoutOptions;

  it('defaults to the wide layout', () => {
    expect(defaultLayoutOptions.layout).toBe('wide');
    expect(columnGap).toBe(40);
  });

  it('puts side structures right of the main column in a wide figure', () => {
    const scene = layoutOf(sided(), 'wide').sceneAt(2);
    const a = boundsOf(scene, 'a');
    const out = boundsOf(scene, 'out');
    const calls = boundsOf(scene, 'calls');
    // The main column: a, then out under it, both at the left margin.
    expect(titleOf(scene, 'a')).toMatchObject({ x: padding });
    expect(titleOf(scene, 'out').x).toBe(padding);
    expect(out[1]).toBeGreaterThan(a[3]);
    // The side column starts at the top, after the widest main block.
    expect(titleOf(scene, 'calls').y).toBe(titleOf(scene, 'a').y);
    expect(calls[0]).toBeGreaterThanOrEqual(
      Math.max(a[2], out[2]) + columnGap - 1,
    );
    expect(sceneProblems(scene)).toEqual([]);
    expect(overlapProblems(scene)).toEqual([]);
  });

  it('puts side structures below the main ones in a narrow figure', () => {
    const scene = layoutOf(sided(), 'narrow').sceneAt(2);
    const out = boundsOf(scene, 'out');
    // Declared second, drawn last: after every main structure.
    expect(titleOf(scene, 'calls').x).toBe(padding);
    expect(boundsOf(scene, 'calls')[1]).toBeGreaterThan(out[3]);
    expect(sceneProblems(scene)).toEqual([]);
  });

  it('makes a wide figure wider and a narrow one taller', () => {
    const wide = layoutOf(sided(), 'wide').sceneAt(0);
    const narrow = layoutOf(sided(), 'narrow').sceneAt(0);
    expect(wide.width).toBeGreaterThan(narrow.width);
    expect(wide.height).toBeLessThan(narrow.height);
  });

  it('lays out a document without side structures as before, in both layouts', () => {
    const trace = mustLoad({ ...sided(false), version: '1.0' });
    const before = layoutTrace(trace);
    for (const layout of ['wide', 'narrow'] as const) {
      const now = layoutTrace(trace, { layout });
      for (let f = 0; f <= trace.length; f++)
        expect(now.sceneAt(f)).toEqual(before.sceneAt(f));
    }
    // One column in declaration order: a, calls, out.
    const scene = before.sceneAt(0);
    const order = ['a', 'calls', 'out'].map((n) => titleOf(scene, n));
    expect(order.map((t) => t.x)).toEqual([padding, padding, padding]);
    expect(order[1]!.y).toBeGreaterThan(order[0]!.y);
    expect(order[2]!.y).toBeGreaterThan(order[1]!.y);
  });

  it('draws one column when every structure is on the side', () => {
    const input = {
      ...sided(),
      structures: {
        calls: { kind: 'stack', initial: [], place: 'side' },
        q: { kind: 'queue', initial: [1], place: 'side' },
      },
      steps: [],
    };
    const scene = layoutOf(input, 'wide').sceneAt(0);
    expect(titleOf(scene, 'calls').x).toBe(padding);
    expect(titleOf(scene, 'q').x).toBe(padding);
    expect(titleOf(scene, 'q').y).toBeGreaterThan(titleOf(scene, 'calls').y);
  });

  it.each(['wide', 'narrow'] as const)(
    'keeps every structure in its place in every frame (%s)',
    (layout) => {
      const trace = mustLoad(sided());
      const figure = layoutTrace(trace, { layout });
      const first = figure.sceneAt(0);
      for (let f = 1; f <= trace.length; f++) {
        const scene = figure.sceneAt(f);
        expect([scene.width, scene.height]).toEqual([
          first.width,
          first.height,
        ]);
        for (const name of ['a', 'calls', 'out'])
          expect(titleOf(scene, name), `${name} frame ${f}`).toEqual(
            titleOf(first, name),
          );
      }
    },
  );

  it('arranges columns from the declarations and the layout alone', () => {
    const { structures } = mustLoad(sided()).visualization;
    expect(arrangeStructures(structures, 'wide')).toEqual([
      { region: 'main', names: ['a', 'out'] },
      { region: 'side', names: ['calls'] },
    ]);
    expect(arrangeStructures(structures, 'narrow')).toEqual([
      { region: 'main', names: ['a', 'out', 'calls'] },
    ]);
    const plain = mustLoad({ ...sided(false), version: '1.0' });
    for (const layout of ['wide', 'narrow'] as const)
      expect(arrangeStructures(plain.visualization.structures, layout)).toEqual(
        [{ region: 'main', names: ['a', 'calls', 'out'] }],
      );
  });
});
