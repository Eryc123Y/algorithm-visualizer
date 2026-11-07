/**
 * Writes package/engine.bc, the engine as QuickJS bytecode for the
 * committed plugin (ADR 0026). Run with `npm run build -w @algoviz/typst`.
 */
import { writeFile } from 'node:fs/promises';
import { relative } from 'node:path';

import { buildEngine, paths } from './engine.ts';

const { bytecode } = await buildEngine();
await writeFile(paths.engine, bytecode);
console.log(
  `${relative(process.cwd(), paths.engine)}: ${(bytecode.length / 1024).toFixed(0)} KiB`,
);
