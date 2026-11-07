/**
 * Parsing pipeline: untrusted input → canonical `Visualization`.
 *
 * 1. Reject versions this package cannot read with a dedicated error
 *    (ADR 0021).
 * 2. Check the document's shape (actions only by `target` and `type`).
 * 3. Expand shorthands in structure declarations.
 * 4. Validate each action against the schema of its target's kind, expand
 *    its shorthands, and check that ids it introduces are new.
 * 5. Check sections against the steps (ADR 0020), and that `version` holds
 *    every feature the document uses (ADR 0021).
 *
 * Every kind-specific step goes through the kind registry (ADR 0012).
 *
 * Only static validity is checked here. Whether an action is valid at its
 * point in the timeline (e.g. an index within the current length) depends
 * on state and is checked by the core reducer.
 */
import {
  formatPath,
  fromZodIssues,
  type ProtocolError,
  type ProtocolErrorCode,
} from './errors.ts';
import {
  kinds,
  type ActionContext,
  type DeclIssue,
  type IdRef,
  type KindTypeMap,
  type StructureKindName,
} from './kinds/index.ts';
import type { Section } from './common.ts';
import { err, ok, type Result } from './result.ts';
import {
  checkFeatures,
  checkVersion,
  PROTOCOL_FEATURES,
  type ProtocolVersion,
} from './version.ts';
import {
  Envelope,
  type StructureDecl,
  type StructureDeclInput,
  type TargetedAction,
  type Visualization,
} from './visualization.ts';

export function parseVisualization(
  input: unknown,
): Result<Visualization, readonly ProtocolError[]> {
  const versionError = checkDocumentVersion(input);
  if (versionError) return err([versionError]);
  const protoErrors = checkProtoKeys(input);
  if (protoErrors.length > 0) return err(protoErrors);

  const envelope = Envelope.safeParse(input);
  if (!envelope.success)
    return err(fromZodIssues(envelope.error.issues, [], 'INVALID_SHAPE'));
  const doc = envelope.data;

  const errors: ProtocolError[] = [];
  const structures: Record<string, StructureDecl> = {};
  // Ids are unique per structure for the whole trace (ADR 0007), so an id
  // removed earlier cannot be reused by a later action.
  const usedIds = new Map<string, Set<string>>();
  for (const [name, input] of Object.entries(doc.structures)) {
    const decl = normalizeDecl(input);
    structures[name] = decl;
    const ids = new Set<string>();
    for (const { id, path } of declIds(decl)) {
      if (ids.has(id))
        errors.push(duplicateId(id, name, ['structures', name, ...path]));
      ids.add(id);
    }
    for (const issue of validateDecl(decl))
      errors.push({
        code: 'INVALID_STRUCTURE',
        path: formatPath(['structures', name, ...issue.path]),
        message: issue.message,
        ...(issue.hint === undefined ? {} : { hint: issue.hint }),
      });
    usedIds.set(name, ids);
  }

  const sourceLines =
    doc.source === undefined ? undefined : doc.source.code.split('\n').length;
  const steps = doc.steps.map((step, s) => {
    const line = step.meta?.line;
    if (sourceLines !== undefined && line !== undefined && line > sourceLines) {
      errors.push({
        code: 'LINE_OUT_OF_RANGE',
        path: formatPath(['steps', s, 'meta', 'line']),
        message: `Line ${line} is past the end of the source code`,
        hint: `The source code has ${sourceLines} lines.`,
      });
    }
    const actions = step.actions.flatMap((raw, a): TargetedAction[] => {
      const path = ['steps', s, 'actions', a];
      const result = parseAction(raw, structures, usedIds, path);
      if (!result.ok) {
        errors.push(...result.error);
        return [];
      }
      return [result.value];
    });
    return step.meta === undefined ? { actions } : { actions, meta: step.meta };
  });
  if (doc.sections !== undefined)
    errors.push(...checkSections(doc.sections, steps.length));

  const vis: Visualization = {
    version: doc.version,
    ...(doc.title === undefined ? {} : { title: doc.title }),
    ...(doc.source === undefined ? {} : { source: doc.source }),
    structures,
    steps,
    ...(doc.sections === undefined ? {} : { sections: doc.sections }),
  };
  // The version is the first thing to fix, so it is reported first.
  const tooOld = checkFeatures<ProtocolVersion>(
    vis,
    doc.version,
    PROTOCOL_FEATURES,
  );
  if (tooOld !== undefined) errors.unshift(tooOld);
  return errors.length > 0 ? err(errors) : ok(vis);
}

