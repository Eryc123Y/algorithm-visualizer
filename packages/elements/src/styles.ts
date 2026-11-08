/**
 * Styles of the player chrome. Every colour and font is a CSS custom property
 * that pages can override on the element, e.g.
 * `algo-player { --algo-accent: #7c3aed; }`. Their values in each built-in
 * theme are in `chrome.ts`.
 */
import { css } from 'lit';

export const playerStyles = css`
  :host {
    display: block;
    container-type: inline-size;
    color: var(--algo-fg);
    font-family: var(--algo-font);
    font-size: 14px;
    line-height: 1.5;
  }
  :host([hidden]) {
    display: none;
  }
  /* Printed as shown, so a night theme stays legible on paper (ADR 0030). */
  @media print {
    :host {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }
  :host(:focus-visible) {
    outline: none;
  }
  :host(:focus-visible) .player {
    outline: 2px solid var(--algo-accent);
    outline-offset: 2px;
  }
  [hidden] {
    display: none !important;
  }

  .player {
    display: grid;
    gap: 12px;
    padding: 16px;
    background: var(--algo-bg);
    border: 1px solid var(--algo-border);
    border-radius: var(--algo-radius);
  }
  :host([mode='display']) .player {
    padding: 0;
    gap: 0;
    background: transparent;
    border: 0;
    border-radius: 0;
  }

  .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  @container (min-width: 720px) {
    .body.with-code {
      grid-template-columns: minmax(0, 1.4fr) minmax(220px, 1fr);
      align-items: start;
    }
  }
  .stage {
    overflow-x: auto;
    min-width: 0;
  }
  .stage svg {
    display: block;
    max-width: 100%;
    height: auto;
  }

  .code-panel {
    display: grid;
    gap: 8px;
    min-width: 0;
  }
  /* The language menu: a native select, drawn in the chrome's colours. */
  .languages {
    justify-self: start;
    height: 28px;
    padding: 0 28px 0 12px;
    color: var(--algo-fg);
    background-color: var(--algo-bg);
    /* A chevron in the text colour, drawn without an image. */
    background-image:
      linear-gradient(45deg, transparent 50%, currentColor 50%),
      linear-gradient(135deg, currentColor 50%, transparent 50%);
    background-position:
      calc(100% - 16px) 55%,
      calc(100% - 11px) 55%;
    background-size: 5px 5px;
    background-repeat: no-repeat;
    border: 1px solid var(--algo-border);
    border-radius: var(--algo-control-radius);
    font: inherit;
    font-size: 12px;
    appearance: none;
    cursor: pointer;
  }
  .languages:hover {
    border-color: var(--algo-accent);
  }

  .code {
    /* Line offsets are measured from the panel, to centre the current line. */
    position: relative;
    margin: 0;
    padding: 8px 0;
    max-height: 320px;
    overflow: auto;
    background: var(--algo-surface);
    border-radius: var(--algo-panel-radius);
    font-family: var(--algo-mono);
    font-size: 12.5px;
    line-height: 1.7;
    counter-reset: line;
  }
  .code .line {
    display: block;
    padding: 0 12px 0 0;
    white-space: pre;
    border-left: 3px solid transparent;
  }
  .code .line::before {
    counter-increment: line;
    content: counter(line);
    display: inline-block;
    width: 3ch;
    margin-right: 12px;
    text-align: right;
    color: var(--algo-muted);
    opacity: 0.7;
  }
  .code .line.current {
    background: var(--algo-line-bg);
    border-left-color: var(--algo-line-edge);
  }
  .tok-keyword {
    color: var(--algo-code-keyword);
    font-weight: 600;
  }
  .tok-builtin {
    color: var(--algo-code-builtin);
  }
  .tok-function {
    color: var(--algo-code-function);
  }
  .tok-string {
    color: var(--algo-code-string);
  }
  .tok-number {
    color: var(--algo-code-number);
  }
  .tok-comment {
    color: var(--algo-code-comment);
    font-style: italic;
  }
  /* Procedure names in pseudocode, as CLRS sets them (ADR 0017). */
  .tok-procedure .small-caps {
    font-variant-caps: all-small-caps;
  }

  .caption {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 12px;
    min-height: 1.5em;
  }
  .narration {
    margin: 0;
    flex: 1 1 240px;
  }
  .vars {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .vars li {
    padding: 1px 8px;
    border-radius: var(--algo-control-radius);
    background: var(--algo-surface);
    border: 1px solid var(--algo-border);
    font-family: var(--algo-mono);
    font-size: 12px;
  }

  /* Buttons, slider and counter; sections sit under the slider. */
  .controls {
    display: grid;
    grid-template-columns: auto auto auto minmax(92px, 1fr) auto;
    align-items: center;
    gap: 2px 6px;
  }
  button {
    display: inline-grid;
    place-items: center;
    width: 34px;
    height: 34px;
    padding: 0;
    color: var(--algo-fg);
    background: transparent;
    border: 1px solid var(--algo-border);
    border-radius: var(--algo-control-radius);
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    border-color: var(--algo-accent);
    color: var(--algo-accent);
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  button.primary {
    width: 40px;
    height: 40px;
    color: var(--algo-accent-fg);
    background: var(--algo-accent);
    border-color: var(--algo-accent);
  }
  button.primary:hover:not(:disabled) {
    color: var(--algo-accent-fg);
    filter: brightness(1.08);
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  .code:focus-visible {
    outline: 2px solid var(--algo-accent);
    outline-offset: 2px;
  }
  input[type='range'] {
    width: calc(100% - 12px);
    min-width: 0;
    margin: 0 6px;
    accent-color: var(--algo-accent);
  }

  .sections {
    grid-column: 4;
    grid-row: 2;
    margin: 0 6px;
    font-size: 11px;
    line-height: 16px;
    color: var(--algo-muted);
    user-select: none;
  }
  /*
   * Inset by the radius of the default slider thumb (16px wide in Chromium
   * and Firefox), so a section starts under the thumb at its first frame.
   */
  .sections .track {
    position: relative;
    height: 20px;
    margin: 0 8px;
  }
  .sections .section {
    position: absolute;
    top: 0;
    bottom: 0;
    box-sizing: border-box;
    padding: 2px 4px 0;
    border-left: 1px solid var(--algo-border);
    border-top: 2px solid transparent;
    cursor: pointer;
    container-type: inline-size;
  }
  .sections .label {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* A title that cannot show a few letters is left to the caption. */
  @container (max-width: 44px) {
    .sections .label {
      visibility: hidden;
    }
  }
  .sections .section:hover {
    color: var(--algo-fg);
  }
  .sections .section.current {
    color: var(--algo-fg);
    font-weight: 600;
    border-left-color: var(--algo-accent);
    border-top-color: var(--algo-accent);
  }
  .section-title {
    flex-basis: 100%;
    min-height: 1.4em;
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--algo-muted);
  }
  .counter {
    min-width: 7ch;
    text-align: right;
    font-family: var(--algo-mono);
    font-size: 12px;
    color: var(--algo-muted);
    font-variant-numeric: tabular-nums;
  }

  .errors {
    padding: 12px 14px;
    border: 1px solid var(--algo-error);
    border-radius: var(--algo-panel-radius);
    color: var(--algo-error);
  }
  .errors p {
    margin: 6px 0 0;
    color: var(--algo-fg);
  }
  .errors pre {
    margin: 6px 0 0;
    white-space: pre-wrap;
    font-family: var(--algo-mono);
    font-size: 12px;
    color: var(--algo-fg);
  }
`;
