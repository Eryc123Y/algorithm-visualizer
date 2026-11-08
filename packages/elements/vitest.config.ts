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
    // The player links its web fonts; the tests need not download them.
    environmentOptions: {
      happyDOM: {
        settings: {
          disableCSSFileLoading: true,
          handleDisabledFileLoadingAsSuccess: true,
        },
      },
    },
    include: ['tests/**/*.spec.ts'],
  },
});
