import { describe, expect, it } from 'vitest';

import {
  apply,
  isTranslation,
  itemTransform,
  parsePath,
} from '../src/index.ts';

describe('itemTransform', () => {
  it('translates', () => {
    const m = itemTransform(10, 20);
    expect(isTranslation(m)).toBe(true);
    expect(apply(m, { x: 1, y: 2 })).toEqual({ x: 11, y: 22 });
  });

  it('rotates clockwise on screen, as SVG does with y down', () => {
    // A point to the right of the origin turns downwards by 90°.
    const m = itemTransform(0, 0, 90);
    expect(isTranslation(m)).toBe(false);
    const p = apply(m, { x: 1, y: 0 });
    expect(p.x).toBeCloseTo(0, 12);
    expect(p.y).toBeCloseTo(1, 12);
  });

  it('is exact for right angles', () => {
    for (const angle of [0, 90, 180, 270, -90]) {
      const m = itemTransform(0, 0, angle);
      for (const v of [m.a, m.b, m.c, m.d])
        expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('stretches before rotating and moving, as translate rotate scale', () => {
    const m = itemTransform(5, 5, 90, 10);
    const p = apply(m, { x: 1, y: 0 });
    expect(p.x).toBeCloseTo(5, 12);
    expect(p.y).toBeCloseTo(15, 12);
  });
});

describe('parsePath', () => {
  it('reads absolute moves, lines and curves', () => {
    expect(parsePath('M-7 0C-22 -34 22 -34 7 0')).toEqual([
      { type: 'move', to: { x: -7, y: 0 } },
      {
        type: 'curve',
        c1: { x: -22, y: -34 },
        c2: { x: 22, y: -34 },
        to: { x: 7, y: 0 },
      },
    ]);
    expect(parsePath('M0 0L10 5L20 0')).toEqual([
      { type: 'move', to: { x: 0, y: 0 } },
      { type: 'line', to: { x: 10, y: 5 } },
      { type: 'line', to: { x: 20, y: 0 } },
    ]);
  });

  it('reads relative lines from the point before', () => {
    // The check mark of a settled cell.
    expect(parsePath('M37 10l3.5 3.5l6-7')).toEqual([
      { type: 'move', to: { x: 37, y: 10 } },
      { type: 'line', to: { x: 40.5, y: 13.5 } },
      { type: 'line', to: { x: 46.5, y: 6.5 } },
    ]);
  });

  it('reads numbers with signs, fractions and commas', () => {
    expect(parsePath('M.5,-1.25L-3e-1 2')).toEqual([
      { type: 'move', to: { x: 0.5, y: -1.25 } },
      { type: 'line', to: { x: -0.3, y: 2 } },
    ]);
  });

  it('rejects what the painter never writes', () => {
    expect(() => parsePath('M0 0A5 5 0 0 1 10 10')).toThrow(/Cannot read/);
    expect(() => parsePath('M0 0L1')).toThrow(/Cannot read/);
    expect(() => parsePath('x')).toThrow(/Cannot read/);
  });
});
