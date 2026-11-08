/**
 * 答题卡, the answer sheet (ADR 0030): the machine-read answer sheet of
 * Chinese exams. The form is printed in a drop-out red the scanner cannot
 * see; everything the student adds is 2B pencil, and a settled cell is
 * filled in solid, like a marked bubble. Almost only red and graphite, so it
 * also prints well in black and white.
 */
import type { SvgTheme } from '../theme.ts';
import { answerSheetFamilies, answerSheetFonts } from './fonts.ts';

const paper = '#ffffff';
const ink = '#141414';
/** The printed form: frames, numbers and headings. */
const red = '#d7263d';
const frame = '#e65a6e';
/** 2B pencil. */
const graphite = '#2b2b2e';

export const answerSheetTheme: SvgTheme = {
  fonts: answerSheetFamilies,
  fontMetrics: answerSheetFonts,
  tex: { value: 'tt', label: 'sf' },
  radius: 0,
  background: null,
  shadow: null,
  title: red,
  index: red,
  pointer: { line: graphite, fill: graphite, text: paper },
  cell: {
    visited: {
      fill: paper,
      stroke: frame,
      strokeWidth: 1.25,
      dash: '1.5 2.5',
      text: '#666666',
    },
    default: {
      fill: paper,
      stroke: frame,
      strokeWidth: 1.25,
      dash: null,
      text: ink,
    },
    compare: {
      fill: paper,
      stroke: graphite,
      strokeWidth: 3,
      dash: null,
      text: ink,
    },
    swap: {
      fill: paper,
      stroke: graphite,
      strokeWidth: 3,
      dash: '5 3',
      text: ink,
    },
    highlight: {
      fill: '#fde4e8',
      stroke: red,
      strokeWidth: 1.5,
      dash: null,
      text: '#86101f',
    },
    settled: {
      fill: graphite,
      stroke: graphite,
      strokeWidth: 1.25,
      dash: null,
      text: paper,
    },
  },
  settledMark: paper,
  groups: [
    { fill: '#fde4e8', stroke: red, text: '#86101f' },
    { fill: '#ececec', stroke: '#6b6b6b', text: ink },
    { fill: '#f9c7cf', stroke: red, text: '#6b0b19' },
    { fill: '#d6d6d6', stroke: '#4a4a4a', text: ink },
    { fill: '#f19aa7', stroke: '#b51d33', text: '#3a0710' },
    { fill: '#a9a9a9', stroke: graphite, text: '#000000' },
  ],
  rb: {
    red: { fill: red, stroke: '#a3182c', text: paper },
    black: { fill: graphite, stroke: graphite, text: paper },
  },
  edge: {
    default: { stroke: '#4a4a4d', width: 1.5, opacity: 1 },
    link: { stroke: '#4a4a4d', width: 1.5, opacity: 1 },
    highlight: { stroke: red, width: 2.75, opacity: 1 },
    selected: { stroke: graphite, width: 4, opacity: 1 },
    rejected: { stroke: '#f2bcc4', width: 1.25, opacity: 1 },
  },
  labelHalo: paper,
};
