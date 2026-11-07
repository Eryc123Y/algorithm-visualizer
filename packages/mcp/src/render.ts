/**
 * One frame of a document as a standalone SVG image.
 */
import { layoutTrace } from '@algoviz/core';
import { ok, type Diagnostic, type Result } from '@algoviz/spec';
import { renderSvg, type ThemeName } from '@algoviz/svg';

import { loadDocument, resolveFrame, type FrameSelector } from './document.ts';

export interface RenderOptions {
  /**
   * The frame: a number, negative from the end, or a selector of one frame
   * such as "relax#2" (ADR 0020). Default -1, the last frame.
   */
  readonly frame?: FrameSelector;
  readonly theme?: ThemeName;
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
  { frame = -1, theme = 'light' }: RenderOptions = {},
): Result<RenderResult, readonly Diagnostic[]> {
  const loaded = loadDocument(input);
  if (!loaded.ok) return loaded;
  const trace = loaded.value;
  const index = resolveFrame(trace, frame);
  if (!index.ok) return index;
  // Laid out with metrics from every frame, as a player would.
  const scene = layoutTrace(trace).sceneAt(index.value);
  return ok({
    frame: index.value,
    frames: trace.length + 1,
    width: scene.width,
    height: scene.height,
    svg: renderSvg(scene, { theme, keys: false }),
  });
}
