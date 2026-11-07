import { posix } from 'node:path';

import { describe, expect, it } from 'vitest';

import { basename, dirname, extname, join } from '../standalone/js/path.ts';

// The paths the CLI builds: output directories, file names and documents.
const paths = [
  'doc.json',
  './doc.json',
  'notes/heap.json',
  '/abs/dir/doc.tar.json',
  'dir/',
  'dir//sub///',
  '.hidden',
  'name.',
  '/',
  '.',
  '..',
  '../up/x.svg',
  'a/./b/../c',
];

describe("the standalone executable's path functions", () => {
  it.each(paths)('agree with node:path/posix on %j', (path) => {
    expect(basename(path)).toBe(posix.basename(path));
    expect(basename(path, '.json')).toBe(posix.basename(path, '.json'));
    expect(extname(path)).toBe(posix.extname(path));
    expect(dirname(path)).toBe(posix.dirname(path));
    expect(join(path, 'fig-01.svg')).toBe(posix.join(path, 'fig-01.svg'));
    expect(join('.', path)).toBe(posix.join('.', path));
  });

  it('also separate with backslashes, as Windows does', () => {
    expect(basename('dir\\doc.json', '.json')).toBe('doc');
    expect(dirname('dir\\sub\\doc.json')).toBe('dir\\sub');
    expect(join('dir\\sub', 'x.tex')).toBe('dir/sub/x.tex');
  });
});
