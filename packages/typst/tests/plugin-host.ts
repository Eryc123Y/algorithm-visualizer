/**
 * Rendering through the committed plugin, as Typst runs it, and what
 * `exportFigures` draws for the same request, for the plugin's tests.
 */
import { runAlgorithm } from '@algomotion/recipes';
import { exportFigures, type ThemeName } from '@algomotion/svg';

import type { Response } from '../src/engine.ts';
import { buildEngine } from '../scripts/engine.ts';
import { instantiatePlugin, type PluginInstance } from '../scripts/host.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** A plugin instance with an engine built from this checkout loaded. */
export async function loadedEngine(): Promise<PluginInstance> {
  const { plugin, bytecode } = await buildEngine();
  const instance = await instantiatePlugin(plugin);
  instance.call('load', bytecode);
  return instance;
}

export function render(instance: PluginInstance, request: unknown): Response {
  const output = instance.call(
    'render',
    encoder.encode(JSON.stringify(request)),
  );
  return JSON.parse(decoder.decode(output)) as Response;
}

/** The SVG of each figure `algomotion export` draws for a run. */
export function exportedSvg(
  id: string,
  input: unknown,
  steps: readonly (string | number)[],
  theme: ThemeName,
): string[] {
  const run = runAlgorithm(id, input);
  if (!run.ok) throw new Error(JSON.stringify(run.error));
  const series = exportFigures(run.value.document, { steps, theme });
  if (!series.ok) throw new Error(JSON.stringify(series.error));
  return series.value.figures.map((f) => f.svg);
}

export function svgOf(response: Response): string[] {
  if (!response.ok) throw new Error(JSON.stringify(response.diagnostics));
  return response.figures.map((f) => f.svg);
}
