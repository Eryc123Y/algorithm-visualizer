import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { selectFrame } from '@algoviz/core';
import { findAlgorithm, runAlgorithm } from '@algoviz/recipes';

import { main } from '../src/cli.ts';

const dir = mkdtempSync(join(tmpdir(), 'algoviz-export-'));
let outs = 0;
/** A fresh output directory, not created yet. */
const outDir = () => join(dir, `out-${++outs}`);

function run(...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = main(
    argv,
    (t) => out.push(t),
    (t) => err.push(t),
  );
  return { code, out: out.join('\n'), err: err.join('\n') };
}

function documentOf(id: string, input?: unknown) {
  const result = runAlgorithm(id, input ?? findAlgorithm(id)!.examples[0]);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value.document;
}

// bst: insert 4 (steps 0–3), search 6 (4–6), delete 3 (7–12); frames 0–13.
const bstFile = join(dir, 'bst.json');
writeFileSync(bstFile, JSON.stringify(documentOf('bst')));

const dijkstraInput = findAlgorithm('dijkstra')!.examples[0];
const inputFile = join(dir, 'input.json');
writeFileSync(inputFile, JSON.stringify(dijkstraInput));

const files = (d: string) => readdirSync(d).toSorted();
const sizeOf = (svg: string) =>
  /^<svg [^>]*width="([\d.]+)" height="([\d.]+)"/.exec(svg)!.slice(1);

