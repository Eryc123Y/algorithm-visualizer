/**
 * Styles of the player chrome. Every colour and font is a CSS custom property
 * that pages can override on the element, e.g.
 * `algo-player { --algo-accent: #7c3aed; }`.
 */
import { css } from 'lit';

export const playerStyles = css`
  :host {
    --algo-bg: #ffffff;
    --algo-fg: #1f2a26;
    --algo-muted: #66736d;
    --algo-border: #dfe5e2;
    --algo-surface: #f5f7f6;
    --algo-accent: #0f7b6c;
    --algo-accent-fg: #ffffff;
    --algo-line-bg: #fff4dc;
    --algo-line-edge: #d08a18;
    --algo-error: #b42318;
    --algo-radius: 14px;
    --algo-font:
      'Inter', 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
    --algo-mono:
      'JetBrains Mono', 'SFMono-Regular', ui-monospace, Menlo, Consolas,
      monospace;

    display: block;
    container-type: inline-size;
    color: var(--algo-fg);
    font-family: var(--algo-font);
    font-size: 14px;
    line-height: 1.5;
  }
  :host([data-resolved-theme='dark']) {
    --algo-bg: #151b19;
    --algo-fg: #e4ebe8;
    --algo-muted: #95a39d;
    --algo-border: #2b3633;
    --algo-surface: #1c2422;
    --algo-accent: #4fc4b0;
    --algo-accent-fg: #0d1a17;
    --algo-line-bg: #3b2c12;
    --algo-line-edge: #e9a53a;
    --algo-error: #ff8a7a;
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

  .code {
    margin: 0;
    padding: 8px 0;
    max-height: 320px;
    overflow: auto;
    background: var(--algo-surface);
    border-radius: 10px;
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
    border-radius: 999px;
    background: var(--algo-surface);
    border: 1px solid var(--algo-border);
    font-family: var(--algo-mono);
    font-size: 12px;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 6px;
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
    border-radius: 999px;
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
  input:focus-visible {
    outline: 2px solid var(--algo-accent);
    outline-offset: 2px;
  }
  input[type='range'] {
    flex: 1;
    min-width: 80px;
    margin: 0 6px;
    accent-color: var(--algo-accent);
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
    border-radius: 10px;
    color: var(--algo-error);
  }
  .errors pre {
    margin: 6px 0 0;
    white-space: pre-wrap;
    font-family: var(--algo-mono);
    font-size: 12px;
    color: var(--algo-fg);
  }
`;
