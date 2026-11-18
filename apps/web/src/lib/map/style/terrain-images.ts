// The images the topographic map's own layers draw with (trails.ts, ADR-0136): the small trees over
// woods, the sign of huts and shelters, in the app's own pictograms, and the arrow of a stream's flow
// (ADR-0140). Added together as each
// style loads, before its tiles are laid out: an image added while tiles are being laid out leaves
// some of them without it.

import type { Map as MapLibreMap } from 'maplibre-gl';

import { GLYPHS } from '../../ui/glyphs.ts';
import { addGlyphImage } from './glyph-images.ts';
import { FLOW_IMAGE, HUT_IMAGE, TREES_IMAGE } from './trails.ts';

const PIXEL_RATIO = 2;
/** The trees repeat every so many points: two to a tile, staggered. */
const TREES_TILE = 44;
const TREE = 'M0 -6 L5 4 L-5 4 Z M0 4 V7';
const TREE_COLOUR = 'rgba(86, 128, 70, 0.5)';
const HUT_COLOUR = '#8a5523';
/** The arrow of a stream's flow: a chevron pointing along the line, in the streams' blue. */
const FLOW_SIZE = 14;
const FLOW = 'M4.5 2.5 L10 7 L4.5 11.5';
const FLOW_COLOUR = '#2f7fbf';
const FLOW_EDGE = 'rgba(255, 255, 255, 0.85)';

/** Adds the topographic map's images to the map's style, those it does not have yet. */
export function addTerrainImages(map: MapLibreMap): void {
  addGlyphImage(map, HUT_IMAGE, { glyph: GLYPHS.house, colour: HUT_COLOUR, shape: 'square' });
  if (!map.hasImage(TREES_IMAGE)) addTrees(map);
  if (!map.hasImage(FLOW_IMAGE)) addFlow(map);
}

function addFlow(map: MapLibreMap): void {
  const canvas = document.createElement('canvas');
  canvas.width = FLOW_SIZE * PIXEL_RATIO;
  canvas.height = FLOW_SIZE * PIXEL_RATIO;
  const context = canvas.getContext('2d');
  if (context === null) return;
  context.scale(PIXEL_RATIO, PIXEL_RATIO);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  const arrow = new Path2D(FLOW);
  // A light edge first, so the arrow holds over the stream's own line and over woods.
  for (const [colour, width] of [
    [FLOW_EDGE, 4],
    [FLOW_COLOUR, 2],
  ] as const) {
    context.strokeStyle = colour;
    context.lineWidth = width;
    context.stroke(arrow);
  }
  map.addImage(FLOW_IMAGE, context.getImageData(0, 0, canvas.width, canvas.height), {
    pixelRatio: PIXEL_RATIO,
  });
}

function addTrees(map: MapLibreMap): void {
  const canvas = document.createElement('canvas');
  canvas.width = TREES_TILE * PIXEL_RATIO;
  canvas.height = TREES_TILE * PIXEL_RATIO;
  const context = canvas.getContext('2d');
  if (context === null) return;
  context.scale(PIXEL_RATIO, PIXEL_RATIO);
  context.strokeStyle = TREE_COLOUR;
  context.lineWidth = 1.2;
  context.lineJoin = 'round';
  const tree = new Path2D(TREE);
  for (const [x, y] of [
    [11, 12],
    [33, 34],
  ] as const) {
    context.save();
    context.translate(x, y);
    context.stroke(tree);
    context.restore();
  }
  map.addImage(TREES_IMAGE, context.getImageData(0, 0, canvas.width, canvas.height), {
    pixelRatio: PIXEL_RATIO,
  });
}
