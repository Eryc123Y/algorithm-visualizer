/**
 * Scene → standalone SVG string. Uses only basic SVG features (no CSS, no
 * filters, no markers, no `dominant-baseline`) so the output renders the same
 * in browsers, Typst, Inkscape and converters for LaTeX.
 */
import type { Scene } from '@algoviz/core';

import { escapeXml, num, paintScene, serializeNode } from './paint.ts';
import type { SvgTheme, ThemeName } from './theme.ts';

export interface RenderSvgOptions {
  /** A theme name or a full theme, e.g. from `createTheme`. Default `'light'`. */
  readonly theme?: SvgTheme | ThemeName;
  /** Output scale; the viewBox stays in scene units. Default 1. */
  readonly scale?: number;
  /** Emit `data-key` attributes, used to animate between frames. Default true. */
  readonly keys?: boolean;
}

export function renderSvg(
  scene: Scene,
  options: RenderSvgOptions = {},
): string {
  const { scale = 1, keys = true } = options;
  const painted = paintScene(scene, options.theme);
  const w = num(painted.width);
  const h = num(painted.height);
  const body = painted.items
    .map((item) => {
      const key = keys ? ` data-key="${escapeXml(item.key)}"` : '';
      const attrs = Object.entries(item.attrs)
        .map(([name, value]) => ` ${name}="${escapeXml(value)}"`)
        .join('');
      return `<g${key}${attrs} transform="translate(${num(item.x)} ${num(item.y)})">${serializeNode(item.node)}</g>`;
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(painted.width * scale)}" height="${num(painted.height * scale)}" viewBox="0 0 ${w} ${h}" role="img">` +
    `<title>${escapeXml(painted.title)}</title>` +
    (painted.background === null
      ? ''
      : `<rect width="${w}" height="${h}" fill="${escapeXml(painted.background)}"/>`) +
    `<g font-family="${escapeXml(painted.fontFamily)}">${body}</g>` +
    `</svg>`
  );
}
