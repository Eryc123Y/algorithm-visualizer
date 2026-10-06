/**
 * Layout of whole frames: `layoutState(vis, state, metrics) → Scene`.
 *
 * Layout is pure and DOM-free (ADR 0003). It takes metrics measured over the
 * whole trace (ADR 0008) so that sizes and positions do not jump between
 * frames.
 */
import type { Visualization } from '@algoviz/spec';

import type { KindedState, VisualizationState } from '../kinds/index.ts';
import type { Trace } from '../trace.ts';
import {
  layoutArray,
  measureArray,
  mergeArrayMetrics,
  type ArrayMetrics,
} from './array.ts';
import { defaultLayoutOptions, type LayoutOptions } from './options.ts';
import type { Scene, SceneItem } from './scene.ts';

export * from './array.ts';
export * from './options.ts';
export * from './scene.ts';

/** Metrics of one structure, tagged with its kind. */
export type KindedMetrics = {
  readonly kind: 'array';
  readonly metrics: ArrayMetrics;
};

/** Metrics of every structure in a visualization, keyed by name. */
export type SceneMetrics = Readonly<Record<string, KindedMetrics>>;

function measureStructure(entry: KindedState): KindedMetrics {
  switch (entry.kind) {
    case 'array':
      return { kind: 'array', metrics: measureArray(entry.state) };
    default: {
      const unreachable: never = entry.kind;
      return unreachable;
    }
  }
}

function mergeStructure(a: KindedMetrics, b: KindedMetrics): KindedMetrics {
  switch (a.kind) {
    case 'array':
      return {
        kind: 'array',
        metrics: mergeArrayMetrics(a.metrics, b.metrics),
      };
    default: {
      const unreachable: never = a.kind;
      return unreachable;
    }
  }
}

export function measureState(state: VisualizationState): SceneMetrics {
  const out: Record<string, KindedMetrics> = {};
  for (const [name, entry] of Object.entries(state))
    out[name] = measureStructure(entry);
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
  let metrics = measureState(trace.frame(0).state);
  for (let i = 1; i <= trace.length; i++)
    metrics = mergeMetrics(metrics, measureState(trace.frame(i).state));
  return metrics;
}

export function layoutState(
  vis: Visualization,
  state: VisualizationState,
  metrics: SceneMetrics = measureState(state),
  options: LayoutOptions = defaultLayoutOptions,
): Scene {
  const o = options;
  const items: SceneItem[] = [];
  let y = o.padding;
  let width = 0;
  let first = true;

  for (const [name, decl] of Object.entries(vis.structures)) {
    const entry = state[name];
    const m = metrics[name] ?? (entry && measureStructure(entry));
    if (entry === undefined || m === undefined) continue;
    if (!first) y += o.structureGap;
    first = false;

    const title = decl.label ?? name;
    const origin = { x: o.padding, y };
    let block;
    switch (entry.kind) {
      case 'array':
        block = layoutArray(name, title, entry.state, m.metrics, origin, o);
        break;
      default: {
        const unreachable: never = entry.kind;
        return unreachable;
      }
    }
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