describe('algoviz export', () => {
  it('writes every frame of a document, named {name}-{frame}', () => {
    const out = outDir();
    const result = run('export', bstFile, '--out', out);
    expect(result).toMatchObject({ code: 0, err: '' });
    const expected = Array.from(
      { length: 14 },
      (_, k) => `bst-${String(k).padStart(2, '0')}.svg`,
    );
    expect(files(out)).toEqual(expected);
    const lines = result.out.split('\n');
    expect(lines).toHaveLength(14);
    expect(lines[0]).toBe(`${join(out, 'bst-00.svg')}  0`);
    expect(lines[5]).toBe(`${join(out, 'bst-05.svg')}  search-6/go`);
    const svg = readFileSync(join(out, 'bst-05.svg'), 'utf8');
    expect(svg).toMatch(/^<svg xmlns/);
    expect(svg).not.toContain('<text');
    expect(svg).toContain('<desc>');
  });

  it('selects sections, steps and ranges, repeated or comma-separated', () => {
    const out = outDir();
    const result = run(
      'export',
      bstFile,
      '--step',
      'search-6',
      '--step=delete-3/left,-1',
      '--out',
      out,
    );
    expect(result.code).toBe(0);
    // search-6 is frames 4–7; the first "left" of delete-3 is step 7.
    expect(files(out)).toEqual(
      [4, 5, 6, 7, 8, 13].map((f) => `bst-${String(f).padStart(2, '0')}.svg`),
    );
    expect(run('export', bstFile, '--step', '2..4', '--out', out).code).toBe(0);
  });

  it('gives every figure of a document one size, alone or in a series', () => {
    const all = outDir();
    const one = outDir();
    expect(run('export', bstFile, '--out', all).code).toBe(0);
    const sizes = new Set(
      files(all).map((f) =>
        sizeOf(readFileSync(join(all, f), 'utf8')).join('x'),
      ),
    );
    expect(sizes.size).toBe(1);
    expect(run('export', bstFile, '--step', '9', '--out', one).code).toBe(0);
    expect(readFileSync(join(one, 'bst-09.svg'), 'utf8')).toBe(
      readFileSync(join(all, 'bst-09.svg'), 'utf8'),
    );
  });

  it('runs a registry algorithm on an input file', () => {
    const out = outDir();
    const result = run(
      'export',
      'dijkstra',
      '--input',
      inputFile,
      '--step',
      'relax#3',
      '--out',
      out,
    );
    expect(result).toMatchObject({ code: 0, err: '' });
    const frame = selectFrame(documentOf('dijkstra'), 'relax#3');
    if (!frame.ok) throw new Error('relax#3 should exist');
    const name = `dijkstra-${String(frame.value).padStart(2, '0')}.svg`;
    expect(files(out)).toEqual([name]);
    expect(result.out).toBe(`${join(out, name)}  relax#3`);
  });

  it('takes the input as JSON text, and names files by step', () => {
    const out = outDir();
    const input = { from: [8, 3, 10], key: 5 };
    const result = run(
      'export',
      'bst.insert',
      '--input',
      JSON.stringify(input),
      '--name',
      '{name}_{step}',
      '--theme',
      'print',
      '--out',
      out,
    );
    expect(result.code).toBe(0);
    const doc = documentOf('bst.insert', input);
    expect(files(out)).toHaveLength(doc.steps.length + 1);
    expect(files(out)).toContain('bst.insert_0.svg');
    for (const f of files(out))
      expect(f).toMatch(/^bst\.insert_[a-z0-9_-]+\.svg$/);
  });

  it('draws other themes', () => {
    const light = outDir();
    const dark = outDir();
    expect(run('export', bstFile, '--step', '3', '--out', light).code).toBe(0);
    expect(
      run('export', bstFile, '--step', '3', '--theme', 'dark', '--out', dark)
        .code,
    ).toBe(0);
    expect(readFileSync(join(dark, 'bst-03.svg'), 'utf8')).not.toBe(
      readFileSync(join(light, 'bst-03.svg'), 'utf8'),
    );
  });

  it('draws side structures beside or below with --layout', () => {
    // An array with a stack in the side panel (ADR 0029).
    const sided = join(dir, 'sided.json');
    writeFileSync(
      sided,
      JSON.stringify({
        version: '0.4',
        structures: {
          a: { kind: 'array', initial: [3, 1, 2] },
          calls: { kind: 'stack', initial: ['sort'], place: 'side' },
        },
        steps: [{ actions: [{ target: 'a', type: 'swap', i: 0, j: 1 }] }],
      }),
    );
    const sizes = (...extra: string[]) => {
      const out = outDir();
      const formats = ['svg', 'tikz'].map((format) => {
        expect(
          run(
            'export',
            sided,
            '--step',
            '1',
            '--format',
            format,
            ...extra,
            '--out',
            out,
          ).code,
        ).toBe(0);
        return format;
      });
      expect(formats).toHaveLength(2);
      const svg = readFileSync(join(out, 'sided-1.svg'), 'utf8');
      const tex = readFileSync(join(out, 'sided-1.tex'), 'utf8');
      return { svg: sizeOf(svg).map(Number), tex };
    };
    const byDefault = sizes();
    const wide = sizes('--layout', 'wide');
    const narrow = sizes('--layout=narrow');
    expect(wide).toEqual(byDefault);
    expect(wide.svg[0]).toBeGreaterThan(narrow.svg[0]!);
    expect(wide.svg[1]).toBeLessThan(narrow.svg[1]!);
    expect(narrow.tex).not.toBe(wide.tex);

    const frame = join(dir, 'sided-render.svg');
    expect(
      run('render', sided, '--layout', 'narrow', '--out', frame).code,
    ).toBe(0);
    expect(sizeOf(readFileSync(frame, 'utf8')).map(Number)[0]).toBeLessThan(
      wide.svg[0]!,
    );
  });

  it('writes into the current directory by default', () => {
    const cwd = process.cwd();
    const here = mkdtempSync(join(dir, 'cwd-'));
    process.chdir(here);
    try {
      const result = run('export', bstFile, '--step', '-1');
      expect(result).toMatchObject({
        code: 0,
        out: 'bst-13.svg  delete-3/no-left',
      });
      expect(files(here)).toEqual(['bst-13.svg']);
    } finally {
      process.chdir(cwd);
    }
  });
});

