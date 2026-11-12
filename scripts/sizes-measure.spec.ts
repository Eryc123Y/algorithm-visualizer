import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

import { afterAll, describe, expect, it } from 'vitest';

import {
  END,
  formatBytes,
  measure,
  replaceBetween,
  sizeOf,
  START,
  table,
} from './sizes-measure.ts';

const dir = mkdtempSync(join(tmpdir(), 'algomotion-sizes-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const text = 'compare '.repeat(500);
writeFileSync(join(dir, 'a.js'), text);
mkdirSync(join(dir, 'fonts'));
writeFileSync(join(dir, 'fonts', 'b.css'), 'body{}');

describe('sizes', () => {
  it('measure a file raw and compressed', () => {
    const size = sizeOf(Buffer.from(text));
    expect(size.files).toBe(1);
    expect(size.raw).toBe(4000);
    expect(size.gzip).toBe(gzipSync(text, { level: 9 }).length);
    expect(gunzipSync(gzipSync(text)).toString()).toBe(text);
    expect(size.brotli).toBeLessThan(size.raw / 10);
  });

  it('add up the files of a folder, each compressed on its own', () => {
    const all = measure(dir)!;
    const a = measure(join(dir, 'a.js'))!;
    const b = measure(join(dir, 'fonts', 'b.css'))!;
    expect(all).toEqual({
      files: 2,
      raw: a.raw + b.raw,
      gzip: a.gzip + b.gzip,
      brotli: a.brotli + b.brotli,
    });
    expect(measure(dir, (f) => f.endsWith('.css'))).toEqual(b);
  });

  it('leave out what was not built', () => {
    expect(measure(join(dir, 'missing'))).toBeUndefined();
    expect(measure(dir, (f) => f.endsWith('.wasm'))).toBeUndefined();
  });

  it('write bytes in decimal units', () => {
    expect(formatBytes(999)).toBe('999 B');
    expect(formatBytes(1500)).toBe('1.5 kB');
    expect(formatBytes(2_066_000)).toBe('2.07 MB');
  });

  it('make a Markdown table, with a row for each output', () => {
    const lines = table([
      { name: 'x', note: 'built', size: measure(join(dir, 'a.js')) },
      { name: 'y', note: 'not', size: undefined },
    ]).split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[2]).toMatch(
      /^\| x \| 1 \| 4\.0 kB \| \d+ B \| \d+ B \| built \|$/,
    );
    expect(lines[3]).toBe('| y |  | not built |  |  | not |');
  });

  it('replace only the text between the markers', () => {
    const doc = `# T\n\n${START}\nold\n${END}\n\nafter\n`;
    expect(replaceBetween(doc, 'new')).toBe(
      `# T\n\n${START}\nnew\n${END}\n\nafter\n`,
    );
    expect(() => replaceBetween('# T', 'new')).toThrow(/no <!-- sizes:start/);
  });
});
