import { readFileSync } from 'node:fs';

import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

import { layoutTrace, loadTrace, type Scene } from '@algoviz/core';

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
    await expect(renderSvg(sceneOf(bubble.input, 4))).toMatchFileSnapshot(
      '__snapshots__/bubble-sort-frame-4.svg',
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
    const svg = renderSvg(
      sceneOf(
        {
          version: '0.1',
          title: 'a < b & "c"',
          structures: { arr: { kind: 'array', initial: ['<b>', "it's"] } },
          steps: [],
        },
        0,
      ),
    );
    expect(svg).not.toContain('<b>');
    expect(parse(svg).querySelector('title')?.textContent).toBe('a < b & "c"');
    expect(parse(svg).querySelectorAll('text')[2]?.textContent).toBe('<b>');
  });

  it('draws arrow heads that end exactly at the arrow tip', () => {
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
    const polygon = parse(renderSvg(scene)).querySelector('polygon');
    expect(polygon?.getAttribute('points')).toBe('50,20 54,26 46,26');
    expect(
      parse(renderSvg(scene)).querySelector('line')?.getAttribute('y2'),
    ).toBe('26');
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
