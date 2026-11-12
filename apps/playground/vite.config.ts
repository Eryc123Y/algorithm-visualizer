import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defaultClientConditions, defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    vue({
      template: {
        // <algo-*> are Web Components from @algomotion/elements.
        compilerOptions: { isCustomElement: (tag) => tag.startsWith('algo-') },
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    // Resolve workspace packages to their TypeScript sources, so the
    // playground never needs them to be built first.
    conditions: ['@algomotion/source', ...defaultClientConditions],
  },
});
