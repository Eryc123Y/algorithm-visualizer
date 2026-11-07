import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their TypeScript sources.
const conditions = ['@algoviz/source', 'import', 'module', 'node', 'default'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    name: 'mcp',
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    // These build the standalone executable with Rust: npm run test:standalone.
    exclude: ['tests/standalone/**'],
    globalSetup: ['tests/build-app.ts'],
  },
});
