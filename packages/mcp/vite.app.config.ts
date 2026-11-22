/**
 * Builds the page algomotion_show opens into one self-contained HTML file,
 * ui/player.html: MCP Apps hosts serve it from a sandbox with no other
 * files, so the scripts are inlined.
 */
import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vite';

import {
  htmlComment,
  noticesFor,
  packagesIn,
  thirdPartyNotices,
} from '../../scripts/third-party.ts';

/** Moves the built script chunks into the HTML file. */
const inlineScripts = (): Plugin => ({
  name: 'algomotion:inline-scripts',
  enforce: 'post',
  generateBundle(_, bundle) {
    for (const html of Object.values(bundle)) {
      if (html.type !== 'asset' || !html.fileName.endsWith('.html')) continue;
      let text = String(html.source);
      const modules: string[] = [];
      for (const [name, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk') continue;
        modules.push(...chunk.moduleIds);
        const tag = new RegExp(
          `<script type="module" crossorigin src="[^"]*${chunk.fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"></script>`,
        );
        // Keep "</script" in the code from closing the tag early.
        const code = chunk.code.replaceAll('</script', '<\\/script');
        text = text.replace(
          tag,
          () => `<script type="module">${code}</script>`,
        );
        delete bundle[name];
      }
      if (/<script[^>]* src=/.test(text))
        throw new Error('A script was left out of the player page');
      // Hosts receive this file alone, so it carries the notices of the
      // software it bundles.
      html.source = `${text.trimEnd()}\n${htmlComment(noticesFor(packagesIn(modules)))}\n`;
    }
  },
});

export default defineConfig({
  root: fileURLToPath(new URL('app', import.meta.url)),
  base: './',
  resolve: {
    conditions: [
      '@algomotion/source',
      'browser',
      'import',
      'module',
      'default',
    ],
    // The page never runs an algorithm: the server does.
    alias: {
      '@algomotion/recipes': fileURLToPath(
        new URL('app/no-recipes.ts', import.meta.url),
      ),
    },
  },
  // THIRD-PARTY-NOTICES.md goes next to the page too, in the npm package.
  plugins: [thirdPartyNotices({ emit: true }), inlineScripts()],
  build: {
    outDir: fileURLToPath(new URL('ui', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    modulePreload: false,
    rollupOptions: {
      input: fileURLToPath(new URL('app/player.html', import.meta.url)),
      // One script: the player's import of the registry, on demand
      // (ADR 0032), would otherwise split the bundle.
      output: { codeSplitting: false },
    },
  },
});
