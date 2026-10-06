/**
 * Scene → standalone SVG string. Uses only basic SVG features (no CSS, no
 * filters, no markers, no `dominant-baseline`) so the output renders the same
 * in browsers, Typst, Inkscape and converters for LaTeX.
 */
import type {
  Scene,
  SceneArrow,
  SceneBadge,
  SceneBox,
  SceneItem,
  SceneText,
} from '@algoviz/core';

import { themes, type SvgTheme, type ThemeName } from './theme.ts';

export interface RenderSvgOptions {
  /** A theme name or a full theme, e.g. from `createTheme`. Default `'light'`. */
  readonly theme?: SvgTheme | ThemeName;
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
  const { scale = 1, keys = true } = options;
  const theme =
    typeof options.theme === 'string' || options.theme === undefined
      ? themes[options.theme ?? 'light']
      : options.theme;
  const key = (item: SceneItem) =>
    keys ? ` data-key="${escapeXml(item.key)}"` : '';

  const box = (b: SceneBox): string => {
    const c = theme.cell[b.role];
    const r = num(Math.min(theme.radius, b.width / 2, b.height / 2));
    const shadow =
      theme.shadow === null
        ? ''
        : `<rect x="${num(b.x)}" y="${num(b.y + 2)}" width="${num(b.width)}" height="${num(b.height)}" rx="${r}" fill="${theme.shadow}"/>`;
    // Inset the border so heavy strokes do not grow the cell.
    const inset = c.strokeWidth / 2;
    const dash = c.dash === null ? '' : ` stroke-dasharray="${c.dash}"`;
    const check =
      b.role !== 'settled' || theme.settledMark === null
        ? ''
        : `<path d="M${num(b.x + b.width - 15)} ${num(b.y + 10)}l3.5 3.5l6-7" fill="none" stroke="${theme.settledMark}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`;
    return (
      `<g${key(b)} data-role="${b.role}">` +
      shadow +
      `<rect x="${num(b.x + inset)}" y="${num(b.y + inset)}" width="${num(b.width - 2 * inset)}" height="${num(b.height - 2 * inset)}" rx="${r}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="${num(c.strokeWidth)}"${dash}/>` +
      check +
      `<text x="${num(b.x + b.width / 2)}" y="${baseline(b.y + b.height / 2, b.fontSize)}" text-anchor="middle" font-size="${num(b.fontSize)}" font-weight="600" fill="${c.text}">${escapeXml(b.text)}</text>` +
      `</g>`
    );
  };

  const text = (t: SceneText): string => {
    const style =
      t.role === 'title'
        ? `font-family="${escapeXml(theme.fonts.label)}" font-weight="600" letter-spacing="0.02em" fill="${theme.title}"`
        : `font-weight="500" fill="${theme.index}"`;
    return `<text${key(t)} x="${num(t.x)}" y="${baseline(t.y, t.fontSize)}" text-anchor="${t.anchor}" font-size="${num(t.fontSize)}" ${style}>${escapeXml(t.text)}</text>`;
  };

  const badge = (b: SceneBadge): string =>
    `<g${key(b)}>` +
    `<rect x="${num(b.x - b.width / 2)}" y="${num(b.y - b.height / 2)}" width="${num(b.width)}" height="${num(b.height)}" rx="${num(b.height / 2)}" fill="${theme.pointer.fill}"/>` +
    `<text x="${num(b.x)}" y="${baseline(b.y, b.fontSize)}" text-anchor="middle" font-size="${num(b.fontSize)}" font-weight="600" fill="${theme.pointer.text}">${escapeXml(b.text)}</text>` +
    `</g>`;

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
      `<line x1="${num(a.x1)}" y1="${num(a.y1)}" x2="${num(bx)}" y2="${num(by)}" stroke="${theme.pointer.line}" stroke-width="1.75" stroke-linecap="round"/>` +
      `<polygon points="${head}" fill="${theme.pointer.line}" stroke="${theme.pointer.line}" stroke-width="1" stroke-linejoin="round"/>` +
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
        case 'badge':
          return badge(item);
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
    // Values are the common case; titles override the family.
    `<g font-family="${escapeXml(theme.fonts.value)}">${body}</g>` +
    `</svg>`
  );
}
