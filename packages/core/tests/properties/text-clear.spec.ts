/**
 * Text beside lines in random documents (ADR 0031): a tree node's note or
 * an edge label crosses an edge only when every place it may take does,
 * and notes sit their gap outside their node. Run deeper with FUZZ_RUNS.
 */
import { textWidth } from '@algoviz/fonts';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  CLEAR,
  LABEL_POSITIONS,
  NOTE_GAP,
  clearance,
  defaultFonts,
  edgeLabelBox,
  labelSegment,
  layoutTrace,
  loadTrace,
  noteBox,
  noteRegion,
  type LabelBox,
  type Obstacles,
  type Scene,
  type SceneEdge,
  type SceneNode,
} from '../../src/index.ts';
import { build } from './build.ts';
import { Dice, RUNS } from './random.ts';

const font = defaultFonts.value;
const dice = fc.array(fc.nat(), { maxLength: 400 });
const params = {
  numRuns: RUNS,
  ...(process.env['FUZZ_SEED']
    ? { seed: Number(process.env['FUZZ_SEED']) }
    : {}),
};

const nodes = (s: Scene) =>
  s.items.filter((i): i is SceneNode => i.type === 'node');
const edges = (s: Scene) =>
  s.items.filter((i): i is SceneEdge => i.type === 'edge');

function linesOf(
  e: SceneEdge,
): (readonly [{ x: number; y: number }, { x: number; y: number }])[] {
  const points = [{ x: e.x1, y: e.y1 }, ...(e.via ?? []), { x: e.x2, y: e.y2 }];
  if (points.length === 2 && Math.hypot(e.x2 - e.x1, e.y2 - e.y1) < 0.5)
    return [];
  return points.slice(1).map((p, k) => [points[k]!, p] as const);
}

const halfOf = (n: SceneNode) => Math.max(n.radius, (n.width ?? 0) / 2);

/**
 * A note's box at `angle`, its text `em` wide in the value font: its own
 * width, or the widest note of the trace, which layout chooses with.
 */
function noteAt(n: SceneNode, angle: number, em?: number): LabelBox {
  const size = Math.max(10, n.fontSize * 0.7);
  return noteBox(
    { x: n.x, y: n.y, radius: n.radius, halfWidth: halfOf(n) },
    angle,
    ((em ?? textWidth(n.label ?? '', font)) * size) / 2,
    size,
  );
}

/** Where any note up to `em` wide may lie at `angle`, as layout chooses. */
function regionAt(n: SceneNode, angle: number, em: number): LabelBox {
  const size = Math.max(10, n.fontSize * 0.7);
  return noteRegion(
    { x: n.x, y: n.y, radius: n.radius, halfWidth: halfOf(n) },
    angle,
    (em * size) / 2,
    size,
  );
}

const overlaps = (p: LabelBox, q: LabelBox) =>
  Math.abs(p.x - q.x) < p.halfWidth + q.halfWidth + 2 &&
  Math.abs(p.y - q.y) < p.halfHeight + q.halfHeight + 2;

/** What is wrong with the text of one scene. */
function problems(scene: Scene, trees: ReadonlyMap<string, number>): string[] {
  const out: string[] = [];
  const all = edges(scene).flatMap(linesOf);
  const noted = nodes(scene).filter((n) => n.label !== undefined);
  const notes = new Map(
    noted.map((n) => [n.key, noteAt(n, n.labelAngle ?? 0)]),
  );
  for (const n of noted) {
    const box = notes.get(n.key)!;
    // The gap outside the outline, whatever the direction.
    const spine = Math.max(
      -(halfOf(n) - n.radius),
      Math.min(halfOf(n) - n.radius, box.x - n.x),
    );
    const dx = Math.max(0, Math.abs(box.x - (n.x + spine)) - box.halfWidth);
    const dy = Math.max(0, Math.abs(box.y - n.y) - box.halfHeight);
    if (Math.hypot(dx, dy) < n.radius + NOTE_GAP - 1e-6)
      out.push(`note of ${n.key} inside its gap`);
    const widest = trees.get(n.key.split('/')[0]!);
    if (widest === undefined) continue;
    const others: Obstacles = {
      segments: all,
      discs: nodes(scene)
        .filter((m) => m.key !== n.key)
        .map((m) => ({ x: m.x, y: m.y, radius: halfOf(m) })),
      boxes: [...notes].filter(([k]) => k !== n.key).map(([, b]) => b),
    };
    if (
      clearance(box, { ...others, discs: [], boxes: [] }) < CLEAR &&
      // Room by more than layout's rounding of note widths (ceilWidth).
      [0, 315, 45].some(
        (a) => clearance(regionAt(n, a, widest), others) >= CLEAR + 1,
      )
    )
      out.push(`note of ${n.key} crosses an edge but had room`);
  }
  // Edge labels: crossing another edge only when every position either
  // crosses one or covers a node, a note or another label.
  const labels = edges(scene).filter(
    (e) => e.label !== undefined && linesOf(e).length > 0,
  );
  const boxes = new Map(
    labels.map((e) => {
      const [a, b] = labelSegment(e);
      return [e.key, edgeLabelBox(e, a, b, font)] as const;
    }),
  );
  const covered = [
    ...nodes(scene).map((n) => ({
      x: n.x,
      y: n.y,
      halfWidth: halfOf(n),
      halfHeight: n.radius,
    })),
    ...notes.values(),
  ];
  for (const e of labels) {
    const other = {
      segments: edges(scene)
        .filter((o) => o.key !== e.key)
        .flatMap(linesOf),
      discs: [],
      boxes: [],
    };
    if (clearance(boxes.get(e.key)!, other) >= CLEAR) continue;
    const [a, b] = labelSegment(e);
    const taken = [
      ...covered,
      ...[...boxes].filter(([k]) => k !== e.key).map(([, x]) => x),
    ];
    const room = LABEL_POSITIONS.some((at) => {
      const box = edgeLabelBox({ ...e, labelAt: at }, a, b, font);
      return (
        !taken.some((t) => overlaps(t, box)) && clearance(box, other) >= CLEAR
      );
    });
    if (room) out.push(`label of ${e.key} crosses an edge but had room`);
  }
  return out;
}

describe.each(['graph', 'tree'])('text clear of edges (%s)', (kind) => {
  it(
    'crosses an edge only where no place for it is clear',
    () => {
      fc.assert(
        fc.property(dice, (values) => {
          const built = build(new Dice(values), [kind]);
          const loaded = loadTrace(built.doc);
          if (!loaded.ok) return;
          const layout = layoutTrace(loaded.value);
          // Each tree and the width of its widest note, in em.
          const trees = new Map(
            Object.entries(layout.metrics).flatMap(([name, m]) =>
              m.kind === 'tree' ? [[name, m.metrics.noteWidth] as const] : [],
            ),
          );
          // A dozen frames, evenly, always the first and the last.
          const n = loaded.value.length;
          const frames = new Set(
            Array.from({ length: Math.min(n + 1, 12) }, (_, k) =>
              Math.round((k * n) / Math.max(1, Math.min(n, 11))),
            ),
          );
          for (const f of frames)
            expect(problems(layout.sceneAt(f), trees), `frame ${f}`).toEqual(
              [],
            );
        }),
        params,
      );
    },
    20 * 60_000,
  );
});
