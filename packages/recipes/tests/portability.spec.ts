/**
 * The engine also runs in QuickJS: the Typst plugin (ADR 0026) and the
 * standalone `algomotion` (ADR 0027), which have no Intl. A call that needs
 * it gives other text there than in Node, so figures, recipe lists and
 * guides would differ between outputs. None of the code they run may
 * use it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packages = fileURLToPath(new URL('../../', import.meta.url));
/** What the Typst plugin and the standalone command run. */
const RUN_IN_QUICKJS = [
  'spec',
  'fonts',
  'core',
  'svg',
  'tikz',
  'recipes',
  'mcp',
];
const NEEDS_INTL = /\btoLocale\w*\(|\bIntl\.|\.localeCompare\(/;
/** A line of code without its comment; doc comment lines are empty. */
const code = (line: string) =>
  /^\s*(\/\*|\*)/.test(line) ? '' : line.replace(/\/\/.*$/, '');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return name.endsWith('.ts') ? [path] : [];
  });
}

describe('code that QuickJS runs', () => {
  it('does not use Intl', () => {
    const found = RUN_IN_QUICKJS.flatMap((p) =>
      sources(join(packages, p, 'src')).flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .flatMap((line, k) =>
            NEEDS_INTL.test(code(line))
              ? [`${file.slice(packages.length)}:${k + 1}`]
              : [],
          ),
      ),
    );
    expect(found).toEqual([]);
  });
});
