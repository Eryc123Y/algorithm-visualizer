import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their TypeScript sources.
const conditions = [
  '@algomotion/source',
  'import',
  'module',
  'node',
  'default',
];

// Property tests run FUZZ_RUNS cases each, 60 by default. A deeper run
// before a release gets time in proportion, rather than the 5 s default.
const testTimeout =
  5000 * Math.max(1, Number(process.env['FUZZ_RUNS'] ?? 60) / 60);

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    name: 'svg',
    testTimeout,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
});
