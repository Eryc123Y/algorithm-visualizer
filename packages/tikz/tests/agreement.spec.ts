/**
 * The TikZ painter against the SVG painter, on the scenes the SVG painter's
 * tests use: every valid fixture, every registry example, and random
 * documents of every kind. Each figure file must be well formed, and each
 * of its shapes and texts must sit where the SVG of the same scene puts
 * them (ADR 0027).
 */
import { readdirSync, readFileSync } from 'node:fs';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { layoutTrace, loadTrace, type Scene } from '@algomotion/core';
import { algorithms, runAlgorithm } from '@algomotion/recipes';
import {
  prepareFigures,
  renderSvg,
  themeNames,
  type ThemeName,
} from '@algomotion/svg';

import { prepareTikzFigures, renderTikz } from '../src/index.ts';
import {
  agreementProblems,
  svgShapes,
  tikzShapes,
  wellFormedProblems,
} from './check.ts';

const THEMES: readonly ThemeName[] = themeNames;

/** Everything wrong with the TikZ figure of a scene, compared with its SVG. */
function problems(scene: Scene, theme: ThemeName): string[] {
  const tikz = renderTikz(scene, { theme });
  const svg = renderSvg(scene, { theme, outlineText: false });
  return [
    ...wellFormedProblems(tikz),
    ...agreementProblems(svgShapes(svg), tikzShapes(tikz)),
  ];
}

const root = new URL('../../../conformance/', import.meta.url);
const fixtures = ['core/valid', 'spec/valid'].flatMap((dir) =>
  readdirSync(new URL(`${dir}/`, root))
    .filter((f) => f.endsWith('.json'))
    .map((f) => [
      `${dir}/${f}`,
      (
        JSON.parse(readFileSync(new URL(`${dir}/${f}`, root), 'utf8')) as {
          input: unknown;
        }
      ).input,
    ]),
);

describe('every valid fixture', () => {
  it.each(fixtures)('%s', (_, input) => {
    const loaded = loadTrace(input);
    if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
    const layout = layoutTrace(loaded.value);
    for (let f = 0; f <= loaded.value.length; f++)
      for (const theme of THEMES)
        expect(
          problems(layout.sceneAt(f), theme),
          `frame ${f}, ${theme}`,
        ).toEqual([]);
  });
});

describe('every registry example', () => {
  it.each(algorithms.map((a) => [a.id, a.examples[0]] as const))(
    '%s',
    (id, input) => {
      const run = runAlgorithm(id, input);
      if (!run.ok) throw new Error(JSON.stringify(run.error));
      const document = run.value.document;
      for (const theme of THEMES) {
        const tikz = prepareTikzFigures(document, { theme });
        const svg = prepareFigures(document, { theme });
        if (!tikz.ok || !svg.ok) throw new Error('prepare');
        // Every frame in the default theme; the ends and the middle in others.
        const last = tikz.value.frames - 1;
        const frames =
          theme === 'light'
            ? undefined
            : [...new Set([0, Math.floor(last / 2), last])];
        const t = tikz.value.figures(frames);
        const s = svg.value.figures(frames);
        if (!t.ok || !s.ok) throw new Error('figures');
        t.value.forEach((figure, k) => {
          const other = s.value[k]!;
          // One canvas per document, in both formats (ADR 0025).
          expect([figure.frame, figure.width, figure.height]).toEqual([
            other.frame,
            other.width,
            other.height,
          ]);
          expect(
            wellFormedProblems(figure.tikz),
            `frame ${figure.frame}`,
          ).toEqual([]);
        });
      }
    },
  );

  it('agrees with the SVG, shape by shape, on every frame', () => {
    for (const algorithm of algorithms) {
      const run = runAlgorithm(algorithm.id, algorithm.examples[0]);
      if (!run.ok) throw new Error(algorithm.id);
      const loaded = loadTrace(run.value.document);
      if (!loaded.ok) throw new Error(algorithm.id);
      const layout = layoutTrace(loaded.value);
      for (let f = 0; f <= loaded.value.length; f++)
        expect(
          problems(layout.sceneAt(f), 'light'),
          `${algorithm.id} frame ${f}`,
        ).toEqual([]);
    }
  }, 120_000);
});

// Random documents of every kind, from @algomotion/core's generator, by
// relative path: a computed specifier keeps TypeScript from pulling core's
// tests into this project (TS6307).
const properties = new URL('../../core/tests/properties/', import.meta.url);
const { build } = (await import(new URL('build.ts', properties).href)) as {
  build: (dice: unknown) => {
    doc: unknown;
    expected: { ok: boolean };
  };
};
const { Dice, RUNS } = (await import(
  new URL('random.ts', properties).href
)) as {
  Dice: new (values: readonly number[]) => unknown;
  RUNS: number;
};

describe('generated documents', () => {
  it(
    'give well-formed figures that agree with the SVG',
    () => {
      fc.assert(
        fc.property(
          fc.array(fc.nat(), { maxLength: 300 }),
          fc.nat(),
          fc.constantFrom(...THEMES),
          (values, pick, theme) => {
            const built = build(new Dice(values));
            if (!built.expected.ok) return;
            const loaded = loadTrace(built.doc);
            if (!loaded.ok) throw new Error(JSON.stringify(loaded.error));
            const layout = layoutTrace(loaded.value);
            const frame = pick % (loaded.value.length + 1);
            expect(problems(layout.sceneAt(frame), theme)).toEqual([]);
          },
        ),
        {
          numRuns: RUNS,
          ...(process.env['FUZZ_SEED']
            ? { seed: Number(process.env['FUZZ_SEED']) }
            : {}),
        },
      );
    },
    20 * 60_000,
  );
});
