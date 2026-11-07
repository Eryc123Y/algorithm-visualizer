/**
 * A typed recorder for building visualization documents from running code.
 *
 * ```ts
 * const r = new Recorder({ title: 'Swap' });
 * const a = r.add('a', { kind: 'array', initial: [2, 1] });
 * r.step({ narration: 'Swap the two values.' });
 * a.swap({ i: 0, j: 1 });
 * const doc = r.build();
 * ```
 *
 * Steps may be named (`r.step({ id: 'swap' })`), and `r.section(id,
 * title)` starts a titled section at the next step (ADR 0020).
 *
 * Each structure handle has one method per action of its kind, typed from
 * the protocol registry, so new kinds get handles without any code here.
 */
import {
  actionTypesOf,
  formatErrors,
  LIMITS,
  minimumVersion,
  parseVisualization,
  SectionId,
  type KindTypeMap,
  type Section,
  type Source,
  type StepMeta,
  type StructureDeclInput,
  type StructureKindName,
  type VisualizationInput,
} from '@algoviz/spec';

type ActionInputOf<K extends StructureKindName> = KindTypeMap[K]['actionInput'];

/** The fields of action `T` of kind `K`, without `type`. */
export type ActionFields<
  K extends StructureKindName,
  T extends ActionInputOf<K>['type'],
> = Omit<Extract<ActionInputOf<K>, { type: T }>, 'type'>;

/**
 * Methods that record actions on one structure. Methods whose fields are
 * all optional, such as `pop`, can be called without an argument. Each
 * returns the handle, so calls can be chained.
 */
export type Handle<K extends StructureKindName> = {
  readonly [T in ActionInputOf<K>['type']]: object extends ActionFields<K, T>
    ? (fields?: ActionFields<K, T>) => Handle<K>
    : (fields: ActionFields<K, T>) => Handle<K>;
};

type Step = VisualizationInput['steps'][number];
type Action = Step['actions'][number];

export interface RecorderOptions {
  readonly title?: string;
  /** Source code whose lines steps refer to with `line`. */
  readonly source?: Source;
}

export class Recorder {
  readonly #options: RecorderOptions;
  readonly #structures: Record<string, StructureDeclInput> = {};
  readonly #steps: Step[] = [];
  readonly #sections: Section[] = [];

  constructor(options: RecorderOptions = {}) {
    this.#options = options;
  }

  /** Declares a structure and returns the handle that records its actions. */
  add<const D extends StructureDeclInput>(
    name: string,
    decl: D,
  ): Handle<D['kind']> {
    if (Object.hasOwn(this.#structures, name))
      throw new Error(`Structure "${name}" is already declared`);
    if (this.#steps.length > 0)
      throw new Error('Declare every structure before the first step');
    // defineProperty, not assignment: a name such as "__proto__" must
    // become a key, not change the object's prototype.
    Object.defineProperty(this.#structures, name, {
      value: decl,
      enumerable: true,
      writable: true,
      configurable: true,
    });
    const methods = actionTypesOf(decl.kind).map((type) => [
      type,
      (fields: object = {}) => {
        this.#push({ ...fields, target: name, type } as Action);
        return handle;
      },
    ]);
    const handle = Object.freeze(Object.fromEntries(methods)) as Handle<
      D['kind']
    >;
    return handle;
  }

  /**
   * Starts a section at the next step: it holds the steps recorded until
   * the next section. Throws for an id that is used already or is not a
   * section id, and when the section before has no steps.
   */
  section(id: string, title: string): this {
    if (!SectionId.safeParse(id).success)
      throw new Error(
        `${JSON.stringify(id)} is not a section id: use lower-case kebab-case, e.g. "insert-5"`,
      );
    if (this.#sections.some((s) => s.id === id))
      throw new Error(`Section "${id}" is already used`);
    if (title === '' || title.length > LIMITS.textLength)
      throw new Error(
        `Section "${id}" needs a title of 1 to ${LIMITS.textLength} characters`,
      );
    this.#checkLastSection();
    this.#sections.push({ id, title, start: this.#steps.length });
    return this;
  }

  /**
   * Starts a new step; actions recorded until the next call belong to it.
   * A string is shorthand for the narration; `id` names the step.
   */
  step(meta: StepMeta | string = {}): this {
    const m = typeof meta === 'string' ? { narration: meta } : meta;
    this.#steps.push(
      Object.keys(m).length === 0 ? { actions: [] } : { actions: [], meta: m },
    );
    return this;
  }

  /** Number of steps recorded so far. */
  get length(): number {
    return this.#steps.length;
  }

  #push(action: Action): void {
    // Actions before any step, or right after `section`, start a step.
    if (this.#steps.length === 0 || this.#sectionPending()) this.step();
    this.#steps.at(-1)!.actions.push(action);
  }

  /** Whether the last section is still waiting for its first step. */
  #sectionPending(): boolean {
    return this.#sections.at(-1)?.start === this.#steps.length;
  }

  #checkLastSection(): void {
    if (this.#sectionPending())
      throw new Error(`Section "${this.#sections.at(-1)!.id}" has no steps`);
  }

  /**
   * The document. It is checked against the protocol: an input too large
   * or too unusual to show (more steps or elements than allowed, ids too
   * long) throws a RangeError instead of giving a document that does not
   * load.
   */
  build(): VisualizationInput {
    const doc = this.#document();
    const parsed = parseVisualization(doc);
    if (!parsed.ok)
      throw new RangeError(
        `This input cannot be shown:\n${formatErrors(parsed.error, { max: 3 })}`,
      );
    return doc;
  }

  #document(): VisualizationInput {
    this.#checkLastSection();
    const { title, source } = this.#options;
    const content = {
      ...(title === undefined ? {} : { title }),
      ...(source === undefined ? {} : { source }),
      structures: { ...this.#structures },
      steps: [...this.#steps],
      ...(this.#sections.length === 0 ? {} : { sections: [...this.#sections] }),
    };
    // The oldest version that has what this document uses (ADR 0021), so
    // older players can show it too.
    return { version: minimumVersion(content), ...content };
  }
}
