/**
 * Builds a random document step by step, applying each action as it is
 * chosen, and records what loading the document must then produce: success,
 * or the first error and where it is.
 */
import {
  kindNames,
  parseVisualization,
  type StructureDecl,
  type TargetedAction,
  type VisualizationInput,
} from '@algoviz/spec';

import {
  applyAction,
  beginStructureStep,
  initStructure,
  type KindedState,
} from '../../src/index.ts';
import { action, declaration, declIds, introducedId } from './generators.ts';
import { forestInorder } from './invariants.ts';
import {
  applyModel,
  dataOf,
  initModel,
  modelled,
  type ModelData,
} from './models.ts';
import type { Dice } from './random.ts';

export type Expected =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: string;
      /** `$.steps[s].actions[a]`, the failing action. */
      readonly at: string;
    };

export interface Built {
  readonly doc: VisualizationInput;
  readonly expected: Expected;
  /** Each structure's state after the last step, applied as built. */
  readonly final: Readonly<Record<string, KindedState>>;
  /** Disagreements with the models and with per-action properties. */
  readonly problems: readonly string[];
}

export function build(r: Dice, only?: readonly string[]): Built {
  const kinds = only ?? kindNames;
  // Now and then, structures five times larger, to stress the layouts.
  r.scale = r.chance(0.12) ? 5 : 1;
  const structures: Record<string, StructureDecl> = {};
  for (let k = 0, count = 1 + r.int(3); k < count; k++)
    structures[`s${k}`] = declaration(r.pick(kinds) as never, r);
  const declared = parseVisualization({
    // 0.4: declarations may have `place` (ADR 0029).
    version: '0.8',
    structures,
    steps: [],
  });
  if (!declared.ok)
    throw new Error(
      `generator made an invalid declaration: ${JSON.stringify(declared.error)}`,
    );

  const entries: Record<string, KindedState> = {};
  const models: Record<string, ModelData | undefined> = {};
  const used: Record<string, Set<string>> = {};
  // Declarations may use authoring forms; state starts from the canonical one.
  for (const [name, decl] of Object.entries(declared.value.structures)) {
    entries[name] = initStructure(decl);
    models[name] = modelled.includes(decl.kind) ? initModel(decl) : undefined;
    used[name] = new Set(declIds(decl));
  }

  const problems: string[] = [];
  const steps: VisualizationInput['steps'] = [];
  const names = Object.keys(structures);
  let expected: Expected = { ok: true };
  // Clean documents redraw rejected actions, so they stay valid and grow
  // long; the others end at their first error.
  const clean = r.chance(0.7);

  outer: for (let s = 0, count = r.int(clean ? 30 : 14); s < count; s++) {
    for (const name of names)
      entries[name] = beginStructureStep(entries[name]!);
    const actions: TargetedAction[] = [];
    steps.push({
      actions,
      ...(r.chance(0.7) ? { meta: { narration: `Step ${s + 1}.` } } : {}),
    });
    for (let a = 0, n = r.int(4), tries = 0; a < n && tries < 40; tries++) {
      const target = r.pick(names);
      const entry = entries[target]!;
      const fields = action(entry, r);
      const act = { target, ...fields } as TargetedAction;
      actions.push(act);
      const at = `$.steps[${s}].actions[${a}]`;

      // Ids are unique for the whole trace, which the parser checks.
      const id = introducedId(fields);
      if (id !== undefined && used[target]!.has(id)) {
        if (clean) {
          actions.pop();
          continue;
        }
        expected = { ok: false, code: 'DUPLICATE_ID', at };
        break outer;
      }

      const model = models[target];
      const predicted =
        model === undefined ? undefined : applyModel(model, fields);
      const result = applyAction(entry, act);
      if (model !== undefined && (predicted === undefined) !== !result.ok)
        problems.push(
          `${at} ${JSON.stringify(fields)}: the model ${predicted === undefined ? 'rejects' : 'accepts'} it, the engine ${result.ok ? 'accepts' : `rejects it (${result.error.code})`}`,
        );
      if (!result.ok) {
        if (clean) {
          actions.pop();
          continue;
        }
        expected = { ok: false, code: result.error.code, at };
        break outer;
      }
      problems.push(...transition(entry, result.value, fields, at));
      entries[target] = result.value;
      if (id !== undefined) used[target]!.add(id);
      if (predicted !== undefined) {
        models[target] = predicted;
        const got = JSON.stringify(dataOf(result.value));
        if (got !== JSON.stringify(predicted))
          problems.push(
            `${at} ${JSON.stringify(fields)}: data ${got}, model ${JSON.stringify(predicted)}`,
          );
      }
      a++;
    }
  }

  return {
    doc: { version: '0.8', structures, steps },
    expected,
    final: entries,
    problems,
  };
}

/** Properties of single tree actions that a forest invariant cannot see. */
function transition(
  before: KindedState,
  after: KindedState,
  a: Record<string, unknown>,
  at: string,
): string[] {
  if (before.kind !== 'tree' || after.kind !== 'tree') return [];
  const count = (e: typeof before) => e.state.data.nodes.length;
  const problems: string[] = [];
  const say = (m: string) => problems.push(`${at} ${String(a['type'])}: ${m}`);
  switch (a['type']) {
    case 'rotate': {
      const [x, y] = [forestInorder(before.state), forestInorder(after.state)];
      if (JSON.stringify(x) !== JSON.stringify(y))
        say(`in-order changed from ${x.join(' ')} to ${y.join(' ')}`);
      break;
    }
    case 'addNode':
      if (count(after) !== count(before) + 1) say('node count is not one more');
      break;
    case 'setChild':
    case 'detach':
    case 'setValue':
    case 'swapValues':
    case 'setColor':
      if (count(after) !== count(before)) say('node count changed');
      break;
    case 'removeNode':
      if (count(after) >= count(before)) say('no node was removed');
      break;
  }
  return problems;
}