describe('algoviz export errors', () => {
  it('reports a step that matches nothing, and writes nothing', () => {
    const out = outDir();
    const { code, err } = run(
      'export',
      bstFile,
      '--step',
      '1,nope',
      '--out',
      out,
    );
    expect(code).toBe(1);
    expect(err).toContain('NO_MATCH');
    expect(err).toContain('Sections: insert-4, search-6, delete-3.');
    expect(existsSync(out)).toBe(false);
  });

  it('reports frames out of range', () => {
    const { code, err } = run(
      'export',
      bstFile,
      '--step',
      '14',
      '--out',
      outDir(),
    );
    expect(code).toBe(1);
    expect(err).toContain('OUT_OF_RANGE');
  });

  it('reports an unknown algorithm and an input its schema rejects', () => {
    const unknown = run('export', 'nope', '--input', '{}', '--out', outDir());
    expect(unknown.code).toBe(1);
    expect(unknown.err).toContain('UNKNOWN_ALGORITHM at $.id');
    const bad = run(
      'export',
      'bst.search',
      '--input',
      '{"from": [1], "key": "x"}',
      '--out',
      outDir(),
    );
    expect(bad.code).toBe(1);
    expect(bad.err).toContain('INVALID_SHAPE at $.input.key');
  });

  it('reports an invalid document', () => {
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, '{}');
    const result = run('export', bad, '--out', outDir());
    expect(result.code).toBe(1);
    expect(result.err).toContain('INVALID_SHAPE');
    writeFileSync(bad, '{oops');
    expect(run('export', bad, '--out', outDir())).toMatchObject({
      code: 1,
      err: expect.stringContaining('INVALID_JSON') as string,
    });
  });

  it('reports a directory it cannot write to, without a stack trace', () => {
    const { code, err } = run(
      'export',
      bstFile,
      '--step',
      '1',
      '--out',
      bstFile,
    );
    expect(code).toBe(1);
    expect(err).toMatch(/^Cannot write to .*bst\.json: /);
  });

  it('suggests --input when the document file is missing', () => {
    const { code, err } = run('export', 'dijkstra');
    expect(code).toBe(2);
    expect(err).toContain('Cannot read dijkstra');
    expect(err).toContain('--input');
  });

  it('exits with 2 on usage errors', () => {
    const usage = (...argv: string[]) => {
      const result = run(...argv);
      expect(result.code).toBe(2);
      return result.err;
    };
    expect(usage('export')).toContain('export needs a file');
    expect(usage('export', 'dijkstra', '--input', '{oops')).toContain('JSON');
    expect(usage('export', 'dijkstra', '--input', '5')).toContain(
      'starts with { or [',
    );
    expect(
      usage('export', 'dijkstra', '--input', join(dir, 'missing.json')),
    ).toContain('Cannot read');
    expect(usage('export', bstFile, '--out', join(dir, 'fig.svg'))).toContain(
      '--name',
    );
    expect(usage('export', bstFile, '--name', '{nope}')).toContain('{nope}');
    expect(usage('export', bstFile, '--name', 'fixed')).toContain('{frame}');
    expect(usage('export', bstFile, '--theme', 'neon')).toContain('neon');
    expect(usage('export', bstFile, '--layout', 'square')).toContain(
      'Unknown layout "square"; use wide, narrow',
    );
    expect(usage('render', bstFile, '--layout', 'square')).toContain(
      'Unknown layout "square"; use wide, narrow',
    );
    expect(usage('validate', bstFile, '--layout', 'narrow')).toContain(
      '--layout only applies to export and render',
    );
    expect(usage('export', bstFile, '--frame', '1')).toContain('--step');
    expect(usage('render', bstFile, '--step', '1')).toContain('export');
    expect(usage('run', 'bst', '{}', '--input', '{}')).toContain('export');
  });

  it('lists export in the usage', () => {
    expect(run().out).toContain('algoviz export');
    expect(run().out).toContain('[--layout wide|narrow]');
  });
});

