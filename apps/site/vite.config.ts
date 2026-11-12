/**
 * The static site (ADR 0040): for now the share page, `play/`. The build
 * is plain files under `dist/`, with relative URLs, so any static host
 * serves it at any path; `_headers` gives Cloudflare Pages its headers.
 */
import { fileURLToPath, URL } from 'node:url';

import { defaultClientConditions, defineConfig, type Plugin } from 'vite';

import { headersFile, withPolicy } from './src/headers.ts';

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * The pages' security headers: the policy in a `<meta>` right after the
 * charset, before anything it governs (only in the build: the dev server
 * needs its own scripts and socket), and every header in `_headers`.
 */
const securityHeaders = (): Plugin => ({
  name: 'algoviz:security-headers',
  apply: 'build',
  transformIndexHtml(html, { filename }) {
    return withPolicy(html, filename);
  },
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: '_headers',
      source: headersFile(),
    });
  },
});

export default defineConfig({
  base: './',
  resolve: {
    // Workspace packages resolve to their TypeScript sources.
    conditions: ['@algoviz/source', ...defaultClientConditions],
  },
  plugins: [securityHeaders()],
  build: {
    target: 'es2022',
    // Every asset as a file: the policy allows no data: URLs.
    assetsInlineLimit: 0,
    rollupOptions: {
      input: { play: page('play/index.html') },
    },
  },
});
