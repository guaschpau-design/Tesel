// What the topographic map draws of the ground as a walker reads it (ADR-0136), in the conventions
// of the OpenStreetMap map: tracks in brown dashes and footpaths in red dots, steps in short red
// bars, pedestrian streets as each map wants them (ADR-0138); streams in blue, dashed where they run
// dry; woods with small trees over their green; huts and shelters with their sign. All from the
// Protomaps base map (its "roads", "water", "landuse" and "pois" layers), so it is drawn offline
// wherever the map was downloaded. The tactical map draws its streams and woods with these layers
// too, in its own colours, and in Spain arrows the way streams flow (ADR-0140, ADR-0141).

import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';

import { themeColor } from '../../ui/theme.ts';

/** The images these layers draw with, made as the map asks for them (terrain-images.ts). */
export const TREES_IMAGE = 'topo-trees';
export const HUT_IMAGE = 'topo-hut';

const TRACK = '#8a5523';
const FOOTPATH = '#e0503c';
/** The topographic map's streams. */
export const TOPO_STREAM = '#4a9fd8';
/** The light edge that keeps a dashed way readable over woods and contour lines. */
const HALO = 'rgba(255, 255, 255, 0.6)';

const detail: ExpressionSpecification = ['get', 'kind_detail'];
const isTrack: ExpressionSpecification = ['==', detail, 'track'];
const isSteps: ExpressionSpecification = ['==', detail, 'steps'];
const isPedestrian: ExpressionSpecification = ['==', detail, 'pedestrian'];
/** Ways on foot, by horse or by bike outside the streets: not pavements nor pedestrian streets. */
const isFootpath: ExpressionSpecification = [
  'all',
  ['==', ['get', 'kind'], 'path'],
  ['!', ['in', detail, ['literal', ['track', 'steps', 'sidewalk', 'pedestrian', 'pier']]]],
];
/** Each way of the ground, out of tunnels and off bridges, which keep the base map's look. */
const onGround: ExpressionSpecification = [
  'all',
  ['!', ['has', 'is_tunnel']],
  ['!', ['has', 'is_bridge']],
];

const width = (at13: number, at16: number, at18: number): ExpressionSpecification => [
  'interpolate',
  ['linear'],
  ['zoom'],
  13,
  at13,
  16,
  at16,
  18,
  at18,
];

/** How pedestrian streets are drawn: as streets on the topographic map, apart on the urban one. */
export interface PedestrianLook {
  readonly line: string;
  readonly casing: string;
}

/**
 * The tracks, footpaths, steps and pedestrian streets, in place of the base map's one brown line
 * for them all (`other`, its "roads_other"), whose look stays for what is left of it: pavements and
 * the like.
 */
export function trailLayers(
  source: string,
  other: LayerSpecification,
  pedestrian: PedestrianLook,
): LayerSpecification[] {
  const common = { type: 'line', source, 'source-layer': 'roads', minzoom: 13 } as const;
  const trails: ExpressionSpecification = ['any', isTrack, isSteps, isFootpath, isPedestrian];
  return [
    {
      id: other.id,
      type: 'line',
      source,
      'source-layer': 'roads',
      filter: [
        'all',
        onGround,
        ['in', ['get', 'kind'], ['literal', ['other', 'path']]],
        ['!=', detail, 'pier'],
        ['!', trails],
      ],
      paint: other.type === 'line' ? (other.paint ?? {}) : {},
    },
    {
      ...common,
      id: 'pedestrian-casing',
      filter: ['all', onGround, isPedestrian],
      paint: { 'line-color': pedestrian.casing, 'line-width': width(2.5, 7.5, 16) },
    },
    {
      ...common,
      id: 'pedestrian',
      filter: ['all', onGround, isPedestrian],
      paint: { 'line-color': pedestrian.line, 'line-width': width(1.5, 6, 14) },
    },
    {
      ...common,
      id: 'trails-halo',
      filter: ['all', onGround, ['any', isTrack, isSteps, isFootpath]],
      paint: { 'line-color': HALO, 'line-width': width(2.5, 4, 7) },
    },
    {
      ...common,
      id: 'trails-track',
      filter: ['all', onGround, isTrack],
      paint: {
        'line-color': TRACK,
        'line-width': width(1, 1.8, 3),
        'line-dasharray': [3.5, 1.5],
      },
    },
    {
      ...common,
      id: 'trails-footpath',
      filter: ['all', onGround, isFootpath],
      paint: {
        'line-color': FOOTPATH,
        'line-width': width(1, 1.5, 2.5),
        'line-dasharray': [1, 1.5],
      },
    },
    {
      ...common,
      id: 'trails-steps',
      filter: ['all', onGround, isSteps],
      paint: {
        'line-color': FOOTPATH,
        'line-width': width(2.5, 4, 7),
        'line-dasharray': [0.35, 0.45],
      },
    },
  ];
}

