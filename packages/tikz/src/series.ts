/**
 * TikZ figures of chosen frames of a document (ADR 0027), on the series
 * of ADR 0025: one layout and one canvas per document, shared with the
 * SVG figures, so a frame's TikZ and SVG figures have the same size and
 * positions. No DOM and no Node.js.
 */
import { err, ok, type Diagnostic, type Result } from '@algoviz/spec';
import {
  prepareScenes,
  type SceneFrame,
  type SeriesOptions,
  type SvgTheme,
} from '@algoviz/svg';

import { renderTikz } from './render.ts';

/** One frame of a document as a TikZ figure for the LaTeX package. */
export interface TikzFigure {
  readonly frame: number;
  /** The frame's most specific selector, e.g. `insert-5/relax#2` (ADR 0020). */
  readonly selector: string;
  /** In scene units; the same for every figure of a document. */
  readonly width: number;
  readonly height: number;
  /** The narration of the step that produced the frame, if it has one. */
  readonly narration?: string;
  readonly tikz: string;
}

/** A document loaded once, from which TikZ figures of its frames are drawn. */
export interface PreparedTikzFigures {
  /** Frames of the document, 0 to `frames - 1`. */
  readonly frames: number;
  /** The figure of the one frame a selector names (`selectFrame`, ADR 0020). */
  figure(selector: string | number): Result<TikzFigure, readonly Diagnostic[]>;
  /** The figures of a series (`selectSeries`, ADR 0025), in timeline order. */
  figures(
    selectors?: readonly (string | number)[],
  ): Result<readonly TikzFigure[], readonly Diagnostic[]>;
}

function figureOf(frame: SceneFrame, theme: SvgTheme): TikzFigure {
  const { scene, ...rest } = frame;
  return {
    ...rest,
    tikz: renderTikz(scene, {
      theme,
      comments: [
        `Frame ${frame.frame}, ${frame.selector}.`,
        ...(frame.narration === undefined ? [] : [frame.narration]),
      ],
    }),
  };
}

/**
 * Loads a document once, for TikZ figures of any of its frames. Errors are
 * those of `prepareScenes`: the document's, `UNKNOWN_THEME` at `$.theme`,
 * and the selectors' at `$`.
 */
export function prepareTikzFigures(
  document: unknown,
  options: SeriesOptions = {},
): Result<PreparedTikzFigures, readonly Diagnostic[]> {
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
        : err(frames.error);
    },
  });
}

/** The TikZ figures of a series, and how many frames the document has. */
export interface TikzFigureSeries {
  readonly frames: number;
  readonly figures: readonly TikzFigure[];
}

/**
 * Loads a document, selects the frames `steps` name, and renders them as
 * TikZ figures; as `exportFigures` does for SVG.
 */
export function exportTikzFigures(
  document: unknown,
  options: SeriesOptions & {
    readonly steps?: readonly (string | number)[];
  } = {},
): Result<TikzFigureSeries, readonly Diagnostic[]> {
  const prepared = prepareTikzFigures(document, options);
  if (!prepared.ok) return prepared;
  const figures = prepared.value.figures(options.steps ?? []);
  if (!figures.ok) return figures;
  return ok({ frames: prepared.value.frames, figures: figures.value });
}
