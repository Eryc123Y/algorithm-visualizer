import { readFileSync } from 'node:fs';

import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

import { layoutTrace, loadTrace, type Scene } from '@algomotion/core';

import { darkTheme, renderSvg } from '../src/index.ts';

function sceneOf(input: unknown, index: number): Scene {
  const result = loadTrace(input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return layoutTrace(result.value).sceneAt(index);
}

function parse(svg: string): Document {
  const window = new Window();
  return new window.DOMParser().parseFromString(
    svg,
    'image/svg+xml',
  ) as unknown as Document;
}

const bubble = JSON.parse(
  readFileSync(
    new URL(
      '../../../conformance/spec/valid/bubble-sort-first-pass.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as { input: unknown };

describe('renderSvg', () => {
  it('renders a bubble sort frame (review the snapshot file when it changes)', async () => {
    await expect(
      renderSvg(sceneOf(bubble.input, 4), { outlineText: false }),
    ).toMatchFileSnapshot('__snapshots__/bubble-sort-frame-4.svg');
  });

  it('renders a bubble sort frame with outlined text (review the snapshot too)', async () => {
    await expect(renderSvg(sceneOf(bubble.input, 4))).toMatchFileSnapshot(
      '__snapshots__/bubble-sort-frame-4-outlined.svg',
    );
  });

  it('produces well-formed SVG with one group per cell', () => {
    const doc = parse(renderSvg(sceneOf(bubble.input, 4)));
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelectorAll('[data-role]')).toHaveLength(4);
    expect(doc.querySelectorAll('[data-role="compare"]')).toHaveLength(2);
    expect(doc.querySelector('title')?.textContent).toBe('Bubble sort');
  });

  it('escapes text content and attributes', () => {
    const doc = (outlineText: boolean) =>
      renderSvg(
        sceneOf(
          {
            version: '1.0',
            title: 'a < b & "c"',
            structures: {
              arr: { kind: 'array', label: 'arr', initial: ['<b>', "it's"] },
            },
            steps: [],
          },
          0,
        ),
        { outlineText },
      );
    const svg = doc(false);
    expect(svg).not.toContain('<b>');
    expect(parse(svg).querySelector('title')?.textContent).toBe('a < b & "c"');
    expect(parse(svg).querySelectorAll('text')[2]?.textContent).toBe('<b>');
    const outlined = doc(true);
    expect(outlined).not.toContain('<b>');
    expect(
      parse(outlined).querySelector('path[aria-label="<b>"]'),
    ).not.toBeNull();
  });

  it('draws arrows around their tip, so they move with what they point at', () => {
    const scene: Scene = {
      width: 100,
      height: 100,
      title: 't',
      items: [
        {
          type: 'arrow',
          key: 'a',
          x1: 50,
          y1: 80,
          x2: 50,
          y2: 20,
          role: 'pointer',
        },
      ],
    };
    const doc = parse(renderSvg(scene));
    expect(doc.querySelector('[data-key="a"]')?.getAttribute('transform')).toBe(
      'translate(50 20)',
    );
    expect(doc.querySelector('polygon')?.getAttribute('points')).toBe(
      '0,0 4,6 -4,6',
    );
    const line = doc.querySelector('line');
    expect([line?.getAttribute('y1'), line?.getAttribute('y2')]).toEqual([
      '60',
      '6',
    ]);
  });

  it('applies theme, scale and key options', () => {
    const scene = sceneOf(bubble.input, 0);
    const svg = renderSvg(scene, { theme: darkTheme, scale: 2, keys: false });
    expect(svg).toContain(darkTheme.cell.default.fill);
    expect(svg).not.toContain('data-key');
    const root = parse(svg).documentElement;
    expect(root.getAttribute('width')).toBe(String(scene.width * 2));
    expect(root.getAttribute('viewBox')).toBe(
      `0 0 ${scene.width} ${scene.height}`,
    );
  });
});
