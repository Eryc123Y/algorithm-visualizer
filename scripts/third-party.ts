/**
 * The third-party software that the builds bundle, which
 * THIRD-PARTY-NOTICES.md names and whose notices it carries. The bundles
 * that go out (the Typst engine, the standalone command, the player and the
 * MCP server's player page) fail to build if they contain an npm package
 * the notices do not name.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

/** The notices, at the root of the repository. */
export const NOTICES = fileURLToPath(
  new URL('../THIRD-PARTY-NOTICES.md', import.meta.url),
);

const MODULES = '/node_modules/';

/** The npm packages among a bundle's module ids, by name, sorted. */
export function packagesIn(moduleIds: Iterable<string>): string[] {
  const names = new Set<string>();
  for (const id of moduleIds) {
    const path = id.replaceAll('\\', '/');
    const at = path.lastIndexOf(MODULES);
    if (at < 0) continue;
    const [first = '', second = ''] = path
      .slice(at + MODULES.length)
      .split('/');
    names.add(first.startsWith('@') ? `${first}/${second}` : first);
  }
  return [...names].sort();
}

/** The names the notices leave out; they name each in backticks. */
export function unnoticed(
  names: readonly string[],
  notices: string = readFileSync(NOTICES, 'utf8'),
): string[] {
  return names.filter((name) => !notices.includes(`\`${name}\``));
}

/**
 * The notices of some npm packages: the sections of THIRD-PARTY-NOTICES.md
 * that name them, under its title, for a file that carries only those.
 */
export function noticesFor(
  packages: readonly string[],
  notices: string = readFileSync(NOTICES, 'utf8'),
): string {
  const sections = notices.split(/^(?=### )/m).slice(1);
  const named = (name: string) => `\`${name}\``;
  const missing = packages.filter(
    (name) => !sections.some((section) => section.includes(named(name))),
  );
  if (missing.length > 0) throw new Error(unnoticedError(missing));
  const chosen = sections.filter((section) =>
    packages.some((name) => section.includes(named(name))),
  );
  return [
    'Third-party notices: this file contains the software below, under its own licence.',
    '',
    ...chosen.map((section) => section.trim() + '\n'),
  ].join('\n');
}

/** Text as an HTML comment, which ends only where the comment does. */
export const htmlComment = (text: string): string =>
  `<!--\n${text.replaceAll('-->', '-- >').replaceAll('--!>', '--! >')}\n-->`;

/** The error for a bundle with packages the notices leave out. */
export function unnoticedError(missing: readonly string[]): string {
  return (
    `The bundle contains ${missing.join(', ')}, which THIRD-PARTY-NOTICES.md ` +
    'does not name: add each with its licence and notice.'
  );
}

/**
 * A Vite plugin that fails the build when a chunk bundles an npm package
 * that THIRD-PARTY-NOTICES.md does not name, and, with `emit`, writes the
 * notices next to the bundle.
 */
export function thirdPartyNotices({ emit = false } = {}): Plugin {
  return {
    name: 'algomotion:third-party-notices',
    generateBundle(_, bundle) {
      const ids = Object.values(bundle).flatMap((output) =>
        output.type === 'chunk' ? output.moduleIds : [],
      );
      const missing = unnoticed(packagesIn(ids));
      if (missing.length > 0) this.error(unnoticedError(missing));
      if (emit)
        this.emitFile({
          type: 'asset',
          fileName: 'THIRD-PARTY-NOTICES.md',
          source: readFileSync(NOTICES, 'utf8'),
        });
    },
  };
}
