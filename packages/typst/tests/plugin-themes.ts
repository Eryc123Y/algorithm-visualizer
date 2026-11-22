/**
 * Every registry example in every theme through the plugin, byte for byte
 * the SVG of `exportFigures` (ADR 0026). The themes are shared out among
 * `plugin-themes-*.spec.ts`, so Vitest draws them in parallel.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { algorithms } from '@algomotion/recipes';
import { themes, type ThemeName } from '@algomotion/svg';

import type { PluginInstance } from '../scripts/host.ts';
import { exportedSvg, loadedEngine, render, svgOf } from './plugin-host.ts';

/** How many files share the themes out. */
export const PARTS = 5;

/** The themes of part `k` of `PARTS`: every `PARTS`-th one from `k`. */
export const themesOfPart = (k: number): ThemeName[] =>
  (Object.keys(themes) as ThemeName[]).filter((_, i) => i % PARTS === k);

/** Draws every registry example in each of `names` through the plugin. */
export function drawsEveryExampleIn(names: readonly ThemeName[]): void {
  let engine: PluginInstance;
  beforeAll(async () => {
    engine = await loadedEngine();
  });
  describe('the plugin', () => {
    for (const theme of names)
      it(`draws every registry example in ${theme} as exportFigures does`, () => {
        for (const algorithm of algorithms)
          for (const input of algorithm.examples)
            expect(
              svgOf(render(engine, { algorithm: algorithm.id, input, theme })),
              `${algorithm.id} in ${theme}`,
            ).toEqual(exportedSvg(algorithm.id, input, [], theme));
      });
  });
}
