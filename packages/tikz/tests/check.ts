/**
 * Checks shared by the TikZ painter's tests: that a figure file is well
 * formed, and that its shapes are those of the SVG of the same scene.
 *
 * The SVG's tags are read and its transforms applied here, with code of
 * its own, so the comparison does not rest on the painter's geometry
 * module.
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A shape reduced to what both formats share: its kind and its points. */
export interface Shape {
  readonly kind: 'rect' | 'circle' | 'open' | 'closed' | 'text';
  readonly points: readonly Point[];
  /** Circles: the radius. */
  readonly radius?: number;
}

const POINT = /\((-?[\d.]+),(-?[\d.]+)\)/g;

const pointsOf = (text: string): Point[] =>
  [...text.matchAll(POINT)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));

/** The drawing lines of a figure file. */
export function drawingOf(tikz: string): string[] {
  const lines = tikz.split('\n');
  return lines.slice(lines.indexOf('}{%') + 1, lines.lastIndexOf('}%'));
}

/** The shapes of a figure file, in drawing order. */
export function tikzShapes(tikz: string): Shape[] {
  return drawingOf(tikz).map((line): Shape => {
    const text = /^\\algoviz@text\{(-?[\d.]+),(-?[\d.]+)\}/.exec(line);
    if (text !== null)
      return {
        kind: 'text',
        points: [{ x: Number(text[1]), y: Number(text[2]) }],
      };
    const body = line.replace(/^\\path\[[^\]]*\] /, '');
    const rect =
      /^\((-?[\d.]+),(-?[\d.]+)\) rectangle \+\+\((-?[\d.]+),(-?[\d.]+)\);$/.exec(
        body,
      );
    if (rect !== null) {
      const [x, y, w, h] = rect.slice(1).map(Number) as [
        number,
        number,
        number,
        number,
      ];
      return {
        kind: 'rect',
        points: [
          { x, y },
          { x: x + w, y: y + h },
        ],
      };
    }
    if (/^\(-?[\d.]+,-?[\d.]+\) rectangle \(/.test(body))
      return { kind: 'rect', points: pointsOf(body) };
    const circle = /circle\[radius=(-?[\d.]+)\\algoviz@u\];$/.exec(body);
    if (circle !== null)
      return {
        kind: 'circle',
        points: pointsOf(body),
        radius: Number(circle[1]),
      };
    return {
      kind: body.endsWith('-- cycle;') ? 'closed' : 'open',
      points: pointsOf(body),
    };
  });
}

/** An SVG item transform: translate, then rotate (degrees), then scale x. */
function transformOf(attr: string): (p: Point) => Point {
  const t = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(attr);
  const r = /rotate\((-?[\d.]+)\)/.exec(attr);
  const s = /scale\((-?[\d.]+) 1\)/.exec(attr);
  const [tx, ty] = t === null ? [0, 0] : [Number(t[1]), Number(t[2])];
  const angle = r === null ? 0 : (Number(r[1]) * Math.PI) / 180;
  const sx = s === null ? 1 : Number(s[1]);
  return ({ x, y }) => {
    const px = x * sx;
    return {
      x: tx + px * Math.cos(angle) - y * Math.sin(angle),
      y: ty + px * Math.sin(angle) + y * Math.cos(angle),
    };
  };
}

/** Points of SVG path data: M, L, C and relative l, as the painter writes. */
function pathPoints(d: string): Point[] {
  const out: Point[] = [];
  let at: Point = { x: 0, y: 0 };
  for (const [, command, args] of d.matchAll(/([MLCl])([^MLCl]*)/g)) {
    const n = (args!.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
    for (let k = 0; k < n.length; k += 2) {
      const p =
        command === 'l'
          ? { x: at.x + n[k]!, y: at.y + n[k + 1]! }
          : { x: n[k]!, y: n[k + 1]! };
      out.push(p);
      // Control points of a curve do not move the pen.
      if (command !== 'C' || k % 6 === 4) at = p;
    }
  }
  return out;
}

type Attributes = Readonly<Record<string, string>>;

const num = (attrs: Attributes, name: string) => Number(attrs[name] ?? 0);

/**
 * The shapes of an SVG made with `outlineText: false`, in drawing order.
 * The SVG painter writes plain, regular markup, so its tags are read one by
 * one; a DOM would hold on to every document parsed in a long property run.
 */
export function svgShapes(svg: string): Shape[] {
  const shapes: Shape[] = [];
  let at: ((p: Point) => Point) | undefined;
  let depth = 0;
  for (const [, close, tag, rest] of svg.matchAll(/<(\/?)(\w+)([^>]*)>/g)) {
    const attrs: Attributes = Object.fromEntries(
      [...rest!.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]),
    );
    if (tag === 'g') {
      if (close === '/') {
        if (at !== undefined && --depth === 0) at = undefined;
      } else if (!rest!.endsWith('/')) {
        if (at !== undefined) depth++;
        else if (attrs['data-key'] !== undefined) {
          at = transformOf(attrs['transform'] ?? '');
          depth = 1;
        }
      }
      continue;
    }
    if (close === '/') continue;
    if (at === undefined) {
      // Outside items, only the background rectangle is drawn.
      if (tag === 'rect')
        shapes.push({
          kind: 'rect',
          points: [
            { x: 0, y: 0 },
            { x: num(attrs, 'width'), y: num(attrs, 'height') },
          ],
        });
      continue;
    }
    switch (tag) {
      case 'rect': {
        const [x, y] = [num(attrs, 'x'), num(attrs, 'y')];
        shapes.push({
          kind: 'rect',
          points: [
            at({ x, y }),
            at({ x: x + num(attrs, 'width'), y: y + num(attrs, 'height') }),
          ],
        });
        break;
      }
      case 'circle':
        shapes.push({
          kind: 'circle',
          points: [at({ x: num(attrs, 'cx'), y: num(attrs, 'cy') })],
          radius: num(attrs, 'r'),
        });
        break;
      case 'line':
        shapes.push({
          kind: 'open',
          points: [
            at({ x: num(attrs, 'x1'), y: num(attrs, 'y1') }),
            at({ x: num(attrs, 'x2'), y: num(attrs, 'y2') }),
          ],
        });
        break;
      case 'polygon': {
        const n = (attrs['points'] ?? '').split(/[\s,]+/).map(Number);
        const points: Point[] = [];
        for (let k = 0; k + 1 < n.length; k += 2)
          points.push(at({ x: n[k]!, y: n[k + 1]! }));
        shapes.push({ kind: 'closed', points });
        break;
      }
      case 'path':
        shapes.push({
          kind: 'open',
          points: pathPoints(attrs['d'] ?? '').map(at),
        });
        break;
      case 'text':
        shapes.push({
          kind: 'text',
          points: [at({ x: num(attrs, 'x'), y: num(attrs, 'y') })],
        });
        break;
    }
  }
  return shapes;
}

