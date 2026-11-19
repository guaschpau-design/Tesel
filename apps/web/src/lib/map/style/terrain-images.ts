// The images the topographic and tactical maps' own layers draw with (trails.ts, ADR-0136,
// ADR-0141): the small trees over woods, the sign of huts and shelters, in the app's own pictograms;
// on the tactical map, a texture of dots over woods and the arrow of a stream's flow. Added together
// as each style loads, before its tiles are laid out: an image added while tiles are being laid out
// leaves some of them without it.

import type { Map as MapLibreMap } from 'maplibre-gl';

import { GLYPHS } from '../../ui/glyphs.ts';
import { addGlyphImage } from './glyph-images.ts';
import { TACTICAL_LOOK } from './tactical.ts';
import { HUT_IMAGE, TREES_IMAGE } from './trails.ts';

const PIXEL_RATIO = 2;
/** The trees repeat every so many points: two to a tile, staggered. */
const TREES_TILE = 44;
const TREE = 'M0 -6 L5 4 L-5 4 Z M0 4 V7';
const TREE_COLOUR = 'rgba(86, 128, 70, 0.5)';
const HUT_COLOUR = '#8a5523';
/** The arrow of a stream's flow: a chevron pointing along the line. */
const FLOW_SIZE = 14;
const FLOW = 'M4.5 2.5 L10 7 L4.5 11.5';
/** The woods' dots repeat every so many points, staggered. */
const DOTS_TILE = 12;

/** Adds the topographic and tactical maps' images to the map's style, those it does not have yet. */
export function addTerrainImages(map: MapLibreMap): void {
  addGlyphImage(map, HUT_IMAGE, { glyph: GLYPHS.house, colour: HUT_COLOUR, shape: 'square' });
  if (!map.hasImage(TREES_IMAGE)) addTrees(map);
  const { images, inks } = TACTICAL_LOOK;
  if (!map.hasImage(images.woods)) addDots(map, images.woods, inks.woods);
  if (!map.hasImage(images.flow)) addFlow(map, images.flow, inks.flow, inks.edge);
}

/** Draws an image on a canvas of this many points a side and adds it to the map's style. */
function addDrawn(
  map: MapLibreMap,
  name: string,
  size: number,
  draw: (context: CanvasRenderingContext2D) => void,
): void {
  const canvas = document.createElement('canvas');
  canvas.width = size * PIXEL_RATIO;
  canvas.height = size * PIXEL_RATIO;
  const context = canvas.getContext('2d');
  if (context === null) return;
  context.scale(PIXEL_RATIO, PIXEL_RATIO);
  draw(context);
  map.addImage(name, context.getImageData(0, 0, canvas.width, canvas.height), {
    pixelRatio: PIXEL_RATIO,
  });
}

function addFlow(map: MapLibreMap, name: string, colour: string, edge: string): void {
  addDrawn(map, name, FLOW_SIZE, (context) => {
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const arrow = new Path2D(FLOW);
    // An edge first, so the arrow holds over the stream's own line and over woods.
    for (const [ink, width] of [
      [edge, 4],
      [colour, 2],
    ] as const) {
      context.strokeStyle = ink;
      context.lineWidth = width;
      context.stroke(arrow);
    }
  });
}

function addDots(map: MapLibreMap, name: string, colour: string): void {
  addDrawn(map, name, DOTS_TILE, (context) => {
    context.fillStyle = colour;
    for (const [x, y] of [
      [3, 3],
      [9, 9],
    ] as const) {
      context.beginPath();
      context.arc(x, y, 1.1, 0, 2 * Math.PI);
      context.fill();
    }
  });
}

function addTrees(map: MapLibreMap): void {
  addDrawn(map, TREES_IMAGE, TREES_TILE, (context) => {
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
  });
}
