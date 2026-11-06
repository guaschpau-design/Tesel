// The drawings of a debrief (ADR-0118): the map of the operation, drawn to scale with no base map
// (each person's way in their colour, where they ended, the calls for help, markers, zones and
// task places, with a grid, a scale bar and north), and the bars of how busy each stretch was.

import type { LatLon } from '@tesel/protocol';

import { formatDistance } from '../format.ts';
import type { Locale, Translate } from '../i18n/index.ts';
import type { Point, Rgb } from '../pdf/pdf-document.ts';
import { textWidth } from '../pdf/pdf-text.ts';
import type { Debrief } from './debrief-data.ts';
import { INK, LEFT, LIME_DEEP, MUTED, RED, RULE, Sheet, TINT, WIDTH } from './debrief-sheet.ts';

/** A colour for each person's way, dark enough to print, none of them the red of an SOS. */
const WAYS: readonly Rgb[] = [
  [0.13, 0.42, 0.75],
  [0.88, 0.45, 0.07],
  [0.52, 0.27, 0.69],
  [0.05, 0.56, 0.52],
  [0.8, 0.2, 0.5],
  [0.42, 0.52, 0.1],
  [0.33, 0.36, 0.42],
  [0.62, 0.42, 0.18],
];

export function wayColor(index: number): Rgb {
  return WAYS.at(index % WAYS.length) ?? INK;
}

const WHITE: Rgb = [1, 1, 1];
const MAP_HEIGHT = 290;
/** The least a map spans, in metres, so one point alone is not a map of a pavement. */
const LEAST_SPAN = 400;
const STEPS = [25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10_000, 20_000, 50_000, 100_000];
const METRES_PER_DEGREE = 111_320;

/** Draws the map at the cursor; returns false, drawing nothing, when nothing has a place. */
export function drawMap(sheet: Sheet, debrief: Debrief, t: Translate, locale: Locale): boolean {
  const main = [
    ...debrief.people.flatMap((person) => person.track),
    ...debrief.calls.map((call) => call.at),
    ...debrief.taskPlaces,
  ];
  const extent = main.length > 0 ? main : debrief.markers.map((marker) => marker.at);
  if (extent.length === 0) return false;

  const lat0 = extent.reduce((sum, point) => sum + point.lat, 0) / extent.length;
  const cos = Math.cos((lat0 * Math.PI) / 180);
  const metres = ({ lat, lon }: LatLon): Point => [
    lon * METRES_PER_DEGREE * cos,
    -lat * METRES_PER_DEGREE,
  ];
  const xs = extent.map((point) => metres(point)[0]);
  const ys = extent.map((point) => metres(point)[1]);
  const span = Math.max(
    LEAST_SPAN,
    (Math.max(...xs) - Math.min(...xs)) * 1.2,
    (Math.max(...ys) - Math.min(...ys)) * 1.2 * (WIDTH / MAP_HEIGHT),
  );
  const scale = WIDTH / span;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const top = sheet.y;
  const project = (point: LatLon): Point => {
    const [x, y] = metres(point);
    return [LEFT + WIDTH / 2 + (x - cx) * scale, top + MAP_HEIGHT / 2 + (y - cy) * scale];
  };
  const doc = sheet.doc;

  doc.rect(LEFT, top, WIDTH, MAP_HEIGHT, { fill: TINT });
  const step = STEPS.find((each) => each * scale >= 70) ?? STEPS.at(-1) ?? 1000;
  doc.clipped(LEFT, top, WIDTH, MAP_HEIGHT, () => {
    // A grid of `step` metres, so distances can be read anywhere on the map.
    const grid = { stroke: [0.88, 0.89, 0.87] as Rgb, width: 0.4 };
    const x0 = cx - WIDTH / 2 / scale;
    const y0 = cy - MAP_HEIGHT / 2 / scale;
    for (let x = Math.ceil(x0 / step) * step; x < x0 + WIDTH / scale; x += step) {
      const at = LEFT + (x - x0) * scale;
      doc.line(
        [
          [at, top],
          [at, top + MAP_HEIGHT],
        ],
        grid,
      );
    }
    for (let y = Math.ceil(y0 / step) * step; y < y0 + MAP_HEIGHT / scale; y += step) {
      const at = top + (y - y0) * scale;
      doc.line(
        [
          [LEFT, at],
          [LEFT + WIDTH, at],
        ],
        grid,
      );
    }

    for (const zone of debrief.zones) {
      const paint = { stroke: MUTED, width: 0.8, dash: [3, 2] };
      const geometry = zone.geometry;
      if (geometry.kind === 'circle') {
        const [x, y] = project(geometry.center);
        doc.circle(x, y, geometry.radius * scale, { ...paint, fill: [0.93, 0.94, 0.92] });
      } else if (geometry.kind === 'polygon') {
        doc.polygon(geometry.points.map(project), { ...paint, fill: [0.93, 0.94, 0.92] });
      } else {
        doc.line(geometry.points.map(project), paint);
      }
    }
    for (const marker of debrief.markers) {
      const [x, y] = project(marker.at);
      doc.polygon(
        [
          [x, y - 3.5],
          [x + 3.5, y],
          [x, y + 3.5],
          [x - 3.5, y],
        ],
        { fill: INK },
      );
      if (marker.label !== '')
        label(sheet, x + 6, y + 2.5, marker.label, { size: 6.5, color: INK });
    }
    for (const place of debrief.taskPlaces) {
      const [x, y] = project(place);
      doc.rect(x - 3, y - 3, 6, 6, { fill: WHITE, stroke: LIME_DEEP, width: 1.2 });
    }
    debrief.people.forEach((person, index) => {
      const color = wayColor(index);
      const points = person.track.map(project);
      const first = points.at(0);
      const last = points.at(-1);
      if (first === undefined || last === undefined) return;
      if (points.length > 1) doc.line(points, { stroke: color, width: 1.8 });
      doc.circle(first[0], first[1], 2.4, { fill: WHITE, stroke: color, width: 1.2 });
      doc.circle(last[0], last[1], 3.4, { fill: color, stroke: WHITE, width: 1 });
      label(sheet, last[0] + 6, last[1] + 3, person.name, { size: 7, color, bold: true });
    });
    for (const call of debrief.calls) {
      const [x, y] = project(call.at);
      doc.circle(x, y, 6, { fill: RED, stroke: WHITE, width: 1.2 });
      doc.text(x, y + 2, '!', { size: 8, bold: true, color: WHITE, align: 'middle' });
      label(sheet, x + 9, y + 3, `SOS · ${call.name}`, { size: 7, color: RED, bold: true });
    }
  });
  doc.rect(LEFT, top, WIDTH, MAP_HEIGHT, { stroke: RULE, width: 0.8 });

  // North, top right; the scale, bottom left.
  const nx = LEFT + WIDTH - 20;
  doc.polygon(
    [
      [nx, top + 12],
      [nx + 5, top + 26],
      [nx, top + 23],
      [nx - 5, top + 26],
    ],
    { fill: INK },
  );
  doc.text(nx, top + 36, 'N', { size: 7, bold: true, color: INK, align: 'middle' });
  const bar = step * scale;
  const by = top + MAP_HEIGHT - 14;
  doc.rect(LEFT + 8, by - 10, bar + 16, 18, { fill: WHITE }, 3);
  doc.rect(LEFT + 16, by, bar / 2, 3, { fill: INK });
  doc.rect(LEFT + 16 + bar / 2, by, bar / 2, 3, { fill: WHITE, stroke: INK, width: 0.6 });
  doc.text(LEFT + 16, by - 3, '0', { size: 6, color: MUTED });
  doc.text(LEFT + 16 + bar, by - 3, formatDistance(step, locale), {
    size: 6,
    color: MUTED,
    align: 'end',
  });
  sheet.y = top + MAP_HEIGHT + 8;
  sheet.y += sheet.paragraph(
    LEFT,
    t('debriefMapNote', { step: formatDistance(step, locale) }),
    WIDTH,
    { size: 7, color: MUTED },
    9,
  );
  sheet.y += 8;
  return true;
}

