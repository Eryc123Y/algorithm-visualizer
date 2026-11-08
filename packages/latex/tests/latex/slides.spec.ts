/**
 * Series as Beamer overlays (ADR 0028): a file of several figures is one
 * picture with one frame per slide, starting where Beamer's incremental
 * count stands or at `start`, and showing the last frame in handouts,
 * transparencies, beamerarticle notes and other documents. The example
 * deck's slides draw the same frames as figures drawn one at a time.
 *
 * Needs what compile.spec.ts needs. Run with npm run test:latex.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadTrace, selectSeries } from '@algoviz/core';
import { runAlgorithm } from '@algoviz/recipes';

import {
  calls,
  document,
  errors,
  examples,
  latexmk,
  pdfText,
  tex,
  workspace,
  type Engine,
} from './helpers.ts';

const WORDS = ['FRAMEA', 'FRAMEB', 'FRAMEC'];

/**
 * A series file as `algoviz export --one-file` writes it, one word per
 * frame, so a page's text tells which frame it shows.
 */
function seriesFile(
  dir: string,
  name: string,
  frames: readonly { word: string; width?: number }[],
): void {
  const figure = ({ word, width = 100 }: { word: string; width?: number }) =>
    [
      `% algoviz figure for LaTeX, format 1: ${word}`,
      `\\algoviz@figure{1}{${width}}{40}{%`,
      '\\algoviz@color{1}{1F2A26}%',
      '}{%',
      `\\algoviz@text{50,25}{c}{12}{0}{label}{algoviz@c1}{}{${word}}`,
      '}%',
    ].join('\n');
  writeFileSync(join(dir, name), `${frames.map(figure).join('\n\n')}\n`);
}

/** A workspace with series.tex, of three frames, and one.tex, of one. */
function seriesWorkspace(): string {
  const dir = workspace();
  seriesFile(
    dir,
    'series.tex',
    WORDS.map((word) => ({ word })),
  );
  seriesFile(dir, 'one.tex', [{ word: 'ALONE' }]);
  return dir;
}

/** A document with the class line and body given. */
function source(
  dir: string,
  name: string,
  documentclass: string,
  body: string,
): string {
  writeFileSync(
    join(dir, `${name}.tex`),
    `${documentclass}\n\\usepackage{algoviz}\n\\begin{document}\n${body}\n\\end{document}\n`,
  );
  return `${name}.tex`;
}

const beamer = (dir: string, name: string, body: string, options = '') =>
  source(dir, name, `\\documentclass[${options}]{beamer}`, body);

/** The text of each page of a PDF. */
const pages = (pdf: string) => pdfText(pdf).split('\f').slice(0, -1);

/** Which frames of series.tex each page shows. */
const shown = (dir: string, name: string) =>
  pages(join(dir, `${name}.pdf`)).map((page) =>
    WORDS.filter((word) => page.includes(word)),
  );

describe('a series file in Beamer', () => {
  const dir = seriesWorkspace();
  const compile = (name: string, body: string, options = '') => {
    const text = tex(dir, beamer(dir, name, body, options), 'off');
    expect(errors(text)).toEqual([]);
    return text;
  };

  it('shows one frame per slide, in order', () => {
    compile('steps', '\\begin{frame}\\algovizinput{series.tex}\\end{frame}');
    expect(shown(dir, 'steps')).toEqual([['FRAMEA'], ['FRAMEB'], ['FRAMEC']]);
  });

  it('starts after a \\pause, as <+> does', () => {
    compile(
      'pause',
      '\\begin{frame}Intro \\pause \\algovizinput{series.tex}\\end{frame}',
    );
    expect(shown(dir, 'pause')).toEqual([
      [],
      ['FRAMEA'],
      ['FRAMEB'],
      ['FRAMEC'],
    ]);
    for (const page of pages(join(dir, 'pause.pdf')))
      expect(page).toContain('Intro');
  });

  it('keeps the last frame while later overlays follow', () => {
    compile(
      'after',
      '\\begin{frame}\\algovizinput{series.tex}\\uncover<+->{Outro}\\end{frame}',
    );
    expect(shown(dir, 'after')).toEqual([
      ['FRAMEA'],
      ['FRAMEB'],
      ['FRAMEC'],
      ['FRAMEC'],
    ]);
    expect(
      pages(join(dir, 'after.pdf')).map((p) => p.includes('Outro')),
    ).toEqual([false, false, false, true]);
  });

  it('starts on the slide start names, and two series step together', () => {
    compile(
      'start',
      '\\begin{frame}\\algovizinput[start=2]{series.tex}\\end{frame}',
    );
    expect(shown(dir, 'start')).toEqual([
      [],
      ['FRAMEA'],
      ['FRAMEB'],
      ['FRAMEC'],
    ]);
    seriesFile(dir, 'other.tex', [
      { word: 'OTHERA' },
      { word: 'OTHERB' },
      { word: 'OTHERC' },
    ]);
    compile(
      'together',
      '\\begin{frame}\\algovizset{start=1}\\algovizinput{series.tex}\\algovizinput{other.tex}\\end{frame}',
    );
    const together = pages(join(dir, 'together.pdf'));
    expect(together).toHaveLength(3);
    together.forEach((page, k) => {
      expect(page).toContain(WORDS[k]);
      expect(page).toContain(`OTHER${'ABC'[k]}`);
    });
  });

  it('shows the last frame in handouts and transparencies', () => {
    for (const mode of ['handout', 'trans']) {
      compile(
        mode,
        '\\begin{frame}\\algovizinput{series.tex}\\end{frame}',
        mode,
      );
      expect(shown(dir, mode), mode).toEqual([['FRAMEC']]);
    }
  });

  it('draws a file of one figure on every slide, as before', () => {
    compile(
      'alone',
      '\\begin{frame}\\algovizinput{one.tex} \\pause Outro\\end{frame}',
    );
    const both = pages(join(dir, 'alone.pdf'));
    expect(both).toHaveLength(2);
    for (const page of both) expect(page).toContain('ALONE');
  });

  it('refuses a start that is not + or a slide number', () => {
    const name = beamer(
      dir,
      'bad-start',
      '\\begin{frame}\\algovizinput[start=0]{series.tex}\\end{frame}',
    );
    expect(tex(dir, name, 'off')).toContain(
      "Package algoviz Error: start takes + or a slide number, not '0'.",
    );
  });
});

