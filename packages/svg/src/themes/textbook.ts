/**
 * 课本批注, textbook annotations (ADR 0030): a textbook figure a student has
 * marked up with highlighter, red pen and blue pen. Black ink on white paper;
 * the highlighter marks a comparison, the red pen a swap, and a solid ink
 * block a settled cell. The night variant is the same page in a reader's
 * night mode: the paper goes dark, the ink turns light, the marks stay marks.
 */
import type { SvgTheme } from '../theme.ts';
import { textbookFamilies, textbookFonts } from './fonts.ts';

const blue = '#1f4fb4';
const red = '#c62e28';

export const textbookTheme: SvgTheme = {
  fonts: textbookFamilies,
  fontMetrics: textbookFonts,
  tex: { value: 'rm', label: 'rm' },
  radius: 1,
  background: null,
  shadow: null,
  title: '#000000',
  index: '#6b6b6b',
  pointer: { line: blue, fill: blue, text: '#ffffff' },
  cell: {
    visited: {
      fill: '#ffffff',
      stroke: '#8c8c8c',
      strokeWidth: 1.25,
      dash: '1.5 2.5',
      text: '#555555',
    },
    default: {
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 1,
      dash: null,
      text: '#000000',
    },
    compare: {
      fill: '#ffe45c',
      stroke: '#000000',
      strokeWidth: 2.5,
      dash: null,
      text: '#000000',
    },
    swap: {
      fill: '#ffffff',
      stroke: red,
      strokeWidth: 2.5,
      dash: '5 3',
      text: red,
    },
    highlight: {
      fill: '#e4ecfb',
      stroke: blue,
      strokeWidth: 1.5,
      dash: null,
      text: '#0f2a66',
    },
    settled: {
      fill: '#000000',
      stroke: '#000000',
      strokeWidth: 1.25,
      dash: null,
      text: '#ffffff',
    },
  },
  settledMark: '#ffffff',
  groups: [
    { fill: '#e4ecfb', stroke: blue, text: '#0f2a66' },
    { fill: '#fde2df', stroke: red, text: '#7a1a16' },
    { fill: '#fff3b0', stroke: '#9a7b00', text: '#4d3d00' },
    { fill: '#e3f1e4', stroke: '#2e7d32', text: '#1b4a1e' },
    { fill: '#ede3f6', stroke: '#6a3fa0', text: '#3d2360' },
    { fill: '#e0f2f1', stroke: '#00796b', text: '#004d43' },
  ],
  rb: {
    red: { fill: red, stroke: '#8f1f1b', text: '#ffffff' },
    black: { fill: '#000000', stroke: '#000000', text: '#ffffff' },
  },
  edge: {
    default: { stroke: '#000000', width: 1.25, opacity: 1 },
    link: { stroke: '#000000', width: 1.25, opacity: 1 },
    highlight: { stroke: blue, width: 2.75, opacity: 1 },
    selected: { stroke: '#000000', width: 3.5, opacity: 1 },
    rejected: { stroke: '#b3b3b3', width: 1, opacity: 1 },
  },
  labelHalo: '#ffffff',
};

// Night: dark paper, light ink. The marks keep their pens.
const paper = '#1b1b1a';
const ink = '#ecebe6';
const highlighter = '#f2d23c';
const redPen = '#ff8577';
const bluePen = '#93b2ff';

export const textbookDarkTheme: SvgTheme = {
  fonts: textbookFamilies,
  fontMetrics: textbookFonts,
  tex: { value: 'rm', label: 'rm' },
  radius: 1,
  background: paper,
  shadow: null,
  title: ink,
  index: '#9a9993',
  pointer: { line: bluePen, fill: bluePen, text: '#0b1a3d' },
  cell: {
    visited: {
      fill: paper,
      stroke: '#85847e',
      strokeWidth: 1.25,
      dash: '1.5 2.5',
      text: '#aaa9a2',
    },
    default: {
      fill: paper,
      stroke: ink,
      strokeWidth: 1,
      dash: null,
      text: ink,
    },
    compare: {
      fill: '#4a4011',
      stroke: highlighter,
      strokeWidth: 2.5,
      dash: null,
      text: '#fff4b8',
    },
    swap: {
      fill: paper,
      stroke: redPen,
      strokeWidth: 2.5,
      dash: '5 3',
      text: redPen,
    },
    highlight: {
      fill: '#1e2a47',
      stroke: bluePen,
      strokeWidth: 1.5,
      dash: null,
      text: '#dce6ff',
    },
    settled: {
      fill: ink,
      stroke: ink,
      strokeWidth: 1,
      dash: null,
      text: '#111111',
    },
  },
  settledMark: '#111111',
  groups: [
    { fill: '#1e2a47', stroke: bluePen, text: '#dce6ff' },
    { fill: '#3d1f1c', stroke: redPen, text: '#ffdcd7' },
    { fill: '#3b3313', stroke: '#e0c23e', text: '#fff1b3' },
    { fill: '#1c3321', stroke: '#74c482', text: '#d9f2dc' },
    { fill: '#2d2243', stroke: '#bb9bf0', text: '#ede3fc' },
    { fill: '#14322f', stroke: '#56c2b6', text: '#d3f2ee' },
  ],
  rb: {
    red: { fill: '#c23b33', stroke: redPen, text: '#ffffff' },
    black: { fill: '#000000', stroke: ink, text: '#ffffff' },
  },
  edge: {
    default: { stroke: '#d9d7d0', width: 1.25, opacity: 1 },
    link: { stroke: '#d9d7d0', width: 1.25, opacity: 1 },
    highlight: { stroke: bluePen, width: 2.75, opacity: 1 },
    selected: { stroke: ink, width: 3.5, opacity: 1 },
    rejected: { stroke: '#55544f', width: 1, opacity: 1 },
  },
  labelHalo: paper,
};