/** Rivers and streams, in place of the base map's thin ones: dashed where they run dry. */
export function streamLayers(source: string, colour: string): LayerSpecification[] {
  const dry: ExpressionSpecification = ['==', ['get', 'intermittent'], true];
  const common = { type: 'line', source, 'source-layer': 'water' } as const;
  const river: ExpressionSpecification = ['==', ['get', 'kind'], 'river'];
  const stream: ExpressionSpecification = ['==', ['get', 'kind'], 'stream'];
  return [
    {
      ...common,
      id: 'streams-river',
      minzoom: 9,
      filter: ['all', river, ['!', dry]],
      paint: { 'line-color': colour, 'line-width': width(1.2, 2.5, 4) },
    },
    {
      ...common,
      id: 'streams-stream',
      minzoom: 12,
      filter: ['all', stream, ['!', dry]],
      paint: { 'line-color': colour, 'line-width': width(0.8, 1.6, 2.5) },
    },
    {
      ...common,
      id: 'streams-dry',
      minzoom: 12,
      filter: ['all', ['any', river, stream], dry],
      paint: {
        'line-color': colour,
        'line-width': width(0.8, 1.4, 2.2),
        'line-dasharray': [3, 2],
      },
    },
  ];
}

/**
 * Arrows the way rivers and streams flow, in Spain: IGN's map (its "hidrografia_lin" layer) draws
 * each watercourse downstream, which the OpenStreetMap map does not keep. From a valley's zoom.
 */
export function flowLayer(source: string, image: string): LayerSpecification {
  return {
    id: 'streams-flow',
    type: 'symbol',
    source,
    'source-layer': 'hidrografia_lin',
    minzoom: 14,
    filter: ['==', ['get', 'clase'], 'curso_natural'],
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 180,
      'icon-image': image,
      'icon-rotation-alignment': 'map',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.9, 17, 1.25],
      'icon-padding': 4,
    },
  };
}

/** A texture over the woods' green, close enough to read the ground by: small trees, or dots. */
export function woodsLayer(source: string, image: string): LayerSpecification {
  return {
    id: 'woods-trees',
    type: 'fill',
    source,
    'source-layer': 'landuse',
    minzoom: 13,
    filter: ['in', ['get', 'kind'], ['literal', ['forest', 'wood']]],
    paint: {
      'fill-pattern': image,
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 1],
    },
  };
}

/** Mountain huts and shelters: their sign, and their name beside it. */
export function hutLayer(source: string, lang: string): LayerSpecification {
  return {
    id: 'huts',
    type: 'symbol',
    source,
    'source-layer': 'pois',
    minzoom: 13,
    filter: ['in', ['get', 'kind'], ['literal', ['alpine_hut', 'shelter', 'wilderness_hut']]],
    layout: {
      'icon-image': HUT_IMAGE,
      'icon-size': 0.8,
      'text-field': ['coalesce', ['get', `name:${lang}`], ['get', 'name']],
      'text-font': ['Noto Sans Medium'],
      'text-size': 11,
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: {
      'text-color': TRACK,
      'text-halo-color': themeColor('map-halo'),
      'text-halo-width': 1.5,
    },
  };
}
