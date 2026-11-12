/**
 * Figure sizes on slides (ADR 0033): in the beamer class a figure fills a
 * box as wide as the line and three quarters of the text height, keeping
 * its shape; width and height replace their side of the box, scale gives
 * the natural size, and notes keep the sizes of ADR 0027. Sizes are read
 * from the log: each figure is measured in a box before it is drawn.
 *
 * Needs what compile.spec.ts needs. Run with npm run test:latex.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  calls,
  errors,
  latexmk,
  tex,
  workspace,
  type Engine,
} from './helpers.ts';

/** A canvas in scene units. */
interface Canvas {
  readonly width: number;
  readonly height: number;
}

const WIDE: Canvas = { width: 1050, height: 424 };
const TALL: Canvas = { width: 574, height: 412 };
const NARROW: Canvas = { width: 452, height: 204 };
const UPRIGHT: Canvas = { width: 200, height: 400 };

/** A figure file of the canvas given, with `frames` figures in it. */
function figureFile(dir: string, name: string, canvas: Canvas, frames = 1) {
  const figure = (k: number) =>
    [
      `\\algoviz@figure{2}{${canvas.width}}{${canvas.height}}{%`,
      '\\algoviz@fonts{normal}{sf}%',
      '\\algoviz@color{1}{1F2A26}%',
      '}{%',
      `\\path[draw=algoviz@c1] (0,0) rectangle (${canvas.width},${canvas.height});`,
      `\\algoviz@text{10,20}{l}{12}{0}{label}{algoviz@c1}{}{F${k}}`,
      '}%',
    ].join('\n');
  writeFileSync(
    join(dir, name),
    `${Array.from({ length: frames }, (_, k) => figure(k)).join('\n\n')}\n`,
  );
}

/** What a measured figure logs: its size and the space around it. */
interface Measured {
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly line: number;
  readonly textheight: number;
  readonly size: number;
}

const PREAMBLE = String.raw`\usepackage{algoviz}
\makeatletter
\newcommand\measure[2]{\sbox0{#2}\typeout{SIZE:#1:\strip@pt\wd0:\strip@pt\ht0:\strip@pt\linewidth:\strip@pt\textheight:\f@size}\usebox0}
\makeatother`;

/** Compiles a document of the class line and body given, and reads its sizes. */
function measure(
  dir: string,
  name: string,
  documentclass: string,
  body: string,
  compile: (file: string) => string = (file) => tex(dir, file, 'off'),
): Measured[] {
  writeFileSync(
    join(dir, `${name}.tex`),
    `${documentclass}\n${PREAMBLE}\n\\begin{document}\n${body}\n\\end{document}\n`,
  );
  const log = compile(`${name}.tex`);
  expect(errors(log)).toEqual([]);
  return [
    ...log.matchAll(
      /^SIZE:([^:]*):([\d.]+):([\d.]+):([\d.]+):([\d.]+):([\d.]+)$/gm,
    ),
  ].map((m) => ({
    label: m[1]!,
    width: Number(m[2]),
    height: Number(m[3]),
    line: Number(m[4]),
    textheight: Number(m[5]),
    size: Number(m[6]),
  }));
}

const TOLERANCE = 0.05;

/** The figure fits the box w by h, touches one of its sides and keeps its shape. */
function expectFilled(m: Measured, canvas: Canvas, w: number, h: number) {
  expect(m.width, m.label).toBeLessThanOrEqual(w + TOLERANCE);
  expect(m.height, m.label).toBeLessThanOrEqual(h + TOLERANCE);
  expect(
    Math.min(Math.abs(m.width - w), Math.abs(m.height - h)),
    `${m.label} touches a side`,
  ).toBeLessThan(TOLERANCE);
  expect(m.width / m.height, `${m.label} keeps its shape`).toBeCloseTo(
    canvas.width / canvas.height,
    2,
  );
}

/** The natural size of ADR 0027: font size / 16 per unit, at most the line. */
function natural(m: Measured, canvas: Canvas, scale = 1) {
  const unit = Math.min((scale * m.size) / 16, m.line / canvas.width);
  return { width: unit * canvas.width, height: unit * canvas.height };
}