const hex = (text: string) => Buffer.from(text, 'utf8').toString('hex');

describe('algoviz export --format tikz', () => {
  it('writes .tex figures for the LaTeX package', () => {
    const out = outDir();
    const result = run(
      'export',
      'dijkstra',
      '--input',
      inputFile,
      '--step=relax#3',
      '--format=tikz',
      '--out',
      out,
    );
    expect(result).toMatchObject({ code: 0, err: '' });
    expect(files(out)).toEqual(['dijkstra-11.tex']);
    expect(result.out).toBe(`${join(out, 'dijkstra-11.tex')}  relax#3`);
    const tikz = readFileSync(join(out, 'dijkstra-11.tex'), 'utf8');
    expect(tikz).toMatch(/^% algoviz figure for LaTeX, format 1: /);
    expect(tikz).toContain('% Frame 11, relax#3.\n');
    expect(tikz).toMatch(/^\\algoviz@figure\{1\}\{[\d.]+\}\{[\d.]+\}\{%$/m);
    expect(tikz.endsWith('}%\n')).toBe(true);
  });

  it('names files as SVG figures are named, with .tex', () => {
    const [svgOut, tikzOut] = [outDir(), outDir()];
    const name = ['--step', 'search-6', '--name', '{step}'];
    run('export', bstFile, ...name, '--out', svgOut);
    run('export', bstFile, ...name, '--format', 'tikz', '--out', tikzOut);
    expect(files(tikzOut)).toEqual(
      files(svgOut).map((f) => f.replace(/\.svg$/, '.tex')),
    );
    expect(files(tikzOut)).toContain('search-6_go.tex');
    // A pattern may end in the format's extension, which is not repeated.
    const ending = outDir();
    run(
      'export',
      bstFile,
      '--step',
      '0',
      '--format',
      'tikz',
      '--out',
      ending,
      '--name',
      'first.tex',
    );
    expect(files(ending)).toEqual(['first.tex']);
  });

  it('draws the frames the SVG figures draw, on the same canvas', () => {
    const [svgOut, tikzOut] = [outDir(), outDir()];
    run('export', bstFile, '--out', svgOut);
    run('export', bstFile, '--format', 'tikz', '--out', tikzOut);
    const svg = files(svgOut);
    expect(files(tikzOut)).toEqual(svg.map((f) => f.replace(/\.svg$/, '.tex')));
    for (const file of svg) {
      const [w, h] = sizeOf(readFileSync(join(svgOut, file), 'utf8'));
      const tikz = readFileSync(
        join(tikzOut, file.replace(/\.svg$/, '.tex')),
        'utf8',
      );
      expect(tikz).toContain(`\\algoviz@figure{1}{${w}}{${h}}{%`);
    }
  });

  it('rejects other formats and a .tex file for --out', () => {
    expect(run('export', bstFile, '--format', 'png')).toMatchObject({
      code: 2,
    });
    expect(run('export', bstFile, '--format', 'png').err).toContain(
      'svg or tikz',
    );
    expect(
      run('export', bstFile, '--format', 'tikz', '--out', join(dir, 'a.tex'))
        .err,
    ).toContain('--name');
  });
});

describe('algoviz export --input-hex', () => {
  it('takes the input as hexadecimal UTF-8', () => {
    const [plain, encoded] = [outDir(), outDir()];
    const input = JSON.stringify(dijkstraInput);
    run('export', 'dijkstra', '--input', input, '--step', '-1', '--out', plain);
    const result = run(
      'export',
      'dijkstra',
      `--input-hex=${hex(input)}`,
      '--step',
      '-1',
      '--out',
      encoded,
    );
    expect(result.code).toBe(0);
    expect(files(encoded)).toEqual(files(plain));
    expect(readFileSync(join(encoded, files(encoded)[0]!), 'utf8')).toBe(
      readFileSync(join(plain, files(plain)[0]!), 'utf8'),
    );
  });

  it('decodes characters outside ASCII', () => {
    const out = outDir();
    // Bracket matching shows every character of its text.
    const input = { text: '(Äβ中)' };
    const result = run(
      'export',
      'balanced-brackets',
      `--input-hex=${hex(JSON.stringify(input))}`,
      '--step=-1',
      '--format=tikz',
      '--out',
      out,
    );
    expect(result.code).toBe(0);
    const tikz = readFileSync(join(out, files(out)[0]!), 'utf8');
    expect(tikz).toContain('{Ä}');
    expect(tikz).toContain('\\ensuremath{\\beta}');
    expect(tikz).toContain('{中}');
  });

  it('rejects odd digits, other characters, bytes that are not UTF-8, and --input with it', () => {
    const usage = (...argv: string[]) => {
      const result = run(...argv);
      expect(result.code).toBe(2);
      return result.err;
    };
    expect(usage('export', 'dijkstra', '--input-hex=abc')).toContain(
      'hexadecimal',
    );
    expect(usage('export', 'dijkstra', '--input-hex=zz')).toContain(
      'hexadecimal',
    );
    expect(usage('export', 'dijkstra', '--input-hex=ff')).toContain('UTF-8');
    expect(
      usage('export', 'dijkstra', '--input-hex=7b7d', '--input', '{}'),
    ).toContain('not both');
    expect(
      usage('export', 'dijkstra', `--input-hex=${hex('{oops')}`),
    ).toContain('JSON');
    expect(usage('render', bstFile, '--input-hex', '7b7d')).toContain('export');
  });
});

describe('algoviz export --error-file', () => {
  it('writes the diagnostics of a failed export', () => {
    const out = outDir();
    const errors = join(out, 'deep', 'fig.err');
    const result = run(
      'export',
      bstFile,
      '--step',
      'nope',
      '--out',
      out,
      '--error-file',
      errors,
    );
    expect(result.code).toBe(1);
    expect(readFileSync(errors, 'utf8')).toBe(`${result.err}\n`);
    expect(result.err).toMatch(/^NO_MATCH at \$: /);
  });

  it('writes a usage error without the usage text', () => {
    const errors = join(outDir(), 'usage.err');
    const result = run(
      'export',
      bstFile,
      '--format=png',
      `--error-file=${errors}`,
    );
    expect(result.code).toBe(2);
    expect(readFileSync(errors, 'utf8')).toBe(
      'Unknown format "png"; use svg or tikz\n',
    );
    expect(result.err).toContain('Usage:');
  });

  it('removes the file after a success', () => {
    const out = outDir();
    const errors = join(out, 'fig.err');
    run(
      'export',
      bstFile,
      '--step',
      'nope',
      '--out',
      out,
      '--error-file',
      errors,
    );
    expect(existsSync(errors)).toBe(true);
    const result = run(
      'export',
      bstFile,
      '--step',
      '0',
      '--out',
      out,
      '--error-file',
      errors,
    );
    expect(result.code).toBe(0);
    expect(existsSync(errors)).toBe(false);
    // Nothing to remove is not an error.
    expect(
      run(
        'export',
        bstFile,
        '--step',
        '0',
        '--out',
        out,
        '--error-file',
        errors,
      ).code,
    ).toBe(0);
  });

  it('leaves a file it cannot write to standard error alone', () => {
    const parent = outDir();
    mkdirSync(parent);
    const blocker = join(parent, 'file');
    writeFileSync(blocker, '');
    const result = run(
      'export',
      bstFile,
      '--step',
      'nope',
      '--error-file',
      join(blocker, 'x.err'),
    );
    expect(result.code).toBe(1);
    expect(result.err).toContain('NO_MATCH');
  });
});

describe('algoviz export --error-file safety', () => {
  it('refuses to name a file the command reads, and leaves it alone', () => {
    const copy = join(outDir(), 'doc.json');
    mkdirSync(join(copy, '..'), { recursive: true });
    writeFileSync(copy, readFileSync(bstFile, 'utf8'));
    const result = run('export', copy, '--step', 'nope', '--error-file', copy);
    expect(result.code).toBe(2);
    expect(result.err).toContain('--error-file names a file');
    expect(readFileSync(copy, 'utf8')).toBe(readFileSync(bstFile, 'utf8'));
    const input = run(
      'export',
      'dijkstra',
      `--input=${inputFile}`,
      `--error-file=${inputFile}`,
    );
    expect(input.code).toBe(2);
    expect(JSON.parse(readFileSync(inputFile, 'utf8'))).toEqual(dijkstraInput);
  });

  it('reports a file --out of render cannot write, without a stack trace', () => {
    const parent = outDir();
    mkdirSync(parent);
    writeFileSync(join(parent, 'file'), '');
    const result = run(
      'render',
      bstFile,
      '--out',
      join(parent, 'file', 'x.svg'),
    );
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/^Cannot write to .*x\.svg: /);
  });

  it('writes whole files, leaving no partial ones', () => {
    const out = outDir();
    run('export', bstFile, '--format', 'tikz', '--out', out);
    expect(files(out).filter((f) => !f.endsWith('.tex'))).toEqual([]);
  });
});

