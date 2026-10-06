import { fileURLToPath } from 'node:url';

import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      name: 'playground',
      environment: 'happy-dom',
      include: ['tests/unit/**/*.spec.ts', 'src/**/*.spec.ts'],
      exclude: [...configDefaults.exclude, 'tests/e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
);
