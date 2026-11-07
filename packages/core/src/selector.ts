/**
 * Selectors (ADR 0020): text that names one frame or a range of frames, the
 * same in the player, the MCP tools, the CLI and the document packages.
 *
 * | Selector                  | Frames                                          |
 * | ------------------------- | ----------------------------------------------- |
 * | `12`, `-1`                | that frame; negative counts from the end        |
 * | `relax`                   | the one after the first step named `relax`      |
 * | `relax#3`                 | the one after the third step named `relax`      |
 * | `insert-5/fixup-case-3#2` | the same, counting only inside `insert-5`       |
 * | `insert-5`                | the section: before its first step to after its last |
 * | `a..b`                    | from the start of `a` to the end of `b`         |
 *
 * A bare name is a section when a section has that id, and a step name
 * otherwise. Names start with a letter, so they never look like numbers.
 */
import {
  err,
  LIMITS,
  ok,
  type Diagnostic,
  type Result,
  type Section,
} from '@algoviz/spec';

export type SelectorErrorCode =
  /** The text is not a selector. */
  | 'INVALID_SELECTOR'
  /** No section or step has the name, or not that many steps do. */
  | 'NO_MATCH'
  /** A frame number past either end of the timeline. */
  | 'OUT_OF_RANGE';

export type SelectorError = Diagnostic<SelectorErrorCode>;

/** One end of a selector: a frame number or a name. */
export type FrameRef =
  | {
      readonly type: 'frame';
      /** As written: negative numbers count from the end. */
      readonly frame: number;
    }
  | {
      readonly type: 'name';
      readonly name: string;
      /** Count only steps inside this section. */
      readonly section?: string;
      /** Which step of that name, from 1; absent means a bare name. */
      readonly nth?: number;
    };

export type Selector =
  | FrameRef
  | { readonly type: 'range'; readonly from: FrameRef; readonly to: FrameRef };

/** Frames `from` to `to`, both included; one frame when they are equal. */
export interface FrameRange {
  readonly from: number;
  readonly to: number;
}

/** What selectors resolve against: a document in either form. */
export interface Selectable {
  readonly steps: readonly {
    readonly meta?: { readonly id?: string | undefined } | undefined;
  }[];
  readonly sections?: readonly Section[] | undefined;
}

const MAX_LENGTH = 200;
const NAME = `[a-z][a-z0-9]*(?:-[a-z0-9]+)*`;
const FRAME = /^-?(?:0|[1-9][0-9]{0,8})$/;
const REF = new RegExp(`^(?:(${NAME})/)?(${NAME})(?:#([1-9][0-9]{0,8}))?$`);

const HINT =
  'Use a frame number such as 3 or -1 (the last), a step name such as "relax" or "relax#2" (the second), a section such as "insert-5", a step in a section such as "insert-5/relax#2", or a range such as "relax#2..-1".';

/** Quotes text for a message, shortened so a huge value stays readable. */
const quote = (text: string) =>
  JSON.stringify(text.length > 40 ? `${text.slice(0, 40)}…` : text);

const fail = (
  code: SelectorErrorCode,
  message: string,
  hint: string,
): Result<never, SelectorError> => err({ code, path: '$', message, hint });

function parseRef(text: string): FrameRef | undefined {
  if (FRAME.test(text) && text !== '-0')
    return { type: 'frame', frame: Number(text) };
  const match = REF.exec(text);
  if (match === null) return undefined;
  const [, section, name, nth] = match;
  if (name!.length > LIMITS.nameLength) return undefined;
  if (section !== undefined && section.length > LIMITS.nameLength)
    return undefined;
  return {
    type: 'name',
    name: name!,
    ...(section === undefined ? {} : { section }),
    ...(nth === undefined ? {} : { nth: Number(nth) }),
  };
}

