/**
 * Painting: Scene → a small tree of SVG nodes per scene item.
 *
 * Shared by the string renderer (`renderSvg`) and the interactive player, so
 * both draw exactly the same shapes. Each item is painted in local
 * coordinates around its origin; the caller positions it with a translation,
 * which is what the player animates between frames.
 */
import type {
  ElementRole,
  GroupIndex,
  Scene,
  SceneArrow,
  SceneBadge,
  SceneBox,
  SceneEdge,
  SceneItem,
  SceneNode,
  SceneText,
} from '@algoviz/core';

import {
  themes,
  type CellStyle,
  type SvgTheme,
  type ThemeName,
} from './theme.ts';

export interface SvgNode {
  readonly tag: 'g' | 'rect' | 'circle' | 'text' | 'line' | 'polygon' | 'path';
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
  /**
   * Rotation in degrees and horizontal stretch, applied after the
   * translation. Edges use them so that moving an edge is a transform
   * animation like any other item.
   */
  readonly rotate?: number;
  readonly scaleX?: number;
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

/**
 * Style of a cell or node. Strong roles (compare, swap, highlight, settled)
 * win; otherwise a red–black variant or a group sets the fill, keeping the
 * role's border (e.g. the dotted border of `visited`).
 */
function elementStyle(
  t: SvgTheme,
  role: ElementRole,
  group: GroupIndex | undefined,
  variant: 'red' | 'black' | undefined,
): CellStyle {
  const base = t.cell[role];
  const strong = role === 'compare' || role === 'swap' || role === 'highlight';
  const tone =
    variant !== undefined
      ? t.rb[variant]
      : group !== undefined
        ? t.groups[group]
        : undefined;
  if (tone === undefined || role === 'settled') return base;
  if (strong) return { ...base, fill: tone.fill, text: tone.text };
  return {
    ...base,
    fill: tone.fill,
    stroke: role === 'visited' ? base.stroke : tone.stroke,
    text: tone.text,
  };
}

function paintBox(b: SceneBox, t: SvgTheme): SvgNode {
  const c = elementStyle(t, b.role, b.group, undefined);
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

function paintNode(n: SceneNode, t: SvgTheme): SvgNode {
  const c = elementStyle(t, n.role, n.group, n.variant);
  const children: SvgNode[] = [];
  if (t.shadow !== null)
    children.push({
      tag: 'circle',
      attrs: { cy: '2', r: num(n.radius), fill: t.shadow },
    });
  children.push({
    tag: 'circle',
    attrs: {
      r: num(n.radius - c.strokeWidth / 2),
      fill: c.fill,
      stroke: c.stroke,
      'stroke-width': num(c.strokeWidth),
      ...(c.dash === null ? {} : { 'stroke-dasharray': c.dash }),
    },
  });
  if (n.role === 'settled' && t.settledMark !== null)
    children.push({
      tag: 'path',
      attrs: {
        d: `M${num(n.radius * 0.45)} ${num(-n.radius * 0.75)}l3 3l5-6`,
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
      y: num(baselineOffset(n.fontSize)),
      'text-anchor': 'middle',
      'font-size': num(n.fontSize),
      'font-weight': '600',
      fill: c.text,
    },
    text: n.text,
  });
  if (n.label !== undefined)
    children.push({
      tag: 'text',
      attrs: {
        y: num(-n.radius - 6),
        'text-anchor': 'middle',
        'font-size': num(Math.max(10, n.fontSize * 0.7)),
        'font-weight': '600',
        fill: t.index,
        stroke: t.labelHalo,
        'stroke-width': '3',
        'paint-order': 'stroke',
      },
      text: n.label,
    });
  return { tag: 'g', attrs: {}, children };
}

const EDGE_HEAD_LENGTH = 8;
const EDGE_HEAD_HALF_WIDTH = 4.5;

/**
 * An edge becomes up to three items: the line, drawn as a unit segment that
 * is translated, rotated and stretched into place; the arrow head, rotated
 * at the tip; and the label, translated to beside the midpoint.
 */
function paintEdge(e: SceneEdge, t: SvgTheme): PaintedItem[] {
  const style = t.edge[e.role];
  const stroke = { stroke: style.stroke, 'stroke-width': num(style.width) };
  const opacity = style.opacity === 1 ? {} : { opacity: String(style.opacity) };
  const dx = e.x2 - e.x1;
  const dy = e.y2 - e.y1;
  const length = Math.hypot(dx, dy);
  const items: PaintedItem[] = [];

  if (length < 0.5) {
    // Self-loop above the point.
    const loop: SvgNode = {
      tag: 'g',
      attrs: opacity,
      children: [
        {
          tag: 'path',
          attrs: { d: 'M-7 0C-22 -34 22 -34 7 0', fill: 'none', ...stroke },
        },
        ...(e.directed
          ? [
              {
                tag: 'polygon' as const,
                attrs: { points: '7,0 3.5,-8.5 11.5,-6.5', fill: style.stroke },
              },
            ]
          : []),
      ],
    };
    items.push({
      key: e.key,
      x: e.x1,
      y: e.y1,
      attrs: { 'data-edge': e.role },
      node: loop,
    });
    if (e.label !== undefined)
      items.push({
        key: `${e.key}#label`,
        x: e.x1,
        y: e.y1 - 32,
        attrs: {},
        node: edgeLabel(e, t),
      });
    return items;
  }

  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const head = e.directed ? Math.min(EDGE_HEAD_LENGTH, length / 2) : 0;
  items.push({
    key: e.key,
    x: e.x1,
    y: e.y1,
    rotate: angle,
    scaleX: length - head,
    attrs: { 'data-edge': e.role },
    node: { tag: 'line', attrs: { x2: '1', ...stroke, ...opacity } },
  });
  if (e.directed)
    items.push({
      key: `${e.key}#head`,
      x: e.x2,
      y: e.y2,
      rotate: angle,
      attrs: {},
      node: {
        tag: 'polygon',
        attrs: {
          points: `0,0 ${num(-head)},${num(-EDGE_HEAD_HALF_WIDTH)} ${num(-head)},${num(EDGE_HEAD_HALF_WIDTH)}`,
          fill: style.stroke,
          ...opacity,
        },
      },
    });
  if (e.label !== undefined) {
    // Beside the midpoint, on the side the normal (-dy, dx) points to.
    const [nx, ny] = [-dy / length, dx / length];
    const side = ny > 0 || (ny === 0 && nx < 0) ? -1 : 1; // prefer above
    items.push({
      key: `${e.key}#label`,
      x: (e.x1 + e.x2) / 2 + nx * 11 * side,
      y: (e.y1 + e.y2) / 2 + ny * 11 * side,
      attrs: {},
      node: edgeLabel(e, t),
    });
  }
  return items;
}

function edgeLabel(e: SceneEdge, t: SvgTheme): SvgNode {
  return {
    tag: 'text',
    attrs: {
      y: num(baselineOffset(e.fontSize)),
      'text-anchor': 'middle',
      'font-size': num(e.fontSize),
      'font-weight': '600',
      fill: t.title,
      stroke: t.labelHalo,
      'stroke-width': '3.5',
      'paint-order': 'stroke',
      'stroke-linejoin': 'round',
    },
    text: e.label ?? '',
  };
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
      : x.role === 'label'
        ? { 'font-family': t.fonts.label, 'font-weight': '600', fill: t.index }
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

function paintItem(item: SceneItem, t: SvgTheme): PaintedItem[] {
  switch (item.type) {
    case 'node':
      return [
        {
          key: item.key,
          x: item.x,
          y: item.y,
          attrs: { 'data-role': item.role },
          node: paintNode(item, t),
        },
      ];
    case 'edge':
      return paintEdge(item, t);
    case 'box':
      return [
        {
          key: item.key,
          x: item.x,
          y: item.y,
          attrs: { 'data-role': item.role },
          node: paintBox(item, t),
        },
      ];
    case 'text':
      return [
        {
          key: item.key,
          x: item.x,
          y: item.y,
          attrs: {},
          node: paintText(item, t),
        },
      ];
    case 'badge':
      return [
        {
          key: item.key,
          x: item.x,
          y: item.y,
          attrs: {},
          node: paintBadge(item, t),
        },
      ];
    case 'arrow':
      return [
        {
          key: item.key,
          x: item.x2,
          y: item.y2,
          attrs: {},
          node: paintArrow(item, t),
        },
      ];
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
    items: scene.items.flatMap((item) => paintItem(item, t)),
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
