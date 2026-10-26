/**
 * One frame of a document as a standalone SVG image.
 */
import { layoutTrace } from '@algoviz/core';
import { ok, type Diagnostic, type Result } from '@algoviz/spec';
import { renderSvg, type ThemeName } from '@algoviz/svg';

import { loadDocument, resolveFrame } from './document.ts';

export interface RenderOptions {
  /** Default -1, the last frame; negative numbers count from the end. */
  readonly frame?: number;
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
