/**
 * Builds the package's manual, dist/algomotion-doc.pdf, from
 * package/algomotion-doc.tex, with the algomotion command of this checkout
 * run from its sources, as `algomotion` on the PATH: `npm run build:doc -w @algomotion/latex`. Needs
 * latexmk and LuaLaTeX. CTAN takes the PDF with its source
 * (scripts/release-assets.sh).
 */
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const repo = here('../../../');
const packageDir = here('../package');
const out = here('../dist');
const NAME = 'algomotion-doc';

/** Quotes a word for sh, which keeps spaces in paths. */
const quoted = (word: string) => `'${word.replaceAll("'", `'\\''`)}'`;

const dir = mkdtempSync(join(tmpdir(), 'algomotion-doc-'));
try {
  copyFileSync(join(packageDir, `${NAME}.tex`), join(dir, `${NAME}.tex`));
  // The manual runs the package's default command, `algomotion`: here the
  // CLI of this checkout, from its sources, first on the PATH.
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const algomotion = join(bin, 'algomotion');
  writeFileSync(
    algomotion,
    `#!/bin/sh\nexec ${[
      process.execPath,
      '--no-warnings',
      '--conditions=@algomotion/source',
      join(repo, 'packages/mcp/src/algomotion.ts'),
    ]
      .map(quoted)
      .join(' ')} "$@"\n`,
  );
  chmodSync(algomotion, 0o755);
  const result = spawnSync(
    'latexmk',
    [
      '-pdflua',
      '-shell-escape',
      '-interaction=nonstopmode',
      '-halt-on-error',
      `${NAME}.tex`,
    ],
    {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}${delimiter}${process.env['PATH'] ?? ''}`,
        TEXINPUTS: `${packageDir}//:`,
      },
      maxBuffer: 1 << 28,
    },
  );
  if (result.error !== undefined)
    throw new Error(`build:doc needs latexmk: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(
      `latexmk failed with ${result.status}:\n${result.stdout.slice(-4000)}`,
    );
  mkdirSync(out, { recursive: true });
  copyFileSync(join(dir, `${NAME}.pdf`), join(out, `${NAME}.pdf`));
  console.log(`dist/${NAME}.pdf`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
