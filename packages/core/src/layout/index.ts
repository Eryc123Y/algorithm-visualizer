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
import type { Scene, SceneItem } from './scene.ts';

export * from './array.ts';
export * from './graph.ts';
export * from './hash-table.ts';
export * from './table.ts';
export * from './array-heap.ts';
export * from './common.ts';
export * from './edge-label.ts';
export * from './linked-list.ts';
export * from './queue.ts';
export * from './stack.ts';
export * from './tree.ts';
export * from './node-tree.ts';
export * from './options.ts';
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

/**
 * Lays out one state. `metrics` default to the state's own; metrics passed
 * in must have been measured with `options.fonts`.
 */
export function layoutState(
  vis: Visualization,
  state: VisualizationState,
  metrics?: SceneMetrics,
  options: LayoutOptions = defaultLayoutOptions,
): Scene {
  const o = options;
  const measured = metrics ?? measureState(vis, state, o.fonts);
  const items: SceneItem[] = [];
  let y = o.padding;
  let width = 0;
  let first = true;

  for (const [name, decl] of Object.entries(vis.structures)) {
    const entry = state[name];
    const m =
      measured[name] ?? (entry && measureStructure(entry, decl, o.fonts));
    if (entry === undefined || m === undefined) continue;
    if (!first) y += o.structureGap;
    first = false;

    const title = decl.label ?? name;
    const origin = { x: o.padding, y };
    const block = layoutOf(entry.kind, {
      name,
      title,
      decl,
      state: entry.state,
      metrics: m.metrics,
      origin,
      options: o,
    } as Parameters<(typeof runtimes)[typeof entry.kind]['layout']>[0]);
    // A loop, not push(...items): spreading a large array overflows the stack.
    for (const item of block.items) items.push(item);
    width = Math.max(width, block.width);
    y += block.height;
  }

  return {
    width: width + 2 * o.padding,
    height: y + o.padding,
    title: vis.title ?? 'Visualization',
    items,
  };
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
  const o: LayoutOptions = { ...defaultLayoutOptions, ...options };
  const metrics = measureTrace(trace, o.fonts);
  return {
    metrics,
    sceneAt: (index) =>
      layoutState(trace.visualization, trace.frame(index).state, metrics, o),
  };
}
