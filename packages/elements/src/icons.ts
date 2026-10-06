import { svg } from 'lit';

const icon = (path: ReturnType<typeof svg>) =>
  svg`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">${path}</svg>`;

export const playIcon = icon(
  svg`<path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.4-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5z"/>`,
);
export const pauseIcon = icon(
  svg`<rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/>`,
);
export const prevIcon = icon(
  svg`<path d="M15.5 5.5 8.5 12l7 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const nextIcon = icon(
  svg`<path d="m8.5 5.5 7 6.5-7 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
export const restartIcon = icon(
  svg`<path d="M5 12a7 7 0 1 0 2.05-4.95M5 5v3.5h3.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
);
