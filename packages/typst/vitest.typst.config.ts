import { defineConfig } from 'vitest/config';

// The Typst tests need the `typst` command, so they run apart from
// `npm run check`: `npm run test:typst`.
const conditions = ['@algoviz/source', 'import', 'module', 'node', 'default'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    name: 'typst-cli',
    environment: 'node',
    include: ['tests/typst/**/*.spec.ts'],
    hookTimeout: 300_000,
    testTimeout: 300_000,
  },
});
