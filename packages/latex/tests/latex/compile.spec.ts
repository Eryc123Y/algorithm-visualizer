/**
 * The LaTeX package in TeX (ADR 0027): the examples compile with pdfLaTeX,
 * LuaLaTeX and XeLaTeX through latexmk, figures are made once and read
 * from the cache afterwards, also without shell escape, and every failure
 * has a clear message and a box in the document.
 *
 * Needs TeX Live 2024 or later with latexmk, pdftotext and pdffonts. The
 * command is the Node CLI from source, or the executable that
 * ALGOMOTION_COMMAND names, such as packages/mcp/dist/standalone/algomotion.
 * Run with npm run test:latex.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { themeNames } from '@algomotion/svg';

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

/** Whether the `count` cached figures of `dir` are one drawing. */
function sameFigures(dir: string, count: number): boolean {
  const figures = cached(dir).map((f) =>
    readFileSync(join(dir, '_algomotion', f), 'utf8'),
  );
  return figures.length === count && new Set(figures).size === 1;
}

// The notes make five figures: two of Dijkstra, two of bubble sort and one
// of a document.
const NOTES_FIGURES = 5;

describe.each<Engine>(['pdflatex', 'lualatex', 'xelatex'])(
  'notes.tex in %s',
  (engine) => {
    const dir = workspace();

    it('compiles, calling algomotion once per figure', () => {
      const text = latexmk(dir, 'notes.tex', engine);
      expect(errors(text)).toEqual([]);
      expect(existsSync(join(dir, 'notes.pdf'))).toBe(true);
      expect(calls(dir)).toHaveLength(NOTES_FIGURES);
      expect(cached(dir)).toHaveLength(NOTES_FIGURES);
      // Every call is a TikZ export through the package's checked arguments.
      for (const call of calls(dir))
        expect(call).toMatch(
          /^export .* --format=tikz --out=_algomotion --name=[0-9a-f]{32} --error-file=_algomotion\/[0-9a-f]{32}\.err$/,
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
        '\\algomotion[step=swap#2]{bubble-sort}{"values": [3, 1, 2]}',
        '\\algomotion[step=swap\\#2]{bubble-sort}{"values": [3, 1, 2]}',
        '\\newcommand\\fig{\\algomotion[step=swap##2]{bubble-sort}{"values": [3, 1, 2]}}\\fig',
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
        '\\algomotion{balanced-brackets}{{"text": "(a\\%b)"}}',
        '\\algomotion{balanced-brackets}{"text": "(a\\%b)"}',
      ].join('\n\n'),
    );
    expect(errors(tex(dir, file, 'unrestricted'))).toEqual([]);
    // The command adds the braces (ADR 0032): two inputs as written, one
    // drawing.
    expect(sameFigures(dir, 2)).toBe(true);
    expect(pdfText(join(dir, 'input.pdf'))).toContain('%');
  });

  it('takes notations, the main field alone, and no input (ADR 0032)', () => {
    const dir = workspace();
    const graph =
      '{"nodes": ["A", "B", "C", "D"], "edges": [["A", "B", 4], ["B", "C", 1], ["A", "C", 7], ["C", "D", 2]]}';
    const file = document(
      dir,
      'notations',
      [
        '\\algomotion[step=improve\\#3]{dijkstra}{A-B 4, B-C 1, A-C 7, C-D 2}',
        `\\algomotion[step=improve\\#3]{dijkstra}{"graph": ${graph}, "source": "A"}`,
        '\\algomotion[step=improve\\#3]{dijkstra}{"graph": "A-B 4,\n  B-C 1, A-C 7, C-D 2"}',
      ].join('\n\n'),
    );
    expect(errors(tex(dir, file, 'unrestricted'))).toEqual([]);
    expect(sameFigures(dir, 3)).toBe(true);

    const more = workspace();
    const others = document(
      more,
      'others',
      [
        '\\algomotion{insertion-sort}{5 2 4 6 1 3}',
        '\\algomotion{bst}{"from": "8 3 10 1 6", "ops": "insert 4, delete 3"}',
        '\\algomotion{inorder-tree-walk}{[4, 2, 6, 1, 3, null, 7]}',
        '\\algomotion{kruskal}{}',
      ].join('\n\n'),
    );
    expect(errors(tex(more, others, 'unrestricted'))).toEqual([]);
    expect(cached(more)).toHaveLength(4);
  });

  it('shows a notation error with its token', () => {
    const dir = workspace();
    const file = document(
      dir,
      'bad-notation',
      '\\algomotion{dijkstra}{A-B 4, B-C x}',
    );
    const text = tex(dir, file, 'unrestricted');
    expect(text).toContain(
      'Package algomotion Error: algomotion could not make the figure: INVALID_NOTATION',
    );
    const pdf = pdfText(join(dir, 'bad-notation.pdf'));
    expect(pdf).toContain('INVALID_NOTATION');
    expect(pdf).toContain('character 12');
  });

  it('passes JSON escapes in strings through TeX', () => {
    const dir = workspace();
    const file = document(
      dir,
      'escapes',
      [
        '\\algomotion{balanced-brackets}{"text": "(\\u0041[\\n])"}',
        '\\algomotion{balanced-brackets}{"text": "(A[\\n])"}',
      ].join('\n\n'),
    );
    expect(errors(tex(dir, file, 'unrestricted'))).toEqual([]);
    // The escape of A is A: two calls, one drawing.
    const figures = cached(dir).map((f) =>
      readFileSync(join(dir, '_algomotion', f), 'utf8'),
    );
    expect(figures).toHaveLength(2);
    expect(figures[0]).toBe(figures[1]);
  });

  it('sizes figures by width, height or scale', () => {
    const dir = workspace();
    const fig = (keys: string) =>
      `\\algomotion[${keys}]{bubble-sort}{"values": [3, 1, 2]}`;
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
    const file = document(dir, 'dash', '\\algomotionfile[step=0]{-bst.json}');
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
      '\\algomotionfile[algorithm=dijkstra]{a!b.json}',
    );
    expect(tex(dir, name, 'unrestricted')).toContain(
      "The file name 'a!b.json' has characters that it cannot have.",
    );
    const cache = document(
      dir,
      'cache',
      '\\algomotion{bubble-sort}{"values": [2, 1]}',
    );
    writeFileSync(
      join(dir, cache),
      readFileSync(join(dir, cache), 'utf8').replace(
        '\\usepackage{algomotion}',
        '\\usepackage[cachedir={a;b}]{algomotion}',
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

  it('draws figures that algomotion export made by hand', () => {
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
      '\\algomotioninput[width=5cm]{figures/relax.tex}',
    );
    expect(errors(tex(dir, file, 'off'))).toEqual([]);
    expect(calls(dir)).toEqual([]);
  });

  it('refuses a figure file of another format, naming both', () => {
    const dir = workspace();
    writeFileSync(
      join(dir, 'old.tex'),
      '\\algomotion@figure{1}{100}{40}{%\n\\algomotion@color{1}{1F2A26}%\n}{%\n}%\n',
    );
    const file = document(dir, 'old-format', '\\algomotioninput{old.tex}');
    expect(tex(dir, file, 'off')).toContain(
      "The figure 'old.tex' has format 1, but this package reads format 2.",
    );
  });

  it('shows the engine’s errors in the document, with the step names', () => {
    const dir = workspace();
    const file = document(
      dir,
      'bad-step',
      '\\algomotion[step=nope]{bubble-sort}{"values": [2, 1]}',
    );
    const text = tex(dir, file, 'unrestricted');
    expect(text).toContain(
      'Package algomotion Error: algomotion could not make the figure: NO_MATCH',
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
        '\\algomotion[step={a;b}]{bubble-sort}{"values": [2, 1]}',
        '\\algomotion[theme={x y}]{bubble-sort}{"values": [2, 1]}',
        '\\algomotion{bubble-sort; rm}{"values": [2, 1]}',
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
      '\\algomotion{bubble-sort}{"values": [2, 1]}',
    );
    const text = tex(dir, file, 'off');
    expect(text).toContain(
      'Shell escape is off, so the figure of bubble-sort cannot be made.',
    );
    expect(pdfText(join(dir, 'off.pdf'))).toContain('shell escape is off');
  });

  it('says when restricted shell escape does not run algomotion', () => {
    const dir = workspace();
    const file = document(
      dir,
      'restricted',
      '\\algomotion{bubble-sort}{"values": [2, 1]}',
    );
    const text = tex(dir, file, 'restricted');
    expect(text).toContain('Restricted shell escape did not run algomotion');
    expect(calls(dir)).toEqual([]);
  });

  it('says when the command is missing', () => {
    const dir = workspace();
    const file = document(
      dir,
      'missing',
      '\\algomotion{bubble-sort}{"values": [2, 1]}',
    );
    writeFileSync(
      join(dir, file),
      readFileSync(join(dir, file), 'utf8').replace(
        '\\usepackage{algomotion}',
        '\\usepackage[command=algomotion-that-is-not-installed]{algomotion}',
      ),
    );
    spawnSync('pdflatex', ['-shell-escape', '-interaction=nonstopmode', file], {
      cwd: dir,
      env,
      encoding: 'utf8',
    });
    const text = log(dir, file);
    expect(text).toContain(
      "Package algomotion Error: The command 'algomotion-that-is-not-installed' made no figure.",
    );
    expect(pdfText(join(dir, 'missing.pdf'))).toContain('Is it installed?');
  });

  it('draws every built-in theme in the families it names (ADR 0030)', () => {
    const dir = workspace();
    const figure = (theme: string) =>
      `\\algomotion[theme=${theme}, step=3]{bubble-sort}{"values": [3, 1, 2]}`;
    const file = document(dir, 'themes', themeNames.map(figure).join('\n\n'));
    for (const engine of ['pdflatex', 'lualatex', 'xelatex'] as const)
      expect(
        errors(tex(dir, file, 'unrestricted', '', engine)),
        engine,
      ).toEqual([]);
    // One call per theme; the second and third engines read the cache.
    expect(calls(dir)).toHaveLength(themeNames.length);
    const fonts = (name: string, body: string) => {
      const one = document(dir, name, body);
      expect(errors(tex(dir, one, 'unrestricted'))).toEqual([]);
      return spawnSync('pdffonts', [join(dir, `${name}.pdf`)], {
        encoding: 'utf8',
      }).stdout;
    };
    // Turbo C sets everything in the typewriter family, blocks in sans.
    const typewriter = fonts('turbo-c', figure('turbo-c'));
    expect(typewriter).toMatch(/LMMono|CMTT|lmmono/i);
    expect(typewriter).not.toMatch(/LMSans|CMSS|lmsans/i);
    const sans = fonts('blocks', figure('blocks'));
    expect(sans).toMatch(/LMSans|CMSS|lmsans/i);
    expect(sans).not.toMatch(/LMMono|CMTT|lmmono/i);
    // A font key still overrides the theme's family.
    expect(
      fonts(
        'override',
        `\\algomotionset{value font=\\sffamily, label font=\\sffamily}\n${figure('turbo-c')}`,
      ),
    ).not.toMatch(/LMMono|CMTT|lmmono/i);
  });

  it('runs every engine on a document with characters outside ASCII', () => {
    const dir = workspace();
    const file = document(
      dir,
      'symbols',
      // ∞ in a node label, and Greek and ∅ in a bracket text.
      [
        '\\algomotion[step=0]{dijkstra}{"graph": {"nodes": ["A", "B"], "edges": [["A", "B", 1]]}, "source": "A"}',
        '\\algomotion{balanced-brackets}{"text": "(αβ)∅[x]"}',
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
