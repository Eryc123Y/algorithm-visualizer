/**
 * Painting: Scene → a small tree of SVG nodes per scene item.
 *
 * Shared by the string renderer (`renderSvg`) and the interactive player, so
 * both draw exactly the same shapes. Each item is painted in local
 * coordinates around its origin; the caller positions it with a translation,
 * which is what the player animates between frames.
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

export interface SvgNode {
  readonly tag: 'g' | 'rect' | 'text' | 'line' | 'polygon' | 'path';
  readonly attrs: Readonly<Record<string, string>>;
  /** Text content (for `text` nodes). */
  readonly text?: string;
  readonly children?: readonly SvgNode[];
}

export interface PaintedItem {
  readonly key: string;
  /** Origin of the item in scene coordinates. */
  readonly x: number;
  readonly y: number;
  /** Extra attributes for the item's wrapper, e.g. `data-role`. */
  readonly attrs: Readonly<Record<string, string>>;
  /** Drawn relative to the origin. */
  readonly node: SvgNode;
}

export interface PaintedScene {
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly background: string | null;
  /** Default font family for the scene. */
  readonly fontFamily: string;
  readonly items: readonly PaintedItem[];
}

/** Rounds to two decimals and drops trailing zeros. */
export const num = (n: number): string => String(Math.round(n * 100) / 100);

/** Baseline offset that vertically centres text of this size. */
const baselineOffset = (fontSize: number) => fontSize * 0.35;

const ARROW_HEAD_LENGTH = 6;
const ARROW_HEAD_HALF_WIDTH = 4;

export const resolveTheme = (
  theme: SvgTheme | ThemeName = 'light',
): SvgTheme => (typeof theme === 'string' ? themes[theme] : theme);

function paintBox(b: SceneBox, t: SvgTheme): SvgNode {
  const c = t.cell[b.role];
  const r = num(Math.min(t.radius, b.width / 2, b.height / 2));
  const inset = c.strokeWidth / 2;
  const children: SvgNode[] = [];
  if (t.shadow !== null)
    children.push({
      tag: 'rect',
      attrs: {
        y: '2',
        width: num(b.width),
        height: num(b.height),
        rx: r,
        fill: t.shadow,
      },
    });
  children.push({
    tag: 'rect',
    attrs: {
      x: num(inset),
      y: num(inset),
      width: num(b.width - 2 * inset),
      height: num(b.height - 2 * inset),
      rx: r,
      fill: c.fill,
      stroke: c.stroke,
      'stroke-width': num(c.strokeWidth),
      ...(c.dash === null ? {} : { 'stroke-dasharray': c.dash }),
    },
  });
  if (b.role === 'settled' && t.settledMark !== null)
    children.push({
      tag: 'path',
      attrs: {
        d: `M${num(b.width - 15)} 10l3.5 3.5l6-7`,
        fill: 'none',
        stroke: t.settledMark,
        'stroke-width': '1.75',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    });
  children.push({
    tag: 'text',
    attrs: {
      x: num(b.width / 2),
      y: num(b.height / 2 + baselineOffset(b.fontSize)),
      'text-anchor': 'middle',
      'font-size': num(b.fontSize),
      'font-weight': '600',
      fill: c.text,
    },
    text: b.text,
  });
  return { tag: 'g', attrs: {}, children };
}

function paintText(x: SceneText, t: SvgTheme): SvgNode {
  const style: Record<string, string> =
    x.role === 'title'
      ? {
          'font-family': t.fonts.label,
          'font-weight': '600',
          'letter-spacing': '0.02em',
          fill: t.title,
        }
      : { 'font-weight': '500', fill: t.index };
  return {
    tag: 'text',
    attrs: {
      y: num(baselineOffset(x.fontSize)),
      'text-anchor': x.anchor,
      'font-size': num(x.fontSize),
      ...style,
    },
    text: x.text,
  };
}

function paintBadge(b: SceneBadge, t: SvgTheme): SvgNode {
  return {
    tag: 'g',
    attrs: {},
    children: [
      {
        tag: 'rect',
        attrs: {
          x: num(-b.width / 2),
          y: num(-b.height / 2),
          width: num(b.width),
          height: num(b.height),
          rx: num(b.height / 2),
          fill: t.pointer.fill,
        },
      },
      {
        tag: 'text',
        attrs: {
          y: num(baselineOffset(b.fontSize)),
          'text-anchor': 'middle',
          'font-size': num(b.fontSize),
          'font-weight': '600',
          fill: t.pointer.text,
        },
        text: b.text,
      },
    ],
  };
}

/** Painted around the arrow's tip, so the arrow moves with what it points at. */
function paintArrow(a: SceneArrow, t: SvgTheme): SvgNode {
  const dx = a.x2 - a.x1;
  const dy = a.y2 - a.y1;
  const length = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / length, dy / length];
  const bx = -ux * ARROW_HEAD_LENGTH;
  const by = -uy * ARROW_HEAD_LENGTH;
  const [px, py] = [-uy * ARROW_HEAD_HALF_WIDTH, ux * ARROW_HEAD_HALF_WIDTH];
  const head = [
    [0, 0],
    [bx + px, by + py],
    [bx - px, by - py],
  ]
    .map(([x, y]) => `${num(x!)},${num(y!)}`)
    .join(' ');
  return {
    tag: 'g',
    attrs: {},
    children: [
      {
        tag: 'line',
        attrs: {
          x1: num(-dx),
          y1: num(-dy),
          x2: num(bx),
          y2: num(by),
          stroke: t.pointer.line,
          'stroke-width': '1.75',
          'stroke-linecap': 'round',
        },
      },
      {
        tag: 'polygon',
        attrs: {
          points: head,
          fill: t.pointer.line,
          stroke: t.pointer.line,
          'stroke-width': '1',
          'stroke-linejoin': 'round',
        },
      },
    ],
  };
}

