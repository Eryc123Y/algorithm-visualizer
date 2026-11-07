import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their TypeScript sources.
const conditions = ['@algoviz/source', 'import', 'module', 'node', 'default'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    name: 'fonts',
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
});
