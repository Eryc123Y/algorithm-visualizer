/**
 * The package's README, which Typst Universe shows as the package's page.
 * Typst Universe asks that its examples compile and import the version
 * being published, so every example is compiled here with the package
 * installed as Typst Universe serves it, `@preview/algomotion:<version>`.
 * The signatures the README gives are checked against lib.typ. Run with
 * `npm run test:typst`; it needs `typst` on PATH.
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  examples,
  frameworksMissing,
  installPackage,
  packageDir,
  specIn,
  type Installed,
} from './install.ts';

const readme = readFileSync(join(packageDir, 'README.md'), 'utf8');
const lib = readFileSync(join(packageDir, 'lib.typ'), 'utf8');
const preview = specIn('preview');

/** The README's Typst code blocks. */
const blocks = [...readme.matchAll(/^```typ\n([\s\S]*?)^```$/gm)].map(
  (m) => m[1]!,
);

/**
 * A function's signature as the README writes it, in a code block or
 * inline: its name, then its parameters after the source and the input.
 */
const SIGNATURE =
  /#?(algomotion(?:-[a-z]+)?)\((?:only, )?source, input, ([^)]*)\)/g;
const isSignature = (block: string) =>
  /^#algomotion[-a-z]*\((?:only, )?source, input,/.test(block);

/** The named parameters of a parameter list, with their defaults. */
function named(parameters: string): Record<string, string> {
  return Object.fromEntries(
    [...parameters.matchAll(/([a-z]+):\s*([^,\s]+)/g)].map((m) => [
      m[1]!,
      m[2]!,
    ]),
  );
}

/** The public functions of lib.typ with their named parameters. */
const defined = Object.fromEntries(
  [...lib.matchAll(/^#let (algomotion[-a-z]*)\(\n([\s\S]*?)^\) =/gm)].map(
    (m) => [m[1]!, named(m[2]!)],
  ),
);

describe('the README’s signatures', () => {
  const documented = [...readme.matchAll(SIGNATURE)].map((m) => ({
    name: m[1]!,
    parameters: named(m[2]!.replaceAll(/\s+/g, ' ')),
  }));

  it('cover every public function of lib.typ, once', () => {
    expect(documented.map((d) => d.name).sort()).toEqual(
      Object.keys(defined).sort(),
    );
  });

  it.for(documented.map((d) => [d.name, d] as const))(
    '%s has the parameters and defaults of lib.typ',
    ([name, { parameters }]) => {
      expect(parameters).toEqual(defined[name]);
    },
  );
});

/** The other packages from Typst Universe an example imports. */
const othersIn = (block: string) =>
  [...block.matchAll(/#import "(@preview\/[a-z-]+:[^"]+)"/g)]
    .map((m) => m[1]!)
    .filter((spec) => spec !== preview);

describe('the README’s examples', () => {
  const code = blocks.filter((b) => !isSignature(b));
  // Other packages, such as touying, come from Typst Universe, which Typst
  // may fail to reach. An example that needs them is then skipped with the
  // reason, but in CI, where every example must run, it fails.
  const missing = new Map(
    [...new Set(code.flatMap(othersIn))].map(
      (spec) => [spec, frameworksMissing([spec])] as const,
    ),
  );
  const unavailable = (block: string) =>
    othersIn(block)
      .map((spec) => missing.get(spec))
      .find((reason) => reason !== undefined);

  let installed: Installed | undefined;
  beforeAll(async () => {
    installed = await installPackage('preview');
    // The document the example of documents reads.
    copyFileSync(
      join(examples, 'heap.json'),
      join(installed.root, 'heap.json'),
    );
  });
  afterAll(() => installed?.remove());

  it('are there, apart from the signatures', () => {
    expect(code.length).toBeGreaterThan(5);
  });

  it('import the package as Typst Universe serves it', () => {
    const imports = code.flatMap((b) =>
      [...b.matchAll(/#import "(@[a-z]+\/algomotion:[^"]+)"/g)].map(
        (m) => m[1]!,
      ),
    );
    expect(imports.length).toBeGreaterThan(0);
    for (const spec of imports) expect(spec).toBe(preview);
  });

  it.for(code.map((block, k) => [k, block.split('\n')[0]!, block] as const))(
    'example %i (%s) compiles without warnings or error boxes',
    ([k, , block], ctx) => {
      const reason = unavailable(block);
      if (reason !== undefined) {
        if (process.env['CI'] !== undefined) throw new Error(reason);
        ctx.skip(reason);
      }
      const { root, tmp } = installed!;
      const typst = (args: readonly string[]) => installed!.typst(args);
      // A fragment continues an example above it, which imports the package.
      const source = block.includes(preview)
        ? block
        : `#import "${preview}": *\n${block}`;
      const file = join(root, `readme-${k}.typ`);
      writeFileSync(file, source);
      const compiled = typst([
        'compile',
        '--root',
        root,
        file,
        join(tmp, `readme-${k}.pdf`),
      ]);
      expect(compiled.stderr).toBe('');
      expect(compiled.status).toBe(0);
      const errors = typst([
        'eval',
        '--root',
        root,
        '--in',
        file,
        'query(<algomotion-error>).len()',
      ]);
      expect(errors.stdout.trim()).toBe('0');
    },
  );
});
