/**
 * One frame of a document as a standalone SVG image.
 */
import { layoutTrace, type FigureLayout } from '@algomotion/core';
import { ok, type Diagnostic, type Result } from '@algomotion/spec';
import { renderSvg, themes, type ThemeName } from '@algomotion/svg';

import { loadDocument, resolveFrame, type FrameSelector } from './document.ts';

export interface RenderOptions {
  /**
   * The frame: a number, negative from the end, or a selector of one frame
   * such as "relax#2" (ADR 0020). Default -1, the last frame.
   */
  readonly frame?: FrameSelector;
  readonly theme?: ThemeName;
  /** Where side structures go (ADR 0029); default `'wide'`, as in the player. */
  readonly layout?: FigureLayout;
}

export interface RenderResult {
  readonly frame: number;
  readonly frames: number;
  readonly width: number;
  readonly height: number;
  readonly svg: string;
}

export function render(
  input: unknown,
  { frame = -1, theme = 'light', layout = 'wide' }: RenderOptions = {},
): Result<RenderResult, readonly Diagnostic[]> {
  const loaded = loadDocument(input);
  if (!loaded.ok) return loaded;
  const trace = loaded.value;
  const index = resolveFrame(trace, frame);
  if (!index.ok) return index;
  // Laid out with metrics from every frame and the theme's fonts, as a
  // player would.
  const scene = layoutTrace(trace, {
    fonts: themes[theme].fontMetrics,
    layout,
  }).sceneAt(index.value);
  return ok({
    frame: index.value,
    frames: trace.length + 1,
    width: scene.width,
    height: scene.height,
    // Text elements, not outlines: a model reads this SVG as text, and
    // outlines would multiply its size (ADR 0024).
    svg: renderSvg(scene, { theme, keys: false, outlineText: false }),
  });
}
