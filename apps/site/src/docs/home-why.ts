/**
 * The home page's short "why" section (roadmap 5.4), below the outputs:
 * three reasons, and the way to the page that argues them.
 */

/** The section, with links relative to the site's root. */
export function homeWhy(): string {
  return `<section class="home-why" aria-labelledby="why-title">
  <div class="section-head">
    <h2 id="why-title">Why not draw it by hand?</h2>
    <p>Hand-drawn figures give exact control, and Manim makes polished videos. algomotion is for something narrower.</p>
  </div>
  <ul class="why-reasons">
    <li><h3>The steps come from running it</h3><p>Name the algorithm and give it your input. Nothing is drawn by hand, so a new input is a new run, not an evening of redrawing.</p></li>
    <li><h3>One run, every place</h3><p>The figure in your notes, the overlays on your slides and the player on your course page are the same run, in the same theme.</p></li>
    <li><h3>Honest about its limits</h3><p>It draws the algorithms in its catalogue and documents you write, laid out automatically, as still figures or a player. No video.</p></li>
  </ul>
  <p><a class="button quiet" href="why/">Why algomotion, compared</a></p>
</section>`;
}