const CANVASES = { wide: WIDE, tall: TALL, narrow: NARROW, upright: UPRIGHT };

function canvasWorkspace(): string {
  const dir = workspace();
  for (const [name, canvas] of Object.entries(CANVASES))
    figureFile(dir, `${name}.tex`, canvas);
  figureFile(dir, 'series.tex', TALL, 3);
  return dir;
}

const frames = (figures: readonly string[]) =>
  figures.map((f) => `\\begin{frame}{A title}${f}\\end{frame}`).join('\n');

describe.each([
  ['4:3', ''],
  ['16:9', 'aspectratio=169'],
])('a Beamer frame at %s', (_, options) => {
  const dir = canvasWorkspace();
  const beamer = `\\documentclass[${options}]{beamer}`;

  it('fills the line and three quarters of the text height, keeping the shape', () => {
    const sizes = measure(
      dir,
      'fill',
      beamer,
      frames(
        Object.keys(CANVASES).map(
          (name) => `\\measure{${name}}{\\algovizinput{${name}.tex}}`,
        ),
      ),
    );
    expect(sizes.map((m) => m.label)).toEqual(Object.keys(CANVASES));
    for (const m of sizes)
      expectFilled(
        m,
        CANVASES[m.label as keyof typeof CANVASES],
        m.line,
        0.75 * m.textheight,
      );
    // The wide figure is bound by the line, the tall one by the height.
    expect(sizes[0]!.width).toBeCloseTo(sizes[0]!.line, 1);
    expect(sizes[1]!.height).toBeCloseTo(0.75 * sizes[1]!.textheight, 1);
  });

  it('takes width and height as sides of the box, and scale as the natural size', () => {
    const sizes = measure(
      dir,
      'keys',
      beamer,
      frames([
        String.raw`\measure{height}{\algovizinput[height=.5\textheight]{wide.tex}}`,
        String.raw`\measure{height-narrow}{\algovizinput[height=.5\textheight]{narrow.tex}}`,
        String.raw`\measure{width}{\algovizinput[width=.5\linewidth]{tall.tex}}`,
        String.raw`\measure{width-upright}{\algovizinput[width=.9\linewidth]{upright.tex}}`,
        String.raw`\measure{both}{\algovizinput[width=3cm, height=3cm]{tall.tex}}`,
        String.raw`\measure{scale}{\algovizinput[scale=1]{narrow.tex}}`,
        String.raw`\measure{scale2}{\algovizinput[scale=0.5]{tall.tex}}`,
        String.raw`\algovizset{scale=1}\measure{unset}{\algovizinput[scale]{narrow.tex}}`,
        String.raw`\algovizset{height=2cm}\measure{zero}{\algovizinput[height=0pt]{tall.tex}}`,
      ]),
    );
    const by = Object.fromEntries(sizes.map((m) => [m.label, m]));
    const cm = 72.27 / 2.54;
    expectFilled(
      by['height']!,
      WIDE,
      by['height']!.line,
      0.5 * by['height']!.textheight,
    );
    expectFilled(
      by['height-narrow']!,
      NARROW,
      by['height-narrow']!.line,
      0.5 * by['height-narrow']!.textheight,
    );
    expectFilled(
      by['width']!,
      TALL,
      0.5 * by['width']!.line,
      0.75 * by['width']!.textheight,
    );
    // The upright figure is capped by the slide box's height.
    expectFilled(
      by['width-upright']!,
      UPRIGHT,
      0.9 * by['width-upright']!.line,
      0.75 * by['width-upright']!.textheight,
    );
    expect(by['width-upright']!.height).toBeCloseTo(
      0.75 * by['width-upright']!.textheight,
      1,
    );
    expectFilled(by['both']!, TALL, 3 * cm, 3 * cm);
    for (const [label, canvas, scale] of [
      ['scale', NARROW, 1],
      ['scale2', TALL, 0.5],
    ] as const) {
      const expected = natural(by[label]!, canvas, scale);
      expect(by[label]!.width, label).toBeCloseTo(expected.width, 1);
      expect(by[label]!.height, label).toBeCloseTo(expected.height, 1);
    }
    expectFilled(
      by['unset']!,
      NARROW,
      by['unset']!.line,
      0.75 * by['unset']!.textheight,
    );
    expectFilled(
      by['zero']!,
      TALL,
      by['zero']!.line,
      0.75 * by['zero']!.textheight,
    );
  });

  it('sizes a series as its figure alone, and fills a column', () => {
    const sizes = measure(
      dir,
      'series-deck',
      beamer,
      frames([
        String.raw`\measure{one}{\algovizinput{tall.tex}}`,
        String.raw`\measure{series}{\algovizinput{series.tex}}`,
        String.raw`\begin{columns}\column{.4\textwidth}\measure{column}{\algovizinput{narrow.tex}}\end{columns}`,
      ]),
    );
    // Beamer typesets the frame once per slide of the series.
    const by = Object.fromEntries(sizes.map((m) => [m.label, m]));
    const [one, series, column] = [by['one'], by['series'], by['column']];
    expect(series!.width).toBeCloseTo(one!.width, 2);
    expect(series!.height).toBeCloseTo(one!.height, 2);
    expect(column!.line).toBeLessThan(0.45 * one!.line);
    expectFilled(column!, NARROW, column!.line, 0.75 * column!.textheight);
  });
});

