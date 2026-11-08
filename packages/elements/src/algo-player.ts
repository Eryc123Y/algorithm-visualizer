/**
 * <algo-player>: an embeddable player for algoviz documents (ADR 0006, 0010,
 * 0011).
 *
 * Modes:
 * - `interactive` (default): a teaching element with controls, narration,
 *   variables and source code.
 * - `display`: a purely visual animation of the structures alone. It plays
 *   and loops on its own, pauses while off screen, takes no input, and moves
 *   cells in straight lines.
 *
 * Content, in order of precedence:
 * - the `visualization` property (a document object),
 * - the `src` attribute (URL of a JSON document),
 * - an inline `<script type="application/json">` child.
 *
 * With the `algorithm` attribute (a registry id, ADR 0032), the content is
 * that algorithm's input instead: the `input` attribute (JSON, an object
 * without its braces, or a notation such as `5 2 4 6 1 3`) or property
 * (any value), else the JSON at `src`, else the inline JSON, else none,
 * which runs the algorithm's first example. The `visualization` property
 * still wins. The registry is loaded on first use.
 *
 * `frame` is a frame number or a selector such as `relax#2` or `insert-5`
 * (ADR 0020). The timeline shows the document's sections, and Page Up and
 * Page Down move between them.
 *
 * A document with its code in several languages (`sources`, ADR 0017) gets
 * a language menu above the code. The reader's choice is remembered for
 * the site and followed by every player on the page; otherwise the
 * `language` attribute, then pseudocode, is shown first.
 *
 * Events: `algo-load` ({ length }), `algo-error` ({ errors }) and
 * `algo-frame` ({ index, length, playing, stepName?, sectionId? }).
 */
import { html, LitElement, nothing, type PropertyValues } from 'lit';

import {
  bareLayoutOptions,
  codeListings,
  defaultLayoutOptions,
  layoutTrace,
  loadTrace,
  sectionAt,
  stepNameAt,
  type FigureLayout,
  type LayoutFonts,
  type LayoutOptions,
  type Trace,
  type TraceLayout,
} from '@algoviz/core';
import { formatErrors, ok, type Diagnostic, type Section } from '@algoviz/spec';
import {
  paintScene,
  resolveTheme,
  type SvgTheme,
  type ThemeName,
} from '@algoviz/svg';

import { codeLines } from './code-panel.ts';
import { documentOf } from './content.ts';
import { PlayerController, type PlaybackState } from './controller.ts';
import {
  nextIcon,
  pauseIcon,
  playIcon,
  prevIcon,
  restartIcon,
} from './icons.ts';
import {
  chooseLanguage,
  LANGUAGE_EVENT,
  LANGUAGE_KEY,
  languageName,
  pickListing,
  storedLanguage,
  type LanguageEventDetail,
} from './languages.ts';
import {
  frameConverter,
  openingFrame,
  sectionStrip,
  type FrameError,
  type FrameSelector,
} from './sections.ts';
import { SceneStage } from './stage.ts';
import { playerStyles } from './styles.ts';
import { chromeStyles, resolvePlayerTheme } from './chrome.ts';
import { defaultFontsUrl, linkFonts } from './fonts.ts';

/**
 * A built-in theme's name, `auto` (light or dark by the reader's colour
 * scheme), or a day and a night theme, such as `textbook textbook-dark`,
 * that follow the colour scheme (ADR 0030).
 */
export type PlayerTheme = ThemeName | 'auto' | `${ThemeName} ${ThemeName}`;

export type PlayerMode = 'interactive' | 'display';

export type PlayerMotion = 'arc' | 'linear';

export interface AlgoFrameDetail {
  readonly index: number;
  readonly length: number;
  readonly playing: boolean;
  /** The name (`meta.id`) of the step that produced the frame, if any. */
  readonly stepName?: string;
  /** The id of that step's section, if any. */
  readonly sectionId?: string;
}

const MAX_ANIMATION_MS = 450;

/** The keys the player takes while its language menu has focus. */
const MENU_PASSES: ReadonlySet<string> = new Set([
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
]);

/** How long display mode holds the last frame before looping. */
const DISPLAY_END_HOLD_MS = 1500;

const mediaQuery = (query: string): MediaQueryList | undefined =>
  typeof matchMedia === 'function' ? matchMedia(query) : undefined;

