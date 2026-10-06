/**
 * Checks shared by tests that lay out scenes: every item has a unique key,
 * finite coordinates, and lies inside the scene with its labels.
 */
import type { Scene, SceneItem } from '../src/index.ts';

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
      const width = [...item.label].length * font * 0.6;
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
        item.label === undefined
          ? 0
          : [...item.label].length * item.fontSize * 0.6;
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
    case 'text':
      return [item.x, item.y, item.x, item.y];
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