/**
 * Where two lists of shapes disagree. SVG writes rotations and stretches
 * rounded to hundredths, so the far end of a long edge may move by a tenth
 * of a unit or two; anything beyond that is reported.
 */
export function agreementProblems(
  svg: readonly Shape[],
  tikz: readonly Shape[],
  tolerance = 0.1,
): string[] {
  const problems: string[] = [];
  if (svg.length !== tikz.length)
    problems.push(`${svg.length} SVG shapes, ${tikz.length} TikZ shapes`);
  svg.forEach((s, k) => {
    const t = tikz[k];
    if (t === undefined) return;
    if (s.kind !== t.kind) {
      problems.push(`shape ${k}: SVG ${s.kind}, TikZ ${t.kind}`);
      return;
    }
    if (s.points.length !== t.points.length)
      problems.push(
        `shape ${k} (${s.kind}): ${s.points.length} and ${t.points.length} points`,
      );
    // A rotation rounded to 0.01° moves a point by up to 0.0002 of its
    // distance from the shape's first point.
    const [first] = s.points;
    s.points.forEach((p, i) => {
      const q = t.points[i];
      const allowed =
        tolerance +
        2e-4 *
          (first === undefined ? 0 : Math.hypot(p.x - first.x, p.y - first.y));
      if (q !== undefined && Math.hypot(p.x - q.x, p.y - q.y) > allowed)
        problems.push(
          `shape ${k} (${s.kind}) point ${i}: SVG (${p.x.toFixed(2)}, ${p.y.toFixed(2)}), TikZ (${q.x}, ${q.y})`,
        );
    });
    if (s.radius !== undefined && Math.abs(s.radius - (t.radius ?? 0)) > 0.011)
      problems.push(`shape ${k}: radius ${s.radius} and ${t.radius}`);
  });
  return problems;
}

/** Commands that text may contain after escaping. */
const TEXT_COMMAND =
  /\\(?:[a-zA-Z]+\{\}|ensuremath\{(?:\\[a-zA-Z]+|-)\}|[{}#$%&_ ])/g;

/**
 * What is wrong with a figure file, if anything: its frame, its braces,
 * its commands, its colours and its numbers.
 */
export function wellFormedProblems(tikz: string): string[] {
  const problems: string[] = [];
  if (/NaN|undefined|Infinity/.test(tikz)) problems.push('not a number');
  const head = /^\\algoviz@figure\{1\}\{([\d.]+)\}\{([\d.]+)\}\{%$/m.exec(tikz);
  if (head === null) return [...problems, 'no \\algoviz@figure line'];
  const [width, height] = [Number(head[1]), Number(head[2])];
  const defined = new Set(
    [...tikz.matchAll(/^\\algoviz@color\{(\d+)\}\{[0-9A-F]{6}\}%$/gm)].map(
      (m) => `algoviz@c${m[1]}`,
    ),
  );
  for (const used of tikz.matchAll(/algoviz@c\d+/g))
    if (!defined.has(used[0]))
      problems.push(`colour ${used[0]} is not defined`);
  for (const line of drawingOf(tikz)) {
    const text =
      /^\\algoviz@text\{[^}]*\}\{[lcr]\}\{[\d.]+\}\{[\d.]+\}\{(?:value|label)\}\{algoviz@c\d+\}\{(?:algoviz@c\d+,[\d.]+\\algoviz@u)?\}\{(.*)\}$/.exec(
        line,
      );
    const rest =
      text !== null
        ? text[1]!.replace(TEXT_COMMAND, '')
        : /^\\path\[[^\]]*\] [^\\]*(?:\\algoviz@u[^\\]*)?;$/.test(line)
          ? ''
          : line;
    if (/[\\{}#$%&_^~]/.test(rest)) problems.push(`not well formed: ${line}`);
    for (const p of pointsOf(line.replace(/\+\+\([^)]*\)/, '')))
      if (p.x < -1 || p.y < -1 || p.x > width + 1 || p.y > height + 1)
        problems.push(
          `(${p.x}, ${p.y}) is outside the ${width} × ${height} canvas`,
        );
  }
  return problems;
}
