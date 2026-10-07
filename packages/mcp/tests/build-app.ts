/** Builds the player page once before the tests that serve it. */
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

export default async function setup(): Promise<void> {
  await build({
    configFile: fileURLToPath(
      new URL('../vite.app.config.ts', import.meta.url),
    ),
    logLevel: 'warn',
  });
}
