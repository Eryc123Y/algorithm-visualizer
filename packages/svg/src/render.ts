/**
 * Scene → standalone SVG string. Uses only basic SVG features (no CSS, no
 * filters, no markers, no `dominant-baseline`) so the output renders the same
 * in browsers, Typst, Inkscape and converters for LaTeX. Text is drawn as
 * glyph outlines of the bundled fonts, so it looks the same without them
 * (ADR 0024).
 */
import type { Scene } from '@algoviz/core';
import type { FontOutlines } from '@algoviz/fonts';

import { bundledOutlines, glyphLookup, type GlyphLookup } from './outline.ts';
import { escapeXml, num, paintScene, serializeNode } from './paint.ts';
import type { SvgTheme, ThemeName } from './theme.ts';

export interface RenderSvgOptions {
  /** A theme name or a full theme, e.g. from `createTheme`. Default `'light'`. */
  readonly theme?: SvgTheme | ThemeName;
  /** Output scale; the viewBox stays in scene units. Default 1. */
  readonly scale?: number;
  /** Emit `data-key` attributes, used to animate between frames. Default true. */
  readonly keys?: boolean;
  /**
   * Draw text as glyph outlines (default), or as text elements naming the
   * theme's fonts: a smaller file with selectable text, for renderers that
   * have the fonts. Text with a character the face has no outline for
   * (such as CJK or emoji) stays text either way.
   */
  readonly outlineText?: boolean;
  /** Outlines to draw text with, by face id. Default: the bundled faces. */
  readonly outlines?: readonly FontOutlines[];
}

// Built on first use, not at import: a module-level call could keep the
// outlines in bundles that never render standalone SVG, such as the player.
let bundledGlyphs: GlyphLookup | undefined;

export function renderSvg(
  scene: Scene,
  options: RenderSvgOptions = {},
): string {
  const { scale = 1, keys = true, outlineText = true, outlines } = options;
  const glyphs = !outlineText
    ? undefined
    : outlines === undefined
      ? (bundledGlyphs ??= glyphLookup(bundledOutlines))
      : glyphLookup(outlines);
  const painted = paintScene(scene, options.theme, {
    ...(glyphs === undefined ? {} : { glyphs }),
  });
  const w = num(painted.width);
  const h = num(painted.height);
  const body = painted.items
    .map((item) => {
      const key = keys ? ` data-key="${escapeXml(item.key)}"` : '';
      const attrs = Object.entries(item.attrs)
        .map(([name, value]) => ` ${name}="${escapeXml(value)}"`)
        .join('');
      const rotate =
        item.rotate === undefined ? '' : ` rotate(${num(item.rotate)})`;
      const scale =
        item.scaleX === undefined ? '' : ` scale(${num(item.scaleX)} 1)`;
      return `<g${key}${attrs} transform="translate(${num(item.x)} ${num(item.y)})${rotate}${scale}">${serializeNode(item.node)}</g>`;
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
