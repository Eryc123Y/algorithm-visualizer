/**
 * 机房 Turbo C, the Turbo C lab (ADR 0030): the blue text-mode IDE of
 * university computer labs, drawn only with the sixteen CGA colours, square
 * corners and the hard black drop shadow of DOS windows. A comparison is
 * cyan, a swap red with a yellow dashed edge, a settled cell a green "OK"
 * button. It paints its blue screen, so it stays a screen on paper too.
 */
import type { SvgTheme } from '../theme.ts';
import { turboCFamilies, turboCFonts } from './fonts.ts';

/** The CGA palette, by its BIOS names. */
const cga = {
  black: '#000000',
  blue: '#0000aa',
  green: '#00aa00',
  cyan: '#00aaaa',
  red: '#aa0000',
  magenta: '#aa00aa',
  brown: '#aa5500',
  lightGray: '#aaaaaa',
  lightBlue: '#5555ff',
  lightGreen: '#55ff55',
  lightCyan: '#55ffff',
  lightRed: '#ff5555',
  lightMagenta: '#ff55ff',
  yellow: '#ffff55',
  white: '#ffffff',
} as const;

export const turboCTheme: SvgTheme = {
  fonts: turboCFamilies,
  fontMetrics: turboCFonts,
  tex: { value: 'tt', label: 'tt' },
  radius: 0,
  background: cga.blue,
  shadow: cga.black,
  title: cga.white,
  index: cga.lightGray,
  pointer: { line: cga.yellow, fill: cga.yellow, text: cga.black },
  cell: {
    visited: {
      fill: cga.blue,
      stroke: cga.lightGray,
      strokeWidth: 1.5,
      dash: '1.5 3',
      text: cga.lightGray,
    },
    default: {
      fill: cga.blue,
      stroke: cga.lightGray,
      strokeWidth: 1.5,
      dash: null,
      text: cga.white,
    },
    compare: {
      fill: cga.cyan,
      stroke: cga.white,
      strokeWidth: 3,
      dash: null,
      text: cga.black,
    },
    swap: {
      fill: cga.red,
      stroke: cga.yellow,
      strokeWidth: 3,
      dash: '5 3',
      text: cga.white,
    },
    highlight: {
      fill: cga.lightBlue,
      stroke: cga.lightCyan,
      strokeWidth: 1.5,
      dash: null,
      text: cga.white,
    },
    settled: {
      fill: cga.green,
      stroke: cga.green,
      strokeWidth: 1.5,
      dash: null,
      text: cga.black,
    },
  },
  settledMark: cga.black,
  groups: [
    { fill: cga.cyan, stroke: cga.lightCyan, text: cga.black },
    { fill: cga.magenta, stroke: cga.lightMagenta, text: cga.white },
    { fill: cga.brown, stroke: cga.yellow, text: cga.white },
    { fill: cga.green, stroke: cga.lightGreen, text: cga.black },
    { fill: cga.lightGray, stroke: cga.white, text: cga.black },
    { fill: cga.lightBlue, stroke: cga.lightCyan, text: cga.white },
  ],
  rb: {
    red: { fill: cga.red, stroke: cga.lightRed, text: cga.white },
    black: { fill: cga.black, stroke: cga.lightGray, text: cga.white },
  },
  edge: {
    default: { stroke: cga.lightGray, width: 1.5, opacity: 1 },
    link: { stroke: cga.lightGray, width: 1.5, opacity: 1 },
    highlight: { stroke: cga.yellow, width: 3, opacity: 1 },
    selected: { stroke: cga.lightGreen, width: 3.5, opacity: 1 },
    rejected: { stroke: cga.lightBlue, width: 1.25, opacity: 1 },
  },
  labelHalo: cga.blue,
};
