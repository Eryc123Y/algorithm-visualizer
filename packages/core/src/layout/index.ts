/**
 * Layout of whole frames: `layoutState(vis, state, metrics) → Scene`.
 *
 * Layout is pure and DOM-free (ADR 0003). It takes metrics measured over the
 * whole trace (ADR 0008) so that sizes and positions do not jump between
 * frames.
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
import { defaultLayoutOptions, type LayoutOptions } from './options.ts';
import type { Scene, SceneItem } from './scene.ts';

export * from './array.ts';
export * from './array-heap.ts';
export * from './common.ts';
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
) {
  return runtimes[kind].measure(state, decl);
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
): KindedMetrics {
  return {
    kind: entry.kind,
    metrics: measureOf(entry.kind, entry.state, decl),
  } as KindedMetrics;
}

function mergeStructure(a: KindedMetrics, b: KindedMetrics): KindedMetrics {
  return {
    kind: a.kind,
    metrics: mergeOf(a.kind, a.metrics, b.metrics),
  } as KindedMetrics;
}

export function measureState(
  vis: Visualization,
  state: VisualizationState,
): SceneMetrics {
  const out: Record<string, KindedMetrics> = {};
  for (const [name, entry] of Object.entries(state)) {
    const decl = vis.structures[name];
    if (decl !== undefined) out[name] = measureStructure(entry, decl);
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

/** Measures every frame of a trace. */
export function measureTrace(trace: Trace): SceneMetrics {
  const vis = trace.visualization;
  let metrics = measureState(vis, trace.frame(0).state);
  for (let i = 1; i <= trace.length; i++)
    metrics = mergeMetrics(metrics, measureState(vis, trace.frame(i).state));
  return metrics;
}

export function layoutState(
  vis: Visualization,
  state: VisualizationState,
  metrics: SceneMetrics = measureState(vis, state),
  options: LayoutOptions = defaultLayoutOptions,
): Scene {
  const o = options;
  const items: SceneItem[] = [];
  let y = o.padding;
  let width = 0;
  let first = true;

  for (const [name, decl] of Object.entries(vis.structures)) {
    const entry = state[name];
    const m = metrics[name] ?? (entry && measureStructure(entry, decl));
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
    items.push(...block.items);
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
  const metrics = measureTrace(trace);
  return {
    metrics,
    sceneAt: (index) =>
      layoutState(trace.visualization, trace.frame(index).state, metrics, o),
  };
}
