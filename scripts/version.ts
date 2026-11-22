/**
 * Sets the versions of a release everywhere the repository writes them
 * (`versions.ts`): the npm packages, their dependencies on each other,
 * the root package, the MCP server, the CDN and release links in the
 * docs, and the Typst and LaTeX packages with their imports and archives.
 * Give only the products that change. Then set the root package's version
 * in package-lock.json too (or run `npm install --package-lock-only`), and
 * add the release to CHANGELOG.md.
 *
 *     node scripts/version.ts [--npm 1.0.0] [--typst 1.0.0] [--latex 1.0.0]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  currentVersions,
  rewrite,
  trackedFiles,
  type Product,
  type Versions,
} from './versions.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;

const { values } = parseArgs({
  options: {
    npm: { type: 'string' },
    typst: { type: 'string' },
    latex: { type: 'string' },
  },
});
const next: Partial<Record<Product, string>> = Object.fromEntries(
  Object.entries(values).filter(([, v]) => v !== undefined),
);
if (Object.keys(next).length === 0) {
  process.stderr.write('Give at least one of --npm, --typst and --latex.\n');
  process.exit(2);
}
for (const [product, version] of Object.entries(next))
  if (!SEMVER.test(version) || (product !== 'npm' && version.includes('-'))) {
    // Typst Universe and CTAN take plain versions only.
    process.stderr.write(`Not a version for ${product}: ${version}\n`);
    process.exit(2);
  }

const date = new Date().toISOString().slice(0, 10);
const before: Versions = currentVersions(ROOT);
let changed = 0;
for (const file of trackedFiles(ROOT)) {
  const path = join(ROOT, file);
  const text = readFileSync(path, 'utf8');
  const out = rewrite(file, text, next, date);
  if (out !== text) {
    writeFileSync(path, out);
    changed += 1;
  }
}
const after = currentVersions(ROOT);
for (const product of Object.keys(next) as Product[])
  process.stdout.write(`${product}: ${before[product]} → ${after[product]}\n`);
process.stdout.write(
  `${changed} files changed. Update package-lock.json and CHANGELOG.md too.\n`,
);
