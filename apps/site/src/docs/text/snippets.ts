/**
 * The notes under each snippet, in each locale (ADR 0045): one sentence
 * on what else the output needs, with `step` as the example of a step to
 * pick. The snippets' headings are in `chrome.ts`.
 */
import type { Locale } from '../locale.ts';
import type { Snippet } from '../snippets.ts';

export type SnippetNotes = Readonly<
  Record<Snippet['id'], (step: string) => string>
>;

const en: SnippetNotes = {
  web: () =>
    'The player is one script, the standalone bundle, in the @algomotion/elements package on npm (tag alpha) or from a CDN such as jsDelivr.',
  typst: (step) =>
    `Draws the last frame; step: "${step}" draws that step instead.`,
  latex: (step) =>
    `Compile with -shell-escape the first time; [step=${step}] picks the step drawn.`,
  cli: (step) =>
    `Writes an SVG of every frame into figures/; --step ${step} writes only that step.`,
  mcp: (step) =>
    `The call a model makes to show this run in the conversation; "frame": "${step}" opens it on that step.`,
  link: () =>
    'Opens this run in the share page; the run travels in the link after the #.',
};

const zh: SnippetNotes = {
  web: () =>
    '播放器只是一个脚本，即 npm 上 @algomotion/elements 包里的独立 bundle（标签 alpha），也可以从 jsDelivr 等 CDN 加载。页面本身是中文时，lang="zh" 可以省略。',
  typst: (step) =>
    `画最后一帧；加上 step: "${step}" 就画那一步。文档里写了 #set text(lang: "zh") 时，lang 可以省略。`,
  latex: (step) =>
    `第一次编译时加 -shell-escape；[step=${step}] 指定画哪一步。`,
  cli: (step) =>
    `把每一帧画成 SVG，写进 figures/；加上 --step ${step} 就只写那一步。`,
  mcp: (step) =>
    `模型在对话中展示这次运行时发出的调用；加上 "frame": "${step}" 就从那一步打开。`,
  link: () => '在分享页面中打开这次运行；运行就写在链接 # 后面的部分里。',
};

export const SNIPPET_NOTES: Readonly<Record<Locale, SnippetNotes>> = {
  en,
  zh,
};
