/**
 * The faces of the built-in themes (ADR 0030): the metrics layout measures
 * with, and the CSS family lists text names. Each list starts with the
 * bundled face; fallbacks of a similar width follow, then CJK families,
 * which the bundled faces lack, then the generic family.
 */
import { defaultFonts, type LayoutFonts } from '@algoviz/core';
import {
  dotGothic16Regular,
  lexendSemiBold,
  notoSansMonoSemiBold,
  notoSansSemiBold,
  stixTwoTextSemiBold,
} from '@algoviz/fonts';

/** CSS families of both roles. */
export interface FontFamilies {
  readonly value: string;
  readonly label: string;
}

const CJK_SANS = "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei'";
const CJK_SERIF = "'Songti SC', 'Noto Serif SC', SimSun";

/** JetBrains Mono and Inter, as ADR 0024 named them. */
export const defaultFamilies: FontFamilies = {
  value:
    "'JetBrains Mono', 'SFMono-Regular', ui-monospace, Menlo, Consolas, monospace",
  label:
    "'Inter', 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
};

export { defaultFonts };

const stix = `'STIX Two Text', 'Times New Roman', Times, ${CJK_SERIF}, serif`;

/** STIX Two Text for everything: the textbook themes. */
export const textbookFonts: LayoutFonts = {
  value: stixTwoTextSemiBold,
  label: stixTwoTextSemiBold,
};
export const textbookFamilies: FontFamilies = { value: stix, label: stix };

const lexend = `'Lexend', 'Avenir Next', 'Segoe UI', system-ui, ${CJK_SANS}, sans-serif`;

/** Lexend for everything: the building-block themes. */
export const blocksFonts: LayoutFonts = {
  value: lexendSemiBold,
  label: lexendSemiBold,
};
export const blocksFamilies: FontFamilies = { value: lexend, label: lexend };

/** Noto Sans Mono for values and Noto Sans for labels: the answer sheet. */
export const answerSheetFonts: LayoutFonts = {
  value: notoSansMonoSemiBold,
  label: notoSansSemiBold,
};
export const answerSheetFamilies: FontFamilies = {
  value: `'Noto Sans Mono', 'DejaVu Sans Mono', ui-monospace, Menlo, Consolas, 'Noto Sans SC', ${CJK_SANS}, monospace`,
  label: `'Noto Sans', 'Noto Sans SC', ${CJK_SANS}, system-ui, sans-serif`,
};

const pixel = `'DotGothic16', 'Courier New', ui-monospace, Menlo, ${CJK_SANS}, monospace`;

/** DotGothic16 for everything: Turbo C. */
export const turboCFonts: LayoutFonts = {
  value: dotGothic16Regular,
  label: dotGothic16Regular,
};
export const turboCFamilies: FontFamilies = { value: pixel, label: pixel };
