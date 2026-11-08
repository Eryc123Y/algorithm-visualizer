import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  layoutTrace,
  loadTrace,
  type Scene,
  type SceneItem,
} from '@algoviz/core';
import {
  createTheme,
  lightTheme,
  type SvgTheme,
  type ThemeName,
} from '@algoviz/svg';

import { renderTikz, TIKZ_FORMAT } from '../src/index.ts';

const sceneOf = (...items: SceneItem[]): Scene => ({
  width: 300,
  height: 200,
  title: 'Test',
  items,
});

/** The drawing lines of a figure: between the colours and the end. */
function drawing(tikz: string): string[] {
  const lines = tikz.split('\n');
  return lines.slice(lines.indexOf('}{%') + 1, lines.lastIndexOf('}%'));
}

/** The colour definitions of a figure, by name. */
function colours(tikz: string): Map<string, string> {
  return new Map(
    [...tikz.matchAll(/\\algoviz@color\{(\d+)\}\{([0-9A-F]{6})\}%/g)].map(
      (m) => [`algoviz@c${m[1]}`, m[2]!],
    ),
  );
}

/** The arguments of each `\algoviz@text`. */
function texts(tikz: string) {
  return [
    ...tikz.matchAll(
      /\\algoviz@text\{([^}]*)\}\{([lcr])\}\{([^}]*)\}\{([^}]*)\}\{(value|label)\}\{([^}]*)\}\{([^}]*)\}\{(.*)\}$/gm,
    ),
  ].map((m) => ({
    at: m[1],
    anchor: m[2],
    size: Number(m[3]),
    room: Number(m[4]),
    font: m[5],
    colour: m[6],
    halo: m[7],
    text: m[8],
  }));
}

const box = (
  over: Partial<Extract<SceneItem, { type: 'box' }>> = {},
): SceneItem => ({
  type: 'box',
  key: 'a/0',
  x: 20,
  y: 40,
  width: 52,
  height: 52,
  role: 'default',
  text: '5',
  fontSize: 20,
  ...over,
});

