import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their TypeScript sources.
const conditions = ['@algoviz/source', 'import', 'module', 'node', 'default'];

// The standalone executable's tests build it, which needs the Rust
// toolchain: npm run test:standalone.
export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    name: 'mcp-standalone',
    environment: 'node',
    include: ['tests/standalone/**/*.spec.ts'],
    hookTimeout: 600_000,
    testTimeout: 120_000,
  },
});
