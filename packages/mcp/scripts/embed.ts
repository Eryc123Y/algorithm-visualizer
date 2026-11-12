/**
 * Vite plugins that replace the server's two file reads with the files'
 * text, for builds that run without a file system (ADR 0039): the
 * standalone executable embeds the guide, and the Worker embeds the guide
 * and the player page.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

/** The `packages/mcp` directory. */
export const mcpRoot = fileURLToPath(new URL('..', import.meta.url));

/** The guide's files, by their path inside `guide/`. */
export function guideFiles(
  dir = join(mcpRoot, 'guide'),
  prefix = '',
): Record<string, string> {
  const files: Record<string, string> = {};
  for (const name of readdirSync(dir).toSorted()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      Object.assign(files, guideFiles(path, `${prefix}${name}/`));
    else if (name.endsWith('.md'))
      files[`${prefix}${name}`] = readFileSync(path, 'utf8');
  }
  return files;
}

/** Replaces `src/guide-files.ts`, which reads `guide/`, with the files' text. */
export const embeddedGuide = (): Plugin => ({
  name: 'algoviz-embedded-guide',
  load(id) {
    if (!id.endsWith('/src/guide-files.ts')) return null;
    return [
      `const files = ${JSON.stringify(guideFiles())};`,
      'export const readGuideFile = (path) => {',
      '  const text = files[path];',
      '  if (text === undefined) throw new Error(`No guide file ${path}`);',
      '  return text;',
      '};',
    ].join('\n');
  },
});

/**
 * Replaces `src/player-file.ts`, which reads `ui/player.html`, with the
 * page's text; the page must be built first (`npm run build:app`).
 */
export const embeddedPlayer = (): Plugin => ({
  name: 'algoviz-embedded-player',
  load(id) {
    if (!id.endsWith('/src/player-file.ts')) return null;
    const html = readFileSync(join(mcpRoot, 'ui', 'player.html'), 'utf8');
    return `export const readPlayerFile = () => ${JSON.stringify(html)};`;
  },
});
