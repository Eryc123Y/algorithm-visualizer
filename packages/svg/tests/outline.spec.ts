import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { defaultFonts, type Scene } from '@algoviz/core';
import {
  interSemiBold,
  jetbrainsMonoSemiBold,
  jetbrainsMonoSemiBoldOutlines,
  textWidth,
} from '@algoviz/fonts';

import {
  bundledOutlines,
  glyphLookup,
  outlineText,
  renderSvg,
} from '../src/index.ts';

/** fast-check settings, deepened with FUZZ_RUNS and replayed with FUZZ_SEED. */
const fuzz = {
  numRuns: Number(process.env['FUZZ_RUNS'] ?? 100),
  ...(process.env['FUZZ_SEED']
    ? { seed: Number(process.env['FUZZ_SEED']) }
    : {}),
};

const glyphs = glyphLookup(bundledOutlines);
const mono = glyphs(jetbrainsMonoSemiBold)!;
const sans = glyphs(interSemiBold)!;

/** Absolute x of every point in path data that starts with an absolute M. */
function xs(path: string): number[] {
  const out: number[] = [];
  const arity: Record<string, number> = { M: 2, m: 2, l: 2, q: 4, c: 6, z: 0 };
  const tokens = path.match(/[a-zA-Z]|-?\d+/g) ?? [];
  let [x, sx] = [0, 0];
  let command = '';
  let k = 0;
  while (k < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[k]!)) command = tokens[k++]!;
    else if (command === 'm' || command === 'M') command = 'l';
    const n = arity[command]!;
    const args = tokens.slice(k, k + n).map(Number);
    k += n;
    if (command === 'z') x = sx;
    else if (command === 'M') x = args[0]!;
    else {
      for (let j = 0; j < n - 2; j += 2) out.push(x + args[j]!);
      x += args[n - 2]!;
    }
    if (command === 'M' || command === 'm') sx = x;
    out.push(x);
  }
  return out;
}

const scene = (items: Scene['items']): Scene => ({
  width: 300,
  height: 100,
  title: 'Test',
  items,
});

describe('outlineText', () => {
  it('moves each glyph to its pen position', () => {
    const one = outlineText('0', jetbrainsMonoSemiBold, mono, 20)!;
    const two = outlineText('00', jetbrainsMonoSemiBold, mono, 20)!;
    const zero = new Map(jetbrainsMonoSemiBoldOutlines.glyphs).get(48)!;
    expect(one.d).toBe(zero);
    // The second zero starts 600 units (0.6 em) further right.
    const first = Number(/^M(-?\d+)/.exec(zero)![1]);
    expect(two.d).toBe(zero + zero.replace(/^M-?\d+/, `M${first + 600}`));
    expect(two.width).toBe(24);
    expect(two.scale).toBe(0.02);
  });

  it('advances over blank glyphs and adds tracking after each character', () => {
    const spaced = outlineText('a b', interSemiBold, sans, 13, 0.02)!;
    expect(spaced.width).toBeCloseTo(
      (textWidth('a b', interSemiBold) + 3 * 0.02) * 13,
      9,
    );
  });

  it('gives up on characters without an outline', () => {
    expect(outlineText('数', jetbrainsMonoSemiBold, mono, 20)).toBe(undefined);
    expect(outlineText('é', jetbrainsMonoSemiBold, mono, 20)).toBe(undefined);
  });

  it('draws inside the width layout measured', () => {
    const ascii = fc.string({
      unit: fc
        .integer({ min: 0x21, max: 0x7e })
        .map((c) => String.fromCharCode(c)),
      minLength: 1,
      maxLength: 20,
    });
    fc.assert(
      fc.property(ascii, fc.constantFrom('value', 'label'), (text, role) => {
        const face = defaultFonts[role];
        const out = outlineText(text, face, glyphs(face)!, 20)!;
        expect(out.width).toBeCloseTo(textWidth(text, face) * 20, 9);
        // Glyphs may overhang their advance a little, never by much.
        const em = face.unitsPerEm;
        for (const x of xs(out.d)) {
          expect(x).toBeGreaterThanOrEqual(-0.15 * em);
          expect(x).toBeLessThanOrEqual(out.width / out.scale + 0.15 * em);
        }
      }),
      fuzz,
    );
  });
});

describe('renderSvg with outlined text', () => {
  const items: Scene['items'] = [
    {
      type: 'text',
      key: 'a/title',
      x: 10,
      y: 10,
      anchor: 'start',
      role: 'title',
      text: 'arr',
      fontSize: 13,
    },
    {
      type: 'box',
      key: 'a/element/e0',
      x: 10,
      y: 20,
      width: 68,
      height: 52,
      role: 'default',
      text: '42',
      fontSize: 20,
    },
    {
      type: 'box',
      key: 'a/element/e1',
      x: 90,
      y: 20,
      width: 68,
      height: 52,
      role: 'default',
      text: '数组',
      fontSize: 20,
    },
  ];

  it('draws text as paths by default, keeping text it has no glyphs for', () => {
    const svg = renderSvg(scene(items));
    expect(svg).toContain('aria-label="arr"');
    expect(svg).toContain('aria-label="42"');
    expect(svg.match(/<text/g)).toHaveLength(1);
    expect(svg).toContain('>数组</text>');
  });

  it('centres a value by its measured width', () => {
    const svg = renderSvg(scene([items[1]!]), { keys: false });
    // "42" is 1.2 em at 20: 24 wide, so it starts 12 left of the centre (34).
    expect(svg).toContain('transform="translate(22 ');
    expect(svg).toContain('scale(0.02)');
  });

  it('keeps every text as text when asked', () => {
    const svg = renderSvg(scene(items), { outlineText: false });
    expect(svg.match(/<text/g)).toHaveLength(3);
    expect(svg).not.toContain('aria-label');
  });

  it('scales label halos back to their width', () => {
    const svg = renderSvg(
      scene([
        {
          type: 'node',
          key: 'g/element/a',
          x: 50,
          y: 50,
          radius: 20,
          role: 'default',
          text: 'A',
          fontSize: 20,
          label: '7',
        },
      ]),
    );
    // A halo of 3 units around a 14-unit label: 3 / (14 / 1000).
    expect(svg).toContain('stroke-width="214.286"');
  });
});
