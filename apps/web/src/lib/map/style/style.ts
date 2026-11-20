// MapLibre styles for each base map (ADR-0120): the Protomaps OpenStreetMap map as a topographic
// map, with contour lines and names of the terrain (topo.ts); as an urban map, for a town's streets,
// house numbers and buildings (urban.ts, ADR-0137); the national orthophotos
// (tiles/ortho.ts) with our labels over them; or the same OpenStreetMap map as the tactical map, read
// as a military map in coyote, the sand of military kit (tactical.ts, ADR-0141, ADR-0144). Each
// base map has its own look, whatever the app's. All are
// served through our tile protocol (tiles/protocol.ts), so downloaded areas work offline whichever
// is shown.

import { layers, namedFlavor, type Flavor } from '@protomaps/basemaps';
import type {
  HillshadeLayerSpecification,
  LayerSpecification,
  SkySpecification,
  SourceSpecification,
  StyleSpecification,
} from 'maplibre-gl';

import { lookOfMap, themeColor, type MapTheme } from '../../ui/theme.ts';
import { CONTOURS_MAX_ZOOM, CONTOURS_MIN_ZOOM, contourTileUrl } from './contours.ts';
import { tileUrlTemplate } from '../tiles/protocol.ts';
import {
  NAMES_ATTRIBUTION,
  BASEMAP_MAX_ZOOM,
  IGN_MAX_ZOOM,
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
  TOPO_PEDESTRIAN,
} from './topo.ts';
import { TACTICAL_LOOK, tacticalFlavor, tacticalNames } from './tactical.ts';
import {
  flowLayer,
  hutLayer,
  streamLayers,
  TOPO_HUTS,
  TOPO_STREAM,
  TOPO_TRAILS,
  trailLayers,
  TREES_IMAGE,
  woodsLayer,
  type PedestrianLook,
  type TrailLook,
} from './trails.ts';
import {
  raisedBuildings,
  URBAN_HOUSE_NUMBER,
  URBAN_PEDESTRIAN,
  urbanFlavor,
  urbanLayers,
} from './urban.ts';
import { houseNumberLayer } from './house-numbers.ts';

export const BASE_MAPS = ['topo', 'urban', 'aerial', 'tactical'] as const;
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
  /** Decluttered, only the names of places (ADR-0151). */
  readonly declutter: boolean;
  readonly lang: string;
}

/**
 * The look of a base map, which what is drawn over it follows (ui/theme.ts): coyote for the
 * tactical map, light for the others; labels over photographs are drawn light on dark by the style
 * itself.
 */
function mapThemeOf(base: BaseMap): MapTheme {
  return base === 'tactical' ? 'coyote' : 'light';
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
  const theme = mapThemeOf(choice.base);
  // First, so that every colour read for the map from here on is this base map's.
  lookOfMap(theme);
  const { sources, ground, lines, names } = baseMapLayers(choice);
  // The ground raised in 3D is shaded too, whether or not the relief layer is on: without
  // shadows, raised ground reads as flat (ADR-0106). A town's map has no shading (ADR-0137); the
  // tactical map always has it, as a military map shows the ground's shape (ADR-0141).
  const shaded =
    (choice.relief || choice.threeD || choice.base === 'tactical') && choice.base !== 'urban';
  const relief = shaded ? reliefShading(theme, choice.threeD) : null;
  // Labels over photographs read best light on dark.
  const sprite = choice.base === 'aerial' ? 'dark' : 'light';
  return {
    version: 8,
    glyphs: `${assetsUrl}fonts/{fontstack}/{range}.pbf`,
    sprite: `${assetsUrl}sprites/${sprite}`,
    sources: {
      ...sources,
      ...(relief ? { [RELIEF_SOURCE]: relief.source } : {}),
      ...(choice.threeD ? { [GROUND_SOURCE]: elevationSource() } : {}),
    },
    layers: [
      ...ground,
      ...(relief ? [relief.layer] : []),
      ...lines,
      ...(choice.declutter ? names.filter(isPlaceName) : names),
    ],
    ...(choice.threeD ? { terrain: { source: GROUND_SOURCE }, sky: groundSky() } : {}),
  };
}

