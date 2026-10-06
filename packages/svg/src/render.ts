/**
 * Scene → standalone SVG string. Uses only basic SVG features (no CSS, no
 * markers, no `dominant-baseline`) so the output renders the same in
 * browsers, Typst, Inkscape and converters for LaTeX.
 */
import type {
  Scene,
  SceneArrow,
  SceneBox,
  SceneItem,
  SceneText,
} from '@algoviz/core';

import { lightTheme, type SvgTheme } from './theme.ts';

export interface RenderSvgOptions {
  readonly theme?: SvgTheme;
  /** Output scale; the viewBox stays in scene units. Default 1. */
  readonly scale?: number;
  /** Emit `data-key` attributes, used to animate between frames. Default true. */
  readonly keys?: boolean;
}

const escapeXml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Rounds to two decimals and drops trailing zeros. */
const num = (n: number): string => String(Math.round(n * 100) / 100);

/** Baseline that vertically centres text of this size on `y`. */
const baseline = (y: number, fontSize: number) => num(y + fontSize * 0.35);

const ARROW_HEAD_LENGTH = 6;
const ARROW_HEAD_HALF_WIDTH = 4;

export function renderSvg(
  scene: Scene,
  options: RenderSvgOptions = {},
): string {
  const { theme = lightTheme, scale = 1, keys = true } = options;
  const key = (item: SceneItem) =>
    keys ? ` data-key="${escapeXml(item.key)}"` : '';

  const box = (b: SceneBox): string => {
    const c = theme.cell[b.role];
    return (
      `<g${key(b)} data-role="${b.role}">` +
      `<rect x="${num(b.x)}" y="${num(b.y)}" width="${num(b.width)}" height="${num(b.height)}" rx="6" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5"/>` +
      `<text x="${num(b.x + b.width / 2)}" y="${baseline(b.y + b.height / 2, b.fontSize)}" text-anchor="middle" font-size="${num(b.fontSize)}" font-weight="600" fill="${c.text}">${escapeXml(b.text)}</text>` +
      `</g>`
    );
  };

  const text = (t: SceneText): string => {
    const fill =
      t.role === 'index'
        ? theme.muted
        : t.role === 'pointer'
          ? theme.pointer
          : theme.text;
    const weight = t.role === 'index' ? '400' : '600';
    return `<text${key(t)} x="${num(t.x)}" y="${baseline(t.y, t.fontSize)}" text-anchor="${t.anchor}" font-size="${num(t.fontSize)}" font-weight="${weight}" fill="${fill}">${escapeXml(t.text)}</text>`;
  };

  const arrow = (a: SceneArrow): string => {
    const dx = a.x2 - a.x1;
    const dy = a.y2 - a.y1;
    const length = Math.hypot(dx, dy) || 1;
    const [ux, uy] = [dx / length, dy / length];
    const bx = a.x2 - ux * ARROW_HEAD_LENGTH;
    const by = a.y2 - uy * ARROW_HEAD_LENGTH;
    const [px, py] = [-uy * ARROW_HEAD_HALF_WIDTH, ux * ARROW_HEAD_HALF_WIDTH];
    const head = [
      [a.x2, a.y2],
      [bx + px, by + py],
      [bx - px, by - py],
    ]
      .map(([x, y]) => `${num(x!)},${num(y!)}`)
      .join(' ');
    return (
      `<g${key(a)}>` +
      `<line x1="${num(a.x1)}" y1="${num(a.y1)}" x2="${num(bx)}" y2="${num(by)}" stroke="${theme.pointer}" stroke-width="1.5"/>` +
      `<polygon points="${head}" fill="${theme.pointer}"/>` +
      `</g>`
    );
  };

  const body = scene.items
    .map((item) => {
      switch (item.type) {
        case 'box':
          return box(item);
        case 'text':
          return text(item);
        case 'arrow':
          return arrow(item);
        default: {
          const unreachable: never = item;
          return unreachable;
        }
      }
    })
    .join('');

  const w = num(scene.width);
  const h = num(scene.height);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(scene.width * scale)}" height="${num(scene.height * scale)}" viewBox="0 0 ${w} ${h}" role="img">` +
    `<title>${escapeXml(scene.title)}</title>` +
    (theme.background === null
      ? ''
      : `<rect width="${w}" height="${h}" fill="${theme.background}"/>`) +
    `<g font-family="${escapeXml(theme.fontFamily)}">${body}</g>` +
    `</svg>`
  );
}
