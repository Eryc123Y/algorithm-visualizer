import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their TypeScript sources.
const conditions = [
  '@algomotion/source',
  'import',
  'module',
  'node',
  'default',
];

/** The Worker's own logic, run in Node; `npm run test:worker` runs the Worker itself. */
export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    name: 'worker',
    environment: 'node',
    include: ['tests/unit/**/*.spec.ts'],
  },
});
