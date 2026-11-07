/**
 * Series of figures (ADR 0025): chosen frames of a document as standalone
 * SVG files that share one layout and one canvas, so every figure of a
 * document has the same size and scale, whichever frames are exported
 * together. No DOM and no Node.js: the Typst plugin keeps documents
 * prepared with `prepareFigures` and draws figures from them (ADR 0026).
 */
import {
  layoutTrace,
  loadTrace,
  selectFrame,
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
  /**
   * The narration of the step that produced the frame, also the SVG's
   * `<desc>`. Absent for frame 0 and for steps without one.
   */
  readonly narration?: string;
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

/** A document loaded once, from which figures of any of its frames are drawn. */
export interface PreparedFigures {
  /** Frames of the document, 0 to `frames - 1`. */
  readonly frames: number;
  /**
   * The figure of the one frame a selector names (`selectFrame`, ADR 0020):
   * a section or a range of several frames is an error.
   */
  figure(selector: string | number): Result<Figure, readonly Diagnostic[]>;
  /**
   * The figures of a series (`selectSeries`, ADR 0025): every frame the
   * selectors name, in timeline order. No selectors means every frame.
   */
  figures(
    selectors?: readonly (string | number)[],
  ): Result<readonly Figure[], readonly Diagnostic[]>;
}

/** Draws frames of a trace, all on its largest canvas. */
type Painter = (frames: readonly number[]) => readonly Figure[];

/**
 * A painter for a trace. The first call lays the trace out with metrics
 * measured over all its frames, in the theme's fonts, and measures the
 * canvas over every frame, keeping the scenes that call wants; later calls
 * lay out only their own frames.
 */
function painterOf(trace: Trace, theme: SvgTheme): Painter {
  let measured:
    | {
        readonly layout: ReturnType<typeof layoutTrace>;
        readonly width: number;
        readonly height: number;
      }
    | undefined;
  const doc = trace.visualization;
  return (frames) => {
    const kept = new Map<number, Scene>();
    if (measured === undefined) {
      const wanted = new Set(frames);
      const layout = layoutTrace(trace, { fonts: theme.fontMetrics });
      let width = 0;
      let height = 0;
      for (let f = 0; f <= trace.length; f++) {
        const scene = layout.sceneAt(f);
        width = Math.max(width, scene.width);
        height = Math.max(height, scene.height);
        if (wanted.has(f)) kept.set(f, scene);
      }
      measured = { layout, width, height };
    }
    const { layout, width, height } = measured;
    return frames.map((frame) => {
      const scene = {
        ...(kept.get(frame) ?? layout.sceneAt(frame)),
        width,
        height,
      };
      // Frame f is the state after step f - 1; frame 0 has no step.
      const narration =
        frame > 0 ? doc.steps[frame - 1]?.meta?.narration : undefined;
      return {
        frame,
        selector: selectorOf(doc, frame),
        width,
        height,
        ...(narration === undefined ? {} : { narration }),
        svg: renderSvg(scene, {
          theme,
          keys: false,
          ...(narration === undefined ? {} : { description: narration }),
        }),
      };
    });
  };
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
  for (const frame of frames)
    if (!Number.isInteger(frame) || frame < 0 || frame > trace.length)
      throw new RangeError(`Frame ${frame} is not in [0, ${trace.length}]`);
  if (frames.length === 0) return [];
  return painterOf(trace, resolveTheme(options.theme))(frames);
}

/**
 * Loads a document once, for figures of any of its frames. Errors are the
 * document's diagnostics, or `UNKNOWN_THEME` at `$.theme`; the figures'
 * selectors report theirs at `$`. Nothing is laid out until a figure is
 * drawn.
 */
export function prepareFigures(
  document: unknown,
  options: SeriesOptions = {},
): Result<PreparedFigures, readonly Diagnostic[]> {
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
  const doc = trace.visualization;
  const paint = painterOf(trace, resolveTheme(theme));
  return ok({
    frames: trace.length + 1,
    figure(selector) {
      const frame = selectFrame(doc, selector);
      return frame.ok ? ok(paint([frame.value])[0]!) : err([frame.error]);
    },
    figures(selectors = []) {
      const frames = selectSeries(doc, selectors);
      return frames.ok ? ok(paint(frames.value)) : err([frames.error]);
    },
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
  const prepared = prepareFigures(document, options);
  if (!prepared.ok) return prepared;
  const figures = prepared.value.figures(options.steps ?? []);
  if (!figures.ok) return figures;
  return ok({ frames: prepared.value.frames, figures: figures.value });
}
