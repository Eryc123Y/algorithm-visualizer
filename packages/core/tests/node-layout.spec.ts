import { describe, expect, it } from 'vitest';

import type { VisualizationInput } from '@algoviz/spec';

import {
  defaultLayoutOptions,
  layoutTrace,
  loadTrace,
  nodeShape,
  outlineDistance,
  type Scene,
  type SceneEdge,
  type SceneNode,
} from '../src/index.ts';

function layout(input: VisualizationInput) {
  const result = loadTrace(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return { trace: result.value, layout: layoutTrace(result.value) };
}

const nodes = (scene: Scene) =>
  new Map(
    scene.items
      .filter((item): item is SceneNode => item.type === 'node')
      .map((n) => [n.key, n]),
  );
const edges = (scene: Scene) =>
  scene.items.filter((item): item is SceneEdge => item.type === 'edge');

/** Whether segment p–q passes within `r` of point c. */
function nearSegment(
  p: { x: number; y: number },
  q: { x: number; y: number },
  c: { x: number; y: number },
  r: number,
) {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const t = Math.max(
    0,
    Math.min(1, ((c.x - p.x) * dx + (c.y - p.y) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(p.x + t * dx - c.x, p.y + t * dy - c.y) < r;
}

describe('nodeShape', () => {
  const o = defaultLayoutOptions;
  it('fits short values in a circle and stretches long ones', () => {
    expect(nodeShape(1, o)).toEqual({
      radius: 20,
      halfWidth: 20,
      fontSize: 20,
    });
    const long = nodeShape(11, o);
    expect(long.halfWidth).toBeGreaterThan(long.radius);
    expect(long.fontSize).toBeLessThan(o.valueFontSize);
  });

  it('measures the outline of a stadium', () => {
    const shape = { radius: 10, halfWidth: 30, fontSize: 12 };
    expect(outlineDistance(shape, 0, 1)).toBeCloseTo(10);
    expect(outlineDistance(shape, 1, 0)).toBeCloseTo(30);
    // Diagonally: through the flat top at y = 10.
    const d = Math.SQRT1_2;
    expect(outlineDistance(shape, d, d) * d).toBeCloseTo(10);
    // Shallower: through the cap centred at (20, 0).
    const [ux, uy] = [3 / Math.sqrt(10), 1 / Math.sqrt(10)];
    const t = outlineDistance(shape, ux, uy);
    expect(Math.hypot(t * ux - 20, t * uy)).toBeCloseTo(10);
  });
});

describe('graph layout', () => {
  it('keeps every node in place while edges and nodes come and go', () => {
    const { trace, layout: l } = layout({
      version: '0.1',
      structures: { g: { kind: 'graph', nodes: ['A', 'B', 'C'] } },
      steps: [
        { actions: [{ target: 'g', type: 'addEdge', edge: ['A', 'B'] }] },
        { actions: [{ target: 'g', type: 'addNode', node: 'D' }] },
        { actions: [{ target: 'g', type: 'removeNode', node: 'B' }] },
      ],
    });
    const first = nodes(l.sceneAt(0));
    for (let i = 1; i <= trace.length; i++)
      for (const [key, node] of nodes(l.sceneAt(i))) {
        const before = first.get(key) ?? nodes(l.sceneAt(2)).get(key)!;
        expect([node.x, node.y]).toEqual([before.x, before.y]);
      }
  });

  it('routes edges that span rows around the nodes between', () => {
    const { layout: l } = layout({
      version: '0.1',
      structures: {
        g: {
          kind: 'graph',
          directed: true,
          nodes: ['a', 'b', 'c', 'd'],
          edges: [
            ['a', 'b'],
            ['b', 'c'],
            ['c', 'd'],
            ['a', 'd'],
          ],
        },
      },
      steps: [],
    });
    const scene = l.sceneAt(0);
    const all = [...nodes(scene).values()];
    for (const e of edges(scene)) {
      const points = [
        { x: e.x1, y: e.y1 },
        ...(e.via ?? []),
        { x: e.x2, y: e.y2 },
      ];
      for (const n of all)
        for (let k = 1; k < points.length; k++) {
          // Ends touch their own nodes; nothing else may be crossed.
          const touching =
            (k === 1 &&
              Math.hypot(points[0]!.x - n.x, points[0]!.y - n.y) <=
                n.radius + 1) ||
            (k === points.length - 1 &&
              Math.hypot(points[k]!.x - n.x, points[k]!.y - n.y) <=
                n.radius + 1);
          if (!touching)
            expect(nearSegment(points[k - 1]!, points[k]!, n, n.radius)).toBe(
              false,
            );
        }
    }
    expect(edges(scene).find((e) => e.key === 'g/edge/a-d')?.via).toHaveLength(
      2,
    );
  });

  it('spreads antiparallel edges and labels them on the outside', () => {
    const { layout: l } = layout({
      version: '0.1',
      structures: {
        g: {
          kind: 'graph',
          directed: true,
          layout: 'circle',
          nodes: ['A', 'B'],
          edges: [
            ['A', 'B', 1],
            ['B', 'A', 2],
          ],
        },
      },
      steps: [],
    });
    const [ab, ba] = edges(l.sceneAt(0));
    // Both start or end at A, a spread apart.
    expect(Math.hypot(ab!.x1 - ba!.x2, ab!.y1 - ba!.y2)).toBeGreaterThan(10);
    expect(ab!.labelSide).toBeDefined();
    expect(ab!.labelSide).toBe(ba!.labelSide);
  });

  it('points a self-loop away from notes and other edges', () => {
    const { layout: l } = layout({
      version: '0.1',
      structures: {
        g: {
          kind: 'graph',
          layout: 'grid',
          nodes: ['A', 'B'],
          edges: [
            ['A', 'A'],
            ['A', 'B'],
          ],
        },
      },
      steps: [
        { actions: [{ target: 'g', type: 'annotate', node: 'A', text: 'x' }] },
      ],
    });
    const loop = edges(l.sceneAt(1)).find((e) => e.key === 'g/edge/A-A')!;
    // Up is kept for the note; left is furthest from the edge to B.
    expect(loop.loopAngle).toBe(270);
  });
});