/**
 * Sections start at a step, each after the one before, and have distinct
 * ids. Starting after the previous one also keeps every section non-empty.
 */
function checkSections(
  sections: readonly Section[],
  stepCount: number,
): ProtocolError[] {
  const errors: ProtocolError[] = [];
  const ids = new Set<string>();
  sections.forEach(({ id, start }, k) => {
    if (ids.has(id))
      errors.push({
        code: 'DUPLICATE_SECTION',
        path: formatPath(['sections', k, 'id']),
        message: `Section id "${id}" is already used`,
        hint: 'Section ids must be unique within a document.',
      });
    ids.add(id);
    const previous = sections[k - 1];
    if (start >= stepCount)
      errors.push({
        code: 'SECTION_OUT_OF_RANGE',
        path: formatPath(['sections', k, 'start']),
        message: `Section "${id}" starts at step ${start}, past the last step`,
        hint:
          stepCount === 0
            ? 'The document has no steps, so it can have no sections.'
            : `Steps are numbered 0 to ${stepCount - 1}.`,
      });
    else if (previous !== undefined && start <= previous.start)
      errors.push({
        code: 'SECTION_OUT_OF_ORDER',
        path: formatPath(['sections', k, 'start']),
        message: `Section "${id}" starts at step ${start}, but must start after section "${previous.id}" (step ${previous.start})`,
        hint: 'List sections in the order of their steps; each has at least one step.',
      });
  });
  return errors;
}

