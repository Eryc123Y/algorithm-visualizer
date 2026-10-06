/**
 * Parsing pipeline: untrusted input → canonical `Visualization`.
 *
 * 1. Reject unsupported versions with a dedicated error.
 * 2. Check the document's shape (actions only by `target` and `type`).
 * 3. Expand shorthands in structure declarations.
 * 4. Validate each action against the schema of its target's kind.
 *
 * Only static validity is checked here. Whether an action is valid at its
 * point in the timeline (e.g. an index within the current length) depends
 * on state and is checked by the core reducer.
 */
import { PROTOCOL_VERSION } from './common.ts';
import {
  formatPath,
  fromZodIssues,
  type ProtocolError,
  type ProtocolErrorCode,
} from './errors.ts';
import {
  actionTypesOf,
  kinds,
  normalizeArrayDecl,
  type StructureKindName,
} from './kinds/index.ts';
import { err, ok, type Result } from './result.ts';
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
  const versionError = checkVersion(input);
  if (versionError) return err([versionError]);
  const protoErrors = checkProtoKeys(input);
  if (protoErrors.length > 0) return err(protoErrors);

  const envelope = Envelope.safeParse(input);
  if (!envelope.success)
    return err(fromZodIssues(envelope.error.issues, [], 'INVALID_SHAPE'));
  const doc = envelope.data;

  const structures: Record<string, StructureDecl> = {};
  for (const [name, decl] of Object.entries(doc.structures))
    structures[name] = normalizeDecl(decl);

  const errors: ProtocolError[] = [];
  // Element ids must be unique for the whole trace (ADR 0007), so an id
  // removed earlier cannot be reused by a later insert.
  const usedIds = new Map<string, Set<string>>();
  for (const [name, decl] of Object.entries(structures))
    usedIds.set(name, new Set(decl.initial.map((e) => e.id)));
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
      const result = parseAction(raw, structures, path);
      if (!result.ok) {
        errors.push(...result.error);
        return [];
      }
      const action = result.value;
      if (action.type === 'insert') {
        const ids = usedIds.get(action.target);
        const id = action.element.id;
        if (ids?.has(id)) {
          errors.push({
            code: 'DUPLICATE_ID',
            path: formatPath([...path, 'element', 'id']),
            message: `Element id "${id}" is already used in "${action.target}"`,
            hint: 'Ids must be unique for the whole trace, even after removal; give the inserted element a new id.',
          });
          return [];
        }
        ids?.add(id);
      }
      return [action];
    });
    return step.meta === undefined ? { actions } : { actions, meta: step.meta };
  });

  if (errors.length > 0) return err(errors);
  return ok({
    version: doc.version,
    ...(doc.title === undefined ? {} : { title: doc.title }),
    ...(doc.source === undefined ? {} : { source: doc.source }),
    structures,
    steps,
  });
}

function checkVersion(input: unknown): ProtocolError | undefined {
  if (typeof input !== 'object' || input === null || !('version' in input))
    return undefined;
  const { version } = input;
  if (version === PROTOCOL_VERSION) return undefined;
  return {
    code: 'UNSUPPORTED_VERSION',
    path: '$.version',
    message: `Unsupported protocol version ${JSON.stringify(version)}`,
    hint: `Set "version" to "${PROTOCOL_VERSION}".`,
  };
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

function normalizeDecl(decl: StructureDeclInput): StructureDecl {
  switch (decl.kind) {
    case 'array':
      return normalizeArrayDecl(decl);
    default: {
      const unreachable: never = decl.kind;
      return unreachable;
    }
  }
}

function parseAction(
  raw: { target: string; type: string; [key: string]: unknown },
  structures: Readonly<Record<string, StructureDecl>>,
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
  const types = actionTypesOf(kind);
  if (!types.includes(raw.type)) {
    return fail(
      'UNKNOWN_ACTION',
      [...path, 'type'],
      `"${raw.type}" is not an action of ${kind} "${target}"`,
      `Valid actions for ${kind}: ${types.join(', ')}.`,
    );
  }

  const parsed = kinds[kind].action.safeParse(payload);
  if (!parsed.success)
    return err(fromZodIssues(parsed.error.issues, path, 'INVALID_ACTION'));
  return ok({ target, ...parsed.data });
}

function fail(
  code: ProtocolErrorCode,
  path: readonly PropertyKey[],
  message: string,
  hint: string,
): Result<never, ProtocolError[]> {
  return err([{ code, path: formatPath(path), message, hint }]);
}
