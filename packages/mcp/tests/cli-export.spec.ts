import {
  existsSync,
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
    expect(usage('export', bstFile, '--frame', '1')).toContain('--step');
    expect(usage('render', bstFile, '--step', '1')).toContain('export');
    expect(usage('run', 'bst', '{}', '--input', '{}')).toContain('export');
  });

  it('lists export in the usage', () => {
    expect(run().out).toContain('algoviz export');
  });
});
