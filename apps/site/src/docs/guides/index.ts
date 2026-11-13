/** Every page of the guide. The sidebar's order is `GUIDE_GROUPS`. */
import type { Guide } from '../guide.ts';
import { ai } from './ai.ts';
import { cli } from './cli.ts';
import { documents } from './documents.ts';
import { inputs } from './inputs.ts';
import { latex } from './latex.ts';
import { shareLinks } from './share-links.ts';
import { slides } from './slides.ts';
import { start } from './start.ts';
import { typst } from './typst.ts';
import { web } from './web.ts';

export const GUIDES: readonly Guide[] = [
  start,
  inputs,
  web,
  typst,
  latex,
  slides,
  cli,
  ai,
  shareLinks,
  documents,
];
