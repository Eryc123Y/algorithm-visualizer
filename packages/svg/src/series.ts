/**
 * Series of figures (ADR 0025): chosen frames of a document as standalone
 * SVG files that share one layout and one canvas, so every figure of a
 * document has the same size and scale, whichever frames are exported
 * together. No DOM and no Node.js: the Typst plugin keeps documents
 * prepared with `prepareFigures` and draws figures from them (ADR 0026).
 */
import {
  defaultLayoutOptions,
  layoutTrace,
  loadTrace,
  selectFrame,
  selectorOf,
  selectSeries,
  type FigureLayout,
  type Scene,
  type Trace,
} from '@algomotion/core';
import { err, ok, type Diagnostic, type Result } from '@algomotion/spec';

import { renderSvg } from './render.ts';
import {
  isThemeName,
  resolveTheme,
  themeNames,
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
  /**
   * Where structures declared with `place: "side"` go (ADR 0029): beside
   * the main ones (`'wide'`, the default) or below them (`'narrow'`).
   */
  readonly layout?: FigureLayout;
}

/** The figure layouts, for checking a name from another language. */
const LAYOUTS: readonly FigureLayout[] = ['wide', 'narrow'];

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

/**
 * A frame of a document laid out on the document's canvas: the scene a
 * painter draws, whatever the format (ADR 0025, 0027).
 */
export interface SceneFrame {
  readonly frame: number;
  /** The frame's most specific selector, e.g. `insert-5/relax#2` (ADR 0020). */
  readonly selector: string;
  /** The same for every frame of a document. */
  readonly width: number;
  readonly height: number;
  /** The narration of the step that produced the frame, if it has one. */
  readonly narration?: string;
  /** Laid out in the theme's fonts, with `width` and `height` as its size. */
  readonly scene: Scene;
}

/** A document loaded once, from which scenes of any of its frames are laid out. */
export interface PreparedScenes {
  /** Frames of the document, 0 to `frames - 1`. */
  readonly frames: number;
  /** The theme the scenes were laid out for, resolved. */
  readonly theme: SvgTheme;
  /** The scene of the one frame a selector names (`selectFrame`, ADR 0020). */
  scene(selector: string | number): Result<SceneFrame, readonly Diagnostic[]>;
  /** The scenes of a series (`selectSeries`, ADR 0025), in timeline order. */
  scenes(
    selectors?: readonly (string | number)[],
  ): Result<readonly SceneFrame[], readonly Diagnostic[]>;
}

/** Lays out frames of a trace, all on its largest canvas. */
type Framer = (frames: readonly number[]) => readonly SceneFrame[];

/**
 * A framer for a trace. The first call lays the trace out with metrics
 * measured over all its frames, in the theme's fonts, and measures the
 * canvas over every frame, keeping the scenes that call wants; later calls
 * lay out only their own frames.
 */
function framerOf(
  trace: Trace,
  theme: SvgTheme,
  layout: FigureLayout = defaultLayoutOptions.layout,
): Framer {
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
      const laid = layoutTrace(trace, { fonts: theme.fontMetrics, layout });
      let width = 0;
      let height = 0;
      for (let f = 0; f <= trace.length; f++) {
        const scene = laid.sceneAt(f);
        width = Math.max(width, scene.width);
        height = Math.max(height, scene.height);
        if (wanted.has(f)) kept.set(f, scene);
      }
      measured = { layout: laid, width, height };
    }
    const { layout: laidOut, width, height } = measured;
    return frames.map((frame) => {
      // Frame f is the state after step f - 1; frame 0 has no step.
      const narration =
        frame > 0 ? doc.steps[frame - 1]?.meta?.narration : undefined;
      return {
        frame,
        selector: selectorOf(doc, frame),
        width,
        height,
        ...(narration === undefined ? {} : { narration }),
        scene: {
          ...(kept.get(frame) ?? laidOut.sceneAt(frame)),
          width,
          height,
        },
      };
    });
  };
}

/** The standalone SVG figure of a laid-out frame. */
function figureOf(frame: SceneFrame, theme: SvgTheme): Figure {
  const { scene, ...rest } = frame;
  return {
    ...rest,
    svg: renderSvg(scene, {
      theme,
      keys: false,
      ...(frame.narration === undefined
        ? {}
        : { description: frame.narration }),
    }),
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
  const theme = resolveTheme(options.theme);
  return framerOf(
    trace,
    theme,
    options.layout,
  )(frames).map((f) => figureOf(f, theme));
}

/**
 * Loads a document once, for scenes of any of its frames, laid out on one
 * canvas in the theme's fonts and the given layout. Errors are the
 * document's diagnostics, `UNKNOWN_THEME` at `$.theme` or `UNKNOWN_LAYOUT`
 * at `$.layout`; the selectors report theirs at `$`. Nothing
 * is laid out until a scene is asked for. Every painter's series is built
 * on it, so SVG and TikZ figures share positions and canvas.
 */
export function prepareScenes(
  document: unknown,
  options: SeriesOptions = {},
): Result<PreparedScenes, readonly Diagnostic[]> {
  // Callers from other languages, such as the Typst plugin, pass any text.
  const { theme, layout } = options;
  if (typeof theme === 'string' && !isThemeName(theme))
    return err([
      {
        code: 'UNKNOWN_THEME',
        path: '$.theme',
        message: `No theme named ${JSON.stringify(theme)}`,
        hint: `Themes: ${themeNames.join(', ')}.`,
      },
    ]);
  if (layout !== undefined && !LAYOUTS.includes(layout))
    return err([
      {
        code: 'UNKNOWN_LAYOUT',
        path: '$.layout',
        message: `No layout named ${JSON.stringify(layout)}`,
        hint: `Layouts: ${LAYOUTS.join(', ')}.`,
      },
    ]);
  const loaded = loadTrace(document);
  if (!loaded.ok) return loaded;
  const trace = loaded.value;
  const doc = trace.visualization;
  const resolved = resolveTheme(theme);
  const frame = framerOf(trace, resolved, layout);
  return ok({
    frames: trace.length + 1,
    theme: resolved,
    scene(selector) {
      const selected = selectFrame(doc, selector);
      return selected.ok
        ? ok(frame([selected.value])[0]!)
        : err([selected.error]);
    },
    scenes(selectors = []) {
      const selected = selectSeries(doc, selectors);
      return selected.ok ? ok(frame(selected.value)) : err([selected.error]);
    },
  });
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
  const prepared = prepareScenes(document, options);
  if (!prepared.ok) return prepared;
  const scenes = prepared.value;
  return ok({
    frames: scenes.frames,
    figure(selector) {
      const frame = scenes.scene(selector);
      return frame.ok ? ok(figureOf(frame.value, scenes.theme)) : frame;
    },
    figures(selectors = []) {
      const frames = scenes.scenes(selectors);
      return frames.ok
        ? ok(frames.value.map((f) => figureOf(f, scenes.theme)))
        : frames;
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