describe('renderTikz', () => {
  it('calls \\algoviz@figure with the format, the canvas and the drawing', () => {
    const tikz = renderTikz(sceneOf(), { comments: ['Frame 3, relax#2.'] });
    expect(tikz.split('\n').slice(0, 6)).toEqual([
      `% algoviz figure for LaTeX, format ${TIKZ_FORMAT}: Test`,
      '% Frame 3, relax#2.',
      '% Draw it with \\algovizinput from the algoviz LaTeX package.',
      `\\algoviz@figure{${TIKZ_FORMAT}}{300}{200}{%`,
      '\\algoviz@fonts{normal}{sf}%',
      '}{%',
    ]);
    expect(TIKZ_FORMAT).toBe(2);
    expect(tikz.endsWith('}%\n')).toBe(true);
  });

  it('names the theme’s TeX families for values and labels (ADR 0030)', () => {
    const fonts = (theme: ThemeName | SvgTheme) =>
      /^\\algoviz@fonts\{(\w+)\}\{(\w+)\}%$/m
        .exec(renderTikz(sceneOf(), { theme }))!
        .slice(1);
    expect(fonts('turbo-c')).toEqual(['tt', 'tt']);
    expect(fonts('textbook')).toEqual(['rm', 'rm']);
    expect(fonts('answer-sheet')).toEqual(['tt', 'sf']);
    expect(fonts('print')).toEqual(['normal', 'sf']);
    expect(fonts(createTheme('light', { tex: { value: 'tt' } }))).toEqual([
      'tt',
      'sf',
    ]);
  });

  it('keeps comments on one line, so they cannot run anything', () => {
    const tikz = renderTikz(sceneOf(), { comments: ['two\nlines \\input{x}'] });
    expect(tikz).toContain('% two lines \\input{x}\n');
  });

  it('draws a cell as its shadow, its body and its text', () => {
    const tikz = renderTikz(sceneOf(box()));
    const c = colours(tikz);
    const [shadow, body, text, ...rest] = drawing(tikz);
    expect(rest).toEqual([]);
    // The light theme's shadow is translucent, 2 units below the cell.
    expect(shadow).toMatch(
      /^\\path\[fill=(algoviz@c\d+),fill opacity=0\.1,rounded corners=8\\algoviz@u\] \(20,42\) rectangle \+\+\(52,52\);$/,
    );
    expect(c.get(/fill=(algoviz@c\d+)/.exec(shadow!)![1]!)).toBe('142D26');
    // The body is inset by half its border, so the border stays inside.
    expect(body).toBe(
      `\\path[fill=${name(c, 'FFFFFF')},draw=${name(c, 'C9D3CF')},line width=1.25\\algoviz@u,rounded corners=8\\algoviz@u] (20.63,40.63) rectangle ++(50.75,50.75);`,
    );
    // Centred on the baseline, 0.35 em below the middle, with room for
    // the cell's width less a margin on each side.
    expect(texts(text!)).toEqual([
      {
        at: '46,73',
        anchor: 'c',
        size: 20,
        room: 44,
        font: 'value',
        colour: name(c, '1F2A26'),
        halo: '',
        text: '5',
      },
    ]);
  });

  it('marks roles with the theme’s borders, dashes and check marks', () => {
    const compare = drawing(renderTikz(sceneOf(box({ role: 'compare' }))));
    expect(compare[1]).toContain('line width=2.5\\algoviz@u');
    const swap = drawing(renderTikz(sceneOf(box({ role: 'swap' }))));
    expect(swap[1]).toContain('dash pattern=on 5\\algoviz@u off 3\\algoviz@u');
    const visited = drawing(renderTikz(sceneOf(box({ role: 'visited' }))));
    expect(visited[1]).toContain(
      'dash pattern=on 2\\algoviz@u off 2.5\\algoviz@u',
    );
    const settled = drawing(renderTikz(sceneOf(box({ role: 'settled' }))));
    expect(settled[2]).toMatch(
      /^\\path\[draw=algoviz@c\d+,line width=1\.75\\algoviz@u,line cap=round,line join=round\] \(57,50\) -- \(60\.5,53\.5\) -- \(66\.5,46\.5\);$/,
    );
  });

  it('draws nodes as circles, or stadiums when wide, with labels outside', () => {
    const tikz = renderTikz(
      sceneOf(
        {
          type: 'node',
          key: 'g/A',
          x: 100,
          y: 80,
          radius: 20,
          role: 'default',
          text: 'A',
          fontSize: 20,
          label: '∞',
          labelAngle: 0,
        },
        {
          type: 'node',
          key: 'g/B',
          x: 200,
          y: 80,
          radius: 20,
          width: 70,
          role: 'highlight',
          text: 'long',
          fontSize: 20,
        },
      ),
    );
    const lines = drawing(tikz);
    expect(lines[1]).toMatch(
      /^\\path\[.*\] \(100,80\) circle\[radius=19\.38\\algoviz@u\];$/,
    );
    const [value, label, wide] = texts(tikz);
    expect(value).toMatchObject({ at: '100,87', anchor: 'c', room: 28 });
    // The label is a free text: no room limit, and a halo behind it.
    expect(label).toMatchObject({
      anchor: 'c',
      room: 0,
      text: '\\ensuremath{\\infty}',
    });
    expect(label!.halo).toMatch(/^algoviz@c\d+,1\.5\\algoviz@u$/);
    expect(
      lines.some((l) =>
        /rounded corners=19\.13\\algoviz@u\] \(165\.88,60\.88\) rectangle \+\+\(68\.25,38\.25\)/.test(
          l,
        ),
      ),
    ).toBe(true);
    expect(wide).toMatchObject({ at: '200,87', room: 58 });
  });

  it('draws edges in scene coordinates, heads and all', () => {
    const tikz = renderTikz(
      sceneOf({
        type: 'edge',
        key: 'g/A-B',
        x1: 10,
        y1: 10,
        x2: 110,
        y2: 10,
        role: 'default',
        directed: true,
        fontSize: 12,
        label: '7',
      }),
    );
    const [line, head, label] = drawing(tikz);
    // The line stops where the head (8 units) begins.
    expect(line).toMatch(
      /^\\path\[draw=algoviz@c\d+,line width=1\.75\\algoviz@u\] \(10,10\) -- \(102,10\);$/,
    );
    expect(head).toMatch(
      /^\\path\[fill=algoviz@c\d+\] \(110,10\) -- \(102,5\.5\) -- \(102,14\.5\) -- cycle;$/,
    );
    expect(texts(label!)[0]).toMatchObject({ anchor: 'c', room: 0, size: 12 });
    expect(texts(label!)[0]!.halo).toMatch(/,1\.75\\algoviz@u$/);
  });

  it('turns rotated shapes the way SVG does', () => {
    // An edge pointing straight down: SVG rotates the unit line by 90°.
    const down = drawing(
      renderTikz(
        sceneOf({
          type: 'edge',
          key: 'e',
          x1: 50,
          y1: 10,
          x2: 50,
          y2: 90,
          role: 'link',
          directed: false,
          fontSize: 12,
        }),
      ),
    );
    expect(down[0]).toMatch(/\(50,10\) -- \(50,90\);$/);
    // A self-loop turned to the right (90°): its curve starts below the
    // node's point and bulges to the right, as in the SVG.
    const loop = drawing(
      renderTikz(
        sceneOf({
          type: 'edge',
          key: 'l',
          x1: 100,
          y1: 100,
          x2: 100,
          y2: 100,
          role: 'rejected',
          directed: false,
          loopAngle: 90,
          fontSize: 12,
        }),
      ),
    );
    const colour = /draw=(algoviz@c\d+)/.exec(loop[0]!)![1]!;
    expect(loop[0]).toBe(
      `\\path[draw=${colour},line width=1.25\\algoviz@u,draw opacity=0.6] (100,93) .. controls (134,78) and (134,122) .. (100,107);`,
    );
  });

  it('draws routed edges as one path through their bends', () => {
    const lines = drawing(
      renderTikz(
        sceneOf({
          type: 'edge',
          key: 'r',
          x1: 0,
          y1: 0,
          x2: 100,
          y2: 50,
          via: [{ x: 50, y: 0 }],
          role: 'highlight',
          directed: false,
          fontSize: 12,
        }),
      ),
    );
    expect(lines[0]).toMatch(
      /line join=round\] \(0,0\) -- \(50,0\) -- \(100,50\);$/,
    );
  });

  it('sets titles in the label font and indices in the value font', () => {
    const tikz = renderTikz(
      sceneOf(
        {
          type: 'text',
          key: 't',
          x: 20,
          y: 20,
          anchor: 'start',
          role: 'title',
          text: 'dist',
          fontSize: 13,
        },
        {
          type: 'text',
          key: 'i',
          x: 60,
          y: 30,
          anchor: 'end',
          role: 'index',
          text: '3',
          fontSize: 12,
        },
      ),
    );
    expect(texts(tikz)).toMatchObject([
      { at: '20,24.55', anchor: 'l', font: 'label', room: 0 },
      { at: '60,34.2', anchor: 'r', font: 'value', room: 0 },
    ]);
  });

  it('draws badges and arrows, with room on the badge', () => {
    const tikz = renderTikz(
      sceneOf(
        {
          type: 'badge',
          key: 'p',
          x: 50,
          y: 50,
          width: 30,
          height: 18,
          role: 'pointer',
          text: 'i',
          fontSize: 12,
        },
        {
          type: 'arrow',
          key: 'q',
          x1: 50,
          y1: 59,
          x2: 50,
          y2: 80,
          role: 'pointer',
        },
      ),
    );
    const lines = drawing(tikz);
    expect(lines[0]).toMatch(
      /rounded corners=9\\algoviz@u\] \(35,41\) rectangle \+\+\(30,18\);$/,
    );
    expect(texts(tikz)[0]).toMatchObject({ at: '50,54.2', room: 22 });
    expect(lines[2]).toMatch(
      /line width=1\.75\\algoviz@u,line cap=round\] \(50,59\) -- \(50,74\);$/,
    );
    expect(lines[3]).toMatch(
      /^\\path\[fill=(algoviz@c\d+),draw=\1,line width=1\\algoviz@u,line join=round\] \(50,80\) -- \(46,74\) -- \(54,74\) -- cycle;$/,
    );
  });

  it('defines each colour once, in order of first use', () => {
    const tikz = renderTikz(sceneOf(box(), box({ key: 'a/1', x: 80 })));
    const defined = [...colours(tikz).keys()];
    expect(defined).toEqual(defined.map((_, k) => `algoviz@c${k + 1}`));
    const used = new Set(tikz.match(/algoviz@c\d+/g));
    expect([...used].sort()).toEqual([...defined].sort());
  });

  it('follows the theme: print has no shadows, a background fills the canvas', () => {
    expect(
      drawing(renderTikz(sceneOf(box()), { theme: 'print' })),
    ).toHaveLength(2);
    const dark = colours(renderTikz(sceneOf(box()), { theme: 'dark' }));
    expect([...dark.values()]).toContain('1C2522');
    const filled = renderTikz(sceneOf(box()), {
      theme: createTheme(lightTheme, { background: '#fafafa' }),
    });
    expect(drawing(filled)[0]).toMatch(
      /^\\path\[fill=algoviz@c1\] \(0,0\) rectangle \(300,200\);$/,
    );
    expect(colours(filled).get('algoviz@c1')).toBe('FAFAFA');
  });

  it('escapes text', () => {
    const tikz = renderTikz(sceneOf(box({ text: '50% & #1' })));
    expect(texts(tikz)[0]!.text).toBe('50\\% \\& \\#1');
  });

  it('renders a bubble sort frame (review the snapshot file when it changes)', async () => {
    const bubble = JSON.parse(
      readFileSync(
        new URL(
          '../../../conformance/spec/valid/bubble-sort-first-pass.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as { input: unknown };
    const trace = loadTrace(bubble.input);
    if (!trace.ok) throw new Error('fixture');
    await expect(
      renderTikz(layoutTrace(trace.value).sceneAt(4)),
    ).toMatchFileSnapshot('__snapshots__/bubble-sort-frame-4.tex');
  });
});

/** The name a figure gave a colour. */
function name(defined: Map<string, string>, hex: string): string {
  const found = [...defined].find(([, value]) => value === hex);
  if (found === undefined) throw new Error(`No colour ${hex}`);
  return found[0];
}
