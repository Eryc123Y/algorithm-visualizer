/**
 * The JavaScript of the standalone executable (ADR 0027), run in a bare
 * V8 context with a host made of `node:fs`, as the Rust host runs it in
 * QuickJS. It must behave as the CLI does in Node: the same output, exit
 * codes and files. `npm run test:standalone` runs the real executable.
 */
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

import { beforeAll, describe, expect, it } from 'vitest';

import { findAlgorithm, runAlgorithm } from '@algoviz/recipes';

import { bundleStandalone } from '../scripts/standalone.ts';
import { main } from '../src/cli.ts';

interface Run {
  readonly code: number;
  readonly out: string;
  readonly err: string;
}

let bundle = '';
beforeAll(async () => {
  bundle = await bundleStandalone();
}, 120_000);

/** Runs the bundle as the executable would, with a host over node:fs. */
function standalone(argv: readonly string[], stdin = ''): Run {
  let code = -1;
  const out: string[] = [];
  const err: string[] = [];
  const host = {
    argv: [...argv],
    write: (fd: number, text: string) => (fd === 2 ? err : out).push(text),
    readFile: (file: string | 0) =>
      file === 0 ? stdin : readFileSync(file, 'utf8'),
    writeFile: (path: string, text: string) => writeFileSync(path, text),
    mkdir: (path: string) => mkdirSync(path, { recursive: true }),
    remove: (path: string) => rmSync(path, { force: true }),
    exit: (n: number) => (code = n),
  };
  // A context with only JavaScript's own globals, as in QuickJS.
  runInNewContext(`"use strict";\n${bundle}`, { __host: host });
  return { code, out: out.join(''), err: err.join('') };
}

/** The CLI in Node, with the output the executable would write. */
function node(argv: readonly string[]): Run {
  const out: string[] = [];
  const err: string[] = [];
  const code = main(
    argv,
    (t) => out.push(`${t}\n`),
    (t) => err.push(`${t}\n`),
  );
  return { code, out: out.join(''), err: err.join('') };
}

const dir = mkdtempSync(join(tmpdir(), 'algoviz-standalone-'));
const bst = join(dir, 'bst.json');
const bstRun = runAlgorithm('bst', findAlgorithm('bst')!.examples[0]);
if (!bstRun.ok) throw new Error('bst');
writeFileSync(bst, JSON.stringify(bstRun.value.document));
const input = join(dir, 'input.json');
writeFileSync(input, JSON.stringify(findAlgorithm('dijkstra')!.examples[0]));

/** The files a directory holds, with their text. */
const contents = (d: string) =>
  readdirSync(d)
    .toSorted()
    .map((f) => [f, readFileSync(join(d, f), 'utf8')]);

describe('the standalone bundle', () => {
  it('loads no module of Node.js', () => {
    expect(bundle).not.toMatch(/\bfrom\s*["']node:|\bimport\(/);
  });

  it.each([
    ['guide', ['guide', 'stack']],
    ['the usage', []],
    ['recipes', ['recipes']],
    ['validate', ['validate', bst]],
    ['inspect', ['inspect', bst, '-1', 'search-6/go']],
    ['render', ['render', bst, '--frame', 'delete-3', '--theme', 'dark']],
    ['a usage error', ['export', bst, '--format', 'png']],
    ['an error in a step', ['export', bst, '--step', 'nope']],
  ])('prints what Node prints: %s', (_, argv) => {
    expect(standalone(argv)).toEqual(node(argv));
  });

  it.each([
    ['SVG', ['export', bst]],
    ['TikZ', ['export', bst, '--format', 'tikz', '--name', '{step}']],
    [
      'TikZ from an input',
      [
        'export',
        'dijkstra',
        '--input',
        input,
        '--step',
        'relax#3,-1',
        '--format=tikz',
      ],
    ],
  ])('writes the files Node writes: %s', (_, argv) => {
    const [a, b] = [join(dir, `a-${_}`), join(dir, `b-${_}`)];
    const ran = standalone([...argv, '--out', a]);
    const expected = node([...argv, '--out', b]);
    expect(ran.code).toBe(expected.code);
    expect(ran.out.replaceAll(a, b)).toBe(expected.out);
    expect(contents(a)).toEqual(contents(b));
  });

  it('takes hexadecimal input and keeps the error file in step', () => {
    const hex = Buffer.from('{"values": [3, 1, 2]}').toString('hex');
    const errors = join(dir, 'hex', 'fig.err');
    const failed = standalone([
      'export',
      'insertion-sort',
      `--input-hex=${hex}`,
      '--step=nope',
      `--error-file=${errors}`,
    ]);
    expect(failed.code).toBe(1);
    expect(readFileSync(errors, 'utf8')).toBe(failed.err);
    const done = standalone([
      'export',
      'insertion-sort',
      `--input-hex=${hex}`,
      '--step=-1',
      '--out',
      join(dir, 'hex'),
      `--error-file=${errors}`,
    ]);
    expect(done.code).toBe(0);
    expect(readdirSync(join(dir, 'hex'))).toEqual(['insertion-sort-11.svg']);
  });

  it('reads standard input', () => {
    const doc = readFileSync(bst, 'utf8');
    const ran = standalone(['validate', '-'], doc);
    expect(ran.code).toBe(0);
    expect(ran.out).toBe(node(['validate', bst]).out);
  });
});