/** The names of towns, districts, regions and countries: what a decluttered map keeps (ADR-0151). */
function isPlaceName(layer: LayerSpecification): boolean {
  return layer.id.startsWith('places_');
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

function baseMapLayers({ base, lang, threeD }: StyleChoice): BaseMapLayers {
  // Every style has the vector base map, which the services read (services/ServicesLayer.svelte).
  const basemap: SourceSpecification = {
    type: 'vector',
    tiles: [tileUrlTemplate('basemap')],
    maxzoom: BASEMAP_MAX_ZOOM,
    attribution: OSM_ATTRIBUTION,
  };
  if (base === 'tactical') {
    const look = TACTICAL_LOOK;
    const { ground, names } = protomapsLayers(tacticalFlavor(), lang);
    return {
      sources: {
        [BASEMAP_SOURCE]: basemap,
        [CONTOURS_SOURCE]: contourSource(),
        [NAMES_SOURCE]: ignSource(),
      },
      // Woods dotted as cover, water and the ways off the streets as on the topographic map in
      // the tactical map's inks; buildings solid, as cover.
      ground: walkersGround(ground, {
        woods: look.images.woods,
        stream: look.stream,
        pedestrian: look.pedestrian,
        trails: look.trails,
      }).map(solidBuildings),
      lines: contourLayers(),
      // The arrows first among the names: any name has the place before them.
      names: [
        flowLayer(NAMES_SOURCE, look.images.flow),
        hutLayer(BASEMAP_SOURCE, lang, look.huts),
        // No points of interest of the base map: shops and museums are no use in an operation;
        // the public services that are, the app draws itself (services/, ADR-0153).
        ...tacticalNames([...terrainNameLayers(), ...names.filter((layer) => layer.id !== 'pois')]),
      ],
    };
  }
  if (base === 'urban') {
    const all = protomapsLayers(urbanFlavor(), lang);
    const { ground, names } = urbanLayers(BASEMAP_SOURCE, all.ground, all.names);
    // Footpaths and steps as on the topographic map: the ways on foot between streets.
    const walked = ground.flatMap((layer) =>
      layer.id === 'roads_other'
        ? trailLayers(BASEMAP_SOURCE, layer, URBAN_PEDESTRIAN, TOPO_TRAILS)
        : [layer],
    );
    return {
      sources: { [BASEMAP_SOURCE]: basemap, [NAMES_SOURCE]: ignSource() },
      ground: walked,
      lines: threeD ? [raisedBuildings(BASEMAP_SOURCE)] : [],
      names: [houseNumberLayer(NAMES_SOURCE, URBAN_HOUSE_NUMBER), ...names],
    };
  }
  if (base === 'topo') {
    const flavor = topoFlavor();
    const { ground, names } = protomapsLayers(flavor, lang);
    return {
      sources: {
        [BASEMAP_SOURCE]: basemap,
        [CONTOURS_SOURCE]: contourSource(),
        [NAMES_SOURCE]: ignSource(),
      },
      ground: walkersGround(ground, {
        woods: TREES_IMAGE,
        stream: TOPO_STREAM,
        pedestrian: TOPO_PEDESTRIAN,
        trails: TOPO_TRAILS,
      }),
      lines: contourLayers(),
      names: [...terrainNameLayers(), hutLayer(BASEMAP_SOURCE, lang, TOPO_HUTS), ...names],
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

/** The contour lines, worked out from the elevation tiles (contours.ts). */
function contourSource(): SourceSpecification {
  return {
    type: 'vector',
    tiles: [contourTileUrl()],
    minzoom: CONTOURS_MIN_ZOOM,
    maxzoom: CONTOURS_MAX_ZOOM,
    attribution: TERRAIN_ATTRIBUTION,
  };
}

/**
 * IGN's vector map of Spain: the names of the terrain, the way streams flow and the official house
 * numbers, read a zoom deeper than the OpenStreetMap map (ADR-0139, ADR-0140).
 */
function ignSource(): SourceSpecification {
  return {
    type: 'vector',
    tiles: [tileUrlTemplate('ign-names')],
    maxzoom: IGN_MAX_ZOOM,
    attribution: NAMES_ATTRIBUTION,
  };
}

/** The base map's buildings at full strength, rather than its half: on the tactical map, cover. */
function solidBuildings(layer: LayerSpecification): LayerSpecification {
  return layer.id === 'buildings' && layer.type === 'fill'
    ? { ...layer, paint: { ...layer.paint, 'fill-opacity': 1 } }
    : layer;
}

/** How a map draws the ground off the streets (trails.ts): its inks for each thing. */
interface WalkersLook {
  /** The image over the woods. */
  readonly woods: string;
  readonly stream: string;
  readonly pedestrian: PedestrianLook;
  readonly trails: TrailLook;
}

/**
 * The ground as a walker reads it (trails.ts, ADR-0136), on the topographic and tactical maps:
 * a pattern over the woods, streams and tracks and footpaths each in their own look, in place of
 * the base map's.
 */
function walkersGround(
  ground: readonly LayerSpecification[],
  look: WalkersLook,
): LayerSpecification[] {
  return ground.flatMap((layer) => {
    if (layer.id === 'landuse_park') return [layer, woodsLayer(BASEMAP_SOURCE, look.woods)];
    if (layer.id === 'water_river') return streamLayers(BASEMAP_SOURCE, look.stream);
    if (layer.id === 'water_stream') return [];
    if (layer.id === 'roads_other') {
      return trailLayers(BASEMAP_SOURCE, layer, look.pedestrian, look.trails);
    }
    return [layer];
  });
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

/** How deep the relief is shaded on each look: less on sand than on the light map. */
const RELIEF_STRENGTH: Readonly<Record<MapTheme, number>> = { light: 0.45, coyote: 0.35 };

/**
 * Shading of the terrain from the elevation tiles (tiles/sources.ts). Over raised ground it is
 * deeper, and lit from the north-west of the land rather than of the screen, so shadows stay on
 * the slopes that cast them as the view turns.
 */
function reliefShading(
  theme: MapTheme,
  threeD: boolean,
): {
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
        'hillshade-exaggeration': RELIEF_STRENGTH[theme] + (threeD ? 0.2 : 0),
        'hillshade-shadow-color': themeColor('map-relief'),
        'hillshade-highlight-color': themeColor('map-relief-light'),
        'hillshade-illumination-anchor': threeD ? 'map' : 'viewport',
      },
    },
  };
}
