import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their TypeScript sources.
const conditions = ['@algoviz/source', 'import', 'module', 'node', 'default'];

// The package compiled by LaTeX: needs TeX Live 2024 or later with
// latexmk, and runs the algoviz command (npm run test:latex).
export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    name: 'latex-compile',
    environment: 'node',
    include: ['tests/latex/**/*.spec.ts'],
    hookTimeout: 600_000,
    testTimeout: 300_000,
    // One TeX run at a time per file keeps the timings readable.
    fileParallelism: false,
  },
});
