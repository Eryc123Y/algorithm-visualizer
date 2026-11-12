import { defineConfig } from 'vitest/config';

/**
 * The built Worker in wrangler's local runtime (workerd, from npm), spoken
 * to by the SDK's client over HTTP. Run after `npm run build`, as
 * `npm run test:worker` does. Nothing is deployed.
 */
export default defineConfig({
  test: {
    name: 'worker-local',
    environment: 'node',
    include: ['tests/local/**/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
