// MapLibre styles for each base map, light or dark: the Protomaps OpenStreetMap map as a street
// map (streets.ts) or as a topographic map, with contour lines and names of the terrain (topo.ts);
// or the national orthophotos (tiles/ortho.ts) with our labels over them. All served through our tile protocol
// (tiles/protocol.ts), so downloaded areas work offline whichever is shown.

import { layers, namedFlavor, type Flavor } from '@protomaps/basemaps';
import type {
  HillshadeLayerSpecification,
  LayerSpecification,
  SkySpecification,
  SourceSpecification,
  StyleSpecification,
} from 'maplibre-gl';

import { themeColor, type MapTheme } from '../../ui/theme.ts';
import { CONTOURS_MAX_ZOOM, CONTOURS_MIN_ZOOM, contourTileUrl } from './contours.ts';
import { streetFlavor } from './streets.ts';
import { tileUrlTemplate } from '../tiles/protocol.ts';
import {
  NAMES_ATTRIBUTION,
  BASEMAP_MAX_ZOOM,
  ORTHO_ATTRIBUTION,
  ORTHO_MAX_ZOOM,
  TERRAIN_ATTRIBUTION,
  TERRAIN_MAX_ZOOM,
  TERRAIN_TILE_SIZE,
} from '../tiles/sources.ts';
import {
  CONTOURS_SOURCE,
  contourLayers,
  NAMES_SOURCE,
  terrainNameLayers,
  topoFlavor,
} from './topo.ts';

export const BASE_MAPS = ['streets', 'topo', 'aerial'] as const;
export type BaseMap = (typeof BASE_MAPS)[number];

/** The style's name for the vector base map, in the Protomaps schema. Every style has it. */
export const BASEMAP_SOURCE = 'protomaps';

const OSM_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a> · ' +
  '<a href="https://protomaps.com" target="_blank">Protomaps</a>';

const ORTHO_SOURCE = 'ortho';
const RELIEF_SOURCE = 'terrain';
/**
 * The same elevation tiles again for the ground raised in 3D, as MapLibre advises. How high it is
 * raised goes with the zoom (map/ground.svelte.ts), so the style leaves it to the map.
 */
const GROUND_SOURCE = 'terrain-3d';

export interface StyleChoice {
  readonly base: BaseMap;
  /** Shading of the terrain, over the base map's ground and under its lines and names. */
  readonly relief: boolean;
  /** The ground raised in 3D (ADR-0102). */
  readonly threeD: boolean;
  readonly theme: MapTheme;
  readonly lang: string;
}

/** A base map in three bands, so that the relief shading can go between the first two. */
interface BaseMapLayers {
  readonly sources: Readonly<Record<string, SourceSpecification>>;
  /** What the relief shades: land, water, roads. */
  readonly ground: LayerSpecification[];
  /** Lines drawn over the shading. */
  readonly lines: LayerSpecification[];
  readonly names: LayerSpecification[];
}

export function buildStyle(choice: StyleChoice, assetsUrl: string): StyleSpecification {
  const { sources, ground, lines, names } = baseMapLayers(choice);
  // The ground raised in 3D is shaded too, whether or not the relief layer is on: without
  // shadows, raised ground reads as flat (ADR-0106).
  const relief = choice.relief || choice.threeD ? reliefShading(choice) : null;
  // Labels over photographs read best light on dark, whatever the app's theme.
  const sprite = choice.base === 'aerial' ? 'dark' : choice.theme;
  return {
    version: 8,
    glyphs: `${assetsUrl}fonts/{fontstack}/{range}.pbf`,
    sprite: `${assetsUrl}sprites/${sprite}`,
    sources: {
      ...sources,
      ...(relief ? { [RELIEF_SOURCE]: relief.source } : {}),
      ...(choice.threeD ? { [GROUND_SOURCE]: elevationSource() } : {}),
    },
    layers: [...ground, ...(relief ? [relief.layer] : []), ...lines, ...names],
    ...(choice.threeD ? { terrain: { source: GROUND_SOURCE }, sky: groundSky() } : {}),
  };
}

