/**
 * Scene → TikZ, for the LaTeX package (ADR 0027).
 *
 * The SVG painter's `paintScene` decides every shape, colour and position,
 * so both painters agree on geometry; this module only writes the painted
 * shapes as TikZ paths, in scene coordinates. Text is left to the
 * document: each label becomes a call to the package's `\algoviz@text`,
 * which sets it in the document's fonts at the anchor the painter chose,
 * and shrinks text inside a cell, node or badge in the rare case it comes
 * out wider than the shape has room for.
 *
 * The output needs the package's macros (`\algoviz@figure`, `\algoviz@u`
 * and the rest) and is read with `@` as a letter, as `\algovizinput` does.
 */
import type { Scene, SceneItem } from '@algoviz/core';
import {
  num,
  paintScene,
  resolveTheme,
  type PaintedItem,
  type SvgNode,
  type SvgTheme,
  type ThemeName,
} from '@algoviz/svg';

import { texText } from './escape.ts';
import {
  apply,
  isTranslation,
  itemTransform,
  parsePath,
  type Affine,
  type Point,
} from './geometry.ts';

/** The version of the file format that `\algoviz@figure` reads. */
export const TIKZ_FORMAT = 1;

export interface RenderTikzOptions {
  /** A theme name or a full theme, e.g. from `createTheme`. Default `'light'`. */
  readonly theme?: SvgTheme | ThemeName;
  /**
   * Lines of comment at the top of the file, such as the step's selector
   * and narration. Comments never change the drawing.
   */
  readonly comments?: readonly string[];
}

interface Colour {
  readonly hex: string;
  readonly opacity: number;
}

/** Reads the colours themes use: `#rgb`, `#rrggbb`, `rgb()` and `rgba()`. */
export function parseColour(text: string): Colour {
  const value = text.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short !== null)
    return {
      hex: short
        .slice(1)
        .map((d) => d + d)
        .join('')
        .toUpperCase(),
      opacity: 1,
    };
  if (/^#[0-9a-f]{6}$/i.test(value))
    return { hex: value.slice(1).toUpperCase(), opacity: 1 };
  const fn = /^rgba?\(([^)]*)\)$/i.exec(value);
  if (fn !== null) {
    const parts = fn[1]!
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    if (
      (parts.length === 3 || parts.length === 4) &&
      parts.every((p) => Number.isFinite(p))
    ) {
      const [r, g, b, a = 1] = parts as [number, number, number, number?];
      const byte = (n: number) =>
        Math.max(0, Math.min(255, Math.round(n)))
          .toString(16)
          .padStart(2, '0');
      return {
        hex: `${byte(r)}${byte(g)}${byte(b)}`.toUpperCase(),
        opacity: Math.max(0, Math.min(1, a)),
      };
    }
  }
  throw new Error(`Cannot read the colour "${text}"`);
}

/** Colours used by a figure, named in the order they are first used. */
class Palette {
  private readonly names = new Map<string, string>();

  /** The TikZ colour name of `hex`, defining it on first use. */
  name(hex: string): string {
    let name = this.names.get(hex);
    if (name === undefined) {
      name = `algoviz@c${this.names.size + 1}`;
      this.names.set(hex, name);
    }
    return name;
  }

  /** `\algoviz@color{<n>}{<RRGGBB>}` for each colour, in order. */
  definitions(): string[] {
    return [...this.names].map(
      ([hex, name]) =>
        `\\algoviz@color{${name.slice('algoviz@c'.length)}}{${hex}}%`,
    );
  }
}

const unit = (n: number) => `${num(n)}\\algoviz@u`;
const point = (p: Point) => `(${num(p.x)},${num(p.y)})`;

/** Attributes a `g` passes to the shapes inside it. */
type Inherited = Readonly<Record<string, string>>;

