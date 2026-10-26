/**
 * Global setup: builds from source what the embedding and MCP App tests
 * load, so they check what `npm run build` would ship: the standalone
 * <algo-player> bundle, the MCP player page, and the test host for it.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

const packages = new URL('../../../../packages/', import.meta.url);

/** Where the test host's script is built. */
export const HOST_SCRIPT = fileURLToPath(
  new URL('../../node_modules/.tmp/e2e/mcp-host.js', import.meta.url),
);

const viteBuild = (cwd: string, config: string) =>
  execFileSync(
    'npx',
    ['vite', 'build', '--config', config, '--logLevel', 'warn'],
    { cwd: fileURLToPath(new URL(cwd, packages)), stdio: 'inherit' },
  );

export default async function buildBundle(): Promise<void> {
  viteBuild('elements/', 'vite.cdn.config.ts');
  viteBuild('mcp/', 'vite.app.config.ts');
  await build({
    configFile: false,
    logLevel: 'warn',
    build: {
      outDir: fileURLToPath(new URL('.', `file://${HOST_SCRIPT}`)),
      emptyOutDir: true,
      target: 'es2022',
      lib: {
        entry: fileURLToPath(new URL('mcp-host.ts', import.meta.url)),
        formats: ['es'],
        fileName: () => 'mcp-host.js',
      },
    },
  });
}
