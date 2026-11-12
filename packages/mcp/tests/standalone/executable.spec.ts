/**
 * The standalone `algomotion` executable (ADR 0027), built with the Rust
 * toolchain and run as a separate process. Its figures must be the CLI's,
 * byte for byte, for every registry example in both formats, and its exit
 * codes, messages and error files the same as in Node.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { algorithms } from '@algomotion/recipes';

import { paths } from '../../scripts/standalone.ts';
import { main } from '../../src/cli.ts';

interface Run {
  readonly code: number | null;
  readonly out: string;
  readonly err: string;
}

beforeAll(() => {
  // Always build, so the tests run the code they sit next to.
  const built = spawnSync(
    process.execPath,
    [
      '--conditions=@algomotion/source',
      join(paths.root, 'scripts/build-standalone.ts'),
    ],
    { encoding: 'utf8' },
  );
  if (built.status !== 0)
    throw new Error(`The build failed:\n${built.stdout}\n${built.stderr}`);
});

function standalone(argv: readonly string[], stdin?: string): Run {
  const ran = spawnSync(paths.executable, argv, {
    encoding: 'utf8',
    ...(stdin === undefined ? {} : { input: stdin }),
  });
  return { code: ran.status, out: ran.stdout, err: ran.stderr };
}

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

const dir = mkdtempSync(join(tmpdir(), 'algomotion-executable-'));
// The input of the tests that need one; the export of every example
// writes its own too.
writeFileSync(
  join(dir, 'dijkstra.json'),
  JSON.stringify(algorithms.find((a) => a.id === 'dijkstra')!.examples[0]),
);
const contents = (d: string) =>
  readdirSync(d)
    .toSorted()
    .map((f) => [f, readFileSync(join(d, f), 'utf8')]);

describe('the standalone executable', () => {
  it('is small', () => {
    const size = statSync(paths.executable).size;
    expect(size).toBeGreaterThan(500_000);
    expect(size).toBeLessThan(4_000_000);
  });

  it('prints the usage and the guide as Node does', () => {
    for (const argv of [['--help'], ['guide', 'tree'], ['recipes']])
      expect(standalone(argv)).toEqual(node(argv));
  });

  it.each(algorithms.map((a) => [a.id, a.examples[0]] as const))(
    'exports every frame of %s as Node does, in SVG and TikZ',
    (id, example) => {
      const input = join(dir, `${id}.json`);
      writeFileSync(input, JSON.stringify(example));
      for (const format of ['svg', 'tikz']) {
        const [a, b] = [
          join(dir, `${id}-${format}-a`),
          join(dir, `${id}-${format}-b`),
        ];
        const argv = ['export', id, '--input', input, `--format=${format}`];
        const ran = standalone([...argv, '--out', a]);
        const expected = node([...argv, '--out', b]);
        expect(ran.code).toBe(0);
        expect(ran.out.replaceAll(a, b)).toBe(expected.out);
        expect(contents(a)).toEqual(contents(b));
      }
    },
  );

  it('fails as Node does, with the same exit codes and error files', () => {
    const input = join(dir, 'dijkstra.json');
    const cases = [
      ['export', 'dijkstra', '--input', input, '--step', 'nope'],
      ['export', 'nope', '--input', input],
      ['export', 'dijkstra', '--input-hex=7b'],
      ['export', 'dijkstra', '--input', input, '--format', 'png'],
      ['validate', join(dir, 'missing.json')],
    ];
    for (const argv of cases) {
      const [a, b] = [join(dir, 'a.err'), join(dir, 'b.err')];
      const ran = standalone([...argv, '--error-file', a]);
      const expected = node([...argv, '--error-file', b]);
      expect(ran.code, argv.join(' ')).toBe(expected.code);
      // A file that cannot be read is named by the host, not by Node.
      if (argv[0] !== 'validate') {
        expect(ran.err).toBe(expected.err);
        expect(readFileSync(a, 'utf8')).toBe(readFileSync(b, 'utf8'));
      }
    }
  });

  it('reads arguments, files and input that are not UTF-8 as Node does', () => {
    // Bytes that are not UTF-8 become U+FFFD, and the error is the CLI's.
    if (process.platform !== 'win32') {
      const arg = spawnSync(paths.executable, [
        'validate',
        Buffer.from([0x61, 0xff]) as unknown as string,
      ]);
      expect(arg.status).toBe(2);
      expect(arg.stderr.toString()).toContain('Cannot read a\u{FFFD}');
    }
    const latin1 = join(dir, 'latin1.json');
    writeFileSync(
      latin1,
      Buffer.from('{"values": [1, 2], "x": "\xe9"}', 'latin1'),
    );
    for (const argv of [
      ['validate', latin1],
      ['export', 'bubble-sort', '--input', latin1, '--out', join(dir, 'l1')],
    ]) {
      const ran = standalone(argv);
      const expected = node(argv);
      expect([ran.code, ran.err]).toEqual([expected.code, expected.err]);
    }
  });

  it('decodes hexadecimal input as Node does, rejecting what is not UTF-8', () => {
    const hex = (text: string) => Buffer.from(text, 'utf8').toString('hex');
    const cases = [
      // Bracket matching shows every character of its text.
      hex('{"text": "(Äβ中)"}'),
      // An overlong encoding, a lone surrogate and a truncated sequence.
      'c0af',
      'eda080',
      hex('{"text": "a"}').slice(0, -2) + 'e2',
      'ZZ',
    ];
    for (const value of cases) {
      const [a, b] = [join(dir, `hex-a-${value}`), join(dir, `hex-b-${value}`)];
      const argv = [
        'export',
        'balanced-brackets',
        `--input-hex=${value}`,
        '--format=tikz',
      ];
      const ran = standalone([...argv, '--out', a]);
      const expected = node([...argv, '--out', b]);
      expect([ran.code, ran.err], value).toEqual([expected.code, expected.err]);
      if (expected.code === 0) expect(contents(a)).toEqual(contents(b));
    }
  });

  it('refuses an error file that names the input, and leaves it alone', () => {
    const input = join(dir, 'dijkstra.json');
    const before = readFileSync(input, 'utf8');
    const ran = standalone([
      'export',
      'dijkstra',
      '--input',
      input,
      '--error-file',
      input,
    ]);
    expect(ran.code).toBe(2);
    expect(readFileSync(input, 'utf8')).toBe(before);
  });

  it('leaves no partial files', () => {
    const out = join(dir, 'whole');
    standalone([
      'export',
      'dijkstra',
      '--input',
      join(dir, 'dijkstra.json'),
      '--format=tikz',
      '--out',
      out,
    ]);
    expect(readdirSync(out).filter((f) => !f.endsWith('.tex'))).toEqual([]);
  });

  it('removes the error file after a success', () => {
    const errors = join(dir, 'ok.err');
    writeFileSync(errors, 'old');
    const ran = standalone([
      'export',
      'bubble-sort',
      '--input-hex',
      Buffer.from('{"values": [2, 1]}').toString('hex'),
      '--step=-1',
      '--out',
      join(dir, 'ok'),
      '--error-file',
      errors,
    ]);
    expect(ran.code).toBe(0);
    expect(existsSync(errors)).toBe(false);
  });

  it('reads standard input', () => {
    const ran = standalone(
      [
        'export',
        'bubble-sort',
        '--input',
        '-',
        '--step=-1',
        '--out',
        join(dir, 'stdin'),
      ],
      '{"values": [3, 2, 1]}',
    );
    expect(ran).toMatchObject({ code: 0, err: '' });
    expect(readdirSync(join(dir, 'stdin'))).toHaveLength(1);
  });
});
