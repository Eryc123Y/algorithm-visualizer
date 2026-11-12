/**
 * The Typst package installed for the Typst tests: a local package
 * directory with the committed plugin and an engine built from this
 * checkout, and the `typst` command run against it.
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { exportFigures, type ThemeName } from '@algomotion/svg';

import { buildEngine } from '../../scripts/engine.ts';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export const packageDir = here('../../package');
export const examples = here('../../examples');
const manifest = readFileSync(join(packageDir, 'typst.toml'), 'utf8');
const field = (name: string) =>
  new RegExp(`^${name}\\s*=\\s*"([^"]+)"`, 'm').exec(manifest)![1]!;
/** The package as documents import it, `@local/algomotion:0.1.0`. */
export const spec = `@local/${field('name')}:${field('version')}`;

/** The slide frameworks the examples and tests use (ADR 0028). */
export const FRAMEWORKS = ['@preview/polylux:0.4.0', '@preview/touying:0.8.0'];

export interface Installed {
  /** A temporary directory for outputs. */
  readonly tmp: string;
  /** A project root for documents the tests write. */
  readonly root: string;
  /** Runs `typst` with the package installed. */
  typst(args: readonly string[]): SpawnSyncReturns<string>;
  /** Removes the temporary directory. */
  remove(): void;
}

/** Installs the package, with a freshly built engine, in a new directory. */
export async function installPackage(): Promise<Installed> {
  const tmp = mkdtempSync(join(tmpdir(), 'algomotion-typst-'));
  const packages = join(tmp, 'packages');
  const root = join(tmp, 'root');
  const installed = join(packages, 'local', field('name'), field('version'));
  mkdirSync(installed, { recursive: true });
  mkdirSync(root);
  for (const file of ['typst.toml', 'lib.typ', 'plugin.wasm', 'OFL.txt'])
    copyFileSync(join(packageDir, file), join(installed, file));
  const { bytecode } = await buildEngine();
  writeFileSync(join(installed, 'engine.bc'), bytecode);
  return {
    tmp,
    root,
    typst(args) {
      const result = spawnSync(
        'typst',
        [...args, '--package-path', packages, '--ignore-system-fonts'],
        { encoding: 'utf8', maxBuffer: 1 << 28 },
      );
      if (result.error !== undefined)
        throw new Error(
          `test:typst needs the typst command: ${result.error.message}`,
        );
      return result;
    },
    remove: () => rmSync(tmp, { recursive: true, force: true }),
  };
}

/**
 * Why the slide frameworks cannot be used, or undefined when they can.
 * Typst downloads them from Typst Universe the first time, so this runs
 * while the tests are collected, before any of them is chosen.
 */
export function frameworksMissing(): string | undefined {
  const dir = mkdtempSync(join(tmpdir(), 'algomotion-frameworks-'));
  try {
    const probe = join(dir, 'probe.typ');
    writeFileSync(probe, FRAMEWORKS.map((f) => `#import "${f}"\n`).join(''));
    const result = spawnSync(
      'typst',
      ['compile', probe, join(dir, 'probe.pdf')],
      { encoding: 'utf8' },
    );
    if (result.error !== undefined)
      return `The typst command is missing: ${result.error.message}`;
    return result.status === 0
      ? undefined
      : `Typst could not load ${FRAMEWORKS.join(' and ')}, so the slide tests are skipped: ${result.stderr.trim()}`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The SVG `algomotion export` draws for a document, in the layout the Typst
 * function draws in by default: narrow for notes, wide for slides (ADR
 * 0029).
 */
export function exported(
  document: unknown,
  steps: readonly (string | number)[],
  theme: ThemeName,
  layout: 'wide' | 'narrow' = 'narrow',
): string[] {
  const series = exportFigures(document, { steps, theme, layout });
  if (!series.ok) throw new Error(JSON.stringify(series.error));
  return series.value.figures.map((f) => f.svg);
}