/** A missing `version` is left to the shape check, which reports it. */
function checkDocumentVersion(input: unknown): ProtocolError | undefined {
  if (typeof input !== 'object' || input === null || !('version' in input))
    return undefined;
  return checkVersion(input.version);
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Reports `__proto__` keys where documents use names as keys. Zod silently
 * drops such keys, which would turn a clear mistake into a confusing one
 * (or lose data), so they are rejected up front.
 */
function checkProtoKeys(input: unknown): ProtocolError[] {
  const errors: ProtocolError[] = [];
  const check = (obj: unknown, path: PropertyKey[]) => {
    if (isRecord(obj) && Object.hasOwn(obj, '__proto__'))
      errors.push({
        code: 'INVALID_SHAPE',
        path: formatPath([...path, '__proto__']),
        message: '"__proto__" cannot be used as a name',
        hint: 'Choose another name.',
      });
  };
  if (!isRecord(input)) return errors;
  check(input['structures'], ['structures']);
  const steps = input['steps'];
  if (Array.isArray(steps))
    steps.forEach((step: unknown, s) => {
      const meta = isRecord(step) ? step['meta'] : undefined;
      check(isRecord(meta) ? meta['vars'] : undefined, [
        'steps',
        s,
        'meta',
        'vars',
      ]);
    });
  return errors;
}

// Kind dispatch. Each helper is generic in the kind, so `kinds[kind]` has
// the matching spec type; the casts restate what the discriminant guarantees.

function normalizeDeclOf<K extends StructureKindName>(
  kind: K,
  input: KindTypeMap[K]['declInput'],
): KindTypeMap[K]['decl'] {
  return kinds[kind].normalizeDecl(input);
}

function declIdsOf<K extends StructureKindName>(
  kind: K,
  decl: KindTypeMap[K]['decl'],
): readonly IdRef[] {
  return kinds[kind].declIds(decl);
}

function normalizeActionOf<K extends StructureKindName>(
  kind: K,
  input: KindTypeMap[K]['actionInput'],
  ctx: ActionContext,
): KindTypeMap[K]['action'] {
  return kinds[kind].normalizeAction(input, ctx);
}

function introducedIdsOf<K extends StructureKindName>(
  kind: K,
  action: KindTypeMap[K]['action'],
): readonly IdRef[] {
  return kinds[kind].introducedIds(action);
}

const normalizeDecl = (input: StructureDeclInput): StructureDecl =>
  normalizeDeclOf(input.kind, input);

function validateDeclOf<K extends StructureKindName>(
  kind: K,
  decl: KindTypeMap[K]['decl'],
): readonly DeclIssue[] {
  return kinds[kind].validateDecl?.(decl) ?? [];
}

const validateDecl = (decl: StructureDecl): readonly DeclIssue[] =>
  validateDeclOf(decl.kind, decl);

const declIds = (decl: StructureDecl): readonly IdRef[] =>
  declIdsOf(decl.kind, decl);

function duplicateId(
  id: string,
  target: string,
  path: readonly PropertyKey[],
): ProtocolError {
  return {
    code: 'DUPLICATE_ID',
    path: formatPath(path),
    message: `Id "${id}" is already used in "${target}"`,
    hint: 'Ids must be unique within a structure for the whole trace, even after removal; choose a new id.',
  };
}

function parseAction(
  raw: { target: string; type: string; [key: string]: unknown },
  structures: Readonly<Record<string, StructureDecl>>,
  usedIds: ReadonlyMap<string, Set<string>>,
  path: readonly PropertyKey[],
): Result<TargetedAction, ProtocolError[]> {
  const { target, ...payload } = raw;
  const decl = Object.hasOwn(structures, target)
    ? structures[target]
    : undefined;
  if (decl === undefined) {
    return fail(
      'UNKNOWN_TARGET',
      [...path, 'target'],
      `No structure named "${target}"`,
      `Declared structures: ${Object.keys(structures).join(', ')}.`,
    );
  }

  const kind: StructureKindName = decl.kind;
  const spec = kinds[kind];
  if (!spec.actionTypes.includes(raw.type)) {
    return fail(
      'UNKNOWN_ACTION',
      [...path, 'type'],
      `"${raw.type}" is not an action of ${kind} "${target}"`,
      `Valid actions for ${kind}: ${spec.actionTypes.join(', ')}.`,
    );
  }

  const parsed = spec.actionInput.safeParse(payload);
  if (!parsed.success)
    return err(fromZodIssues(parsed.error.issues, path, 'INVALID_ACTION'));

  const ids = usedIds.get(target) ?? new Set<string>();
  // The payload was parsed with this kind's schema, so it is this kind's input.
  const input = parsed.data;
  const action = normalizeActionOf(kind, input, {
    allocateId(prefix) {
      let n = 0;
      while (ids.has(`${prefix}${n}`)) n += 1;
      const id = `${prefix}${n}`;
      ids.add(id);
      return id;
    },
  });
  // Shorthands can produce values the canonical schema rejects, such as an
  // id made from a node name with a space; check the result as well.
  const canonical = spec.action.safeParse(action);
  if (!canonical.success)
    return err(fromZodIssues(canonical.error.issues, path, 'INVALID_ACTION'));
  const errors: ProtocolError[] = [];
  for (const ref of introducedIdsOf(kind, action)) {
    if (ids.has(ref.id) && !wasAllocated(input, ref)) {
      errors.push(duplicateId(ref.id, target, [...path, ...ref.path]));
    }
    ids.add(ref.id);
  }
  if (errors.length > 0) return err(errors);
  return ok({ target, ...action });
}

/**
 * Whether an introduced id was generated during normalisation (and so
 * already reserved), rather than written in the input.
 */
function wasAllocated(input: unknown, ref: IdRef): boolean {
  let node: unknown = input;
  for (const key of ref.path) {
    if (typeof node !== 'object' || node === null) return true;
    node = (node as Record<PropertyKey, unknown>)[key];
  }
  return node === undefined;
}

function fail(
  code: ProtocolErrorCode,
  path: readonly PropertyKey[],
  message: string,
  hint: string,
): Result<never, ProtocolError[]> {
  return err([{ code, path: formatPath(path), message, hint }]);
}
