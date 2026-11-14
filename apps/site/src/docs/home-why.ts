/**
 * The home page's short "why" section (roadmap 5.4), below the outputs:
 * three reasons, and the way to the page that argues them.
 */
import { text } from './html.ts';
import type { HomeText } from './text/home.ts';

/** The section, with links relative to the locale's root. */
export function homeWhy(t: HomeText['why']): string {
  return `<section class="home-why" aria-labelledby="why-title">
  <div class="section-head">
    <h2 id="why-title">${text(t.title)}</h2>
    <p>${text(t.lede)}</p>
  </div>
  <ul class="why-reasons">
${t.reasons.map((r) => `    <li><h3>${text(r.title)}</h3><p>${text(r.text)}</p></li>`).join('\n')}
  </ul>
  <p><a class="button quiet" href="why/">${text(t.more)}</a></p>
</section>`;
}
