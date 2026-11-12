/**
 * Bundles the Worker into one ES module, `dist/worker.js`, with the guide
 * and the player page embedded (ADR 0039): the server's two file reads
 * become the files' text, so the bundle needs no file system. wrangler
 * deploys that file as it is.
 */
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

import {
  embeddedGuide,
  embeddedPlayer,
} from '../../packages/mcp/scripts/embed.ts';

export default defineConfig({
  resolve: {
    conditions: [
      '@algomotion/source',
      'workerd',
      'worker',
      'browser',
      'module',
      'import',
      'default',
    ],
  },
  plugins: [embeddedGuide(), embeddedPlayer()],
  build: {
    target: 'es2023',
    minify: true,
    reportCompressedSize: false,
    lib: {
      entry: fileURLToPath(new URL('src/worker.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'worker.js',
    },
  },
});
