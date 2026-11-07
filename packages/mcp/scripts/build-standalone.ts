/**
 * Builds the standalone `algoviz` executable (ADR 0027): the CLI bundled
 * with Vite, compiled to QuickJS bytecode and included in a small Rust
 * program that runs it with QuickJS-ng. Run it with
 * `npm run build:standalone -w @algoviz/mcp`; add `-- --target <triple>`
 * to build for another platform the Rust toolchain has.
 *
 * Needs rustup, which installs the Rust version pinned in
 * standalone/rust-toolchain.toml, and a C compiler for QuickJS (the
 * system's cc). Crates come from standalone/Cargo.lock. The executable is
 * written to dist/standalone/ and is not committed: it changes with the
 * engine and is built per platform. Publishing it waits for roadmap 4.3.
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { delimiter, dirname, join } from 'node:path';

import { bundleStandalone, paths } from './standalone.ts';

const { crate, target } = paths;

/** Runs a command, or fails the build with its output. */
function run(
  command: string,
  args: readonly string[],
  options: { env?: NodeJS.ProcessEnv; inherit?: boolean } = {},
): string {
  const result = spawnSync(command, args, {
    cwd: crate,
    env: options.env ?? process.env,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe',
  });
  if (result.error !== undefined)
    throw new Error(`Cannot run ${command}: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(' ')} exited with ${result.status}` +
        (options.inherit ? '; see its output above' : `:\n${result.stderr}`),
    );
  return result.stdout ?? '';
}

/** The pinned toolchain's bin directory, installed by rustup if missing. */
function toolchainBin(): string {
  const pinned = /channel\s*=\s*"([^"]+)"/.exec(
    readFileSync(join(crate, 'rust-toolchain.toml'), 'utf8'),
  )?.[1];
  if (pinned === undefined)
    throw new Error('standalone/rust-toolchain.toml names no channel');
  try {
    return dirname(
      run('rustup', ['which', 'cargo', '--toolchain', pinned]).trim(),
    );
  } catch {
    run('rustup', ['toolchain', 'install', pinned, '--profile', 'minimal'], {
      inherit: true,
    });
    return dirname(
      run('rustup', ['which', 'cargo', '--toolchain', pinned]).trim(),
    );
  }
}

/** The value of `--target`, if given. */
function targetTriple(argv: readonly string[]): string | undefined {
  const k = argv.indexOf('--target');
  return k >= 0
    ? argv[k + 1]
    : argv.find((a) => a.startsWith('--target='))?.slice(9);
}

async function main(argv: readonly string[]): Promise<void> {
  const triple = targetTriple(argv);
  mkdirSync(target, { recursive: true });
  writeFileSync(paths.bundle, await bundleStandalone());
  console.log(`bundle: ${statSync(paths.bundle).size} bytes`);

  const bin = toolchainBin();
  run(
    'cargo',
    [
      'build',
      '--release',
      '--locked',
      ...(triple === undefined ? [] : ['--target', triple]),
    ],
    {
      env: {
        ...process.env,
        PATH: [bin, process.env['PATH'] ?? ''].join(delimiter),
        CARGO_TARGET_DIR: target,
        ALGOVIZ_BUNDLE: paths.bundle,
      },
      inherit: true,
    },
  );
  const windows =
    triple === undefined
      ? process.platform === 'win32'
      : triple.includes('windows');
  const name = windows ? 'algoviz.exe' : 'algoviz';
  const built = join(
    target,
    ...(triple === undefined ? [] : [triple]),
    'release',
    name,
  );
  mkdirSync(paths.out, { recursive: true });
  const output = join(paths.out, name);
  copyFileSync(built, output);
  // The minimal toolchain cannot strip; the system's strip can, where there is one.
  if (!windows && spawnSync('strip', [output]).status !== 0)
    console.warn(
      'strip failed or is missing; the executable keeps its symbols',
    );
  console.log(`${output}: ${statSync(output).size} bytes`);
}

main(process.argv.slice(2)).catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 2;
});