describe('steps in a call', () => {
  it('passes the list with --one-file, keyed apart from step', () => {
    const dir = workspace();
    const figure = (keys: string) =>
      `\\algoviz[${keys}]{bubble-sort}{"values": [3, 1, 2]}`;
    const file = document(
      dir,
      'series-keys', // not calls.tex: its log would replace calls.log
      [
        figure('step=0'),
        figure('steps=0'),
        figure('steps={0, swap#1..-1}'),
        // The same list, with \# and without the space: the same key.
        figure('steps={0,swap\\#1..-1}'),
        figure('steps'),
        // step after steps draws one frame again.
        `\\algovizset{steps}${figure('step=-1')}`,
        figure('steps={a;b}'),
      ].join('\n\n'),
    );
    const text = tex(dir, file, 'unrestricted');
    expect(text).toContain(
      "The steps 'a;b' has characters that it cannot have.",
    );
    expect(
      calls(dir).map((c) => c.match(/--step=\S+|--one-file/g)?.join(' ')),
    ).toEqual([
      '--step=0',
      '--step=0 --one-file',
      '--step=0,swap#1..-1 --one-file',
      '--one-file',
      '--step=-1',
    ]);
  });
});

describe('a series file without overlays', () => {
  const dir = seriesWorkspace();

  it('shows the last frame in beamerarticle notes, without a warning', () => {
    const name = source(
      dir,
      'notes',
      '\\documentclass{article}\\usepackage{beamerarticle}',
      '\\begin{frame}\\algovizinput{series.tex}\\end{frame}',
    );
    const text = tex(dir, name, 'off');
    expect(errors(text)).toEqual([]);
    expect(shown(dir, 'notes')).toEqual([['FRAMEC']]);
    expect(text).not.toContain('needs Beamer');
  });

  it('shows the last frame in an article, with a warning', () => {
    const name = source(
      dir,
      'article',
      '\\documentclass{article}',
      '\\algovizinput{series.tex}',
    );
    const text = tex(dir, name, 'off');
    expect(errors(text)).toEqual([]);
    expect(shown(dir, 'article')).toEqual([['FRAMEC']]);
    expect(text).toContain(
      'Package algoviz Warning: A series of 3 frames needs Beamer for its overlays, so only its last frame is drawn.',
    );
  });

  it('sizes the picture to the largest figure of the file', () => {
    seriesFile(dir, 'wide.tex', [{ word: 'WIDE', width: 200 }]);
    seriesFile(dir, 'mixed.tex', [
      { word: 'WIDE', width: 200 },
      { word: 'NARROW', width: 100 },
    ]);
    const name = source(
      dir,
      'sizes',
      '\\documentclass{article}',
      [
        '\\sbox0{\\algovizinput{wide.tex}}\\typeout{SIZE wide \\the\\wd0}',
        '\\sbox0{\\algovizinput{mixed.tex}}\\typeout{SIZE mixed \\the\\wd0}',
      ].join('\n'),
    );
    const text = tex(dir, name, 'off');
    const size = (key: string) =>
      new RegExp(`SIZE ${key} ([\\d.]+pt)`).exec(text)?.[1];
    expect(size('mixed')).toBeDefined();
    expect(size('mixed')).toBe(size('wide'));
  });
});

/** The frames a series names in a run of an algorithm on an input. */
function framesOf(
  id: string,
  input: unknown,
  steps: readonly string[],
): number[] {
  const run = runAlgorithm(id, input);
  if (!run.ok) throw new Error(JSON.stringify(run.error));
  const trace = loadTrace(run.value.document);
  if (!trace.ok) throw new Error(JSON.stringify(trace.error));
  const frames = selectSeries(trace.value.visualization, steps);
  if (!frames.ok) throw new Error(JSON.stringify(frames.error));
  return [...frames.value];
}

