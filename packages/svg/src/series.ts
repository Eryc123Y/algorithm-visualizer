/**
 * Series of figures (ADR 0025): chosen frames of a document as standalone
 * SVG files that share one layout and one canvas, so every figure of a
 * document has the same size and scale, whichever frames are exported
 * together. No DOM and no Node.js: the Typst plugin calls `exportFigures`.
 */
import {
  layoutTrace,
  loadTrace,
  selectorOf,
  selectSeries,
  type Scene,
  type Trace,
} from '@algoviz/core';
import { err, ok, type Diagnostic, type Result } from '@algoviz/spec';

import { renderSvg } from './render.ts';
import {
  resolveTheme,
  themes,
  type SvgTheme,
  type ThemeName,
} from './theme.ts';

/** One frame of a document as a standalone SVG. */
export interface Figure {
  readonly frame: number;
  /** The frame's most specific selector, e.g. `insert-5/relax#2` (ADR 0020). */
  readonly selector: string;
  /** The same for every figure of a document. */
  readonly width: number;
  readonly height: number;
  readonly svg: string;
}

/** The figures of a series, and how many frames the document has. */
export interface FigureSeries {
  /** Frames of the document, 0 to `frames - 1`; not only those exported. */
  readonly frames: number;
  readonly figures: readonly Figure[];
}

export interface SeriesOptions {
  /** A theme name or a full theme, e.g. from `createTheme`. Default `'light'`. */
  readonly theme?: SvgTheme | ThemeName;
}

export interface ExportOptions extends SeriesOptions {
  /** Selectors of ADR 0020, as text or frame numbers. None means every frame. */
  readonly steps?: readonly (string | number)[];
}

/**
 * Lays out every frame to find the largest canvas, keeping the scenes of
 * the frames that are wanted.
 */
function layoutSeries(
  trace: Trace,
  frames: readonly number[],
  theme: SvgTheme,
): {
  readonly width: number;
  readonly height: number;
  readonly scenes: ReadonlyMap<number, Scene>;
} {
  for (const frame of frames)
    if (!Number.isInteger(frame) || frame < 0 || frame > trace.length)
      throw new RangeError(`Frame ${frame} is not in [0, ${trace.length}]`);
  const wanted = new Set(frames);
  const layout = layoutTrace(trace, { fonts: theme.fontMetrics });
  const scenes = new Map<number, Scene>();
  let width = 0;
  let height = 0;
  for (let f = 0; f <= trace.length; f++) {
    const scene = layout.sceneAt(f);
    width = Math.max(width, scene.width);
    height = Math.max(height, scene.height);
    if (wanted.has(f)) scenes.set(f, scene);
  }
  return { width, height, scenes };
}

/**
 * Renders `frames` of a trace, each on the largest canvas of the trace and
 * laid out with metrics measured over all its frames in the theme's fonts.
 * @throws RangeError for a frame outside `[0, trace.length]`.
 */
export function renderSeries(
  trace: Trace,
  frames: readonly number[],
  options: SeriesOptions = {},
): readonly Figure[] {
  if (frames.length === 0) return [];
  const theme = resolveTheme(options.theme);
  const { width, height, scenes } = layoutSeries(trace, frames, theme);
  const doc = trace.visualization;
  return frames.map((frame) => {
    const scene = { ...scenes.get(frame)!, width, height };
    // Frame f is the state after step f - 1; frame 0 has no step.
    const narration =
      frame > 0 ? doc.steps[frame - 1]?.meta?.narration : undefined;
    return {
      frame,
      selector: selectorOf(doc, frame),
      width,
      height,
      svg: renderSvg(scene, {
        theme,
        keys: false,
        ...(narration === undefined ? {} : { description: narration }),
      }),
    };
  });
}

/**
 * Loads a document, selects the frames `steps` name, and renders them as a
 * series. Errors are the document's diagnostics, the selector's at `$`, or
 * `UNKNOWN_THEME` at `$.theme`.
 */
export function exportFigures(
  document: unknown,
  options: ExportOptions = {},
): Result<FigureSeries, readonly Diagnostic[]> {
  // Callers from other languages, such as the Typst plugin, pass any text.
  const { theme } = options;
  if (typeof theme === 'string' && !Object.hasOwn(themes, theme))
    return err([
      {
        code: 'UNKNOWN_THEME',
        path: '$.theme',
        message: `No theme named ${JSON.stringify(theme)}`,
        hint: `Themes: ${Object.keys(themes).join(', ')}.`,
      },
    ]);
  const loaded = loadTrace(document);
  if (!loaded.ok) return loaded;
  const trace = loaded.value;
  const frames = selectSeries(trace.visualization, options.steps ?? []);
  if (!frames.ok) return err([frames.error]);
  return ok({
    frames: trace.length + 1,
    figures: renderSeries(trace, frames.value, options),
  });
}
