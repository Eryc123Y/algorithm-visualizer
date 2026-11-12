/**
 * Placement (ADR 0029): which column of a figure each structure goes in.
 *
 * A structure declared with `place: "side"` is auxiliary. A wide figure
 * draws the side structures in a column right of the main ones; a narrow
 * figure draws them after the main ones, in the same column. Within a
 * column, structures keep their declaration order. The arrangement depends
 * only on the declarations and the layout, never on sizes, so it is the
 * same in every frame of a trace.
 */
import type { StructureDecl } from '@algomotion/spec';

import type { FigureLayout, Region } from './options.ts';

/** A column of a figure: the structures it draws, top to bottom. */
export interface FigureColumn {
  readonly region: Region;
  readonly names: readonly string[];
}

/**
 * The columns of a figure: one, or two in a wide figure that has both main
 * and side structures.
 */
export function arrangeStructures(
  structures: Readonly<Record<string, StructureDecl>>,
  layout: FigureLayout,
): readonly FigureColumn[] {
  const names = Object.keys(structures);
  const isSide = (name: string) => structures[name]?.place === 'side';
  const main = names.filter((name) => !isSide(name));
  const side = names.filter(isSide);
  if (main.length === 0 || side.length === 0)
    return [{ region: 'main', names }];
  if (layout === 'narrow')
    return [{ region: 'main', names: [...main, ...side] }];
  return [
    { region: 'main', names: main },
    { region: 'side', names: side },
  ];
}
