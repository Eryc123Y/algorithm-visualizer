/**
 * Standalone bundle for <script> tags and CDNs (e.g. AI chat artifacts):
 * includes Lit and every algoviz package, and defines <algo-player>.
 */
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    conditions: ['@algoviz/source', 'browser', 'import', 'module', 'default'],
  },
  build: {
    outDir: 'dist/cdn',
    emptyOutDir: true,
    lib: {
      entry: 'src/define.ts',
      formats: ['es'],
      fileName: () => 'algoviz-player.js',
    },
  },
});
