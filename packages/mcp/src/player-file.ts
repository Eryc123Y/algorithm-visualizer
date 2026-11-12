/**
 * The player page's HTML, read from `ui/player.html`, which the app build
 * writes next to both `src/` and `dist/`. Builds for runtimes without a
 * file system, such as the Worker (ADR 0039), replace this module with one
 * that holds the page's text.
 */
import { readFileSync } from 'node:fs';

/** The player page, or an error naming the build that writes it. */
export function readPlayerFile(): string {
  const file = new URL('../ui/player.html', import.meta.url);
  try {
    return readFileSync(file, 'utf8');
  } catch {
    throw new Error(
      `The player page is missing at ${file.pathname}; build it with "npm run build -w @algomotion/mcp".`,
    );
  }
}