function paintItem(item: SceneItem, t: SvgTheme): PaintedItem {
  switch (item.type) {
    case 'box':
      return {
        key: item.key,
        x: item.x,
        y: item.y,
        attrs: { 'data-role': item.role },
        node: paintBox(item, t),
      };
    case 'text':
      return {
        key: item.key,
        x: item.x,
        y: item.y,
        attrs: {},
        node: paintText(item, t),
      };
    case 'badge':
      return {
        key: item.key,
        x: item.x,
        y: item.y,
        attrs: {},
        node: paintBadge(item, t),
      };
    case 'arrow':
      return {
        key: item.key,
        x: item.x2,
        y: item.y2,
        attrs: {},
        node: paintArrow(item, t),
      };
    default: {
      const unreachable: never = item;
      return unreachable;
    }
  }
}

export function paintScene(
  scene: Scene,
  theme?: SvgTheme | ThemeName,
): PaintedScene {
  const t = resolveTheme(theme);
  return {
    width: scene.width,
    height: scene.height,
    title: scene.title,
    background: t.background,
    fontFamily: t.fonts.value,
    items: scene.items.map((item) => paintItem(item, t)),
  };
}

export const escapeXml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const serializeAttrs = (attrs: Readonly<Record<string, string>>): string =>
  Object.entries(attrs)
    .map(([name, value]) => ` ${name}="${escapeXml(value)}"`)
    .join('');

/** Serialises a node as SVG markup. Text and attribute values are escaped. */
export function serializeNode(node: SvgNode): string {
  const inner =
    (node.text === undefined ? '' : escapeXml(node.text)) +
    (node.children ?? []).map(serializeNode).join('');
  return inner === ''
    ? `<${node.tag}${serializeAttrs(node.attrs)}/>`
    : `<${node.tag}${serializeAttrs(node.attrs)}>${inner}</${node.tag}>`;
}
