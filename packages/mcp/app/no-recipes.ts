/**
 * The registry, as the player page of algomotion_show sees it: absent. The
 * server runs recipes and hands the page their documents (ADR 0032), so
 * the page never sets `algorithm`, and its one self-contained script
 * leaves the registry out.
 */
import { err, type Diagnostic, type Result } from '@algomotion/spec';

const absent: Diagnostic = {
  code: 'LOAD_FAILED',
  path: '$',
  message:
    'This player runs no algorithms; algomotion_show runs a recipe and shows its document',
};

export const readInput = (): Result<never, readonly Diagnostic[]> =>
  err([absent]);

export const runAlgorithm = (): Result<never, readonly Diagnostic[]> =>
  err([absent]);
