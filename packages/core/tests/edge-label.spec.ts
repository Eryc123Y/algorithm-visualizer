import { describe, expect, it } from 'vitest';

import {
  defaultFonts,
  edgeLabelBox,
  labelSegment,
  separateEdgeLabels,
  type SceneEdge,
  type SceneItem,
  CLEAR,
  segmentToBox,
} from '../src/index.ts';

const font = defaultFonts.value;

const edge = (
  key: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label?: string,
): SceneEdge => ({
  type: 'edge',
  key,
  x1,
  y1,
  x2,
  y2,
  role: 'default',
  directed: false,
  fontSize: 12,
  ...(label === undefined ? {} : { label }),
});

const boxes = (items: SceneItem[]) =>
  items.flatMap((i) => {
    if (i.type !== 'edge' || i.label === undefined) return [];
    const [a, b] = labelSegment(i);
    return [edgeLabelBox(i, a, b, font)];
  });

describe('edge labels', () => {
  it('sit beside the middle by default, above a horizontal edge', () => {
    const e = edge('e', 0, 100, 200, 100, '7');
    const box = edgeLabelBox(e, { x: 0, y: 100 }, { x: 200, y: 100 }, font);
    expect(box.x).toBe(100);
    expect(box.y).toBeLessThan(100);
  });

  it('move apart when two crossing edges would put them in one place', () => {
    const items = separateEdgeLabels(
      [edge('h', 0, 100, 200, 100, '-1'), edge('v', 100, 0, 100, 200, '-2')],
      font,
    );
    const [p, q] = boxes(items);
    const apart =
      Math.abs(p!.x - q!.x) >= p!.halfWidth + q!.halfWidth ||
      Math.abs(p!.y - q!.y) >= p!.halfHeight + q!.halfHeight;
    expect(apart).toBe(true);
    // Both move along their edges, off the crossing, clear of the other
    // edge (ADR 0031).
    expect(items[0]).toHaveProperty('labelAt');
    expect(items[1]).toHaveProperty('labelAt');
    const horizontal = [
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    ] as const;
    const vertical = [
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    ] as const;
    expect(segmentToBox(...vertical, p!)).toBeGreaterThanOrEqual(CLEAR);
    expect(segmentToBox(...horizontal, q!)).toBeGreaterThanOrEqual(CLEAR);
  });

  it('keep the middle when no other edge is near', () => {
    const items = separateEdgeLabels(
      [edge('h', 0, 100, 200, 100, '-1'), edge('v', 300, 0, 300, 200, '-2')],
      font,
    );
    expect(items[0]).not.toHaveProperty('labelAt');
    expect(items[1]).not.toHaveProperty('labelAt');
  });

  it('keep clear of nodes where they can', () => {
    const items = separateEdgeLabels(
      [
        {
          type: 'node',
          key: 'n',
          x: 100,
          y: 88,
          radius: 14,
          role: 'default',
          text: 'x',
          fontSize: 14,
        },
        edge('e', 0, 100, 200, 100, '5'),
      ],
      font,
    );
    const [box] = boxes(items);
    expect(Math.abs(box!.x - 100)).toBeGreaterThan(14 + box!.halfWidth);
  });

  it('are as wide as their text in the font', () => {
    const e = edge('e', 0, 100, 200, 100, '\u6570\u7ec4');
    const box = edgeLabelBox(e, { x: 0, y: 100 }, { x: 200, y: 100 }, font);
    expect(box.halfWidth).toBe(12);
  });

  it('leave edges without labels, and self-loops, alone', () => {
    const items: SceneItem[] = [
      edge('a', 0, 0, 100, 0),
      edge('loop', 50, 50, 50, 50, 'w'),
    ];
    expect(separateEdgeLabels(items, font)).toEqual(items);
  });
});
