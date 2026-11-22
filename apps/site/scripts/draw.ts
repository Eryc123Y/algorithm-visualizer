/**
 * The figures the site's pages show, drawn by the engine at build time:
 * runs of the registry in the page's language (ADR 0045), each frame in
 * the light and the dark theme or in one fixed theme. `build-pages.ts`
 * writes the pages around them.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { algorithms, runAlgorithm } from '@algomotion/recipes';
import {
  exportFigures,
  prepareFigures,
  type Figure,
  type ThemeName,
} from '@algomotion/svg';

import type { Entry } from '../src/docs/catalog.ts';
import type { Art } from '../src/docs/home.ts';
import { PREFIX, type Locale } from '../src/docs/locale.ts';
import {
  flipFrames,
  thumbnailFrame,
  thumbnailStem,
  type Thumbnail,
} from '../src/docs/pages.ts';
import { shortInput } from '../src/docs/short-input.ts';
import type { FigureLayout } from '../src/docs/why.ts';

export const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

/** Writes `content` to `path` under dist/, making its folders. */
export function write(path: string, content: string): void {
  const file = join(DIST, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

/**
 * A run to draw: its document, and the language it is in, which is also
 * the language of the words the layout draws itself, such as "min".
 */
export interface Run {
  readonly document: unknown;
  readonly locale: Locale;
}

/** `algorithm` run on `input` in `locale`, or a build error. */
export function runOf(
  algorithm: string,
  input: unknown,
  locale: Locale = 'en',
): Run {
  const result = runAlgorithm(algorithm, input, { locale });
  if (!result.ok)
    throw new Error(
      `${algorithm} on ${JSON.stringify(input)}: ${JSON.stringify(result.error)}`,
    );
  return { document: result.value.document, locale };
}

/** One frame of `run` in `theme`. */
export function figureOf(
  run: Run,
  step: string | number,
  theme: ThemeName,
  layout?: FigureLayout,
): Figure {
  const series = exportFigures(run.document, {
    theme,
    locale: run.locale,
    steps: [step],
    ...(layout === undefined ? {} : { layout }),
  });
  if (!series.ok)
    throw new Error(`${step} in ${theme}: ${JSON.stringify(series.error)}`);
  return series.value.figures[0]!;
}

/** Every frame of `run` after the first, as the light theme draws it. */
export function allFigures(run: Run): readonly Figure[] {
  const series = exportFigures(run.document, {
    theme: 'light',
    locale: run.locale,
  });
  if (!series.ok) throw new Error(JSON.stringify(series.error));
  return series.value.figures.filter((f) => f.frame > 0);
}

/**
 * Draws a step in the light and the dark theme, or in one fixed theme,
 * into `stem-light.svg` and `stem-dark.svg`. Without `alt`, the step's
 * narration describes it.
 */
export function drawArt(
  run: Run,
  step: string | number,
  stem: string,
  alt: string,
  theme?: ThemeName,
  layout?: FigureLayout,
): Art {
  const light = figureOf(run, step, theme ?? 'light', layout);
  const dark =
    theme === undefined ? figureOf(run, step, 'dark', layout) : light;
  write(`${stem}-light.svg`, light.svg);
  write(`${stem}-dark.svg`, dark.svg);
  const described = alt || light.narration;
  if (described === undefined || described === '')
    throw new Error(`${stem}: a figure needs alternative text`);
  return {
    light: `${stem}-light.svg`,
    dark: `${stem}-dark.svg`,
    width: light.width,
    height: light.height,
    alt: described,
    // One fixed theme: shown on that theme's paper in both schemes.
    ...(theme === undefined ? {} : { theme }),
  };
}

/**
 * The catalogue's thumbnails in `locale`: each algorithm and structure
 * of `entries` from its first example, at the frame `thumbnailFrame`
 * picks, in light and dark, and the few frames it flips through on hover
 * (`flipFrames`), beside the locale's catalogue page.
 */
export function drawThumbnails(
  entries: readonly Entry[],
  locale: Locale,
): Record<string, Thumbnail> {
  const thumbnails: Record<string, Thumbnail> = {};
  const folder = `${PREFIX[locale]}algorithms/`;
  for (const entry of entries) {
    if (entry.structure !== undefined) continue;
    const algorithm = algorithms.find((a) => a.id === entry.id)!;
    const { document } = runOf(
      entry.id,
      shortInput(entry.id, algorithm.examples[0]),
      locale,
    );
    const stem = thumbnailStem(entry.id);
    let flip: readonly number[] = [];
    const [light] = (['light', 'dark'] as const).map((theme) => {
      const prepared = prepareFigures(document, { theme, locale });
      if (!prepared.ok)
        throw new Error(
          `${entry.id} in ${theme}: ${JSON.stringify(prepared.error)}`,
        );
      const draw = (frame: number) => {
        const figure = prepared.value.figure(frame);
        if (!figure.ok)
          throw new Error(
            `${entry.id} in ${theme}: ${JSON.stringify(figure.error)}`,
          );
        return figure.value;
      };
      const still = draw(thumbnailFrame(prepared.value.frames));
      write(`${folder}${stem}-${theme}.svg`, still.svg);
      flip = flipFrames(prepared.value.frames);
      for (const frame of flip)
        write(`${folder}${stem}-f${frame}-${theme}.svg`, draw(frame).svg);
      return still;
    });
    thumbnails[entry.id] = {
      light: `${stem}-light.svg`,
      dark: `${stem}-dark.svg`,
      width: light!.width,
      height: light!.height,
      alt: '',
      flip,
    };
  }
  return thumbnails;
}