/** Reads a selector without looking at a document. */
export function parseSelector(text: string): Result<Selector, SelectorError> {
  const invalid = () =>
    fail('INVALID_SELECTOR', `${quote(text)} is not a selector`, HINT);
  if (text.length > MAX_LENGTH) return invalid();
  const parts = text.split('..').map((part) => part.trim());
  if (parts.length > 2) return invalid();
  const refs = parts.map(parseRef);
  const [from, to] = refs;
  if (from === undefined || refs.some((r) => r === undefined)) return invalid();
  return ok(to === undefined ? from : { type: 'range', from, to: to });
}

/** Up to 30 items, then an ellipsis. */
function listOf(items: readonly string[]): string {
  const shown = items.slice(0, 30);
  return `${shown.join(', ')}${items.length > shown.length ? ', …' : ''}`;
}

const nameOf = (doc: Selectable, step: number) => doc.steps[step]?.meta?.id;

/** Distinct step names in steps [lo, hi), in order of first use. */
function namesIn(doc: Selectable, lo: number, hi: number): string[] {
  const names = new Set<string>();
  for (let s = lo; s < hi; s++) {
    const name = nameOf(doc, s);
    if (name !== undefined) names.add(name);
  }
  return [...names];
}

/** What the document has to select, for messages about a failed match. */
function inventory(doc: Selectable): string {
  const sections = (doc.sections ?? []).map((s) => s.id);
  const names = namesIn(doc, 0, doc.steps.length);
  if (sections.length === 0 && names.length === 0)
    return `The document has no sections and its steps have no names; use a frame number from 0 to ${doc.steps.length}.`;
  return [
    sections.length > 0
      ? `Sections: ${listOf(sections)}.`
      : 'The document has no sections.',
    names.length > 0
      ? `Step names: ${listOf(names)}.`
      : 'Its steps have no names.',
  ].join(' ');
}

/** Steps [lo, hi) of a section: to the next section's start, or the end. */
function boundsOf(
  doc: Selectable,
  id: string,
): { readonly lo: number; readonly hi: number } | undefined {
  const sections = doc.sections ?? [];
  const k = sections.findIndex((s) => s.id === id);
  if (k < 0) return undefined;
  return {
    lo: sections[k]!.start,
    hi: sections[k + 1]?.start ?? doc.steps.length,
  };
}

const steps = (n: number) => (n === 1 ? 'step' : 'steps');

function resolveFrame(
  doc: Selectable,
  frame: number,
): Result<FrameRange, SelectorError> {
  const length = doc.steps.length;
  const index = frame < 0 ? length + 1 + frame : frame;
  if (Number.isInteger(index) && index >= 0 && index <= length)
    return ok({ from: index, to: index });
  return fail(
    'OUT_OF_RANGE',
    `Frame ${frame} does not exist`,
    `Frames go from 0 (before the first step) to ${length} (after the last); -1 is the last.`,
  );
}

function resolveName(
  doc: Selectable,
  ref: Extract<FrameRef, { type: 'name' }>,
): Result<FrameRange, SelectorError> {
  const { name, section, nth } = ref;
  if (section === undefined && nth === undefined) {
    const bounds = boundsOf(doc, name);
    if (bounds !== undefined) return ok({ from: bounds.lo, to: bounds.hi });
  }
  let lo = 0;
  let hi = doc.steps.length;
  if (section !== undefined) {
    const bounds = boundsOf(doc, section);
    if (bounds === undefined) {
      const ids = (doc.sections ?? []).map((s) => s.id);
      return fail(
        'NO_MATCH',
        `There is no section ${quote(section)}`,
        ids.length > 0
          ? `Sections: ${listOf(ids)}.`
          : 'The document has no sections.',
      );
    }
    ({ lo, hi } = bounds);
  }
  const want = nth ?? 1;
  let count = 0;
  for (let s = lo; s < hi; s++)
    if (nameOf(doc, s) === name && ++count === want)
      return ok({ from: s + 1, to: s + 1 });

  if (section !== undefined) {
    const names = namesIn(doc, lo, hi);
    return fail(
      'NO_MATCH',
      count === 0
        ? `Section ${quote(section)} has no step named ${quote(name)}`
        : `Section ${quote(section)} has only ${count} ${steps(count)} named ${quote(name)}`,
      names.length > 0
        ? `Step names in ${quote(section)}: ${listOf(names)}.`
        : `The steps of ${quote(section)} have no names.`,
    );
  }
  if (count === 0)
    return fail(
      'NO_MATCH',
      nth === undefined
        ? `No section or step is named ${quote(name)}`
        : `No step is named ${quote(name)}`,
      inventory(doc),
    );
  return fail(
    'NO_MATCH',
    `There ${count === 1 ? 'is' : 'are'} only ${count} ${steps(count)} named ${quote(name)}`,
    inventory(doc),
  );
}

