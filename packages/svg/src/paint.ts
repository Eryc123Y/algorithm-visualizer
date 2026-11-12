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
} from '@algomotion/core';
import {
  TITLE_TRACKING,
  edgeLabelBox,
  labelSegment,
  noteBox,
} from '@algomotion/core';
import { textWidth } from '@algomotion/fonts';

import { descentOf } from './descent.ts';
import { num } from './format.ts';
import { outlineNode, type GlyphLookup } from './outline.ts';
import {
  resolveTheme,
  type CellStyle,
  type SvgTheme,
  type ThemeName,
} from './theme.ts';

export interface SvgNode {
  readonly tag: 'g' | 'rect' | 'circle' | 'text' | 'line' | 'polygon' | 'path';
  readonly attrs: Readonly<Record<string, string>>;
  /** Text content (for `text` nodes). */
  readonly text?: string;
  /**
   * The font role of a `text` node, `value` unless `label`: the face
   * standalone SVG outlines it with (ADR 0024).
   */
  readonly font?: 'value' | 'label';
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

export { num } from './format.ts';

/** Baseline offset that vertically centres text of this size. */
const baselineOffset = (fontSize: number) => fontSize * 0.35;

/**
 * The weight of a role's text: its face's own (ADR 0030), so a face with one
 * weight is drawn as designed and never made bold by the renderer.
 */
const weight = (t: SvgTheme, role: 'value' | 'label' = 'value'): string =>
  String(t.fontMetrics[role].weight);

const ARROW_HEAD_LENGTH = 6;
const ARROW_HEAD_HALF_WIDTH = 4;

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

/** Whether an item draws the settled check mark (ADR 0009, 0031). */
const isSettled = (item: SceneBox | SceneNode): boolean =>
  item.role === 'settled' || item.settled === true;

/**
 * The check mark's colour: the theme's on the settled fill, else the text
 * colour of the role drawn, which every theme gives 4.5:1 on its fill.
 */
const markColour = (t: SvgTheme, role: ElementRole, c: CellStyle): string =>
  role === 'settled' ? (t.settledMark ?? c.text) : c.text;

const MARK_WIDTH = 1.75;
/** Room between the check mark and the value's ink. */
const MARK_GAP = 1;
/** The smallest a check mark gets, as a fraction of its full size. */
const MARK_MIN_SCALE = 0.4;

/**
 * A node's check mark (ADR 0031): under the value, where it cannot read as
 * an accent on a letter, with its corner just inside the thickest border
 * the theme draws, so it stays put whatever role the node takes. Under a
 * value whose glyphs descend, it shrinks until it clears them.
 */
function nodeCheck(n: SceneNode, t: SvgTheme): string {
  const r = n.radius;
  const cap = MARK_WIDTH / 2;
  const border = Math.max(...Object.values(t.cell).map((c) => c.strokeWidth));
  const inner = r - border - cap;
  // Less a little, so that rounding to two decimals stays inside.
  const corner = {
    x: -0.05 * r,
    y: Math.sqrt(inner ** 2 - (0.05 * r) ** 2) - 0.02,
  };
  const ink =
    baselineOffset(n.fontSize) +
    descentOf(n.text, t.fontMetrics.value) * n.fontSize;
  // The long arm rises 0.25 r at full size; its end is the mark's top,
  // which rounding may raise by up to 0.005.
  const room = corner.y - cap - MARK_GAP - ink - 0.01;
  const scale = Math.max(MARK_MIN_SCALE, Math.min(1, room / (0.25 * r)));
  const at = (dx: number, dy: number) =>
    `${num(corner.x + dx * r * scale)} ${num(corner.y + dy * r * scale)}`;
  return `M${at(-0.12, -0.12)}L${at(0, 0)}L${at(0.25, -0.25)}`;
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
  if (isSettled(b) && t.settledMark !== null)
    children.push({
      tag: 'path',
      attrs: {
        d: `M${num(b.width - 15)} 10l3.5 3.5l6-7`,
        fill: 'none',
        stroke: markColour(t, b.role, c),
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
      'font-weight': weight(t),
      fill: c.text,
    },
    text: b.text,
  });
  return { tag: 'g', attrs: {}, children };
}

function paintNode(n: SceneNode, t: SvgTheme): SvgNode {
  const c = elementStyle(t, n.role, n.group, n.variant);
  const halfWidth = Math.max(n.radius, (n.width ?? 0) / 2);
  // A circle, or a stadium when the node is wider than it is tall.
  const outline = (inset: number, dy: number): SvgNode =>
    halfWidth === n.radius
      ? {
          tag: 'circle',
          attrs: {
            ...(dy === 0 ? {} : { cy: num(dy) }),
            r: num(n.radius - inset),
          },
        }
      : {
          tag: 'rect',
          attrs: {
            x: num(-halfWidth + inset),
            y: num(-n.radius + inset + dy),
            width: num(2 * (halfWidth - inset)),
            height: num(2 * (n.radius - inset)),
            rx: num(n.radius - inset),
          },
        };
  const children: SvgNode[] = [];
  if (t.shadow !== null) {
    const shadow = outline(0, 2);
    children.push({ ...shadow, attrs: { ...shadow.attrs, fill: t.shadow } });
  }
  const body = outline(c.strokeWidth / 2, 0);
  children.push({
    ...body,
    attrs: {
      ...body.attrs,
      fill: c.fill,
      stroke: c.stroke,
      'stroke-width': num(c.strokeWidth),
      ...(c.dash === null ? {} : { 'stroke-dasharray': c.dash }),
    },
  });
  if (isSettled(n) && t.settledMark !== null)
    children.push({
      tag: 'path',
      attrs: {
        d: nodeCheck(n, t),
        fill: 'none',
        stroke: markColour(t, n.role, c),
        'stroke-width': num(MARK_WIDTH),
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
      'font-weight': weight(t),
      fill: c.text,
    },
    text: n.text,
  });
  if (n.label !== undefined) {
    // A gap outside the outline in the direction of labelAngle (ADR 0031).
    const fontSize = Math.max(10, n.fontSize * 0.7);
    const box = noteBox(
      { x: 0, y: 0, radius: n.radius, halfWidth },
      n.labelAngle ?? 0,
      (textWidth(n.label, t.fontMetrics.value) * fontSize) / 2,
      fontSize,
    );
    children.push({
      tag: 'text',
      attrs: {
        ...(Math.abs(box.x) < 1e-9 ? {} : { x: num(box.x) }),
        y: num(box.y + baselineOffset(fontSize)),
        'text-anchor': 'middle',
        'font-size': num(fontSize),
        'font-weight': weight(t),
        fill: t.index,
        stroke: t.labelHalo,
        'stroke-width': '3',
        'paint-order': 'stroke',
      },
      text: n.label,
    });
  }
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

  if (e.via !== undefined && e.via.length > 0) {
    // A routed edge: a polyline relative to its start, the head along the
    // last segment, and the label beside the middle segment.
    const points = [{ x: e.x1, y: e.y1 }, ...e.via, { x: e.x2, y: e.y2 }];
    const last = points.at(-2)!;
    const lastAngle = Math.atan2(e.y2 - last.y, e.x2 - last.x);
    const lastLength = Math.hypot(e.x2 - last.x, e.y2 - last.y);
    const head = e.directed ? Math.min(EDGE_HEAD_LENGTH, lastLength / 2) : 0;
    const end = {
      x: e.x2 - Math.cos(lastAngle) * head,
      y: e.y2 - Math.sin(lastAngle) * head,
    };
    const d = [...points.slice(0, -1), end]
      .map(
        (p, k) => `${k === 0 ? 'M' : 'L'}${num(p.x - e.x1)} ${num(p.y - e.y1)}`,
      )
      .join('');
    items.push({
      key: e.key,
      x: e.x1,
      y: e.y1,
      attrs: { 'data-edge': e.role },
      node: {
        tag: 'path',
        attrs: {
          d,
          fill: 'none',
          'stroke-linejoin': 'round',
          ...stroke,
          ...opacity,
        },
      },
    });
    if (e.directed)
      items.push(
        arrowHead(
          e,
          e.x2,
          e.y2,
          (lastAngle * 180) / Math.PI,
          head,
          style.stroke,
          opacity,
        ),
      );
    if (e.label !== undefined) {
      const [a, b] = labelSegment(e);
      items.push(labelBeside(e, a, b, t));
    }
    return items;
  }

  if (length < 0.5) {
    // Self-loop outward from the point, drawn pointing up and rotated.
    const loopAngle = e.loopAngle ?? 0;
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
      ...(loopAngle === 0 ? {} : { rotate: loopAngle }),
      attrs: { 'data-edge': e.role },
      node: loop,
    });
    if (e.label !== undefined) {
      // Beyond the loop, by half the label's extent in that direction.
      const rad = (loopAngle * Math.PI) / 180;
      const [dx, dy] = [Math.sin(rad), -Math.cos(rad)];
      const halfWidth =
        (textWidth(e.label, t.fontMetrics.value) * e.fontSize) / 2;
      const reach =
        34 + Math.abs(dx) * halfWidth + Math.abs(dy) * (e.fontSize / 2) + 2;
      items.push({
        key: `${e.key}#label`,
        x: e.x1 + dx * reach,
        y: e.y1 + dy * reach,
        attrs: {},
        node: edgeLabel(e, t),
      });
    }
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
    items.push(arrowHead(e, e.x2, e.y2, angle, head, style.stroke, opacity));
  if (e.label !== undefined)
    items.push(labelBeside(e, { x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }, t));
  return items;
}

