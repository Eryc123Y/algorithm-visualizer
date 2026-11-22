import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their TypeScript sources.
const conditions = [
  '@algomotion/source',
  'import',
  'module',
  'node',
  'default',
];

// The generated requests run FUZZ_RUNS cases, 30 by default; a deeper run
// before a release gets time in proportion. Drawing every registry example
// in every theme takes about 120 s on a GitHub runner and 140 s on a busy
// laptop; it gets twice that. Coverage (CI runs test:coverage) instruments
// the engine the plugin's bundle is built from, which makes it about twice
// as slow again: 170 to 280 s on a GitHub runner.
const coverage = process.argv.some((arg) => arg.startsWith('--coverage'));
const testTimeout =
  300_000 *
  Math.max(1, Number(process.env['FUZZ_RUNS'] ?? 30) / 30) *
  (coverage ? 2 : 1);

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    name: 'typst',
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    // These need the typst command: npm run test:typst.
    exclude: ['tests/typst/**'],
    // The plugin tests bundle the engine and run it in WebAssembly first.
    hookTimeout: 120_000,
    testTimeout,
  },
});