/** TikZ options for an SVG shape's fill and stroke. */
function paintOptions(
  attrs: Readonly<Record<string, string>>,
  palette: Palette,
): string[] {
  const options: string[] = [];
  const opacity = attrs['opacity'] === undefined ? 1 : Number(attrs['opacity']);
  const fill = attrs['fill'];
  if (fill !== undefined && fill !== 'none') {
    const colour = parseColour(fill);
    options.push(`fill=${palette.name(colour.hex)}`);
    const alpha = colour.opacity * opacity;
    if (alpha !== 1) options.push(`fill opacity=${num(alpha)}`);
  }
  const stroke = attrs['stroke'];
  if (stroke !== undefined && stroke !== 'none') {
    const colour = parseColour(stroke);
    options.push(
      `draw=${palette.name(colour.hex)}`,
      `line width=${unit(Number(attrs['stroke-width'] ?? 1))}`,
    );
    const alpha = colour.opacity * opacity;
    if (alpha !== 1) options.push(`draw opacity=${num(alpha)}`);
    const dash = attrs['stroke-dasharray'];
    if (dash !== undefined) {
      const lengths = dash
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);
      const pattern =
        lengths.length % 2 === 0 ? lengths : [...lengths, ...lengths];
      options.push(
        `dash pattern=${pattern
          .map((n, k) => `${k % 2 === 0 ? 'on' : 'off'} ${unit(n)}`)
          .join(' ')}`,
      );
    }
    if (attrs['stroke-linecap'] === 'round') options.push('line cap=round');
    if (attrs['stroke-linejoin'] === 'round') options.push('line join=round');
  }
  return options;
}

const path = (options: readonly string[], body: string) =>
  `\\path[${options.join(',')}] ${body};`;

/** Requires a transform that only moves, for shapes that cannot turn. */
function moved(m: Affine, tag: string): Affine {
  if (!isTranslation(m))
    throw new Error(`A ${tag} cannot be rotated or stretched in TikZ output`);
  return m;
}

const ANCHOR: Readonly<Record<string, string>> = {
  start: 'l',
  middle: 'c',
  end: 'r',
};

/**
 * Margins between a text inside a shape and the shape's edge. Layout keeps
 * at least 10 units in cells, 8 in nodes and 6 on badges (ADR 0024), so the
 * document's text may grow a little before the package shrinks it.
 */
const BOX_MARGIN = 4;
const NODE_MARGIN = 6;

/** How wide the text of a scene item may be; 0 when nothing bounds it. */
function roomOf(item: SceneItem | undefined): number {
  switch (item?.type) {
    case 'box':
    case 'badge':
      return Math.max(0, item.width - 2 * BOX_MARGIN);
    case 'node':
      return Math.max(
        0,
        2 * Math.max(item.radius, (item.width ?? 0) / 2) - 2 * NODE_MARGIN,
      );
    default:
      return 0;
  }
}

/** What writing a node needs besides the node. */
interface Context {
  readonly palette: Palette;
  /** The room of the item's own text (`roomOf`). */
  readonly room: number;
}

function writeText(
  node: SvgNode,
  m: Affine,
  { palette, room }: Context,
): string {
  const at = apply(moved(m, 'text'), {
    x: Number(node.attrs['x'] ?? 0),
    y: Number(node.attrs['y'] ?? 0),
  });
  const colour = palette.name(parseColour(node.attrs['fill'] ?? '#000').hex);
  const stroke = node.attrs['stroke'];
  // A haloed text is a label outside its item, such as a node's distance.
  const halo =
    stroke === undefined
      ? ''
      : `${palette.name(parseColour(stroke).hex)},${unit(Number(node.attrs['stroke-width'] ?? 0) / 2)}`;
  return [
    '\\algoviz@text',
    `{${num(at.x)},${num(at.y)}}`,
    `{${ANCHOR[node.attrs['text-anchor'] ?? 'start'] ?? 'l'}}`,
    `{${num(Number(node.attrs['font-size']))}}`,
    `{${num(stroke === undefined ? room : 0)}}`,
    `{${node.font === 'label' ? 'label' : 'value'}}`,
    `{${colour}}`,
    `{${halo}}`,
    `{${texText(node.text ?? '')}}`,
  ].join('');
}

