/**
 * The standalone executable's JavaScript (ADR 0027): the CLI and the
 * engine bundled into one ES module for QuickJS, with `node:fs` and
 * `node:path` replaced by modules over the Rust host's functions, and the
 * guide's Markdown included. The build script and the tests share it.
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build, type Rollup } from 'vite';

import { embeddedGuide } from './embed.ts';

/** Directories and files of the standalone build. */
export const paths = (() => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const crate = join(root, 'standalone');
  const target = join(crate, 'target');
  return {
    root,
    crate,
    target,
    bundle: join(target, 'algomotion.js'),
    out: join(root, 'dist', 'standalone'),
    executable: join(
      root,
      'dist',
      'standalone',
      process.platform === 'win32' ? 'algomotion.exe' : 'algomotion',
    ),
  };
})();
const { root, crate } = paths;

/** The CLI and the engine as one ES module for QuickJS. */
export async function bundleStandalone(): Promise<string> {
  const js = join(crate, 'js');
  const result = await build({
    configFile: false,
    root,
    logLevel: 'silent',
    resolve: {
      conditions: ['@algomotion/source', 'module', 'import', 'default'],
      alias: [
        { find: /^node:fs$/, replacement: join(js, 'fs.ts') },
        { find: /^node:path$/, replacement: join(js, 'path.ts') },
      ],
    },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    plugins: [embeddedGuide()],
    build: {
      write: false,
      minify: true,
      target: 'es2023',
      reportCompressedSize: false,
      lib: {
        entry: join(js, 'main.ts'),
        formats: ['es'],
        fileName: 'algomotion',
      },
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
  const chunk = chunks[0]!;
  // Nothing may be left to import, from Node.js or elsewhere: QuickJS has
  // no modules but this one. (`process` appears only in the CLI's default
  // arguments, which the entry always passes.)
  const left = [...chunk.imports, ...chunk.dynamicImports];
  if (left.length > 0 || /["']node:[a-z]/.test(chunk.code))
    throw new Error(`The bundle still imports ${left.join(', ') || 'node:'}`);
  const code = chunk.code;
  return code;
}
