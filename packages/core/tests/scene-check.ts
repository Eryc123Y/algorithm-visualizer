/**
 * Checks shared by tests that lay out scenes: every item has a unique key,
 * finite coordinates, and lies inside the scene with its labels, and text
 * fits the cell, node or badge it is drawn in. Text is measured in the
 * default fonts, which the default themes draw with (ADR 0024).
 */
import { textWidth } from '@algoviz/fonts';

import {
  defaultFonts,
  TITLE_TRACKING,
  type Scene,
  type SceneItem,
} from '../src/index.ts';

/** Width of text in the value font, at `fontSize`. */
const valueWidth = (text: string, fontSize: number) =>
  textWidth(text, defaultFonts.value) * fontSize;

/** Width of a text item, in the font its role is drawn in. */
function textItemWidth(item: SceneItem & { type: 'text' }): number {
  if (item.role === 'index') return valueWidth(item.text, item.fontSize);
  const tracking = item.role === 'title' ? TITLE_TRACKING : 0;
  return (
    (textWidth(item.text, defaultFonts.label) +
      tracking * [...item.text].length) *
    item.fontSize
  );
}

/** Horizontal and vertical extent of an item, including annotations. */
export function extent(item: SceneItem): [number, number, number, number] {
  switch (item.type) {
    case 'box':
      return [item.x, item.y, item.x + item.width, item.y + item.height];
    case 'node': {
      const half = Math.max(item.radius, (item.width ?? 0) / 2);
      if (item.label === undefined)
        return [
          item.x - half,
          item.y - item.radius,
          item.x + half,
          item.y + item.radius,
        ];
      // Painters draw labels at 70% of the value size, at least 10 units:
      // centred above, or turned and then reaching out by their width.
      const font = Math.max(10, item.fontSize * 0.7);
      const width = valueWidth(item.label, font);
      const turned = (item.labelAngle ?? 0) !== 0;
      const dx = turned ? half + width + 4 : Math.max(half, width / 2);
      const below = turned ? item.radius + font + 4 : item.radius;
      return [
        item.x - dx,
        item.y - item.radius - font - 4,
        item.x + dx,
        item.y + below,
      ];
    }
    case 'badge':
      return [
        item.x - item.width / 2,
        item.y - item.height / 2,
        item.x + item.width / 2,
        item.y + item.height / 2,
      ];
    case 'edge': {
      const isLoop =
        item.via === undefined && item.x1 === item.x2 && item.y1 === item.y2;
      // Labels sit beside the edge (or beyond a loop) and reach out by their
      // own size; see paintEdge.
      const labelWidth =
        item.label === undefined ? 0 : valueWidth(item.label, item.fontSize);
      const [dx, dy] = isLoop
        ? [34, 34].map(
            (d) =>
              d +
              (item.label === undefined
                ? 0
                : Math.max(labelWidth, item.fontSize) + 2),
          )
        : item.label === undefined
          ? [0, 0]
          : [labelWidth + 4, item.fontSize + 4];
      const xs = [item.x1, item.x2, ...(item.via ?? []).map((p) => p.x)];
      const ys = [item.y1, item.y2, ...(item.via ?? []).map((p) => p.y)];
      return [
        Math.min(...xs) - dx!,
        Math.min(...ys) - dy!,
        Math.max(...xs) + dx!,
        Math.max(...ys) + dy!,
      ];
    }
    case 'arrow':
      return [
        Math.min(item.x1, item.x2),
        Math.min(item.y1, item.y2),
        Math.max(item.x1, item.x2),
        Math.max(item.y1, item.y2),
      ];
    case 'text': {
      const width = textItemWidth(item);
      const left =
        item.anchor === 'start'
          ? item.x
          : item.anchor === 'middle'
            ? item.x - width / 2
            : item.x - width;
      return [left, item.y, left + width, item.y];
    }
    default: {
      const unreachable: never = item;
      return unreachable;
    }
  }
}

/**
 * What is wrong with a scene: duplicate keys, coordinates that are not
 * finite, and items (with their labels) outside the scene. Empty if none.
 */
