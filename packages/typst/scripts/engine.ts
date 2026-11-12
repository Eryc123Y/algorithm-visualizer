/**
 * Builds the engine for the Typst package (ADR 0026): bundles the entry in
 * `src/main.ts` with Vite, then compiles the bundle to QuickJS bytecode by
 * running the committed plugin. Needs Node only, no Rust toolchain.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { build, type Rollup } from 'vite';

import { instantiatePlugin } from './host.ts';

/** Files of the workspace. */
export const paths = {
  root: fileURLToPath(new URL('..', import.meta.url)),
  plugin: fileURLToPath(new URL('../package/plugin.wasm', import.meta.url)),
  engine: fileURLToPath(new URL('../package/engine.bc', import.meta.url)),
};

/** The engine entry and everything it imports, as one minified ES module. */
export async function bundleEngine(): Promise<string> {
  const result = await build({
    configFile: false,
    root: paths.root,
    logLevel: 'silent',
    // Workspace packages resolve to their TypeScript sources.
    resolve: {
      conditions: ['@algomotion/source', 'module', 'import', 'default'],
    },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      write: false,
      minify: true,
      target: 'es2023',
      reportCompressedSize: false,
      lib: { entry: 'src/main.ts', formats: ['es'], fileName: 'engine' },
    },
  });
  const outputs = (
    Array.isArray(result) ? result : [result]
  ) as Rollup.RollupOutput[];
  const chunks = outputs
    .flatMap((o) => o.output)
    .filter((o): o is Rollup.OutputChunk => o.type === 'chunk');
  if (chunks.length !== 1)
    throw new Error(`Expected one chunk, got ${chunks.length}`);
  return chunks[0]!.code;
}

/** Compiles the bundle to QuickJS bytecode with the plugin's `compile`. */
export async function compileEngine(
  plugin: Uint8Array<ArrayBuffer>,
  source: string,
): Promise<Uint8Array> {
  const instance = await instantiatePlugin(plugin);
  return instance.call('compile', new TextEncoder().encode(source));
}

/** The committed plugin, and the engine's bytecode built for it. */
export async function buildEngine(): Promise<{
  readonly plugin: Uint8Array<ArrayBuffer>;
  readonly bytecode: Uint8Array;
}> {
  const plugin = new Uint8Array(await readFile(paths.plugin));
  return {
    plugin,
    bytecode: await compileEngine(plugin, await bundleEngine()),
  };
}
