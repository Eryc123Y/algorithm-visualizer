/**
 * Every place the repository writes a version agrees with the release it
 * is at (roadmap 4.3), so a release changes them all or the check fails.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  currentVersions,
  isVersion,
  rewrite,
  trackedFiles,
  versionsIn,
} from './versions.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const current = currentVersions(ROOT);
const found = trackedFiles(ROOT).flatMap((file) =>
  versionsIn(file, readFileSync(join(ROOT, file), 'utf8')),
);

describe('the versions the repository writes', () => {
  it('agree with the release, product by product', () => {
    const wrong = found
      .filter((f) => f.version !== current[f.product])
      .map(
        (f) =>
          `${f.file}: ${f.text} (the ${f.product} version is ${current[f.product]})`,
      );
    expect(wrong).toEqual([]);
  });

  it('are written where the release needs them', () => {
    const files = (product: string) =>
      new Set(found.filter((f) => f.product === product).map((f) => f.file));
    // The root package gives the site's footer its version, and the MCP
    // server tells clients its own.
    expect(files('npm')).toContain('package.json');
    expect(files('npm')).toContain('packages/mcp/src/server.ts');
    expect(files('npm')).toContain('packages/elements/package.json');
    expect(files('typst')).toContain('packages/typst/package/typst.toml');
    expect(files('typst')).toContain('apps/site/src/docs/snippets.ts');
    // The folder a manual install puts the package in, in the guide.
    expect(files('typst')).toContain('apps/site/src/docs/guides/typst.ts');
    expect(files('typst')).toContain('packages/typst/package/README.md');
    expect(files('latex')).toContain('packages/latex/package/algomotion.sty');
  });
});

describe('rewrite', () => {
  it('writes each product’s new version, and leaves the others', () => {
    const text = [
      '  "version": "1.0.0-alpha.1",',
      '"@algomotion/core": "1.0.0-alpha.1"',
      '#import "@local/algomotion:0.1.0": algomotion',
      'https://cdn.jsdelivr.net/npm/@algomotion/elements@1.0.0-alpha.1/dist/cdn/x.js',
    ].join('\n');
    expect(
      rewrite(
        'packages/core/package.json',
        text,
        { npm: '1.0.0' },
        '2026-12-01',
      ),
    ).toBe(
      [
        '  "version": "1.0.0",',
        '"@algomotion/core": "1.0.0"',
        '#import "@local/algomotion:0.1.0": algomotion',
        'https://cdn.jsdelivr.net/npm/@algomotion/elements@1.0.0/dist/cdn/x.js',
      ].join('\n'),
    );
  });

  it('dates the LaTeX header, and keeps the cache key in step', () => {
    const sty = [
      '\\ProvidesExplPackage{algomotion}{2026-11-08}{0.1.0}',
      '\\str_const:Nn \\c__algomotion_version_str { 0.1.0 }',
    ].join('\n');
    expect(
      rewrite('algomotion.sty', sty, { latex: '1.0.0' }, '2026-12-01'),
    ).toBe(
      [
        '\\ProvidesExplPackage{algomotion}{2026-12-01}{1.0.0}',
        '\\str_const:Nn \\c__algomotion_version_str { 1.0.0 }',
      ].join('\n'),
    );
  });

  it('moves the Typst package’s folder, written with or without local/', () => {
    const text =
      'Link it as `algomotion/0.1.0`, under local/algomotion/0.1.0, and import @local/algomotion:0.1.0.';
    expect(rewrite('README.md', text, { typst: '1.0.0' }, '2026-12-01')).toBe(
      'Link it as `algomotion/1.0.0`, under local/algomotion/1.0.0, and import @local/algomotion:1.0.0.',
    );
  });

  it('leaves a document’s protocol version alone', () => {
    const doc = '{ "version": "1.0", "structures": {} }';
    expect(rewrite('x.json', doc, { npm: '2.0.0' }, '2026-12-01')).toBe(doc);
  });
});

describe('isVersion', () => {
  it('takes what npm, Typst Universe and CTAN take', () => {
    for (const v of ['1.0.0', '1.0.0-alpha.2', '2.10.3-rc.1', '0.1.0'])
      expect(isVersion('npm', v), v).toBe(true);
    for (const v of ['1.0.0', '0.2.0'])
      expect(isVersion('typst', v), v).toBe(true);
    expect(isVersion('latex', '1.0.0')).toBe(true);
  });

  it('refuses what they would not', () => {
    for (const v of [
      '1.0',
      '01.0.0',
      '1.0.0-alpha..2',
      '1.0.0-',
      '1.0.0-01',
      '1.0.0+build',
      'v1.0.0',
    ])
      expect(isVersion('npm', v), v).toBe(false);
    // Typst Universe and CTAN take plain versions only.
    expect(isVersion('typst', '1.0.0-alpha.1')).toBe(false);
    expect(isVersion('latex', '1.0.0-rc.1')).toBe(false);
  });
});
