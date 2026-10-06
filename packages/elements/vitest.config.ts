import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their TypeScript sources.
const conditions = [
  '@algoviz/source',
  'browser',
  'import',
  'module',
  'default',
];

export default defineConfig({
  resolve: { conditions },
  test: {
    name: 'elements',
    environment: 'happy-dom',
    include: ['tests/**/*.spec.ts'],
  },
});
