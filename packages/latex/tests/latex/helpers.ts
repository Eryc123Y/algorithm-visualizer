/**
 * What the LaTeX compile tests share: a workspace with the examples and a
 * command that logs its calls, the engines through latexmk or alone, and
 * readers for logs, calls, the cache and PDF text.
 */
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repo = fileURLToPath(new URL('../../../../', import.meta.url));
export const examples = join(repo, 'packages/latex/examples');
export const command =
  process.env['ALGOMOTION_COMMAND'] ??
  [
    process.execPath,
    '--no-warnings',
    '--conditions=@algomotion/source',
    join(repo, 'packages/mcp/src/algomotion.ts'),
  ].join(' ');

export type Engine = 'pdflatex' | 'lualatex' | 'xelatex';
export type Shell = 'unrestricted' | 'restricted' | 'off';

export const LATEXMK: Readonly<Record<Engine, string>> = {
  pdflatex: '-pdf',
  lualatex: '-pdflua',
  xelatex: '-pdfxe',
};

/**
 * A fresh directory with the examples and a command that logs each call
 * to calls.log before running algomotion.
 */
export function workspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'algomotion-latex-'));
  for (const file of readdirSync(examples))
    copyFileSync(join(examples, file), join(dir, file));
  const wrapper = join(dir, 'algomotion-calls');
  writeFileSync(
    wrapper,
    `#!/bin/sh\necho "$@" >> "${join(dir, 'calls.log')}"\nexec ${command} "$@"\n`,
  );
  chmodSync(wrapper, 0o755);
  return dir;
}

export const env = {
  ...process.env,
  TEXINPUTS: `${join(repo, 'packages/latex/package')}//:`,
};

const pretex = (dir: string, options = '') =>
  `\\PassOptionsToPackage{command=${join(dir, 'algomotion-calls')}${options}}{algomotion}`;

/** Compiles with latexmk, as users do; `force` runs TeX again anyway. */
export function latexmk(
  dir: string,
  file: string,
  engine: Engine,
  shell: Exclude<Shell, 'restricted'> = 'unrestricted',
  force = false,
): string {
  spawnSync(
    'latexmk',
    [
      LATEXMK[engine],
      shell === 'off' ? '-no-shell-escape' : '-shell-escape',
      '-interaction=nonstopmode',
      ...(force ? ['-g'] : []),
      `-usepretex=${pretex(dir)}`,
      file,
    ],
    { cwd: dir, env, encoding: 'utf8' },
  );
  return log(dir, file);
}

/** Compiles once with an engine, for the cases latexmk cannot set up. */
export function tex(
  dir: string,
  file: string,
  shell: Shell,
  options = '',
  engine: Engine = 'pdflatex',
): string {
  const flag = {
    unrestricted: '-shell-escape',
    restricted: '-shell-restricted',
    off: '-no-shell-escape',
  }[shell];
  spawnSync(
    engine,
    [
      flag,
      '-interaction=nonstopmode',
      `${pretex(dir, options)}\\input{${file}}`,
    ],
    { cwd: dir, env, encoding: 'utf8' },
  );
  return log(dir, file);
}

/** A log, with the lines TeX broke at 79 characters joined again. */
export const log = (dir: string, file: string) =>
  readFileSync(join(dir, file.replace(/\.tex$/, '.log')), 'utf8')
    .split('\n')
    .reduce<string[]>((lines, line) => {
      const last = lines.at(-1);
      if (last !== undefined && last.length > 0 && last.length % 79 === 0)
        lines[lines.length - 1] = last + line;
      else lines.push(line);
      return lines;
    }, [])
    .join('\n')
    // l3msg wraps messages itself, continuing them after "(algomotion)".
    .replace(/\n\(algomotion\)\s+/g, ' ');

/** The lines of a log that report errors. */
export const errors = (text: string) =>
  text.split('\n').filter((line) => line.startsWith('!'));

export const calls = (dir: string) =>
  existsSync(join(dir, 'calls.log'))
    ? readFileSync(join(dir, 'calls.log'), 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
    : [];

export const cached = (dir: string) =>
  existsSync(join(dir, '_algomotion'))
    ? readdirSync(join(dir, '_algomotion')).filter((f) => f.endsWith('.tex'))
    : [];

export const pdfText = (pdf: string) =>
  spawnSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).stdout;

/** A document of its own: the figures given, after the preamble. */
export function document(dir: string, name: string, body: string): string {
  const file = `${name}.tex`;
  writeFileSync(
    join(dir, file),
    `\\documentclass{article}\n\\usepackage{algomotion}\n\\begin{document}\n${body}\n\\end{document}\n`,
  );
  return file;
}
