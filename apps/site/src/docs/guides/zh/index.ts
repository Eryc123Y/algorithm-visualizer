/**
 * The guide in Chinese (roadmap 5.7), page for page the English one in
 * `../index.ts`; `tests/unit/zh-guides.spec.ts` holds them in step.
 */
import type { Guide } from '../../guide.ts';
import { zh as ai } from './ai.ts';
import { zh as cli } from './cli.ts';
import { zh as documents } from './documents.ts';
import { zh as inputs } from './inputs.ts';
import { zh as latex } from './latex.ts';
import { zh as shareLinks } from './share-links.ts';
import { zh as slides } from './slides.ts';
import { zh as start } from './start.ts';
import { zh as typst } from './typst.ts';
import { zh as web } from './web.ts';

export const GUIDES_ZH: readonly Guide[] = [
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