function arrowHead(
  e: SceneEdge,
  x: number,
  y: number,
  angle: number,
  head: number,
  fill: string,
  opacity: Record<string, string>,
): PaintedItem {
  return {
    key: `${e.key}#head`,
    x,
    y,
    rotate: angle,
    attrs: {},
    node: {
      tag: 'polygon',
      attrs: {
        points: `0,0 ${num(-head)},${num(-EDGE_HEAD_HALF_WIDTH)} ${num(-head)},${num(EDGE_HEAD_HALF_WIDTH)}`,
        fill,
        ...opacity,
      },
    },
  };
}

/**
 * The label beside the middle of the segment from `a` to `b`, on the side
 * the normal (-dy, dx) points to (the right, facing along the edge), far
 * enough that the text clears the line whatever its slope.
 */
function labelBeside(
  e: SceneEdge,
  a: { readonly x: number; readonly y: number },
  b: { readonly x: number; readonly y: number },
  t: SvgTheme,
): PaintedItem {
  const box = edgeLabelBox(e, a, b, t.fontMetrics.value);
  return {
    key: `${e.key}#label`,
    x: box.x,
    y: box.y,
    attrs: {},
    node: edgeLabel(e, t),
  };
}

function edgeLabel(e: SceneEdge, t: SvgTheme): SvgNode {
  return {
    tag: 'text',
    attrs: {
      y: num(baselineOffset(e.fontSize)),
      'text-anchor': 'middle',
      'font-size': num(e.fontSize),
      'font-weight': weight(t),
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
          'font-weight': weight(t, 'label'),
          'letter-spacing': `${TITLE_TRACKING}em`,
          fill: t.title,
        }
      : x.role === 'label'
        ? {
            'font-family': t.fonts.label,
            'font-weight': weight(t, 'label'),
            fill: t.index,
          }
        : // One weight per font role, as the bundled faces have (ADR 0024).
          { 'font-weight': weight(t), fill: t.index };
  return {
    tag: 'text',
    attrs: {
      y: num(baselineOffset(x.fontSize)),
      'text-anchor': x.anchor,
      'font-size': num(x.fontSize),
      ...style,
    },
    text: x.text,
    ...(x.role === 'index' ? {} : { font: 'label' as const }),
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
          'font-weight': weight(t),
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

/** The structure an item belongs to: its key up to the first `/`. */
const structureOf = (key: string): string => key.split('/', 1)[0]!;

/**
 * Edge labels moved after the last edge of their structure, so that their
 * halos cover the lines they sit on (ADR 0031). Everything else keeps its
 * order.
 */
function labelsOnTop(items: readonly PaintedItem[]): PaintedItem[] {
  const isLabel = (i: PaintedItem) =>
    i.key.endsWith('#label') && i.key.includes('/edge/');
  const lastEdge = new Map<string, number>();
  items.forEach((item, k) => {
    if (item.attrs['data-edge'] !== undefined || item.key.endsWith('#head'))
      lastEdge.set(structureOf(item.key), k);
  });
  const pending = new Map<string, PaintedItem[]>();
  const out: PaintedItem[] = [];
  items.forEach((item, k) => {
    const name = structureOf(item.key);
    if (isLabel(item) && (lastEdge.get(name) ?? -1) > k)
      pending.set(name, [...(pending.get(name) ?? []), item]);
    else out.push(item);
    if (lastEdge.get(name) === k) {
      out.push(...(pending.get(name) ?? []));
      pending.delete(name);
    }
  });
  for (const rest of pending.values()) out.push(...rest);
  return out;
}

export interface PaintOptions {
  /**
   * Draws text as glyph outlines from these faces where every character
   * has one; text stays text without it, as in the player.
   */
  readonly glyphs?: GlyphLookup;
}

export function paintScene(
  scene: Scene,
  theme?: SvgTheme | ThemeName,
  { glyphs }: PaintOptions = {},
): PaintedScene {
  const t = resolveTheme(theme);
  const painted = labelsOnTop(
    scene.items.flatMap((item) => paintItem(item, t)),
  );
  return {
    width: scene.width,
    height: scene.height,
    title: scene.title,
    background: t.background,
    fontFamily: t.fonts.value,
    items:
      glyphs === undefined
        ? painted
        : painted.map((item) => ({
            ...item,
            node: outlineNode(item.node, t, glyphs),
          })),
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
