/**
 * Text beside lines (ADR 0031): node notes, heap indices and edge labels
 * keep clear of edges where a place for them does, in every frame of the
 * registry's examples and of random documents.
 */
import { describe, expect, it } from 'vitest';

import { textWidth } from '@algoviz/fonts';
import { algorithms, runAlgorithm } from '../src/index.ts';

import {
  CLEAR,
  clearance,
  defaultFonts,
  edgeLabelBox,
  labelSegment,
  layoutTrace,
  loadTrace,
  noteBox,
  type LabelBox,
  type Obstacles,
  type Scene,
  type SceneNode,
  type SceneText,
} from '@algoviz/core';

const font = defaultFonts.value;

/** The lines of a scene's edges, self-loops left out. */
function lines(scene: Scene, skip?: string): Obstacles['segments'] {
  return scene.items.flatMap((i) => {
    if (i.type !== 'edge' || i.key === skip) return [];
    const points = [
      { x: i.x1, y: i.y1 },
      ...(i.via ?? []),
      { x: i.x2, y: i.y2 },
    ];
    if (points.length === 2 && Math.hypot(i.x2 - i.x1, i.y2 - i.y1) < 0.5)
      return [];
    return points.slice(1).map((p, k) => [points[k]!, p] as const);
  });
}

const nodes = (scene: Scene) =>
  scene.items.filter((i): i is SceneNode => i.type === 'node');

/** The box of a node's note, as painters place it. */
function noteOf(n: SceneNode): LabelBox {
  const fontSize = Math.max(10, n.fontSize * 0.7);
  return noteBox(
    {
      x: n.x,
      y: n.y,
      radius: n.radius,
      halfWidth: Math.max(n.radius, (n.width ?? 0) / 2),
    },
    n.labelAngle ?? 0,
    (textWidth(n.label ?? '', font) * fontSize) / 2,
    fontSize,
  );
}

/**
 * Whether a tree node's note had a clear spot among its preferred ones,
 * above, above left and above right, away from edges and other nodes.
 */
function hadRoom(scene: Scene, n: SceneNode): boolean {
  const others: Obstacles = {
    segments: lines(scene),
    discs: nodes(scene)
      .filter((m) => m.key !== n.key)
      .map((m) => ({ x: m.x, y: m.y, radius: m.radius })),
    boxes: [],
  };
  return [0, 315, 45].some(
    (angle) => clearance(noteOf({ ...n, labelAngle: angle }), others) >= CLEAR,
  );
}

/**
 * Notes, indices and labels of a scene that touch an edge. A tree node's
 * note may, when none of its preferred spots was clear: it then keeps its
 * halo over the line (ADR 0031).
 */
function crossings(scene: Scene, trees: ReadonlySet<string>): string[] {
  const all: Obstacles = { segments: lines(scene), discs: [], boxes: [] };
  const out: string[] = [];
  for (const n of nodes(scene))
    if (
      n.label !== undefined &&
      clearance(noteOf(n), all) < CLEAR &&
      !(trees.has(n.key.split('/')[0]!) && !hadRoom(scene, n))
    )
      out.push(`note of ${n.key}`);
  for (const i of scene.items) {
    if (i.type === 'text' && i.role === 'index' && i.key.includes('/index/')) {
      const box = {
        x: i.x,
        y: i.y,
        halfWidth: (textWidth(i.text, font) * i.fontSize) / 2,
        halfHeight: i.fontSize / 2,
      };
      if (clearance(box, all) < CLEAR) out.push(`index ${i.key}`);
    }
    if (i.type === 'edge' && i.label !== undefined) {
      const [a, b] = labelSegment(i);
      if (Math.hypot(b.x - a.x, b.y - a.y) < 0.5) continue;
      const box = edgeLabelBox(i, a, b, font);
      const others = { segments: lines(scene, i.key), discs: [], boxes: [] };
      if (clearance(box, others) < CLEAR) out.push(`label of ${i.key}`);
    }
  }
  return out;
}

const examples = [
  'dijkstra',
  'prim',
  'bellman-ford',
  'kruskal',
  'disjoint-set',
  'heapsort',
  'min-heap',
  'max-heap',
  'avl',
];

describe('text clear of edges in the registry examples', () => {
  it.each(examples)('%s, every frame', (id) => {
    const algo = algorithms.find((a) => a.id === id)!;
    const run = runAlgorithm(id, algo.examples[0]);
    if (!run.ok) throw new Error(id);
    const trace = loadTrace(run.value.document);
    if (!trace.ok) throw new Error(id);
    const layout = layoutTrace(trace.value);
    const trees = new Set(
      Object.entries(run.value.document.structures)
        .filter(([, d]) => d.kind === 'tree')
        .map(([name]) => name),
    );
    const problems = new Set<string>();
    for (let f = 0; f <= trace.value.length; f++)
      for (const p of crossings(layout.sceneAt(f), trees)) problems.add(p);
    expect([...problems]).toEqual([]);
  });

  it('numbers a heap above its nodes, as CLRS does', () => {
    const algo = algorithms.find((a) => a.id === 'heapsort')!;
    const run = runAlgorithm('heapsort', algo.examples[0]);
    if (!run.ok) throw new Error('heapsort');
    const trace = loadTrace(run.value.document);
    if (!trace.ok) throw new Error('heapsort');
    const scene = layoutTrace(trace.value).sceneAt(0);
    const indices = scene.items.filter(
      (i): i is SceneText => i.type === 'text' && /^a\/index\/\d+$/.test(i.key),
    );
    expect(indices.length).toBeGreaterThan(0);
    for (const i of indices) {
      // Nodes are drawn in position order.
      const at = nodes(scene)[Number(i.key.split('/').at(-1))]!;
      expect(i.y, i.key).toBeLessThan(at.y - at.radius);
    }
  });

  it('keeps a note as close to its node at a diagonal as above it', () => {
    const node = { x: 0, y: 0, radius: 20, halfWidth: 20 };
    const above = noteBox(node, 0, 6, 11);
    const diagonal = noteBox(node, 45, 6, 11);
    const gap = (b: LabelBox) =>
      Math.hypot(
        Math.max(0, Math.abs(b.x) - b.halfWidth),
        Math.max(0, Math.abs(b.y) - b.halfHeight),
      ) - node.radius;
    expect(gap(above)).toBeCloseTo(4, 6);
    // The box's nearest corner to the centre is the gap outside the circle,
    // give or take the corner's rounding away from the circle.
    expect(gap(diagonal)).toBeGreaterThanOrEqual(4 - 1e-9);
    expect(gap(diagonal)).toBeLessThan(CLEAR + 4 + 2);
  });
});
