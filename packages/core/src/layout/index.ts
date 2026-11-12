/**
 * Layout of whole frames: `layoutState(vis, state, metrics) → Scene`.
 *
 * Layout is pure and DOM-free (ADR 0003). It takes metrics measured over the
 * whole trace (ADR 0008) so that sizes and positions do not jump between
 * frames, with text measured in the fonts of the layout options (ADR 0024).
 */
import type {
  StructureDecl,
  StructureKindName,
  Visualization,
} from '@algoviz/spec';

import type { Block } from '../kind.ts';
import type { KindedState, VisualizationState } from '../kinds/index.ts';
import { runtimes, type CoreTypeMap } from '../registry.ts';
import type { Trace } from '../trace.ts';
import {
  defaultFonts,
  defaultLayoutOptions,
  type LayoutFonts,
  type LayoutOptions,
} from './options.ts';
import { arrangeStructures, type FigureColumn } from './placement.ts';
import type { Scene, SceneItem } from './scene.ts';

export * from './array.ts';
export * from './btree.ts';
export * from './graph.ts';
export * from './hash-table.ts';
export * from './table.ts';
export * from './array-heap.ts';
export * from './common.ts';
export * from './edge-label.ts';
export * from './linked-list.ts';
export * from './priority-queue.ts';
export * from './queue.ts';
export * from './stack.ts';
export * from './tree.ts';
export * from './node-tree.ts';
export * from './notes.ts';
export * from './options.ts';
export * from './placement.ts';
export * from './scene.ts';

/** Metrics of one structure, tagged with its kind. */
export type KindedMetrics<K extends StructureKindName = StructureKindName> = {
  [P in K]: { readonly kind: P; readonly metrics: CoreTypeMap[P]['metrics'] };
}[K];

/** Metrics of every structure in a visualization, keyed by name. */
export type SceneMetrics = Readonly<Record<string, KindedMetrics>>;

// Generic dispatch helpers; see kinds/index.ts for the pattern.

function measureOf<K extends StructureKindName>(
  kind: K,
  state: CoreTypeMap[K]['state'],
  decl: CoreTypeMap[K]['decl'],
  fonts: LayoutFonts,
) {
  return runtimes[kind].measure(state, decl, fonts);
}

function mergeOf<K extends StructureKindName>(
  kind: K,
  a: CoreTypeMap[K]['metrics'],
  b: CoreTypeMap[K]['metrics'],
) {
  return runtimes[kind].mergeMetrics(a, b);
}

function layoutOf<K extends StructureKindName>(
  kind: K,
  input: Parameters<(typeof runtimes)[K]['layout']>[0],
): Block {
  return runtimes[kind].layout(input);
}

function measureStructure(
  entry: KindedState,
  decl: StructureDecl,
  fonts: LayoutFonts,
): KindedMetrics {
  return {
    kind: entry.kind,
    metrics: measureOf(entry.kind, entry.state, decl, fonts),
  } as KindedMetrics;
}

function mergeStructure(a: KindedMetrics, b: KindedMetrics): KindedMetrics {
  return {
    kind: a.kind,
    metrics: mergeOf(a.kind, a.metrics, b.metrics),
  } as KindedMetrics;
}

/** Metrics of one state, with text measured in `fonts`. */
export function measureState(
  vis: Visualization,
  state: VisualizationState,
  fonts: LayoutFonts = defaultFonts,
): SceneMetrics {
  const out: Record<string, KindedMetrics> = {};
  for (const [name, entry] of Object.entries(state)) {
    const decl = vis.structures[name];
    if (decl !== undefined) out[name] = measureStructure(entry, decl, fonts);
  }
  return out;
}

export function mergeMetrics(a: SceneMetrics, b: SceneMetrics): SceneMetrics {
  const out: Record<string, KindedMetrics> = { ...a };
  for (const [name, m] of Object.entries(b)) {
    const prev = out[name];
    out[name] = prev === undefined ? m : mergeStructure(prev, m);
  }
  return out;
}

/** Measures every frame of a trace, with text measured in `fonts`. */
export function measureTrace(
  trace: Trace,
  fonts: LayoutFonts = defaultFonts,
): SceneMetrics {
  const vis = trace.visualization;
  let metrics = measureState(vis, trace.frame(0).state, fonts);
  for (let i = 1; i <= trace.length; i++)
    metrics = mergeMetrics(
      metrics,
      measureState(vis, trace.frame(i).state, fonts),
    );
  return metrics;
}

/** A column's items and size; `x` is where the next column may start. */
interface ColumnLayout {
  readonly items: readonly SceneItem[];
  readonly width: number;
  readonly height: number;
}

/**
 * Lays out the structures of one column top to bottom from `origin`,
 * skipping any the state lacks.
 */
