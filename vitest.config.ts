import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/playground', 'evals'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'apps/playground/src/**/*.{ts,vue}'],
      exclude: ['apps/playground/src/main.ts', '**/*.d.ts'],
    },
  },
});
