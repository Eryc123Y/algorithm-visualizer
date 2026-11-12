import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/*',
      'apps/playground',
      'apps/site',
      'apps/worker',
      'evals',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'packages/*/src/**/*.ts',
        'apps/playground/src/**/*.{ts,vue}',
        'apps/site/src/**/*.ts',
      ],
      exclude: [
        'apps/playground/src/main.ts',
        'apps/site/src/play/main.ts',
        '**/*.d.ts',
      ],
    },
  },
});