function layoutColumn(
  vis: Visualization,
  state: VisualizationState,
  measured: SceneMetrics,
  column: FigureColumn,
  origin: { readonly x: number; readonly y: number },
  o: LayoutOptions,
  closed: ReadonlySet<string>,
): ColumnLayout {
  const items: SceneItem[] = [];
  let y = origin.y;
  let width = 0;
  let first = true;
  // Room closed bands give up in this frame, kept in the column's size.
  let reserved = 0;
  // A lone structure's id says nothing the figure does not; a label does.
  const lone = Object.keys(vis.structures).length === 1;
  for (const name of column.names) {
    const decl = vis.structures[name]!;
    const entry = state[name];
    const m =
      measured[name] ?? (entry && measureStructure(entry, decl, o.fonts));
    if (entry === undefined || m === undefined) continue;
    if (!first) y += o.structureGap;
    first = false;

    const block = layoutOf(entry.kind, {
      name,
      title: decl.label ?? name,
      decl,
      state: entry.state,
      metrics: m.metrics,
      origin: { x: origin.x, y },
      region: column.region,
      ...(closed.has(name) ? { pointersShown: false } : {}),
      options:
        lone && decl.label === undefined ? { ...o, showTitles: false } : o,
    } as Parameters<(typeof runtimes)[typeof entry.kind]['layout']>[0]);
    // A loop, not push(...items): spreading a large array overflows the stack.
    for (const item of block.items) items.push(item);
    width = Math.max(width, block.width);
    y += block.height;
    reserved += block.reserved ?? 0;
  }
  return { items, width, height: y - origin.y + reserved };
}

/**
 * Lays out one state. `metrics` default to the state's own; metrics passed
 * in must have been measured with `options.fonts`. Structures go in the
 * columns of `arrangeStructures` (ADR 0029): a second column starts after
 * the widest block of the first, plus `columnGap`.
 */
export function layoutState(
  vis: Visualization,
  state: VisualizationState,
  metrics?: SceneMetrics,
  options: LayoutOptions = defaultLayoutOptions,
  closedBands: ReadonlySet<string> = new Set(),
): Scene {
  const o = options;
  const measured = metrics ?? measureState(vis, state, o.fonts);
  const items: SceneItem[] = [];
  let x = o.padding;
  let width = 0;
  let height = 0;

  for (const [k, column] of arrangeStructures(
    vis.structures,
    o.layout,
  ).entries()) {
    if (k > 0) x += o.columnGap;
    const laid = layoutColumn(
      vis,
      state,
      measured,
      column,
      { x, y: o.padding },
      o,
      closedBands,
    );
    for (const item of laid.items) items.push(item);
    x += laid.width;
    width = x - o.padding;
    height = Math.max(height, laid.height);
  }

  return {
    width: width + 2 * o.padding,
    height: o.padding + height + o.padding,
    title: vis.title ?? 'Visualization',
    items,
  };
}

/**
 * For each structure with a pointer band, the first and last frame in
 * which it has a pointer (ADR 0031).
 */
function pointerSpans(trace: Trace): Map<string, [number, number]> {
  const spans = new Map<string, [number, number]>();
  for (let i = 0; i <= trace.length; i++)
    for (const [name, entry] of Object.entries(trace.frame(i).state)) {
      if (entry.kind !== 'array' && entry.kind !== 'linkedList') continue;
      if (Object.keys(entry.state.marks.pointers).length === 0) continue;
      const span = spans.get(name);
      if (span === undefined) spans.set(name, [i, i]);
      else span[1] = i;
    }
  return spans;
}

/** Lays out the frames of a trace with metrics shared by all of them. */
export interface TraceLayout {
  readonly metrics: SceneMetrics;
  sceneAt(index: number): Scene;
}

export function layoutTrace(
  trace: Trace,
  options: Partial<LayoutOptions> = {},
): TraceLayout {
  // `fonts: undefined` (e.g. from a theme without metrics) keeps the default.
  const o: LayoutOptions = {
    ...defaultLayoutOptions,
    ...options,
    fonts: options.fonts ?? defaultFonts,
  };
  const metrics = measureTrace(trace, o.fonts);
  const spans = pointerSpans(trace);
  // Bands below a structure open over the frames from its first pointer to
  // its last, and close outside them (ADR 0031).
  const closedAt = (index: number): ReadonlySet<string> =>
    new Set(
      Object.keys(trace.visualization.structures).filter((name) => {
        const span = spans.get(name);
        return span === undefined || index < span[0] || index > span[1];
      }),
    );
  return {
    metrics,
    sceneAt: (index) =>
      layoutState(
        trace.visualization,
        trace.frame(index).state,
        metrics,
        o,
        closedAt(index),
      ),
  };
}
