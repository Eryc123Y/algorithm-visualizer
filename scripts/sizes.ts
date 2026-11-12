/**
 * Builds what users download and reports its raw, gzip and brotli sizes
 * (roadmap 4.4): the player for CDNs and for apps, the Typst and LaTeX
 * packages, the Worker, the standalone executable and the site.
 *
 *   npm run sizes                  build everything, then print the table
 *   npm run sizes -- --no-build    measure what is already built
 *   npm run sizes -- --write       also write the table to docs/sizes.md
 *
 * The standalone executable needs the Rust toolchain (ADR 0027); without
 * cargo it is left out. The Typst plugin is measured as committed, since
 * rebuilding it needs a pinned LLVM (ADR 0026).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { arch, platform } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

import { measure, replaceBetween, table, type Row } from './sizes-measure.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const at = (...parts: string[]) => join(root, ...parts);
const args = new Set(process.argv.slice(2));

/** Runs a command at the root, printing its output only if it fails. */
function run(command: string, commandArgs: readonly string[]): string {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // npm is a batch file on Windows.
    shell: platform() === 'win32',
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stdout + result.stderr);
    throw new Error(`${command} ${commandArgs.join(' ')} failed`);
  }
  return result.stdout;
}

const hasCargo = () => spawnSync('cargo', ['--version']).status === 0;

/** The player as an app's bundler ships it: minified, with code splitting. */
async function buildElementsForApps(outDir: string): Promise<void> {
  await build({
    configFile: false,
    logLevel: 'warn',
    root: at('packages/elements'),
    resolve: {
      conditions: ['@algoviz/source', 'browser', 'import', 'module', 'default'],
    },
    build: {
      outDir,
      emptyOutDir: true,
      minify: true,
      reportCompressedSize: false,
      rollupOptions: {
        input: at('packages/elements/src/define.ts'),
        preserveEntrySignatures: 'allow-extension',
        output: {
          entryFileNames: 'define.js',
          chunkFileNames: (chunk) =>
            chunk.moduleIds.some((id) => id.includes('/packages/recipes/'))
              ? 'recipes.js'
              : '[name]-[hash].js',
        },
      },
    },
  });
}

const APP_DIR = at('node_modules/.cache/algoviz-sizes/elements');

async function buildAll(): Promise<void> {
  const steps: [string, () => unknown][] = [
    [
      'the elements and the CDN bundle',
      () => run('npm', ['run', 'build', '-w', '@algoviz/elements']),
    ],
    ['the elements for apps', () => buildElementsForApps(APP_DIR)],
    [
      'the Typst engine',
      () => run('npm', ['run', 'build', '-w', '@algoviz/typst']),
    ],
    ['the Worker', () => run('npm', ['run', 'build', '-w', '@algoviz/worker'])],
    ['the site', () => run('npm', ['run', 'build', '-w', '@algoviz/site'])],
  ];
  if (hasCargo())
    steps.push([
      'the standalone executable',
      () => run('npm', ['run', 'build:standalone', '-w', '@algoviz/mcp']),
    ]);
  else console.warn('cargo not found: the standalone executable is left out.');
  for (const [name, step] of steps) {
    console.log(`Building ${name}…`);
    await step();
  }
}

const ext =
  (...exts: string[]) =>
  (file: string) =>
    exts.some((e) => file.endsWith(e));

function rows(): Row[] {
  const cdn = at('packages/elements/dist/cdn');
  const typst = at('packages/typst/package');
  const site = at('apps/site/dist');
  const exe = platform() === 'win32' ? 'algoviz.exe' : 'algoviz';
  return [
    {
      name: 'CDN `algoviz-player.js`',
      note: 'the `<algo-player>` element with Lit and the engine, as a `<script type="module">` loads it',
      size: measure(join(cdn, 'algoviz-player.js')),
    },
    {
      name: 'CDN `algoviz-recipes.js`',
      note: 'the registry, loaded on first use of `algorithm` (ADR 0032)',
      size: measure(join(cdn, 'algoviz-recipes.js')),
    },
    {
      name: 'CDN `fonts/`',
      note: 'every theme’s web fonts; a player loads only its theme’s',
      size: measure(join(cdn, 'fonts'), ext('.woff2')),
    },
    {
      name: '`@algoviz/elements` in an app',
      note: 'the `define` entry minified by Vite, without the registry chunk',
      size: measure(APP_DIR, (f) => f.endsWith('.js') && f !== 'recipes.js'),
    },
    {
      name: '… its registry chunk',
      note: 'the same, the registry loaded on first use',
      size: measure(join(APP_DIR, 'recipes.js')),
    },
    {
      name: 'Typst `plugin.wasm`',
      note: 'QuickJS in WebAssembly, as committed (ADR 0026)',
      size: measure(join(typst, 'plugin.wasm')),
    },
    {
      name: 'Typst `engine.bc`',
      note: 'the engine as QuickJS bytecode',
      size: measure(join(typst, 'engine.bc')),
    },
    {
      name: 'Typst package',
      note: 'everything in `packages/typst/package/`',
      size: measure(typst),
    },
    {
      name: 'LaTeX package',
      note: 'everything in `packages/latex/package/`',
      size: measure(at('packages/latex/package')),
    },
    {
      name: 'Worker `worker.js`',
      note: 'the MCP server with the guide and player page (ADR 0039)',
      size: measure(at('apps/worker/dist/worker.js')),
    },
    {
      name: `Standalone \`${exe}\``,
      note: `the CLI for ${platform()}-${arch()} (ADR 0027)`,
      size: measure(at('packages/mcp/dist/standalone', exe)),
    },
    {
      name: 'Site scripts and styles',
      note: '`.js` and `.css` under `apps/site/dist/`',
      size: measure(site, ext('.js', '.css')),
    },
    {
      name: 'Site pages',
      note: '`.html` under `apps/site/dist/`',
      size: measure(site, ext('.html')),
    },
    {
      name: 'Site, everything',
      note: 'all of `apps/site/dist/`, fonts and images included',
      size: measure(site),
    },
  ];
}

/** Today's date and the commit measured, noting local changes. */
function provenance(): string {
  const commit = run('git', ['rev-parse', '--short', 'HEAD']).trim();
  const dirty = run('git', ['status', '--porcelain'])
    .split('\n')
    .some((l) => l.trim() !== '' && !l.endsWith('docs/sizes.md'));
  const date = new Date().toISOString().slice(0, 10);
  const built = args.has('--no-build') ? ', from outputs built earlier' : '';
  return `Measured on ${date} at commit \`${commit}\`${dirty ? ' with local changes' : ''}${built}, with Node ${process.versions.node}; gzip at level 9 and brotli at quality 11, each file on its own.`;
}

if (!args.has('--no-build')) await buildAll();
const output = `${provenance()}\n\n${table(rows())}`;
console.log(output);
if (args.has('--write')) {
  const doc = at('docs/sizes.md');
  writeFileSync(doc, replaceBetween(readFileSync(doc, 'utf8'), output));
  console.log('Wrote docs/sizes.md.');
}