export function sceneProblems(scene: Scene): string[] {
  const problems: string[] = [];
  const keys = new Set<string>();
  if (!Number.isFinite(scene.width) || !Number.isFinite(scene.height))
    problems.push(`scene size ${scene.width}×${scene.height}`);
  for (const item of scene.items) {
    if (keys.has(item.key)) problems.push(`duplicate key ${item.key}`);
    keys.add(item.key);
    const [x1, y1, x2, y2] = extent(item);
    if (![x1, y1, x2, y2].every(Number.isFinite))
      problems.push(`${item.key}: coordinates not finite`);
    else if (
      x1 < -0.5 ||
      y1 < -0.5 ||
      x2 > scene.width + 0.5 ||
      y2 > scene.height + 0.5
    )
      problems.push(
        `${item.key}: [${x1}, ${y1}, ${x2}, ${y2}] outside ${scene.width}×${scene.height}`,
      );
  }
  return problems;
}

/**
 * Text that does not fit inside what it is drawn in: the value of a cell
 * or node (with 4 units to spare on each side) or the name on a badge.
 */
export function fitProblems(scene: Scene): string[] {
  return scene.items.flatMap((item) => {
    if (item.type !== 'box' && item.type !== 'node' && item.type !== 'badge')
      return [];
    const outer =
      item.type === 'node'
        ? Math.max(2 * item.radius, item.width ?? 0)
        : item.width;
    const width = valueWidth(item.text, item.fontSize);
    return width > outer - 8 + 1e-6
      ? [`${item.key}: "${item.text}" is ${width} wide in ${outer}`]
      : [];
  });
}

const structureOf = (key: string) => key.slice(0, key.indexOf('/'));

/**
 * Items that cover each other: nodes or cells of one structure that
 * overlap, and structures whose items reach into each other's area.
 * `allowNodeOverlap` lists structures placed by hand.
 */
export function overlapProblems(
  scene: Scene,
  allowNodeOverlap: ReadonlySet<string> = new Set(),
): string[] {
  const problems: string[] = [];
  const nodes = scene.items.filter((i) => i.type === 'node');
  for (let a = 0; a < nodes.length; a++)
    for (let b = a + 1; b < nodes.length; b++) {
      const [p, q] = [nodes[a]!, nodes[b]!];
      if (structureOf(p.key) !== structureOf(q.key)) continue;
      if (allowNodeOverlap.has(structureOf(p.key))) continue;
      // Stadiums are wider than tall: compare as rectangles then.
      const [pw, qw] = [p.width ?? 2 * p.radius, q.width ?? 2 * q.radius];
      const apart =
        Math.abs(p.x - q.x) >= (pw + qw) / 2 - 0.5 ||
        Math.abs(p.y - q.y) >= p.radius + q.radius - 0.5;
      const round = p.width === undefined && q.width === undefined;
      const far = Math.hypot(p.x - q.x, p.y - q.y) >= p.radius + q.radius - 0.5;
      if (round ? !far : !apart)
        problems.push(`nodes ${p.key} and ${q.key} overlap`);
    }
  const boxes = scene.items.filter((i) => i.type === 'box');
  for (let a = 0; a < boxes.length; a++)
    for (let b = a + 1; b < boxes.length; b++) {
      const [p, q] = [boxes[a]!, boxes[b]!];
      if (
        p.x < q.x + q.width - 0.5 &&
        q.x < p.x + p.width - 0.5 &&
        p.y < q.y + q.height - 0.5 &&
        q.y < p.y + p.height - 0.5
      )
        problems.push(`boxes ${p.key} and ${q.key} overlap`);
    }
  // Each structure's extent must not reach into another's.
  const areas = new Map<string, [number, number, number, number]>();
  for (const item of scene.items) {
    const name = structureOf(item.key);
    const [x1, y1, x2, y2] = extent(item);
    const area = areas.get(name);
    areas.set(
      name,
      area === undefined
        ? [x1, y1, x2, y2]
        : [
            Math.min(area[0], x1),
            Math.min(area[1], y1),
            Math.max(area[2], x2),
            Math.max(area[3], y2),
          ],
    );
  }
  const list = [...areas];
  for (let a = 0; a < list.length; a++)
    for (let b = a + 1; b < list.length; b++) {
      const [[n, p], [m, q]] = [list[a]!, list[b]!];
      if (
        p[1] < q[3] - 0.5 &&
        q[1] < p[3] - 0.5 &&
        p[0] < q[2] - 0.5 &&
        q[0] < p[2] - 0.5
      )
        problems.push(`structures ${n} and ${m} overlap`);
    }
  return problems;
}
