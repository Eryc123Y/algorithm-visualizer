/**
 * Builds the Typst plugin, package/plugin.wasm, from the Rust crate in
 * plugin/ (ADR 0026). Run with `npm run build:plugin -w @algoviz/typst`;
 * add `-- --check` to rebuild and compare with the committed file instead.
 *
 * Needs rustup, which installs the Rust version pinned in
 * plugin/rust-toolchain.toml, and clang from LLVM 23 with the wasm32 target
 * for QuickJS's C (set CC_wasm32_unknown_unknown, or put that clang first on
 * PATH; Homebrew's llvm is found by itself). Crates come from Cargo.lock,
 * and paths are remapped, so the same toolchain gives the same bytes in any
 * checkout. The committed file was built with clang 23.1.5 (Homebrew).
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LLVM_MAJOR = 23;
const crate = fileURLToPath(new URL('../plugin', import.meta.url));
const output = fileURLToPath(
  new URL('../package/plugin.wasm', import.meta.url),
);
const target = join(crate, 'target');
const built = join(
  target,
  'wasm32-unknown-unknown/release/algoviz_typst_plugin.wasm',
);

/** Runs a command and returns its standard output, or fails the build. */
function run(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
  inherit = false,
): string {
  const result = spawnSync(command, args, {
    cwd: crate,
    env,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : 'pipe',
  });
  if (result.error !== undefined)
    throw new Error(`Cannot run ${command}: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(' ')} exited with ${result.status}` +
        (inherit ? '; see its output above' : `:\n${result.stderr ?? ''}`),
    );
  return result.stdout ?? '';
}

/**
 * The Rust toolchain the crate pins, with the wasm32 target. rustup
 * installs it only if it is missing, so a build that has it needs no
 * network.
 */
function toolchainBin(): string {
  const pinned = /channel\s*=\s*"([^"]+)"/.exec(
    readFileSync(join(crate, 'rust-toolchain.toml'), 'utf8'),
  )?.[1];
  if (pinned === undefined)
    throw new Error('plugin/rust-toolchain.toml names no channel');
  let installed = '';
  try {
    installed = run('rustup', [
      'target',
      'list',
      '--installed',
      '--toolchain',
      pinned,
    ]);
  } catch {
    // Not installed yet.
  }
  if (!/\bwasm32-unknown-unknown\b/.test(installed))
    run('rustup', [
      'toolchain',
      'install',
      pinned,
      '--profile',
      'minimal',
      '--target',
      'wasm32-unknown-unknown',
    ]);
  return dirname(
    run('rustup', ['which', 'cargo', '--toolchain', pinned]).trim(),
  );
}

/** clang and llvm-ar from LLVM 23, with the wasm32 target. */
function llvm(): {
  readonly cc: string;
  readonly ar: string;
  readonly version: string;
} {
  const candidates = [
    process.env['CC_wasm32_unknown_unknown'],
    'clang',
    '/opt/homebrew/opt/llvm/bin/clang',
    '/usr/local/opt/llvm/bin/clang',
  ].filter((c): c is string => c !== undefined);
  for (const cc of candidates) {
    const version = spawnSync(cc, ['--version'], { encoding: 'utf8' });
    const major = /clang version (\d+)\./.exec(version.stdout ?? '')?.[1];
    if (Number(major) !== LLVM_MAJOR) continue;
    const targets = spawnSync(cc, ['-print-targets'], { encoding: 'utf8' });
    if (!/\bwasm32\b/.test(targets.stdout ?? '')) continue;
    // llvm-ar from the same LLVM as this clang.
    const dir = cc.includes('/')
      ? dirname(cc)
      : dirname(spawnSync('which', [cc], { encoding: 'utf8' }).stdout.trim());
    return {
      cc,
      ar: process.env['AR_wasm32_unknown_unknown'] ?? join(dir, 'llvm-ar'),
      version: (version.stdout ?? '').split('\n')[0] ?? '',
    };
  }
  throw new Error(
    `No clang ${LLVM_MAJOR} with the wasm32 target; tried ${candidates.join(', ')}. ` +
      'Install LLVM (e.g. brew install llvm) or set CC_wasm32_unknown_unknown.',
  );
}

const sha256 = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

function main(check: boolean): number {
  const bin = toolchainBin();
  const { cc, ar, version } = llvm();
  console.log(`C compiler: ${version}`);
  const cargoHome = process.env['CARGO_HOME'] ?? join(homedir(), '.cargo');
  const env = {
    ...process.env,
    PATH: [bin, process.env['PATH'] ?? ''].join(delimiter),
    CARGO_TARGET_DIR: target,
    CC_wasm32_unknown_unknown: cc,
    AR_wasm32_unknown_unknown: ar,
    // Paths end up in panic messages and C assertions; keep them neutral.
    RUSTFLAGS: [
      `--remap-path-prefix=${cargoHome}=/cargo`,
      `--remap-path-prefix=${crate}=/plugin`,
    ].join(' '),
    CFLAGS_wasm32_unknown_unknown: [
      `-ffile-prefix-map=${cargoHome}=/cargo`,
      `-ffile-prefix-map=${target}=/target`,
      `-ffile-prefix-map=${crate}=/plugin`,
    ].join(' '),
  };
  run(
    'cargo',
    ['build', '--release', '--locked', '--target', 'wasm32-unknown-unknown'],
    env,
    true,
  );
  const fresh = readFileSync(built);
  const hash = sha256(fresh);
  if (check) {
    const committed = existsSync(output) ? readFileSync(output) : undefined;
    const same = committed !== undefined && sha256(committed) === hash;
    console.log(
      same
        ? `package/plugin.wasm matches the build (${hash})`
        : `package/plugin.wasm differs from the build (${hash})`,
    );
    return same ? 0 : 1;
  }
  copyFileSync(built, output);
  console.log(`package/plugin.wasm: ${fresh.length} bytes, sha256 ${hash}`);
  return 0;
}

try {
  process.exitCode = main(process.argv.includes('--check'));
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 2;
}