/** Whether two font pairs set text in the same faces. */
const sameFonts = (a: LayoutFonts | null, b: LayoutFonts): boolean =>
  a !== null && a.value === b.value && a.label === b.label;

export class AlgoPlayer extends LitElement {
  static override styles = [playerStyles, chromeStyles()];

  /**
   * The stylesheet of the themes' web fonts (ADR 0030), linked from the
   * document the first time a player connects. By default it is
   * `fonts/fonts.css` next to the player's module; a bundle that copies
   * the fonts elsewhere names their place here, and null turns loading
   * off, leaving text to the fallbacks of each theme's font lists. Set it
   * before the first player connects: the stylesheet is linked once.
   */
  static fontsUrl: string | null | undefined = undefined;

  static override properties = {
    src: { type: String },
    algorithm: { type: String },
    input: {},
    mode: { type: String, reflect: true },
    layout: { type: String },
    once: { type: Boolean },
    motion: { type: String },
    visualization: { attribute: false },
    frame: { converter: frameConverter, reflect: true },
    theme: { type: String },
    customTheme: { attribute: false },
    speed: { type: Number },
    autoplay: { type: Boolean },
    loop: { type: Boolean },
    hideControls: { type: Boolean, attribute: 'hide-controls' },
    hideCode: { type: Boolean, attribute: 'hide-code' },
    language: { type: String },
    preferredLanguage: { state: true },
    playback: { state: true },
    errors: { state: true },
    frameError: { state: true },
    trace: { state: true },
    darkScheme: { state: true },
    printing: { state: true },
  };

  /** URL of a JSON document, or of the algorithm's input. */
  declare src: string | undefined;
  /** A registry id, such as `dijkstra`: the content is then its input. */
  declare algorithm: string | undefined;
  /**
   * The algorithm's input: text, read as JSON or a notation such as
   * `A-B 4, B-C 2`, or any value; without it, the first example runs.
   */
  declare input: unknown;
  /** A document object; takes precedence over `src` and inline JSON. */
  declare visualization: unknown;
  /** `interactive` (default) or `display`: animation only, no chrome. */
  declare mode: PlayerMode;
  /**
   * Where structures declared with `place: "side"` go (ADR 0029): beside
   * the others (`wide`, the default) or below them (`narrow`), for a
   * narrow column. Any other value draws wide.
   */
  declare layout: FigureLayout;
  /** In display mode, play once instead of looping. */
  declare once: boolean;
  /** Cell movement; defaults to `arc` when interactive, `linear` in display. */
  declare motion: PlayerMotion | undefined;
  /**
   * Current frame: 0 is the initial state, `length` the last. Also takes
   * a selector, such as `relax#2`, `insert-5/go` or `-1` (the last frame);
   * it reads back as the frame number once the document has loaded. A
   * section opens at its first step.
   */
  declare frame: FrameSelector;
  /**
   * A built-in theme (`light`, `textbook`, `turbo-c`, …), `auto` to follow
   * the system between light and dark, or a pair such as
   * `textbook textbook-dark` to follow it between those two.
   */
  declare theme: PlayerTheme;
  /** A full SVG theme (e.g. from `createTheme`); overrides `theme` for the scene. */
  declare customTheme: SvgTheme | undefined;
  /** Milliseconds per step while playing. */
  declare speed: number;
  declare autoplay: boolean;
  declare loop: boolean;
  declare hideControls: boolean;
  declare hideCode: boolean;
  /**
   * The language of the code to show first, e.g. `python`, when the
   * document has several; pseudocode by default. A language the reader
   * chose wins.
   */
  declare language: string | undefined;

  /** The language the reader chose, in this page or before on the site. */
  declare protected preferredLanguage: string | undefined;

  declare protected playback: PlaybackState;
  declare protected errors: readonly Diagnostic[] | null;
  declare protected frameError: FrameError | null;
  declare protected trace: Trace | null;
  declare protected darkScheme: boolean;
  /**
   * Whether the page is being printed: `auto` and day-and-night pairs
   * then print in their day theme (ADR 0030).
   */
  declare protected printing: boolean;

