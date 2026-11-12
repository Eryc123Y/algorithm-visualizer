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
  LABEL_ANGLES,
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
  type SceneBadge,
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

/** Whether a badge sits right above a node, as pointers at linked roots do. */
const aboveANode = (b: SceneBadge, scene: Scene) =>
  nodes(scene).some((n) => Math.abs(n.x - b.x) < 0.5 && b.y < n.y - n.radius);

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
    // As layout chooses (ADR 0031, 0034): clear of the regions of the notes
    // placed before this one, in node order, of NIL leaves and of the
    // pointers above roots.
    const earlier = noted.slice(0, noted.indexOf(n));
    const others: Obstacles = {
      segments: all,
      discs: nodes(scene)
        .filter((m) => m.key !== n.key)
        .map((m) => ({ x: m.x, y: m.y, radius: halfOf(m) })),
      boxes: [
        ...earlier.map((m) => regionAt(m, m.labelAngle ?? 0, widest)),
        ...scene.items.flatMap((i): LabelBox[] =>
          (i.type === 'box' && i.key.includes('/nil/')) ||
          (i.type === 'badge' && aboveANode(i, scene))
            ? [
                {
                  x: i.type === 'box' ? i.x + i.width / 2 : i.x,
                  y: i.type === 'box' ? i.y + i.height / 2 : i.y,
                  halfWidth: i.width / 2,
                  halfHeight: i.height / 2,
                },
              ]
            : [],
        ),
      ],
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

/** The parts of segment a–b inside a rectangle, by Liang–Barsky. */
function crossesBox(
  [a, b]: readonly [{ x: number; y: number }, { x: number; y: number }],
  box: { x: number; y: number; width: number; height: number },
): boolean {
  let [t0, t1] = [0, 1];
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const edges: [number, number][] = [
    [-dx, a.x - box.x],
    [dx, box.x + box.width - a.x],
    [-dy, a.y - box.y],
    [dy, box.y + box.height - a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return t1 - t0 > 1e-9;
}

describe('dependency arrows in tables', () => {
  it(
    'cross no cell but the two they join',
    () => {
      fc.assert(
        fc.property(dice, (values) => {
          const built = build(new Dice(values), ['table']);
          const loaded = loadTrace(built.doc);
          if (!loaded.ok) return;
          const layout = layoutTrace(loaded.value);
          for (let f = 0; f <= loaded.value.length; f++) {
            const scene = layout.sceneAt(f);
            const cells = scene.items.filter(
              (i): i is Extract<typeof i, { type: 'box' }> =>
                i.type === 'box' && i.key.includes('/cell/'),
            );
            for (const arrow of edges(scene).filter((e) =>
              e.key.includes('/depend/'),
            )) {
              const line = linesOf(arrow)[0];
              if (line === undefined) continue;
              const inside =
                (p: { x: number; y: number }) => (c: (typeof cells)[number]) =>
                  p.x >= c.x &&
                  p.x <= c.x + c.width &&
                  p.y >= c.y &&
                  p.y <= c.y + c.height;
              const ends = cells.filter(
                (c) => inside(line[0])(c) || inside(line[1])(c),
              );
              expect(ends, `${arrow.key} at frame ${f}`).toHaveLength(2);
              const crossed = cells
                .filter((c) => !ends.includes(c))
                .filter((c) => crossesBox(line, c))
                .map((c) => c.key);
              expect(crossed, `${arrow.key} at frame ${f}`).toEqual([]);
            }
          }
        }),
        params,
      );
    },
    20 * 60_000,
  );
});

describe('labels of points in a plane', () => {
  it(
    'go under a pointer’s badge only where every direction meets one',
    () => {
      fc.assert(
        fc.property(dice, (values) => {
          const built = build(new Dice(values), ['plane']);
          const loaded = loadTrace(built.doc);
          if (!loaded.ok) return;
          const layout = layoutTrace(loaded.value);
          const scenes = Array.from(
            { length: loaded.value.length + 1 },
            (_, f) => layout.sceneAt(f),
          );
          // The badges under each point over the trace, as one box, as
          // layout keeps labels clear of them.
          const stacks = new Map<string, LabelBox>();
          for (const scene of scenes)
            for (const b of scene.items.filter(
              (i): i is SceneBadge => i.type === 'badge',
            )) {
              const name = b.key.split('/')[0]!;
              const under = nodes(scene)
                .filter(
                  (n) =>
                    n.key.startsWith(`${name}/point/`) &&
                    Math.abs(n.x - b.x) < 0.5 &&
                    n.y < b.y,
                )
                .sort((p, q) => q.y - p.y)[0];
              if (under === undefined) continue;
              const key = under.key;
              const box = {
                x0: b.x - b.width / 2,
                x1: b.x + b.width / 2,
                y0: b.y - b.height / 2,
                y1: b.y + b.height / 2,
              };
              const old = stacks.get(key);
              const [x0, x1, y0, y1] = old
                ? [
                    Math.min(old.x - old.halfWidth, box.x0),
                    Math.max(old.x + old.halfWidth, box.x1),
                    Math.min(old.y - old.halfHeight, box.y0),
                    Math.max(old.y + old.halfHeight, box.y1),
                  ]
                : [box.x0, box.x1, box.y0, box.y1];
              stacks.set(key, {
                x: (x0 + x1) / 2,
                y: (y0 + y1) / 2,
                halfWidth: (x1 - x0) / 2,
                halfHeight: (y1 - y0) / 2,
              });
            }
          scenes.forEach((scene, f) => {
            const badges = scene.items.filter(
              (i): i is SceneBadge => i.type === 'badge',
            );
            for (const n of nodes(scene)) {
              if (n.label === undefined) continue;
              const name = n.key.split('/')[0]!;
              const note = noteAt(n, n.labelAngle ?? 0);
              const covered = badges.some(
                (b) =>
                  b.key.startsWith(`${name}/`) &&
                  overlaps(note, {
                    x: b.x,
                    y: b.y,
                    halfWidth: b.width / 2 - 2,
                    halfHeight: b.height / 2 - 2,
                  }),
              );
              if (!covered) continue;
              const m = layout.metrics[name]!;
              if (m.kind !== 'plane') continue;
              const theirs = [...stacks]
                .filter(([k]) => k.startsWith(`${name}/`))
                .map(([, box]) => box);
              const room = LABEL_ANGLES.some(
                (a) =>
                  clearance(
                    noteRegion(
                      { x: n.x, y: n.y, radius: n.radius, halfWidth: n.radius },
                      a,
                      (m.metrics.labelWidth * n.fontSize) / 2,
                      n.fontSize,
                    ),
                    { segments: [], discs: [], boxes: theirs },
                  ) >=
                  CLEAR + 1,
              );
              expect(
                room,
                `label of ${n.key} under a badge at frame ${f}`,
              ).toBe(false);
            }
          });
        }),
        params,
      );
    },
    20 * 60_000,
  );
});
