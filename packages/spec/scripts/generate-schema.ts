/**
 * Writes schema/visualization.schema.json from the Zod schemas.
 * A unit test fails if the committed file is out of date.
 */
import { writeFileSync } from 'node:fs';

import { visualizationJsonSchema } from '../src/index.ts';

const target = new URL('../schema/visualization.schema.json', import.meta.url);
writeFileSync(
  target,
  `${JSON.stringify(visualizationJsonSchema(), null, 2)}\n`,
);
console.log(`Wrote ${target.pathname}`);