const resolveRef = (doc: Selectable, ref: FrameRef) =>
  ref.type === 'frame' ? resolveFrame(doc, ref.frame) : resolveName(doc, ref);

/**
 * The frames a selector names in a document. A number is a frame number;
 * text is read with `parseSelector`.
 */
export function selectFrames(
  doc: Selectable,
  selector: string | number,
): Result<FrameRange, SelectorError> {
  if (typeof selector === 'number') return resolveFrame(doc, selector);
  const parsed = parseSelector(selector);
  if (!parsed.ok) return parsed;
  const s = parsed.value;
  if (s.type !== 'range') return resolveRef(doc, s);
  const from = resolveRef(doc, s.from);
  if (!from.ok) return from;
  const to = resolveRef(doc, s.to);
  if (!to.ok) return to;
  if (from.value.from > to.value.to)
    return fail(
      'INVALID_SELECTOR',
      `${quote(selector)} ends before it starts: frame ${to.value.to} comes before frame ${from.value.from}`,
      'Put the earlier end first.',
    );
  return ok({ from: from.value.from, to: to.value.to });
}

/**
 * The one frame a selector names, for a figure or a starting point. A
 * section or a range of several frames is an error.
 */
export function selectFrame(
  doc: Selectable,
  selector: string | number,
): Result<number, SelectorError> {
  const range = selectFrames(doc, selector);
  if (!range.ok) return range;
  const { from, to } = range.value;
  if (from === to) return ok(from);
  const text = String(selector);
  const example = text.includes('..')
    ? `${from} or ${to}`
    : `"${text}/<step name>" or ${to}`;
  return fail(
    'INVALID_SELECTOR',
    `${quote(text)} is frames ${from} to ${to}, not one frame`,
    `Name one frame, such as ${example}.`,
  );
}

/** The name of the step that produced a frame, if it has one. */
export function stepNameAt(doc: Selectable, frame: number): string | undefined {
  return frame > 0 ? nameOf(doc, frame - 1) : undefined;
}

/**
 * The section of the step that produced a frame. The frame before a
 * section's first step belongs to the section before it, if any.
 */
export function sectionAt(doc: Selectable, frame: number): Section | undefined {
  const step = frame - 1;
  if (step < 0) return undefined;
  let found: Section | undefined;
  for (const section of doc.sections ?? []) {
    if (section.start > step) break;
    found = section;
  }
  return found;
}

/**
 * The most specific selector of a frame, such as `insert-5/go#2`: its
 * step's name, counted inside its section, or else the frame number.
 */
export function selectorOf(doc: Selectable, frame: number): string {
  const name = stepNameAt(doc, frame);
  if (name === undefined) return String(frame);
  const section = sectionAt(doc, frame);
  let nth = 0;
  for (let s = section?.start ?? 0; s < frame; s++)
    if (nameOf(doc, s) === name) nth += 1;
  if (section !== undefined)
    return `${section.id}/${nth === 1 ? name : `${name}#${nth}`}`;
  // A bare name would be read as a section of the same id.
  return nth === 1 && boundsOf(doc, name) === undefined
    ? name
    : `${name}#${nth}`;
}
