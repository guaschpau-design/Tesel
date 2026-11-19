// APP-6's movement indicator on the tactical map (ADR-0150): a line out of a member's symbol, or
// this device's, the way it moves, ending in an arrowhead where it will be in a minute at its
// speed, so that who walks and who drives tell apart at a glance. Shorter than that, it would hide
// under the symbol: it reaches at least a little past it. Without a speed, as from the compass of a
// device standing still, it only points.

import { offsetMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { FilterSpecification, LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';

import { metresPerPixel } from '../map/geometry.ts';

/** The tip is where it will be this many seconds from now. */
export const SECONDS_AHEAD = 60;
/** The least length on screen, in CSS pixels: past the symbol, whose frames are 24 high. */
export const LEAST_PX = 40;

const ARROWHEAD_IMAGE = 'tesel-app6-arrowhead';
const PIXEL_RATIO = 2;

/** Something moving: where it is, the way it moves (degrees from north) and how fast (m/s). */
export interface Movement {
  readonly at: LatLon;
  readonly heading: number;
  readonly speed: number | null;
}

/** The lines and their arrowheads at a zoom: each line's tip is a point with the heading. */
export function movementFeatures(
  movements: readonly Movement[],
  zoom: number,
): FeatureCollection<LineString | Point, { heading: number }> {
  const features: Feature<LineString | Point, { heading: number }>[] = [];
  for (const { at, heading, speed } of movements) {
    const metres = Math.max((speed ?? 0) * SECONDS_AHEAD, LEAST_PX * metresPerPixel(zoom, at.lat));
    const angle = (heading * Math.PI) / 180;
    const tip = offsetMeters(at, metres * Math.cos(angle), metres * Math.sin(angle));
    const properties = { heading };
    features.push(
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [at.lon, at.lat],
            [tip.lon, tip.lat],
          ],
        },
        properties,
      },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [tip.lon, tip.lat] }, properties },
    );
  }
  return { type: 'FeatureCollection', features };
}

/** Black lines on a white edge, as the frames are drawn, for the symbol over their start. */
export function movementLayers(source: string): LayerSpecification[] {
  const line: FilterSpecification = ['==', ['geometry-type'], 'LineString'];
  return [
    {
      id: `${source}-edge`,
      type: 'line',
      source,
      filter: line,
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 5 },
    },
    {
      id: `${source}-line`,
      type: 'line',
      source,
      filter: line,
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': '#000000', 'line-width': 2.5 },
    },
    {
      id: `${source}-head`,
      type: 'symbol',
      source,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'icon-image': ARROWHEAD_IMAGE,
        'icon-anchor': 'top',
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    },
  ];
}

/** The arrowhead, its point at the top of the image, which is where the line ends. */
export function addArrowheadImage(map: MapLibreMap): void {
  if (map.hasImage(ARROWHEAD_IMAGE)) return;
  const width = 18;
  const height = 12;
  const canvas = document.createElement('canvas');
  canvas.width = width * PIXEL_RATIO;
  canvas.height = height * PIXEL_RATIO;
  const c = canvas.getContext('2d');
  if (c === null) return;
  c.scale(PIXEL_RATIO, PIXEL_RATIO);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const middle = width / 2;
  for (const [colour, lineWidth] of [
    ['#ffffff', 5],
    ['#000000', 2.5],
  ] as const) {
    c.strokeStyle = colour;
    c.lineWidth = lineWidth;
    c.beginPath();
    c.moveTo(middle - 6, 9);
    c.lineTo(middle, 3);
    c.lineTo(middle + 6, 9);
    c.stroke();
  }
  map.addImage(ARROWHEAD_IMAGE, c.getImageData(0, 0, canvas.width, canvas.height), {
    pixelRatio: PIXEL_RATIO,
  });
}
