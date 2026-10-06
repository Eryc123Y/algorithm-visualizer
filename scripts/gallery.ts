/**
 * Renders every frame of every valid conformance fixture (or the documents
 * given as arguments) to one HTML contact sheet, for visual review.
 *
 *   npm run gallery [-- out.html [document-or-fixture.json …]]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

import { layoutTrace, loadTrace } from '@algoviz/core';
import { formatErrors } from '@algoviz/spec';
import { renderSvg, type ThemeName } from '@algoviz/svg';

const [out = 'gallery.html', ...files] = process.argv.slice(2);
const root = new URL('../conformance/', import.meta.url);

const documents: [string, unknown][] =
  files.length > 0
    ? files.map((f) => {
        // Accept conformance fixtures as well as bare documents.
        const json = JSON.parse(readFileSync(f, 'utf8')) as { input?: unknown };
        return [f, json.input ?? json];
      })
    : ['core/valid', 'spec/valid'].flatMap((dir) =>
        readdirSync(new URL(`${dir}/`, root))
          .filter((f) => f.endsWith('.json'))
          .map((f): [string, unknown] => [
            `${dir}/${f}`,
            (
              JSON.parse(
                readFileSync(new URL(`${dir}/${f}`, root), 'utf8'),
              ) as { input: unknown }
            ).input,
          ]),
      );

const escape = (s: string) =>
  s.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`);
const sections = documents.map(([name, doc]) => {
  const result = loadTrace(doc);
  if (!result.ok)
    return `<section><h2>${escape(name)}</h2><pre>${escape(formatErrors(result.error))}</pre></section>`;
  const trace = result.value;
  const layout = layoutTrace(trace);
  // Long traces are sampled evenly, always keeping the first and last frame.
  const count = Math.min(trace.length + 1, 10);
  const frames = [
    ...new Set(
      Array.from({ length: count }, (_, k) =>
        Math.round((k * trace.length) / Math.max(1, count - 1)),
      ),
    ),
  ];
  const figure = (i: number, theme: ThemeName) =>
    `<figure class="${theme}">${renderSvg(layout.sceneAt(i), { theme })}<figcaption>${i}${
      trace.frame(i).step?.meta?.narration
        ? ` · ${escape(trace.frame(i).step!.meta!.narration!)}`
        : ''
    }</figcaption></figure>`;
  return `<section><h2>${escape(name)}</h2><div class="row">${frames.map((i) => figure(i, 'light')).join('')}${figure(trace.length, 'dark')}</div></section>`;
});

writeFileSync(
  out,
  `<!doctype html><meta charset="utf-8"><title>algoviz gallery</title><style>
body{font:12px system-ui;margin:16px;background:#eceeed}h2{font-size:13px;margin:16px 0 6px}
.row{display:flex;flex-wrap:wrap;gap:6px}figure{margin:0;padding:8px;background:#fff;border-radius:6px}
figure.dark{background:#151b19;color:#9aa8a1}figcaption{color:#667;max-width:320px}pre{color:#b42318}
</style>${sections.join('')}`,
);
console.log(`Wrote ${out} (${documents.length} documents)`);
