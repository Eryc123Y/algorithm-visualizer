/**
 * Standalone bundle for <script> tags and CDNs (e.g. AI chat artifacts):
 * includes Lit and every algoviz package, and defines <algo-player>. The
 * themes' web fonts go next to it in fonts/, where the player looks for
 * them (ADR 0030), and next to the modules that tsc wrote, for the same
 * reason.
 */
import { cpSync } from 'node:fs';

import { defineConfig, type Plugin } from 'vite';

const copyFonts = (): Plugin => ({
  name: 'algoviz:copy-fonts',
  closeBundle() {
    for (const to of ['dist/cdn/fonts', 'dist/fonts'])
      cpSync('src/fonts', to, { recursive: true });
  },
});

export default defineConfig({
  resolve: {
    conditions: ['@algoviz/source', 'browser', 'import', 'module', 'default'],
  },
  plugins: [copyFonts()],
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