/** A label on the map, on a white ground so it reads over the lines. */
function label(
  sheet: Sheet,
  x: number,
  y: number,
  text: string,
  style: { size: number; color: Rgb; bold?: boolean },
): void {
  const width = textWidth(text, style.size, style.bold);
  sheet.doc.rect(x - 2, y - style.size, width + 4, style.size + 3, { fill: WHITE }, 2);
  sheet.doc.text(x, y, text, style);
}

/** Bars of how many diary lines each stretch of the period holds, with the calls for help. */
export function drawActivity(sheet: Sheet, debrief: Debrief, t: Translate, locale: Locale): void {
  const { from, until } = debrief.period;
  const minutes = [5, 10, 15, 30, 60, 120, 180, 360, 720, 1440];
  const bucket = (minutes.find((each) => (until - from) / (each * 60_000) <= 36) ?? 1440) * 60_000;
  const count = Math.max(1, Math.ceil((until - from) / bucket));
  const bars = Array.from({ length: count }, () => 0);
  const calls = new Set<number>();
  const slot = (time: number) =>
    Math.min(count - 1, Math.max(0, Math.floor((time - from) / bucket)));
  for (const line of debrief.lines)
    bars[slot(line.time * 1000)] = (bars.at(slot(line.time * 1000)) ?? 0) + 1;
  for (const call of debrief.calls) calls.add(slot(call.time));
  const highest = Math.max(1, ...bars);

  const doc = sheet.doc;
  const height = 70;
  const top = sheet.y + 6;
  const base = top + height;
  const width = WIDTH / count;
  doc.line(
    [
      [LEFT, base],
      [LEFT + WIDTH, base],
    ],
    { stroke: RULE, width: 0.8 },
  );
  doc.text(LEFT - 4, top + 6, String(highest), { size: 6.5, color: MUTED, align: 'end' });
  bars.forEach((value, index) => {
    const x = LEFT + index * width;
    const tall = (value / highest) * height;
    if (value > 0)
      doc.rect(
        x + width * 0.12,
        base - tall,
        width * 0.76,
        tall,
        { fill: calls.has(index) ? RED : INK },
        1.5,
      );
  });
  const time = (at: number) => new Date(at).toLocaleTimeString(locale, { timeStyle: 'short' });
  doc.text(LEFT, base + 11, time(from), SMALL_LABEL);
  doc.text(LEFT + WIDTH, base + 11, time(until), { ...SMALL_LABEL, align: 'end' });
  doc.text(LEFT + WIDTH / 2, base + 11, t('debriefActivityEach', { minutes: bucket / 60_000 }), {
    ...SMALL_LABEL,
    align: 'middle',
  });
  sheet.y = base + 26;
}

const SMALL_LABEL = { size: 6.5, color: MUTED };
