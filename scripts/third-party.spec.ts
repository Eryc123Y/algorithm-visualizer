/**
 * THIRD-PARTY-NOTICES.md names everything the distributed files contain
 * from others: every crate the Rust builds lock, and every npm package it
 * names carries the copyright lines of the installed version's licence.
 * The bundles check their npm packages against it when they are built
 * (third-party.ts).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { NOTICES, packagesIn, unnoticed } from './third-party.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const notices = readFileSync(NOTICES, 'utf8');

/** The crates a Cargo.lock locks, but the workspace's own. */
function lockedCrates(path: string): string[] {
  const lock = readFileSync(join(ROOT, path), 'utf8');
  return [...lock.matchAll(/^name = "([^"]+)"$/gm)]
    .map((m) => m[1]!)
    .filter((name) => !name.startsWith('algomotion-'));
}

/** The names in backticks in the table's rows from a source, such as npm. */
function rowsFrom(source: string): string[] {
  return notices
    .split('\n')
    .filter((line) => line.split('|')[2]?.trim() === source)
    .flatMap((line) =>
      [...line.split('|')[1]!.matchAll(/`([^`]+)`/g)].map((m) => m[1]!),
    );
}

describe('packagesIn', () => {
  it('names the npm packages of module ids, scoped or not, once', () => {
    expect(
      packagesIn([
        '/repo/node_modules/zod/v4/core/core.js',
        '/repo/node_modules/zod/v4/classic/schemas.js',
        '/repo/node_modules/@lit/reactive-element/reactive-element.js',
        '/repo/node_modules/a/node_modules/b/index.js',
        'C:\\repo\\node_modules\\lit-html\\lit-html.js',
        '/repo/packages/core/src/index.ts',
        '\0vite/preload-helper.js',
      ]),
    ).toEqual(['@lit/reactive-element', 'b', 'lit-html', 'zod']);
  });
});

describe('unnoticed', () => {
  it('keeps the names the notices do not give in backticks', () => {
    expect(unnoticed(['zod', 'left-pad'], 'The `zod` package.')).toEqual([
      'left-pad',
    ]);
  });
});

describe('THIRD-PARTY-NOTICES.md', () => {
  it.for([
    'packages/typst/plugin/Cargo.lock',
    'packages/mcp/standalone/Cargo.lock',
  ])('names every crate of %s', (lock) => {
    expect(unnoticed(lockedCrates(lock), notices)).toEqual([]);
  });

  it('names npm packages, each with its licence’s copyright lines', () => {
    const npm = rowsFrom('npm');
    expect(npm).toContain('zod');
    for (const name of npm) {
      const dir = join(ROOT, 'node_modules', name);
      const licence = ['LICENSE', 'LICENSE.md', 'LICENSE.txt']
        .map((file) => join(dir, file))
        .find((file) => existsSync(file));
      expect(licence, name).toBeDefined();
      const copyrights = readFileSync(licence!, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^Copyright \(c\)/i.test(line));
      expect(copyrights.length, name).toBeGreaterThan(0);
      for (const line of copyrights) expect(notices, name).toContain(line);
    }
  });

  it('goes with the Typst package as it is', () => {
    expect(
      readFileSync(
        join(ROOT, 'packages/typst/package/THIRD-PARTY-NOTICES.md'),
        'utf8',
      ),
    ).toBe(notices);
  });
});
