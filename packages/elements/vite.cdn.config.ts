/**
 * Standalone bundle for <script> tags and CDNs (e.g. AI chat artifacts):
 * includes Lit and every algoviz package, and defines <algo-player>. The
 * themes' web fonts go next to it in fonts/, where the player looks for
 * them (ADR 0030), and next to the modules that tsc wrote, for the same
 * reason.
 *
 * The registry, which only players with `algorithm` need, is a second
 * file next to it, algoviz-recipes.js, imported on first use (ADR 0032).
 * It imports the engine from algoviz-player.js, which may therefore
 * export more than its entry does, so no third, shared file is needed.
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
    sourcemap: true,
    lib: {
      entry: 'src/define.ts',
      formats: ['es'],
      fileName: () => 'algoviz-player.js',
    },
    rollupOptions: {
      preserveEntrySignatures: 'allow-extension',
      output: {
        // Library mode minifies ES output without its whitespace and keeps
        // pure annotations, for bundlers that use the files; browsers load
        // these as they are, so minify them fully. Licence comments stay.
        minify: { codegen: true },
        comments: { legal: true, annotation: false, jsdoc: false },
        chunkFileNames: (chunk) =>
          chunk.moduleIds.some((id) => id.includes('/packages/recipes/'))
            ? 'algoviz-recipes.js'
            : 'algoviz-[name]-[hash].js',
      },
    },
  },
});
