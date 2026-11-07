import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their TypeScript sources.
const conditions = ['@algoviz/source', 'import', 'module', 'node', 'default'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    name: 'typst',
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    // The plugin tests bundle the engine and run it in WebAssembly first.
    hookTimeout: 120_000,
    testTimeout: 120_000,
  },
});
