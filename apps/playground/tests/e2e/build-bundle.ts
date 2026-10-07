/**
 * Global setup: builds the standalone <algo-player> bundle from source, so
 * the embedding tests check what `npm run build` would ship.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default function buildBundle(): void {
  execFileSync(
    'npx',
    ['vite', 'build', '--config', 'vite.cdn.config.ts', '--logLevel', 'warn'],
    {
      cwd: fileURLToPath(
        new URL('../../../../packages/elements/', import.meta.url),
      ),
      stdio: 'inherit',
    },
  );
}
