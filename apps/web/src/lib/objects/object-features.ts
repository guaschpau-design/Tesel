// Map objects as GeoJSON for the map layers: markers, the shapes drawn and the strips of sweeps.

import type { GroupState } from '@tesel/core';
import type { LatLon, ShapeEvent } from '@tesel/protocol';
import type { Feature, FeatureCollection, Geometry, LineString, Point } from 'geojson';

import { circleRing, toPosition } from '../map/geometry.ts';
import { shownText } from '../text.ts';
import type { Tone } from '../ui/theme.ts';
import { styleInfo, symbolImageName } from './catalog.ts';
import { stripOf, stripPath, stripWalker, walkerTone } from './sweeps.ts';

interface ObjectProperties {
  /** Object reference key (protocol §3.10), used to select the object. */
  readonly key: string;
  readonly label: string;
}

export interface MarkerProperties extends ObjectProperties {
  readonly icon: string;
}

export interface ShapeProperties extends ObjectProperties {
  /** Family of colour, which the layer turns into the colour app.css gives it. */
  readonly tone: Tone;
}

export function markerFeatures(
  state: Pick<GroupState, 'objects'>,
): FeatureCollection<Point, MarkerProperties> {
  const features: Feature<Point, MarkerProperties>[] = [];
  for (const [key, record] of state.objects) {
    if (record.type !== 'marker') continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: toPosition(record) },
      properties: { key, label: shownText(record.label), icon: symbolImageName(record.symbol) },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function shapeFeatures(
  state: Pick<GroupState, 'objects'>,
): FeatureCollection<Geometry, ShapeProperties> {
  const features: Feature<Geometry, ShapeProperties>[] = [];
  for (const [key, record] of state.objects) {
    if (record.type !== 'shape') continue;
    features.push({
      type: 'Feature',
      geometry: shapeGeometry(record),
      properties: { key, label: shownText(record.label), tone: styleInfo(record.style).tone },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** The way through each strip of a sweep, in its team's colour, with its number. */
export function stripFeatures(
  state: Pick<GroupState, 'objects' | 'tasks' | 'teams'>,
): FeatureCollection<LineString, ShapeProperties> {
  const features: Feature<LineString, ShapeProperties>[] = [];
  for (const [key, record] of state.objects) {
    if (record.type !== 'sweep') continue;
    const strip = stripOf(record, state.objects);
    if (strip === null) continue;
    const tone = walkerTone(state.teams, stripWalker(state.tasks, key), record.strip);
    features.push(stripFeature(key, record.strip, tone, stripPath(strip)));
  }
  return { type: 'FeatureCollection', features };
}

/** One strip's way, drawn alike on the map and while a sweep is planned. */
export function stripFeature(
  key: string,
  strip: number,
  tone: Tone,
  path: readonly LatLon[],
): Feature<LineString, ShapeProperties> {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: path.map(toPosition) },
    properties: {
      key,
      label: String(strip + 1),
      tone,
    },
  };
}

function shapeGeometry(shape: ShapeEvent): Geometry {
  const { geometry } = shape;
  switch (geometry.kind) {
    case 'polyline':
      return { type: 'LineString', coordinates: geometry.points.map(toPosition) };
    case 'polygon': {
      const ring = geometry.points.map(toPosition);
      const first = ring[0];
      return { type: 'Polygon', coordinates: [first ? [...ring, first] : ring] };
    }
    case 'circle':
      return { type: 'Polygon', coordinates: [circleRing(geometry.center, geometry.radius)] };
  }
}