/** TikZ commands for a painted node and its children. */
function writeNode(
  node: SvgNode,
  m: Affine,
  inherited: Inherited,
  context: Context,
): string[] {
  const { palette } = context;
  const attrs = { ...inherited, ...node.attrs };
  const n = (name: string) => Number(attrs[name] ?? 0);
  switch (node.tag) {
    case 'g': {
      const passed: Record<string, string> = {};
      if (node.attrs['opacity'] !== undefined)
        passed['opacity'] = String(
          Number(inherited['opacity'] ?? 1) * Number(node.attrs['opacity']),
        );
      return (node.children ?? []).flatMap((child) =>
        writeNode(child, m, { ...inherited, ...passed }, context),
      );
    }
    case 'rect': {
      const corner = apply(moved(m, 'rect'), { x: n('x'), y: n('y') });
      const options = paintOptions(attrs, palette);
      const r = n('rx');
      if (r > 0) options.push(`rounded corners=${unit(r)}`);
      return [
        path(
          options,
          `${point(corner)} rectangle ++(${num(n('width'))},${num(n('height'))})`,
        ),
      ];
    }
    case 'circle': {
      const centre = apply(moved(m, 'circle'), { x: n('cx'), y: n('cy') });
      return [
        path(
          paintOptions(attrs, palette),
          `${point(centre)} circle[radius=${unit(n('r'))}]`,
        ),
      ];
    }
    case 'line': {
      const from = apply(m, { x: n('x1'), y: n('y1') });
      const to = apply(m, { x: n('x2'), y: n('y2') });
      return [
        path(paintOptions(attrs, palette), `${point(from)} -- ${point(to)}`),
      ];
    }
    case 'polygon': {
      const numbers = (attrs['points'] ?? '')
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number);
      const points: Point[] = [];
      for (let k = 0; k + 1 < numbers.length; k += 2)
        points.push(apply(m, { x: numbers[k]!, y: numbers[k + 1]! }));
      return [
        path(
          paintOptions(attrs, palette),
          `${points.map(point).join(' -- ')} -- cycle`,
        ),
      ];
    }
    case 'path': {
      const body = parsePath(attrs['d'] ?? '')
        .map((s) =>
          s.type === 'move'
            ? point(apply(m, s.to))
            : s.type === 'line'
              ? `-- ${point(apply(m, s.to))}`
              : `.. controls ${point(apply(m, s.c1))} and ${point(apply(m, s.c2))} .. ${point(apply(m, s.to))}`,
        )
        .join(' ');
      return [path(paintOptions(attrs, palette), body)];
    }
    case 'text':
      return [writeText(node, m, context)];
    default: {
      const unreachable: never = node.tag;
      return unreachable;
    }
  }
}

function writeItem(
  item: PaintedItem,
  source: SceneItem | undefined,
  palette: Palette,
): string[] {
  const m = itemTransform(item.x, item.y, item.rotate, item.scaleX);
  return writeNode(item.node, m, {}, { palette, room: roomOf(source) });
}

/** A comment line: one line, `%` first, so nothing in it can run. */
const comment = (text: string) => `% ${text.replace(/\s+/g, ' ').trim()}`;

/**
 * Renders a scene as a TikZ figure for the LaTeX package: a call to
 * `\algoviz@figure` with the format, the canvas size in scene units, the
 * colours and the drawing. Positions are those of `renderSvg`; text is
 * left to the document's fonts.
 */
export function renderTikz(
  scene: Scene,
  options: RenderTikzOptions = {},
): string {
  const theme = resolveTheme(options.theme);
  const painted = paintScene(scene, theme);
  const palette = new Palette();
  const body: string[] = [];
  if (painted.background !== null) {
    const background = parseColour(painted.background);
    body.push(
      path(
        [
          `fill=${palette.name(background.hex)}`,
          ...(background.opacity === 1
            ? []
            : [`fill opacity=${num(background.opacity)}`]),
        ],
        `(0,0) rectangle (${num(painted.width)},${num(painted.height)})`,
      ),
    );
  }
  // Painted items keep their scene item's key, or extend it after a `#`.
  const sources = new Map(scene.items.map((item) => [item.key, item]));
  for (const item of painted.items)
    body.push(...writeItem(item, sources.get(item.key), palette));
  return [
    comment(
      `algoviz figure for LaTeX, format ${TIKZ_FORMAT}: ${painted.title}`,
    ),
    ...(options.comments ?? []).map(comment),
    comment('Draw it with \\algovizinput from the algoviz LaTeX package.'),
    `\\algoviz@figure{${TIKZ_FORMAT}}{${num(painted.width)}}{${num(painted.height)}}{%`,
    ...palette.definitions(),
    '}{%',
    ...body,
    '}%',
    '',
  ].join('\n');
}
