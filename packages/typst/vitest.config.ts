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
// before a release gets time in proportion. Coverage (CI runs
// test:coverage) instruments the engine the plugin's bundle is built from,
// which makes drawing every registry example in every theme about twice as
// slow: about 170 s on a GitHub runner, past the 120 s it needs without.
const coverage = process.argv.some((arg) => arg.startsWith('--coverage'));
const testTimeout =
  120_000 *
  Math.max(1, Number(process.env['FUZZ_RUNS'] ?? 30) / 30) *
  (coverage ? 3 : 1);

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