/** The elevation tiles (tiles/sources.ts), as MapLibre reads them. */
function elevationSource(): SourceSpecification {
  return {
    type: 'raster-dem',
    tiles: [tileUrlTemplate('terrain')],
    encoding: 'terrarium',
    tileSize: TERRAIN_TILE_SIZE,
    maxzoom: TERRAIN_MAX_ZOOM,
    attribution: TERRAIN_ATTRIBUTION,
  };
}

function baseMapLayers({ base, theme, lang }: StyleChoice): BaseMapLayers {
  // Every style has the vector base map, which the services read (services/ServicesLayer.svelte).
  const basemap: SourceSpecification = {
    type: 'vector',
    tiles: [tileUrlTemplate('basemap')],
    maxzoom: BASEMAP_MAX_ZOOM,
    attribution: OSM_ATTRIBUTION,
  };
  if (base === 'streets') {
    return {
      sources: { [BASEMAP_SOURCE]: basemap },
      ...protomapsLayers(streetFlavor(theme), lang),
    };
  }
  if (base === 'topo') {
    const contours: SourceSpecification = {
      type: 'vector',
      tiles: [contourTileUrl()],
      minzoom: CONTOURS_MIN_ZOOM,
      maxzoom: CONTOURS_MAX_ZOOM,
      attribution: TERRAIN_ATTRIBUTION,
    };
    const terrainNames: SourceSpecification = {
      type: 'vector',
      tiles: [tileUrlTemplate('ign-names')],
      maxzoom: BASEMAP_MAX_ZOOM,
      attribution: NAMES_ATTRIBUTION,
    };
    const { ground, names } = protomapsLayers(topoFlavor(theme), lang);
    return {
      sources: {
        [BASEMAP_SOURCE]: basemap,
        [CONTOURS_SOURCE]: contours,
        [NAMES_SOURCE]: terrainNames,
      },
      ground,
      lines: contourLayers(),
      names: [...terrainNameLayers(), ...names],
    };
  }
  const ortho: SourceSpecification = {
    type: 'raster',
    tiles: [tileUrlTemplate('ortho')],
    tileSize: 256,
    maxzoom: ORTHO_MAX_ZOOM,
    attribution: ORTHO_ATTRIBUTION,
  };
  return {
    sources: { [ORTHO_SOURCE]: ortho, [BASEMAP_SOURCE]: basemap },
    ground: [{ id: ORTHO_SOURCE, type: 'raster', source: ORTHO_SOURCE }],
    lines: [],
    names: layers(BASEMAP_SOURCE, namedFlavor('dark'), { lang, labelsOnly: true }),
  };
}

/** The Protomaps map in a palette, split where its names begin. */
function protomapsLayers(flavor: Flavor, lang: string): Omit<BaseMapLayers, 'sources'> {
  const all = layers(BASEMAP_SOURCE, flavor, { lang });
  const firstName = all.findIndex((layer) => layer.type === 'symbol');
  const at = firstName === -1 ? all.length : firstName;
  return { ground: all.slice(0, at), lines: [], names: all.slice(at) };
}

/**
 * The sky over the raised ground, with a haze that thickens towards the horizon: the depth that
 * makes far ridges read as far.
 */
function groundSky(): SkySpecification {
  return {
    'sky-color': themeColor('map-sky'),
    'horizon-color': themeColor('map-horizon'),
    'fog-color': themeColor('map-horizon'),
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.75,
    'atmosphere-blend': 0,
  };
}

/**
 * Shading of the terrain from the elevation tiles (tiles/sources.ts). Over raised ground it is
 * deeper, and lit from the north-west of the land rather than of the screen, so shadows stay on
 * the slopes that cast them as the view turns.
 */
function reliefShading({ theme, threeD }: StyleChoice): {
  source: SourceSpecification;
  layer: HillshadeLayerSpecification;
} {
  return {
    source: elevationSource(),
    layer: {
      id: 'relief',
      type: 'hillshade',
      source: RELIEF_SOURCE,
      paint: {
        'hillshade-exaggeration': (theme === 'dark' ? 0.35 : 0.45) + (threeD ? 0.2 : 0),
        'hillshade-shadow-color': themeColor('map-relief'),
        'hillshade-illumination-anchor': threeD ? 'map' : 'viewport',
      },
    },
  };
}
