/**
 * Measuring what users download: raw, gzip and brotli sizes of files and
 * folders, and the table `npm run sizes` prints and writes to the docs.
 * Each file is compressed on its own, as a server sends it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

export interface Size {
  readonly files: number;
  readonly raw: number;
  readonly gzip: number;
  readonly brotli: number;
}

export const NO_SIZE: Size = { files: 0, raw: 0, gzip: 0, brotli: 0 };

/** The sizes of one file's bytes. */
export function sizeOf(bytes: Uint8Array): Size {
  return {
    files: 1,
    raw: bytes.length,
    gzip: gzipSync(bytes, { level: 9 }).length,
    brotli: brotliCompressSync(bytes, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11,
        [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length,
      },
    }).length,
  };
}

export const add = (a: Size, b: Size): Size => ({
  files: a.files + b.files,
  raw: a.raw + b.raw,
  gzip: a.gzip + b.gzip,
  brotli: a.brotli + b.brotli,
});

/** Every file under `dir`, relative to it, sorted. */
export function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => statSync(join(dir, f)).isFile())
    .sort();
}

/**
 * The total size of a file, or of the files under a folder that `keep`
 * accepts (by path relative to the folder). Undefined if it is missing.
 */
export function measure(
  path: string,
  keep: (file: string) => boolean = () => true,
): Size | undefined {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return undefined;
  }
  if (stat.isFile()) return sizeOf(readFileSync(path));
  const total = filesUnder(path)
    .filter(keep)
    .map((f) => sizeOf(readFileSync(join(path, f))))
    .reduce(add, NO_SIZE);
  return total.files === 0 ? undefined : total;
}

/** Bytes in decimal units, as Cloudflare and npm report them. */
export function formatBytes(n: number): string {
  if (n < 1000) return `${n} B`;
  if (n < 1e6) return `${(n / 1e3).toFixed(1)} kB`;
  return `${(n / 1e6).toFixed(2)} MB`;
}

export interface Row {
  readonly name: string;
  /** What the row is, for the table's last column. */
  readonly note: string;
  /** Undefined when the output was not built. */
  readonly size: Size | undefined;
}

/** The rows as a Markdown table. */
export function table(rows: readonly Row[]): string {
  const line = (cells: readonly string[]) => `| ${cells.join(' | ')} |`;
  return [
    line(['Download', 'Files', 'Raw', 'gzip', 'brotli', 'What it is']),
    line(['---', '--:', '--:', '--:', '--:', '---']),
    ...rows.map(({ name, note, size }) =>
      line(
        size === undefined
          ? [name, '', 'not built', '', '', note]
          : [
              name,
              String(size.files),
              formatBytes(size.raw),
              formatBytes(size.gzip),
              formatBytes(size.brotli),
              note,
            ],
      ),
    ),
  ].join('\n');
}

export const START = '<!-- sizes:start -->';
export const END = '<!-- sizes:end -->';

/** `doc` with the text between the markers replaced by `body`. */
export function replaceBetween(doc: string, body: string): string {
  const from = doc.indexOf(START);
  const to = doc.indexOf(END);
  if (from < 0 || to < from)
    throw new Error(`The document has no ${START} … ${END} section`);
  return `${doc.slice(0, from + START.length)}\n${body}\n${doc.slice(to)}`;
}