describe('algoviz export --one-file', () => {
  it('writes a series into one TikZ file, the figures in timeline order', () => {
    const [single, series] = [outDir(), outDir()];
    const steps = ['--step', 'relax#3,improve#2,-1', '--format', 'tikz'];
    run('export', 'dijkstra', '--input', inputFile, ...steps, '--out', single);
    const result = run(
      'export',
      'dijkstra',
      '--input',
      inputFile,
      ...steps,
      '--one-file',
      '--out',
      series,
    );
    expect(result).toMatchObject({ code: 0, err: '' });
    expect(files(series)).toEqual(['dijkstra.tex']);
    const path = join(series, 'dijkstra.tex');
    expect(result.out.split('\n')).toEqual([
      `${path}  improve#2`,
      `${path}  relax#3`,
      `${path}  done`,
    ]);
    // The figures `export` writes one by one, separated by blank lines.
    const figures = files(single).map((f) =>
      readFileSync(join(single, f), 'utf8'),
    );
    expect(figures).toHaveLength(3);
    expect(readFileSync(path, 'utf8')).toBe(figures.join('\n'));
    expect(
      readFileSync(path, 'utf8').match(/^\\algoviz@figure\{/gm),
    ).toHaveLength(3);
  });

  it('writes every frame without --step, under the name given', () => {
    const out = outDir();
    const result = run(
      'export',
      bstFile,
      '--format=tikz',
      '--one-file',
      `--out=${out}`,
      '--name=all.tex',
    );
    expect(result.code).toBe(0);
    expect(files(out)).toEqual(['all.tex']);
    expect(result.out.split('\n')).toHaveLength(14);
    expect(
      readFileSync(join(out, 'all.tex'), 'utf8').match(/^\\algoviz@figure/gm),
    ).toHaveLength(14);
  });

  it('refuses SVG, a name per frame, and the flag outside export', () => {
    const svg = run('export', bstFile, '--one-file', '--out', outDir());
    expect(svg.code).toBe(2);
    expect(svg.err).toContain('--one-file needs --format tikz');
    const frame = run(
      'export',
      bstFile,
      '--format=tikz',
      '--one-file',
      '--name={frame}',
      '--out',
      outDir(),
    );
    expect(frame.code).toBe(2);
    expect(frame.err).toContain('leave out {frame} and {step}');
    expect(run('validate', bstFile, '--one-file').err).toContain(
      '--one-file only applies to export',
    );
  });

  it('writes nothing when a step fails', () => {
    const out = outDir();
    const result = run(
      'export',
      bstFile,
      '--step=0,nope',
      '--format=tikz',
      '--one-file',
      '--out',
      out,
    );
    expect(result.code).toBe(1);
    expect(existsSync(out)).toBe(false);
  });
});