  #layout: TraceLayout | null = null;
  /** The fonts `#layout` measured text with. */
  #layoutFonts: LayoutFonts | null = null;
  #stage: SceneStage | null = null;
  #inline: unknown = undefined;
  #inlineText: string | null = null;
  #request = 0;
  #rendered = false;
  #requestedFrame: FrameSelector = 0;
  readonly #controller: PlayerController;
  readonly #colorScheme = mediaQuery('(prefers-color-scheme: dark)');
  readonly #reducedMotion = mediaQuery('(prefers-reduced-motion: reduce)');
  #visibility: IntersectionObserver | null = null;
  #pausedOffscreen = false;
  /** Whether playback was running when the element was last disconnected. */
  #playingWhenDisconnected = false;
  /** Last visibility reported by the IntersectionObserver. */
  #visible = true;
  #ownsTabIndex = false;

  constructor() {
    super();
    this.src = undefined;
    this.algorithm = undefined;
    this.input = undefined;
    this.mode = 'interactive';
    this.layout = 'wide';
    this.once = false;
    this.motion = undefined;
    this.visualization = undefined;
    this.frame = 0;
    this.theme = 'auto';
    this.customTheme = undefined;
    this.speed = 900;
    this.autoplay = false;
    this.loop = false;
    this.hideControls = false;
    this.hideCode = false;
    this.language = undefined;
    this.preferredLanguage = storedLanguage();
    this.errors = null;
    this.frameError = null;
    this.trace = null;
    this.darkScheme = this.#colorScheme?.matches ?? false;
    this.printing = false;
    this.#controller = new PlayerController({
      interval: this.speed,
      onChange: (state) => this.#onPlayback(state),
    });
    this.playback = this.#controller.state;
  }

  // --- Public API ----------------------------------------------------------

  play(): void {
    this.#controller.play();
  }

  pause(): void {
    this.#controller.pause();
  }

  next(): void {
    this.#controller.next();
  }

  prev(): void {
    this.#controller.prev();
  }

  seek(index: number): void {
    this.#controller.seek(index);
  }

  /** Number of steps in the loaded trace (frames are 0 to `length`). */
  get length(): number {
    return this.trace?.length ?? 0;
  }

  /** The name (`meta.id`) of the step that produced the current frame. */
  get stepName(): string | undefined {
    const doc = this.trace?.visualization;
    return doc && stepNameAt(doc, this.playback.index);
  }

  /** The section of the step that produced the current frame. */
  get section(): Section | undefined {
    const doc = this.trace?.visualization;
    return doc && sectionAt(doc, this.playback.index);
  }

  /** The language of the code on show, if the document names one. */
  get currentLanguage(): string | undefined {
    return this.#listing()?.language;
  }

  // --- Lifecycle -------------------------------------------------------------

  override connectedCallback(): void {
    super.connectedCallback();
    linkFonts(
      AlgoPlayer.fontsUrl === undefined
        ? defaultFontsUrl()
        : AlgoPlayer.fontsUrl,
    );
    this.addEventListener('keydown', this.#onKeyDown);
    this.#colorScheme?.addEventListener('change', this.#onColorScheme);
    globalThis.addEventListener?.('beforeprint', this.#onBeforePrint);
    globalThis.addEventListener?.('afterprint', this.#onAfterPrint);
    globalThis.addEventListener?.(LANGUAGE_EVENT, this.#onLanguage);
    globalThis.addEventListener?.('storage', this.#onStorage);
    // A choice made while this player was detached.
    this.preferredLanguage = storedLanguage() ?? this.preferredLanguage;
    if (typeof IntersectionObserver === 'function') {
      this.#visibility = new IntersectionObserver(this.#onVisibility);
      this.#visibility.observe(this);
    }
    // Resume after being moved or re-inserted into the document.
    if (
      this.trace !== null &&
      (this.#playingWhenDisconnected || this.#isDisplay)
    ) {
      this.#playingWhenDisconnected = false;
      this.#startPlayback();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this.#onKeyDown);
    this.#colorScheme?.removeEventListener('change', this.#onColorScheme);
    globalThis.removeEventListener?.('beforeprint', this.#onBeforePrint);
    globalThis.removeEventListener?.('afterprint', this.#onAfterPrint);
    globalThis.removeEventListener?.(LANGUAGE_EVENT, this.#onLanguage);
    globalThis.removeEventListener?.('storage', this.#onStorage);
    this.#visibility?.disconnect();
    this.#visibility = null;
    // Pause (rather than dispose) so the UI state stays in sync and playback
    // can resume if the element is connected again.
    this.#playingWhenDisconnected = this.playback.playing;
    this.#controller.pause();
  }

  get #isDisplay(): boolean {
    return this.mode === 'display';
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('speed')) this.#controller.interval = this.speed;
    if (changed.has('loop') || changed.has('mode') || changed.has('once')) {
      this.#controller.loop = this.#isDisplay ? !this.once : this.loop;
      this.#controller.endHold = this.#isDisplay ? DISPLAY_END_HOLD_MS : 0;
    }
    if (changed.has('mode')) {
      this.#updateFocusability();
      if (this.trace !== null && changed.get('mode') !== undefined) {
        this.#relayout();
        if (this.#isDisplay) this.#startPlayback();
        else if (!this.autoplay) this.#controller.pause();
      }
    }
    if (
      changed.has('layout') &&
      this.trace !== null &&
      changed.get('layout') !== undefined
    )
      this.#relayout();
    // A theme with other fonts needs room for its own text (ADR 0024).
    if (
      this.trace !== null &&
      this.#layout !== null &&
      !sameFonts(this.#layoutFonts, this.#sceneTheme().fontMetrics)
    )
      this.#relayout();
    const reload =
      changed.has('visualization') ||
      changed.has('src') ||
      changed.has('algorithm') ||
      changed.has('input');
    if (changed.has('frame')) this.#onFrame(reload);
    if (reload) void this.#load();
    const resolved = this.#resolvedTheme();
    if (this.dataset['resolvedTheme'] !== resolved)
      this.dataset['resolvedTheme'] = resolved;
  }

  #onFrame(reload: boolean): void {
    const frame = this.frame;
    if (typeof frame === 'number' && !Number.isFinite(frame)) {
      this.frame = this.playback.index;
    } else if (this.trace === null || reload) {
      // Before a document is loaded, or with a new one, remember the frame
      // to show once it is.
      this.#requestedFrame = frame;
    } else if (frame !== this.playback.index) {
      this.#goTo(frame);
    }
  }

  /**
   * Shows the frame a number or selector names. A selector that matches
   * nothing keeps the current frame and says why.
   */
  #goTo(frame: FrameSelector): void {
    const doc = this.trace?.visualization;
    if (doc === undefined) return;
    // Plain numbers are clamped to the timeline, as before selectors.
    const index =
      typeof frame === 'number' && frame >= 0
        ? ok(frame)
        : openingFrame(doc, frame);
    if (index.ok) {
      this.frameError = null;
      this.#controller.seek(index.value);
    } else {
      this.frameError = { selector: String(frame), error: index.error };
    }
    // The frame reads back as a number, even if the seek changed nothing.
    this.frame = this.playback.index;
  }

  protected override firstUpdated(): void {
    const svg = this.renderRoot.querySelector('svg.scene');
    if (svg instanceof SVGSVGElement) this.#stage = new SceneStage(svg);
    // Children parsed before the element upgraded produce no slotchange.
    this.#readInline();
  }

  protected override updated(): void {
    this.#drawScene();
    this.#scrollCodeLine();
  }

  // --- Loading ---------------------------------------------------------------

  async #load(): Promise<void> {
    const request = ++this.#request;
    const pending = documentOf({
      visualization: this.visualization,
      algorithm: this.algorithm,
      // Removing the attribute sets null: no input, as when never given.
      input: this.input ?? undefined,
      src: this.src,
      inline: this.#inline,
    });
    // A document given directly loads at once, without a microtask.
    const content = pending instanceof Promise ? await pending : pending;
    if (request !== this.#request) return;
    if (!content.ok) {
      this.#fail(content.error);
      return;
    }
    if (content.value === undefined) return;

    const result = loadTrace(content.value);
    if (!result.ok) {
      this.#fail(result.error);
      return;
    }
    this.errors = null;
    this.frameError = null;
    this.trace = result.value;
    this.#relayout();
    this.#controller.reset(result.value.length);
    if (this.#requestedFrame !== 0) this.#goTo(this.#requestedFrame);
    this.#requestedFrame = 0;
    this.dispatchEvent(
      new CustomEvent('algo-load', { detail: { length: result.value.length } }),
    );
    if (this.autoplay || this.#isDisplay) this.#startPlayback();
  }

  #fail(errors: readonly Diagnostic[]): void {
    this.trace = null;
    this.frameError = null;
    this.#layout = null;
    this.errors = errors;
    this.#controller.reset(0);
    this.dispatchEvent(new CustomEvent('algo-error', { detail: { errors } }));
  }

  #onSlotChange = (): void => {
    this.#readInline();
  };

  /** Reads the first `<script type="application/json">` child, if any. */
  #readInline(): void {
    const script = [...this.children].find(
      (el): el is HTMLScriptElement =>
        el instanceof HTMLScriptElement && el.type === 'application/json',
    );
    if (script === undefined || script.textContent === this.#inlineText) return;
    this.#inlineText = script.textContent;
    try {
      this.#inline = JSON.parse(script.textContent ?? '');
    } catch (error) {
      // Inline JSON is the lowest-priority source; ignore it when another is set.
      if (this.#hasOtherContent) return;
      // A load started before the inline JSON was read, such as an
      // algorithm's first example, must not replace this error.
      this.#request++;
      this.#fail([
        {
          code: 'INVALID_JSON',
          path: '$',
          message: error instanceof Error ? error.message : String(error),
          hint: 'The inline <script type="application/json"> must contain valid JSON.',
        },
      ]);
      return;
    }
    if (!this.#hasOtherContent) void this.#load();
  }

  /** Whether content other than the inline JSON is given. */
  get #hasOtherContent(): boolean {
    return (
      this.visualization !== undefined ||
      Boolean(this.src) ||
      (Boolean(this.algorithm) && this.input != null)
    );
  }

  // --- Playback --------------------------------------------------------------

  #onPlayback(state: PlaybackState): void {
    const previous = this.playback;
    this.playback = state;
    this.frame = state.index;
    // A selector that matched nothing no longer matters once the frame moves.
    if (state.index !== previous.index) this.frameError = null;
    if (state.index !== previous.index || state.playing !== previous.playing) {
      const doc = this.trace?.visualization;
      const stepName = doc && stepNameAt(doc, state.index);
      const section = doc && sectionAt(doc, state.index);
      const detail: AlgoFrameDetail = {
        ...state,
        ...(stepName === undefined ? {} : { stepName }),
        ...(section === undefined ? {} : { sectionId: section.id }),
      };
      this.dispatchEvent(new CustomEvent('algo-frame', { detail }));
    }
  }

  /**
   * Moves to the first step of the next section (direction 1) or of the
   * current or previous one (-1), or to the end or the start.
   */
  #jumpSection(direction: 1 | -1): void {
    const sections = this.trace?.visualization.sections ?? [];
    const firsts = sections.map((s) => s.start + 1);
    const index = this.playback.index;
    const target =
      direction > 0
        ? (firsts.find((f) => f > index) ?? this.length)
        : (firsts.filter((f) => f < index).at(-1) ?? 0);
    this.seek(target);
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    if (this.#isDisplay) return;
    const target = event.composedPath()[0];
    // A focused code panel keeps its keys for scrolling.
    if (target instanceof HTMLElement && target.classList.contains('code'))
      return;
    // The language menu keeps the keys it chooses with; the player takes
    // the left and right arrows and the section jumps from it.
    if (target instanceof HTMLSelectElement && !MENU_PASSES.has(event.key))
      return;
    const sections = (this.trace?.visualization.sections ?? []).length > 0;
    const jumps: Record<string, () => void> = sections
      ? {
          PageDown: () => this.#jumpSection(1),
          PageUp: () => this.#jumpSection(-1),
        }
      : {};
    // The timeline slider handles its own keys, except the section jumps,
    // which matter most where screen readers announce the section.
    const actions: Record<string, () => void> =
      target instanceof HTMLInputElement
        ? jumps
        : {
            ArrowRight: () => this.next(),
            ArrowLeft: () => this.prev(),
            ' ': () => this.#controller.toggle(),
            k: () => this.#controller.toggle(),
            Home: () => this.seek(0),
            End: () => this.seek(this.length),
            ...jumps,
          };
    const action = actions[event.key];
    if (action === undefined) return;
    event.preventDefault();
    action();
  };

  /**
   * Starts automatic playback, unless this is a display that is currently
   * off screen: then it starts once the display becomes visible.
   */
  #startPlayback(): void {
    if (this.#isDisplay && !this.#visible) this.#pausedOffscreen = true;
    else this.#controller.play();
  }

  /** Display mode pauses while off screen and resumes when visible again. */
  #onVisibility = (entries: IntersectionObserverEntry[]): void => {
    const visible = entries.at(-1)?.isIntersecting ?? true;
    this.#visible = visible;
    if (!this.#isDisplay) return;
    if (!visible && this.playback.playing) {
      this.#pausedOffscreen = true;
      this.#controller.pause();
    } else if (visible && this.#pausedOffscreen) {
      this.#pausedOffscreen = false;
      this.#controller.play();
    }
  };

  /** Interactive players are focusable for keyboard control; displays are not. */
  #updateFocusability(): void {
    if (this.#isDisplay) {
      if (this.#ownsTabIndex) this.removeAttribute('tabindex');
      this.#ownsTabIndex = false;
    } else if (!this.hasAttribute('tabindex')) {
      this.tabIndex = 0;
      this.#ownsTabIndex = true;
    }
  }

  #layoutOptions(): LayoutOptions {
    return {
      ...(this.#isDisplay ? bareLayoutOptions : defaultLayoutOptions),
      layout: this.layout === 'narrow' ? 'narrow' : 'wide',
      fonts: this.#sceneTheme().fontMetrics,
    };
  }

  /** Lays the trace out again, measuring text in the theme's fonts. */
  #relayout(): void {
    if (this.trace === null) return;
    const options = this.#layoutOptions();
    this.#layout = layoutTrace(this.trace, options);
    this.#layoutFonts = options.fonts;
    this.#rendered = false;
  }

  #onBeforePrint = (): void => {
    this.printing = true;
  };

  #onAfterPrint = (): void => {
    this.printing = false;
  };

  #onColorScheme = (event: MediaQueryListEvent): void => {
    this.darkScheme = event.matches;
  };

  /** Another player on the page, or this one, told of a reader's choice. */
  #onLanguage = (event: Event): void => {
    const detail = (event as CustomEvent<LanguageEventDetail | undefined>)
      .detail;
    if (typeof detail?.language === 'string')
      this.preferredLanguage = detail.language;
  };

  /** A reader's choice in another tab of this site. */
  #onStorage = (event: StorageEvent): void => {
    if (event.key === LANGUAGE_KEY && event.newValue !== null)
      this.preferredLanguage = event.newValue;
  };

  /** The code listing on show: the reader's choice, `language`, pseudocode. */
  #listing() {
    const doc = this.trace?.visualization;
    return pickListing(doc ? codeListings(doc) : [], [
      this.preferredLanguage,
      this.language,
    ]);
  }

  #chooseLanguage(language: string): void {
    this.preferredLanguage = language;
    chooseLanguage(language);
  }

  /** The theme the scene is painted with. */
  #sceneTheme(): SvgTheme {
    return resolveTheme(this.customTheme ?? this.#resolvedTheme());
  }

  #resolvedTheme(): ThemeName {
    return resolvePlayerTheme(
      String(this.theme ?? 'auto'),
      this.darkScheme && !this.printing,
    );
  }

  // --- Rendering -------------------------------------------------------------

  #drawScene(): void {
    if (this.#stage === null || this.#layout === null) return;
    const scene = this.#layout.sceneAt(this.playback.index);
    const painted = paintScene(scene, this.#sceneTheme());
    const animate = this.#rendered && !(this.#reducedMotion?.matches ?? false);
    this.#stage.render(painted, {
      duration: animate ? Math.min(MAX_ANIMATION_MS, this.speed * 0.55) : 0,
      motion: this.motion ?? (this.#isDisplay ? 'linear' : 'arc'),
    });
    this.#rendered = true;
  }

  #scrollCodeLine(): void {
    const code = this.renderRoot.querySelector<HTMLElement>('.code');
    const line = code?.querySelector<HTMLElement>('.line.current');
    if (!code || !line) return;
    const top = line.offsetTop - code.clientHeight / 2 + line.clientHeight / 2;
    code.scrollTop = Math.max(0, top);
  }

  protected override render() {
    const trace = this.trace;
    const { index, length, playing } = this.playback;
    const step = trace?.frame(index).step;
    const listings = trace ? codeListings(trace.visualization) : [];
    const listing = this.#listing();
    const display = this.#isDisplay;
    const showCode = listing !== undefined && !this.hideCode && !display;
    const vars = Object.entries(step?.meta?.vars ?? {});
    const sections = trace?.visualization.sections ?? [];
    const section = this.section;

    return html`
      <div class="player" part="container">
        ${
          this.errors
            ? html`<div class="errors" role="alert" part="errors">
                <strong
                  >${
                    this.algorithm && this.visualization === undefined
                      ? 'This algorithm could not be run on its input.'
                      : 'This visualization could not be loaded.'
                  }</strong
                >
                <pre>${formatErrors(this.errors)}</pre>
              </div>`
            : nothing
        }
        ${
          this.frameError && trace
            ? html`<div class="errors frame-error" role="alert" part="errors">
                <strong
                  >Cannot open frame
                  ${JSON.stringify(this.frameError.selector)}.</strong
                >
                <p>
                  ${this.frameError.error.message}.
                  ${this.frameError.error.hint ?? ''}
                </p>
              </div>`
            : nothing
        }
        <div
          class="body ${showCode ? 'with-code' : ''}"
          ?hidden=${trace === null}
        >
          <div class="stage" part="stage"><svg class="scene"></svg></div>
          ${
            showCode
              ? html`<div class="code-panel">
                  ${
                    listings.length > 1
                      ? html`<select
                          class="languages"
                          part="languages"
                          aria-label="Code language"
                          .value=${listing.language ?? ''}
                          @change=${(event: Event) =>
                            this.#chooseLanguage(
                              (event.target as HTMLSelectElement).value,
                            )}
                        >
                          ${listings.map(
                            ({ language }) =>
                              html`<option
                                value=${language ?? ''}
                                ?selected=${language === listing.language}
                              >
                                ${languageName(language)}
                              </option>`,
                          )}
                        </select>`
                      : nothing
                  }
                  <pre
                    class="code"
                    part="code"
                    role="region"
                    aria-label=${listing.language === undefined ? 'Source code' : `Source code, ${languageName(listing.language)}`}
                    tabindex="0"
                  >
${codeLines(listing.source, listing.lineOf(step))}</pre>
                </div>`
              : nothing
          }
        </div>
        <div
          class="caption"
          part="caption"
          ?hidden=${trace === null || display}
        >
          ${
            sections.length > 0
              ? html`<p class="section-title" part="section-title">
                  ${section?.title ?? ''}
                </p>`
              : nothing
          }
          <p class="narration" aria-live="polite">
            ${step?.meta?.narration ?? (index === 0 ? 'Initial state.' : '')}
          </p>
          ${
            vars.length > 0
              ? html`<ul class="vars" aria-label="Variables">
                  ${vars.map(([name, value]) => html`<li>${name} = ${JSON.stringify(value)}</li>`)}
                </ul>`
              : nothing
          }
        </div>
        <div
          class="controls"
          part="controls"
          ?hidden=${this.hideControls || trace === null || display}
        >
          <button
            type="button"
            aria-label="Previous step"
            ?disabled=${index === 0}
            @click=${() => this.prev()}
          >
            ${prevIcon}
          </button>
          <button
            type="button"
            class="primary"
            aria-label=${playing ? 'Pause' : index === length ? 'Replay' : 'Play'}
            ?disabled=${length === 0}
            @click=${() => this.#controller.toggle()}
          >
            ${playing ? pauseIcon : index === length ? restartIcon : playIcon}
          </button>
          <button
            type="button"
            aria-label="Next step"
            ?disabled=${index === length}
            @click=${() => this.next()}
          >
            ${nextIcon}
          </button>
          <input
            type="range"
            min="0"
            max=${length}
            .value=${String(index)}
            aria-label="Timeline"
            aria-valuetext=${
              sections.length > 0
                ? `Frame ${index} of ${length}${section ? `, ${section.title}` : ''}`
                : nothing
            }
            @input=${(event: Event) => this.seek(Number((event.target as HTMLInputElement).value))}
          />
          <span class="counter" aria-live="off">${index} / ${length}</span>
          ${
            sections.length > 0 && !display
              ? sectionStrip(sections, length, section, (f) => this.seek(f))
              : nothing
          }
        </div>
      </div>
      <slot hidden @slotchange=${this.#onSlotChange}></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'algo-player': AlgoPlayer;
  }
  interface HTMLElementEventMap {
    'algo-frame': CustomEvent<AlgoFrameDetail>;
    'algo-load': CustomEvent<{ length: number }>;
    'algo-error': CustomEvent<{ errors: readonly Diagnostic[] }>;
  }
}
