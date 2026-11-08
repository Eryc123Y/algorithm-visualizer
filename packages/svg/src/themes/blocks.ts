/**
 * 积木教具, building blocks (ADR 0030): classroom manipulatives, chunky
 * blocks in Cuisenaire-rod colours with thick outlines and a hard block
 * shadow. A comparison is a yellow block, a swap red with a dashed edge, a
 * settled cell green. The night variant lays the same blocks on a dark felt
 * mat: outlines and shadows stay the darkest thing in the picture.
 */
import type { SvgTheme } from '../theme.ts';
import { blocksFamilies, blocksFonts } from './fonts.ts';

const navy = '#1e2a4a';

// Rod colours shared by both variants, dark enough to carry white text.
const yellow = '#ffd23f';
const red = '#db3328';
const green = '#178548';
const sky = '#bfe3ff';

export const blocksTheme: SvgTheme = {
  fonts: blocksFamilies,
  fontMetrics: blocksFonts,
  tex: { value: 'sf', label: 'sf' },
  radius: 10,
  background: null,
  shadow: navy,
  title: navy,
  index: '#6b7593',
  pointer: { line: navy, fill: navy, text: '#ffffff' },
  cell: {
    visited: {
      fill: '#f1f3f8',
      stroke: '#8a93ad',
      strokeWidth: 2,
      dash: '3 3',
      text: '#5a6480',
    },
    default: {
      fill: '#ffffff',
      stroke: navy,
      strokeWidth: 2,
      dash: null,
      text: navy,
    },
    compare: {
      fill: yellow,
      stroke: navy,
      strokeWidth: 3,
      dash: null,
      text: navy,
    },
    swap: {
      fill: red,
      stroke: navy,
      strokeWidth: 3,
      dash: '6 3',
      text: '#ffffff',
    },
    highlight: {
      fill: sky,
      stroke: navy,
      strokeWidth: 2,
      dash: null,
      text: navy,
    },
    settled: {
      fill: green,
      stroke: navy,
      strokeWidth: 2,
      dash: null,
      text: '#ffffff',
    },
  },
  settledMark: '#ffffff',
  groups: [
    { fill: '#2f6fde', stroke: navy, text: '#ffffff' },
    { fill: '#9bd770', stroke: navy, text: navy },
    { fill: '#8e5cc2', stroke: navy, text: '#ffffff' },
    { fill: '#f28c28', stroke: navy, text: navy },
    { fill: '#8b5a2b', stroke: navy, text: '#ffffff' },
    { fill: '#ff8fab', stroke: navy, text: navy },
  ],
  rb: {
    red: { fill: red, stroke: navy, text: '#ffffff' },
    black: { fill: navy, stroke: navy, text: '#ffffff' },
  },
  edge: {
    default: { stroke: navy, width: 2.5, opacity: 1 },
    link: { stroke: navy, width: 2, opacity: 1 },
    highlight: { stroke: '#f2a900', width: 4, opacity: 1 },
    selected: { stroke: green, width: 5, opacity: 1 },
    rejected: { stroke: '#c3c8d6', width: 2, opacity: 1 },
  },
  labelHalo: '#ffffff',
};

// Felt mat, outlines darker than the mat, light text.
const mat = '#1b2342';
const outline = '#080c1a';
const light = '#eef1fb';

export const blocksDarkTheme: SvgTheme = {
  fonts: blocksFamilies,
  fontMetrics: blocksFonts,
  tex: { value: 'sf', label: 'sf' },
  radius: 10,
  background: mat,
  shadow: '#04060d',
  title: light,
  index: '#9aa5c8',
  pointer: { line: light, fill: light, text: mat },
  cell: {
    visited: {
      fill: '#242d4f',
      stroke: '#7d88ad',
      strokeWidth: 2,
      dash: '3 3',
      text: '#b9c1db',
    },
    default: {
      fill: '#34406a',
      stroke: outline,
      strokeWidth: 2,
      dash: null,
      text: '#f4f6ff',
    },
    compare: {
      fill: yellow,
      stroke: outline,
      strokeWidth: 3,
      dash: null,
      text: navy,
    },
    swap: {
      fill: red,
      stroke: outline,
      strokeWidth: 3,
      dash: '6 3',
      text: '#ffffff',
    },
    highlight: {
      fill: sky,
      stroke: outline,
      strokeWidth: 2,
      dash: null,
      text: navy,
    },
    settled: {
      fill: green,
      stroke: outline,
      strokeWidth: 2,
      dash: null,
      text: '#ffffff',
    },
  },
  settledMark: '#ffffff',
  groups: [
    { fill: '#2f6fde', stroke: outline, text: '#ffffff' },
    { fill: '#9bd770', stroke: outline, text: navy },
    { fill: '#8e5cc2', stroke: outline, text: '#ffffff' },
    { fill: '#f28c28', stroke: outline, text: navy },
    { fill: '#8b5a2b', stroke: outline, text: '#ffffff' },
    { fill: '#ff8fab', stroke: outline, text: navy },
  ],
  rb: {
    red: { fill: red, stroke: outline, text: '#ffffff' },
    black: { fill: outline, stroke: '#7d88ad', text: '#ffffff' },
  },
  edge: {
    default: { stroke: '#9aa6cc', width: 2.5, opacity: 1 },
    link: { stroke: '#9aa6cc', width: 2, opacity: 1 },
    highlight: { stroke: yellow, width: 4, opacity: 1 },
    selected: { stroke: '#3fcf7f', width: 5, opacity: 1 },
    rejected: { stroke: '#3a4468', width: 2, opacity: 1 },
  },
  labelHalo: mat,
};
