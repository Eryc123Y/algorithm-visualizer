/**
 * A bug inside the engine during export: the error file says so, and the
 * exception goes on up, so Node prints its stack and the standalone
 * executable exits with 70.
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { main } from '../src/cli.ts';

vi.mock('@algoviz/tikz', () => ({
  exportTikzFigures: () => {
    throw new TypeError('boom');
  },
}));

describe('an internal error', () => {
  it('is written to the error file and thrown', () => {
    const errors = join(mkdtempSync(join(tmpdir(), 'algoviz-bug-')), 'x.err');
    expect(() =>
      main(
        [
          'export',
          'bubble-sort',
          '--input',
          '{"values": [2, 1]}',
          '--format',
          'tikz',
          '--error-file',
          errors,
        ],
        () => {},
        () => {},
      ),
    ).toThrow('boom');
    expect(readFileSync(errors, 'utf8')).toBe(
      'Internal error in algoviz: boom\n',
    );
  });
});
