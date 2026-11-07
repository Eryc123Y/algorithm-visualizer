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
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const examples = join(repo, 'packages/latex/examples');
const command =
  process.env['ALGOVIZ_COMMAND'] ??
  [
    process.execPath,
    '--no-warnings',
    '--conditions=@algoviz/source',
    join(repo, 'packages/mcp/src/algoviz.ts'),
  ].join(' ');

type Engine = 'pdflatex' | 'lualatex' | 'xelatex';
type Shell = 'unrestricted' | 'restricted' | 'off';

const LATEXMK: Readonly<Record<Engine, string>> = {
  pdflatex: '-pdf',
  lualatex: '-pdflua',
  xelatex: '-pdfxe',
};

/**
 * A fresh directory with the examples and a command that logs each call
 * to calls.log before running algoviz.
 */
function workspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'algoviz-latex-'));
  for (const file of readdirSync(examples))
    copyFileSync(join(examples, file), join(dir, file));
  const wrapper = join(dir, 'algoviz-calls');
  writeFileSync(
    wrapper,
    `#!/bin/sh\necho "$@" >> "${join(dir, 'calls.log')}"\nexec ${command} "$@"\n`,
  );
  chmodSync(wrapper, 0o755);
  return dir;
}

const env = {
  ...process.env,
  TEXINPUTS: `${join(repo, 'packages/latex/package')}//:`,
};

const pretex = (dir: string, options = '') =>
  `\\PassOptionsToPackage{command=${join(dir, 'algoviz-calls')}${options}}{algoviz}`;

/** Compiles with latexmk, as users do; `force` runs TeX again anyway. */
function latexmk(
  dir: string,
  file: string,
  engine: Engine,
  shell: Exclude<Shell, 'restricted'> = 'unrestricted',
  force = false,
): string {
  spawnSync(
    'latexmk',
    [
      LATEXMK[engine],
      shell === 'off' ? '-no-shell-escape' : '-shell-escape',
      '-interaction=nonstopmode',
      ...(force ? ['-g'] : []),
      `-usepretex=${pretex(dir)}`,
      file,
    ],
    { cwd: dir, env, encoding: 'utf8' },
  );
  return log(dir, file);
}

/** Compiles once with an engine, for the cases latexmk cannot set up. */
function tex(
  dir: string,
  file: string,
  shell: Shell,
  options = '',
  engine: Engine = 'pdflatex',
): string {
  const flag = {
    unrestricted: '-shell-escape',
    restricted: '-shell-restricted',
    off: '-no-shell-escape',
  }[shell];
  spawnSync(
    engine,
    [
      flag,
      '-interaction=nonstopmode',
      `${pretex(dir, options)}\\input{${file}}`,
    ],
    { cwd: dir, env, encoding: 'utf8' },
  );
  return log(dir, file);
}

/** A log, with the lines TeX broke at 79 characters joined again. */
const log = (dir: string, file: string) =>
  readFileSync(join(dir, file.replace(/\.tex$/, '.log')), 'utf8')
    .split('\n')
    .reduce<string[]>((lines, line) => {
      const last = lines.at(-1);
      if (last !== undefined && last.length > 0 && last.length % 79 === 0)
        lines[lines.length - 1] = last + line;
      else lines.push(line);
      return lines;
    }, [])
    .join('\n')
    // l3msg wraps messages itself, continuing them after "(algoviz)".
    .replace(/\n\(algoviz\)\s+/g, ' ');

/** The lines of a log that report errors. */
const errors = (text: string) =>
  text.split('\n').filter((line) => line.startsWith('!'));

const calls = (dir: string) =>
  existsSync(join(dir, 'calls.log'))
    ? readFileSync(join(dir, 'calls.log'), 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
    : [];

const cached = (dir: string) =>
  existsSync(join(dir, '_algoviz'))
    ? readdirSync(join(dir, '_algoviz')).filter((f) => f.endsWith('.tex'))
    : [];

const pdfText = (pdf: string) =>
  spawnSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).stdout;

/** A document of its own: the figures given, after the preamble. */
function document(dir: string, name: string, body: string): string {
  const file = `${name}.tex`;
  writeFileSync(
    join(dir, file),
    `\\documentclass{article}\n\\usepackage{algoviz}\n\\begin{document}\n${body}\n\\end{document}\n`,
  );
  return file;
}

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
      for (const label of ['A', 'B', 'F', '14', '22'])
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

describe('slides.tex in Beamer', () => {
  it('compiles, with # written \\# in a frame and # in a fragile one', () => {
    const dir = workspace();
    const text = latexmk(dir, 'slides.tex', 'pdflatex');
    expect(errors(text)).toEqual([]);
    expect(calls(dir)).toHaveLength(3);
    expect(calls(dir).filter((c) => c.includes('--step=relax#'))).toHaveLength(
      2,
    );
  });
});

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
