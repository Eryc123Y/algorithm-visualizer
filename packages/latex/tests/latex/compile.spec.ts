/**
 * The LaTeX package in TeX (ADR 0027): the examples compile with pdfLaTeX,
 * LuaLaTeX and XeLaTeX through latexmk, figures are made once and read
 * from the cache afterwards, also without shell escape, and every failure
 * has a clear message and a box in the document.
 *
 * Needs TeX Live 2024 or later with latexmk, pdftotext and pdffonts. The
 * command is the Node CLI from source, or the executable that
 * ALGOVIZ_COMMAND names, such as packages/mcp/dist/standalone/algoviz.
 * Run with npm run test:latex.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  cached,
  calls,
  command,
  document,
  env,
  errors,
  latexmk,
  log,
  pdfText,
  tex,
  workspace,
  type Engine,
} from './helpers.ts';

// The notes make five figures: two of Dijkstra, two of bubble sort and one
// of a document.
const NOTES_FIGURES = 5;

describe.each<Engine>(['pdflatex', 'lualatex', 'xelatex'])(
  'notes.tex in %s',
  (engine) => {
    const dir = workspace();

    it('compiles, calling algoviz once per figure', () => {
      const text = latexmk(dir, 'notes.tex', engine);
      expect(errors(text)).toEqual([]);
      expect(existsSync(join(dir, 'notes.pdf'))).toBe(true);
      expect(calls(dir)).toHaveLength(NOTES_FIGURES);
      expect(cached(dir)).toHaveLength(NOTES_FIGURES);
      // Every call is a TikZ export through the package's checked arguments.
      for (const call of calls(dir))
        expect(call).toMatch(
          /^export .* --format=tikz --out=_algoviz --name=[0-9a-f]{32} --error-file=_algoviz\/[0-9a-f]{32}\.err$/,
        );
    });

    it('sets the text of figures in the document fonts', () => {
      const fonts = spawnSync('pdffonts', [join(dir, 'notes.pdf')], {
        encoding: 'utf8',
      }).stdout;
      expect(fonts).not.toMatch(/JetBrains|Inter/);
      expect(fonts).toMatch(/LMRoman|CMR|LatinModern|lmroman/i);
      // Node names and distances are real text.
      const text = pdfText(join(dir, 'notes.pdf'));
      for (const label of ['A', 'B', 'F', '14', '11'])
        expect(text).toContain(label);
    });

    it('reads every figure from the cache on the next run', () => {
      const text = latexmk(dir, 'notes.tex', engine, 'unrestricted', true);
      expect(errors(text)).toEqual([]);
      expect(calls(dir)).toHaveLength(NOTES_FIGURES);
    });

    it('needs no shell escape for cached figures', () => {
      const text = latexmk(dir, 'notes.tex', engine, 'off', true);
      expect(errors(text)).toEqual([]);
      expect(calls(dir)).toHaveLength(NOTES_FIGURES);
    });
  },
);

describe('the package', () => {
  it('spells a step with # or \\#, and both name one figure', () => {
    const dir = workspace();
    const file = document(
      dir,
      'hash',
      [
        '\\algoviz[step=swap#2]{bubble-sort}{"values": [3, 1, 2]}',
        '\\algoviz[step=swap\\#2]{bubble-sort}{"values": [3, 1, 2]}',
        '\\newcommand\\fig{\\algoviz[step=swap##2]{bubble-sort}{"values": [3, 1, 2]}}\\fig',
      ].join('\n\n'),
    );
    expect(errors(tex(dir, file, 'unrestricted'))).toEqual([]);
    expect(calls(dir)).toEqual([expect.stringContaining('--step=swap#2')]);
  });

  it('takes an object without its braces, and the escapes TeX needs', () => {
    const dir = workspace();
    const file = document(
      dir,
      'input',
      [
        '\\algoviz{balanced-brackets}{{"text": "(a\\%b)"}}',
        '\\algoviz{balanced-brackets}{"text": "(a\\%b)"}',
      ].join('\n\n'),
    );
    expect(errors(tex(dir, file, 'unrestricted'))).toEqual([]);
    expect(calls(dir)).toHaveLength(1);
    expect(pdfText(join(dir, 'input.pdf'))).toContain('%');
  });

  it('passes JSON escapes in strings through TeX', () => {
    const dir = workspace();
    const file = document(
      dir,
      'escapes',
      [
        '\\algoviz{balanced-brackets}{"text": "(\\u0041[\\n])"}',
        '\\algoviz{balanced-brackets}{"text": "(A[\\n])"}',
      ].join('\n\n'),
    );
    expect(errors(tex(dir, file, 'unrestricted'))).toEqual([]);
    // The escape of A is A: two calls, one drawing.
    const figures = cached(dir).map((f) =>
      readFileSync(join(dir, '_algoviz', f), 'utf8'),
    );
    expect(figures).toHaveLength(2);
    expect(figures[0]).toBe(figures[1]);
  });

  it('sizes figures by width, height or scale', () => {
    const dir = workspace();
    const fig = (keys: string) =>
      `\\algoviz[${keys}]{bubble-sort}{"values": [3, 1, 2]}`;
    const file = document(
      dir,
      'sizes',
      [
        `\\sbox0{${fig('width=5cm')}}\\typeout{SIZE width \\the\\wd0}`,
        `\\sbox0{${fig('height=2cm')}}\\typeout{SIZE height \\the\\dimexpr\\ht0+\\dp0\\relax}`,
        `\\sbox0{${fig('')}}\\typeout{SIZE natural \\the\\wd0}`,
        `\\sbox0{${fig('scale=0.5')}}\\typeout{SIZE half \\the\\wd0}`,
      ].join('\n'),
    );
    const text = tex(dir, file, 'unrestricted');
    expect(errors(text)).toEqual([]);
    const size = (name: string) =>
      Number(new RegExp(`SIZE ${name} ([\\d.]+)pt`).exec(text)?.[1]);
    expect(size('width')).toBeCloseTo(142.26, 0);
    expect(size('height')).toBeCloseTo(56.91, 0);
    expect(size('half') / size('natural')).toBeCloseTo(0.5, 2);
    // One run, one call: sizes are applied when a figure is drawn.
    expect(calls(dir)).toHaveLength(1);
  });

  it('reads a file whose name starts with -', () => {
    const dir = workspace();
    copyFileSync(join(dir, 'bst-delete.json'), join(dir, '-bst.json'));
    const file = document(dir, 'dash', '\\algovizfile[step=0]{-bst.json}');
    expect(errors(tex(dir, file, 'unrestricted'))).toEqual([]);
    expect(calls(dir)).toEqual([
      expect.stringMatching(/^export \.\/-bst\.json /),
    ]);
  });

  it('refuses a file name or cache directory the shell would read', () => {
    const dir = workspace();
    copyFileSync(join(dir, 'graph.json'), join(dir, 'a!b.json'));
    const name = document(
      dir,
      'name',
      '\\algovizfile[algorithm=dijkstra]{a!b.json}',
    );
    expect(tex(dir, name, 'unrestricted')).toContain(
      "The file name 'a!b.json' has characters that it cannot have.",
    );
    const cache = document(
      dir,
      'cache',
      '\\algoviz{bubble-sort}{"values": [2, 1]}',
    );
    writeFileSync(
      join(dir, cache),
      readFileSync(join(dir, cache), 'utf8').replace(
        '\\usepackage{algoviz}',
        '\\usepackage[cachedir={a;b}]{algoviz}',
      ),
    );
    spawnSync(
      'pdflatex',
      ['-shell-escape', '-interaction=nonstopmode', cache],
      {
        cwd: dir,
        env,
        encoding: 'utf8',
      },
    );
    expect(log(dir, cache)).toContain(
      "The cache directory 'a;b' has characters that it cannot have.",
    );
    expect(calls(dir)).toEqual([]);
  });

  it('draws figures that algoviz export made by hand', () => {
    const dir = workspace();
    spawnSync(
      'sh',
      [
        '-c',
        `${command} export dijkstra --input graph.json --step='relax#2' --format=tikz --out figures --name relax`,
      ],
      { cwd: dir },
    );
    const file = document(
      dir,
      'by-hand',
      '\\algovizinput[width=5cm]{figures/relax.tex}',
    );
    expect(errors(tex(dir, file, 'off'))).toEqual([]);
    expect(calls(dir)).toEqual([]);
  });

  it('shows the engine’s errors in the document, with the step names', () => {
    const dir = workspace();
    const file = document(
      dir,
      'bad-step',
      '\\algoviz[step=nope]{bubble-sort}{"values": [2, 1]}',
    );
    const text = tex(dir, file, 'unrestricted');
    expect(text).toContain(
      'Package algoviz Error: algoviz could not make the figure: NO_MATCH',
    );
    const pdf = pdfText(join(dir, 'bad-step.pdf'));
    expect(pdf).toContain('NO_MATCH');
    expect(pdf).toContain('Step names: compare, swap');
    // Errors are not cached: the next run asks again.
    tex(dir, file, 'unrestricted');
    expect(calls(dir)).toHaveLength(2);
  });

  it('refuses arguments with characters the shell would read, and runs nothing', () => {
    const dir = workspace();
    const file = document(
      dir,
      'shell',
      [
        '\\algoviz[step={a;b}]{bubble-sort}{"values": [2, 1]}',
        '\\algoviz[theme={x y}]{bubble-sort}{"values": [2, 1]}',
        '\\algoviz{bubble-sort; rm}{"values": [2, 1]}',
      ].join('\n\n'),
    );
    const text = tex(dir, file, 'unrestricted');
    expect(text).toContain(
      "The step 'a;b' has characters that it cannot have.",
    );
    expect(text).toContain(
      "The theme 'x y' has characters that it cannot have.",
    );
    expect(text).toContain("The algorithm id 'bubble-sort; rm' has characters");
    expect(calls(dir)).toEqual([]);
  });

  it('says when shell escape is off', () => {
    const dir = workspace();
    const file = document(
      dir,
      'off',
      '\\algoviz{bubble-sort}{"values": [2, 1]}',
    );
    const text = tex(dir, file, 'off');
    expect(text).toContain(
      'Shell escape is off, so the figure of bubble-sort cannot be made.',
    );
    expect(pdfText(join(dir, 'off.pdf'))).toContain('shell escape is off');
  });

  it('says when restricted shell escape does not run algoviz', () => {
    const dir = workspace();
    const file = document(
      dir,
      'restricted',
      '\\algoviz{bubble-sort}{"values": [2, 1]}',
    );
    const text = tex(dir, file, 'restricted');
    expect(text).toContain('Restricted shell escape did not run algoviz');
    expect(calls(dir)).toEqual([]);
  });

  it('says when the command is missing', () => {
    const dir = workspace();
    const file = document(
      dir,
      'missing',
      '\\algoviz{bubble-sort}{"values": [2, 1]}',
    );
    writeFileSync(
      join(dir, file),
      readFileSync(join(dir, file), 'utf8').replace(
        '\\usepackage{algoviz}',
        '\\usepackage[command=algoviz-that-is-not-installed]{algoviz}',
      ),
    );
    spawnSync('pdflatex', ['-shell-escape', '-interaction=nonstopmode', file], {
      cwd: dir,
      env,
      encoding: 'utf8',
    });
    const text = log(dir, file);
    expect(text).toContain(
      "Package algoviz Error: The command 'algoviz-that-is-not-installed' made no figure.",
    );
    expect(pdfText(join(dir, 'missing.pdf'))).toContain('Is it installed?');
  });

  it('runs every engine on a document with characters outside ASCII', () => {
    const dir = workspace();
    const file = document(
      dir,
      'symbols',
      // ∞ in a node label, and Greek and ∅ in a bracket text.
      [
        '\\algoviz[step=0]{dijkstra}{"graph": {"nodes": ["A", "B"], "edges": [["A", "B", 1]]}, "source": "A"}',
        '\\algoviz{balanced-brackets}{"text": "(αβ)∅[x]"}',
      ].join('\n\n'),
    );
    for (const engine of ['pdflatex', 'lualatex', 'xelatex'] as const) {
      const text = tex(dir, file, 'unrestricted', '', engine);
      expect(errors(text), engine).toEqual([]);
    }
    // The second and third engines found the figures cached.
    expect(calls(dir)).toHaveLength(2);
  });
});