describe('notes keep the sizes of ADR 0027', () => {
  const dir = canvasWorkspace();
  const body = [
    String.raw`\measure{wide}{\algovizinput{wide.tex}}`,
    String.raw`\measure{narrow}{\algovizinput{narrow.tex}}`,
    String.raw`\measure{height}{\algovizinput[height=5cm]{wide.tex}}`,
    String.raw`\measure{scale}{\algovizinput[scale=0.5]{tall.tex}}`,
  ].join('\n\n');

  it.for([
    ['an article', '\\documentclass{article}'],
    [
      'beamerarticle notes',
      '\\documentclass{article}\\usepackage{beamerarticle}',
    ],
  ])('in %s', ([name, documentclass]) => {
    const sizes = measure(dir, name!.replace(/\W/g, '-'), documentclass!, body);
    const [wide, narrow, height, scale] = sizes;
    for (const [m, canvas, factor] of [
      [wide!, WIDE, 1],
      [narrow!, NARROW, 1],
      [scale!, TALL, 0.5],
    ] as const) {
      const expected = natural(m, canvas, factor);
      expect(m.width, m.label).toBeCloseTo(expected.width, 1);
      expect(m.height, m.label).toBeCloseTo(expected.height, 1);
    }
    // A height alone is not capped by the line in notes.
    expect(height!.height).toBeCloseTo((5 * 72.27) / 2.54, 1);
    expect(height!.width).toBeGreaterThan(height!.line);
  });
});

describe.each<Engine>(['pdflatex', 'lualatex'])(
  'registry figures on a 16:9 slide in %s',
  (engine) => {
    it('fill the slide box: Kruskal by its width, Dijkstra by its height', () => {
      const dir = workspace();
      const ids = ['kruskal', 'dijkstra', 'binary-search'];
      const sizes = measure(
        dir,
        'registry',
        '\\documentclass[aspectratio=169]{beamer}',
        frames(ids.map((id) => `\\measure{${id}}{\\algoviz{${id}}{}}`)),
        (file) => latexmk(dir, file, engine),
      );
      expect(calls(dir)).toHaveLength(3);
      expect(sizes.map((m) => m.label)).toEqual(ids);
      for (const m of sizes) {
        expect(m.width, m.label).toBeLessThanOrEqual(m.line + TOLERANCE);
        expect(m.height, m.label).toBeLessThanOrEqual(
          0.75 * m.textheight + TOLERANCE,
        );
      }
      const [kruskal, dijkstra, search] = sizes;
      expect(kruskal!.width).toBeCloseTo(kruskal!.line, 1);
      expect(dijkstra!.height).toBeCloseTo(0.75 * dijkstra!.textheight, 1);
      // Larger than its natural size, a sixteenth of the font size per unit.
      expect(search!.width).toBeCloseTo(search!.line, 1);
      expect(search!.width).toBeGreaterThan(
        1.2 * ((NARROW.width * search!.size) / 16),
      );
    });
  },
);