const graph: unknown = JSON.parse(
  readFileSync(join(examples, 'graph.json'), 'utf8'),
);
const bst = { from: [8, 3, 10, 1, 6, 4, 7], key: 3 };

// The frames of slides.tex: every frame of Dijkstra, a range after a
// pause, one step, and a section of bst.delete.
const DIJKSTRA = framesOf('dijkstra', graph, []);
const RANGE = framesOf('dijkstra', graph, ['extract#3..improve#5']);
const SECTION = framesOf('bst.delete', bst, ['delete-3']);

/**
 * A deck with the frames of slides.tex drawn one at a time with step=:
 * the same titles and sizes, one Beamer frame per slide.
 */
function oneAtATime(dir: string): string {
  const frame = (title: string, figure: string) =>
    `\\begin{frame}{${title}}\n  \\centering\n  ${figure}\n\\end{frame}`;
  const body = [
    ...DIJKSTRA.map((f) =>
      frame(
        "Dijkstra's algorithm, step by step",
        `\\algovizfile[algorithm=dijkstra, step=${f}]{graph.json}`,
      ),
    ),
    ...SECTION.map((f) =>
      frame(
        'Deleting $3$ from a binary search tree',
        `\\algoviz[step=${f}, theme=print]{bst.delete}{"from": [8, 3, 10, 1, 6, 4, 7], "key": 3}`,
      ),
    ),
  ];
  writeFileSync(
    join(dir, 'reference.tex'),
    `\\documentclass{beamer}\n\\usepackage{algoviz}\n\\algovizset{height=0.72\\textheight}\n\\begin{document}\n${body.join('\n')}\n\\end{document}\n`,
  );
  return 'reference.tex';
}

describe.each<Engine>(['pdflatex', 'lualatex'])(
  'slides.tex in %s',
  (engine) => {
    const dir = workspace();
    const slides = DIJKSTRA.length + 1 + RANGE.length + 1 + SECTION.length;

    it('calls algoviz once per series or figure, and makes a slide per frame', () => {
      const text = latexmk(dir, 'slides.tex', engine);
      expect(errors(text)).toEqual([]);
      expect(calls(dir)).toHaveLength(4);
      const series = calls(dir).filter((c) => c.includes('--one-file'));
      expect(series).toHaveLength(3);
      expect(series.some((c) => c.includes('--step='))).toBe(true);
      expect(
        calls(dir).filter((c) => c.includes('--step=relax#6')),
      ).toHaveLength(1);
      expect(pages(join(dir, 'slides.pdf'))).toHaveLength(slides);
    });

    it('draws on each slide the frame that step= draws alone', () => {
      latexmk(dir, oneAtATime(dir), engine);
      const reference = pages(join(dir, 'reference.pdf'));
      const deck = pages(join(dir, 'slides.pdf'));
      const sectionStart = DIJKSTRA.length + 1 + RANGE.length + 1;
      expect(deck.slice(0, DIJKSTRA.length)).toEqual(
        reference.slice(0, DIJKSTRA.length),
      );
      expect(deck.slice(sectionStart)).toEqual(
        reference.slice(DIJKSTRA.length),
      );
      // Consecutive frames differ, so the comparison means something.
      expect(new Set(deck.slice(0, DIJKSTRA.length)).size).toBeGreaterThan(
        DIJKSTRA.length / 2,
      );
    });

    it('starts the range after its \\pause', () => {
      const deck = pages(join(dir, 'slides.pdf'));
      const range = deck.slice(
        DIJKSTRA.length,
        DIJKSTRA.length + 1 + RANGE.length,
      );
      for (const page of range) expect(page).toContain('The queue hands out');
      // The first slide has the text alone; the figure's labels come after.
      for (const page of range.slice(1))
        expect(page.length).toBeGreaterThan(range[0]!.length + 10);
    });

    it('reads every series from the cache on the next run', () => {
      const before = calls(dir).length;
      const text = latexmk(dir, 'slides.tex', engine, 'unrestricted', true);
      expect(errors(text)).toEqual([]);
      expect(calls(dir)).toHaveLength(before);
    });
  },
);

describe('slides.tex as a handout', () => {
  it('shows each series at its last frame, one page per frame', () => {
    const dir = workspace();
    writeFileSync(
      join(dir, 'handout.tex'),
      `\\PassOptionsToClass{handout}{beamer}\\input{slides.tex}\n`,
    );
    const text = latexmk(dir, 'handout.tex', 'pdflatex');
    expect(errors(text)).toEqual([]);
    const handout = pages(join(dir, 'handout.pdf'));
    expect(handout).toHaveLength(4);
    latexmk(dir, oneAtATime(dir), 'pdflatex');
    const reference = pages(join(dir, 'reference.pdf'));
    expect(handout[0]).toBe(reference[DIJKSTRA.length - 1]);
    expect(handout[3]).toBe(reference.at(-1));
  });
});
