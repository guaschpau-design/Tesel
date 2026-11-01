// Tesel's pictograms, drawn on a 24 × 24 grid: strokes two units wide with round ends, plus a few
// filled parts. The same paths draw the map's markers (on a canvas, with Path2D), the symbols in
// forms and the interface's own signs (as SVG), so they all look alike.

export interface Glyph {
  readonly strokes: readonly string[];
  readonly fills: readonly string[];
}

const glyph = (strokes: readonly string[], fills: readonly string[] = []): Glyph => ({
  strokes,
  fills,
});

export const GLYPHS = {
  point: glyph([], ['M12 8a4 4 0 1 1 0 8a4 4 0 1 1 0-8z']),
  injured: glyph([
    'M9 4.2a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2z',
    'M3.8 19.5v-1.2a5.2 5.2 0 0 1 10.4 0v1.2',
    'M18.5 7.5v6M15.5 10.5h6',
  ]),
  search: glyph(['M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13z', 'M15.3 15.3l5 5']),
  flame: glyph([
    'M12 3.2c.8 3.3 5.2 5.4 5.2 10.2a5.2 5.2 0 0 1-10.4 0c0-2.6 1.4-4.2 2.6-5.3.2 1.7 1 2.8 2.1 3.2.5-2.8-.5-5.4.5-8.1z',
  ]),
  waves: glyph([
    'M3 8c1.5 0 1.5-1.4 3-1.4S7.5 8 9 8s1.5-1.4 3-1.4S13.5 8 15 8s1.5-1.4 3-1.4S19.5 8 21 8',
    'M3 13c1.5 0 1.5-1.4 3-1.4S7.5 13 9 13s1.5-1.4 3-1.4S13.5 13 15 13s1.5-1.4 3-1.4S19.5 13 21 13',
    'M3 18c1.5 0 1.5-1.4 3-1.4S7.5 18 9 18s1.5-1.4 3-1.4S13.5 18 15 18s1.5-1.4 3-1.4S19.5 18 21 18',
  ]),
  warning: glyph(['M12 4.2L20.8 19.4H3.2Z', 'M12 10v4.2', 'M12 16.9v.1']),
  barrier: glyph([
    'M3.5 8.5h17v5h-17z',
    'M8 8.5l-3 5M13 8.5l-3 5M18 8.5l-3 5',
    'M6 13.5v6M18 13.5v6',
  ]),
  house: glyph(['M4 11.2l8-6.7 8 6.7', 'M6 9.6V19.5h12V9.6', 'M10 19.5v-5h4v5']),
  flag: glyph(['M6.5 21V3.8', 'M6.5 4.8h11l-2.6 4 2.6 4h-11']),
  cross: glyph([], ['M10 4.5h4v5.5h5.5v4H14v5.5h-4V14H4.5v-4H10z']),
  cloud: glyph(['M7 18.5h10.5a3.8 3.8 0 0 0 .6-7.6a5.6 5.6 0 0 0-10.7-1.3a4.5 4.5 0 0 0-.4 8.9z']),
  fuel: glyph([
    'M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20',
    'M3.5 20h12',
    'M7.5 8h4',
    'M14 9.5h1.5A1.5 1.5 0 0 1 17 11v5a1.5 1.5 0 0 0 3 0V8.5L17.5 6',
  ]),
  drop: glyph(['M12 3.5c3 4.2 6.2 7.1 6.2 10.6a6.2 6.2 0 0 1-12.4 0c0-3.5 3.2-6.4 6.2-10.6z']),
  helipad: glyph([
    'M12 3.6a8.4 8.4 0 1 1 0 16.8a8.4 8.4 0 1 1 0-16.8z',
    'M9 8.2v7.6M15 8.2v7.6M9 12h6',
  ]),
  shield: glyph(['M12 3.5l7 2.6v5.4c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6.1z']),
  /** A building with columns: a town hall. */
  columns: glyph([
    'M3.5 9.2L12 4.5l8.5 4.7z',
    'M6 11.5v6M10 11.5v6M14 11.5v6M18 11.5v6',
    'M4 20h16',
  ]),
  mast: glyph(
    ['M12 10.5V20.5M8 20.5h8', 'M8.8 7.2a4.6 4.6 0 0 1 6.4 0', 'M6.2 4.6a8.3 8.3 0 0 1 11.6 0'],
    ['M12 8.8a1.6 1.6 0 1 1 0 3.2a1.6 1.6 0 1 1 0-3.2z'],
  ),
  // Signs of the interface rather than of map symbols.
  wifi: glyph(
    ['M4 9.5a11.3 11.3 0 0 1 16 0', 'M7 12.8a7 7 0 0 1 10 0', 'M9.9 15.9a2.9 2.9 0 0 1 4.2 0'],
    ['M12 17.6a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3z'],
  ),
  qr: glyph(
    ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z'],
    ['M13.5 13.5h3v3h-3z', 'M17.5 17.5h3v3h-3z', 'M13.5 17.5h3v3h-3z', 'M17.5 13.5h3v3h-3z'],
  ),
  /** Mobile data: bars of signal. */
  signal: glyph(['M5 19.5v-3M9.7 19.5v-6M14.3 19.5v-9M19 19.5V4.5']),
  locate: glyph(
    ['M12 5.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13z', 'M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22'],
    ['M12 9.8a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 1 1 0-4.4z'],
  ),
  person: glyph([
    'M12 3.8a3.7 3.7 0 1 1 0 7.4a3.7 3.7 0 1 1 0-7.4z',
    'M4.8 20.2v-.6a7.2 7.2 0 0 1 14.4 0v.6',
  ]),
  pause: glyph(['M8.5 5.5v13M15.5 5.5v13']),
  /** An eye, struck through: not seen. */
  hidden: glyph([
    'M2.5 12s3.5-6.2 9.5-6.2 9.5 6.2 9.5 6.2-3.5 6.2-9.5 6.2S2.5 12 2.5 12z',
    'M12 9.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z',
    'M4 20L20 4',
  ]),
  plus: glyph(['M12 5v14M5 12h14']),
  chat: glyph([
    'M5 5.5h14a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1h-8.5L6 19.5V16H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z',
  ]),
  more: glyph(
    [],
    [
      'M5.5 10.2a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 1 1 0-3.6z',
      'M12 10.2a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 1 1 0-3.6z',
      'M18.5 10.2a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 1 1 0-3.6z',
    ],
  ),
  layers: glyph([
    'M12 4l8.5 4.5L12 13 3.5 8.5z',
    'M3.5 12.5L12 17l8.5-4.5',
    'M3.5 16.5L12 21l8.5-4.5',
  ]),
  ruler: glyph(['M3.8 16.2L16.2 3.8l4 4L7.8 20.2z', 'M8 12l2 2M11 9l2 2M14 6l2 2']),
  pin: glyph(
    ['M12 21s-6.5-6-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21z'],
    ['M12 7.4a2.4 2.4 0 1 1 0 4.8a2.4 2.4 0 1 1 0-4.8z'],
  ),
  trail: glyph(['M4 19c2.4 0 3.2-3.4 5.6-3.4s3 2.2 5.4.2c2.4-2 2.6-7.8 5-10.3']),
  relief: glyph(['M2.5 19.5l6.2-10.3 4.1 6.2 2.6-3.6 6.1 7.7z']),
  area: glyph(['M5 8.5L12 4l7 5-2.2 10.5H7.2z']),
  pushpin: glyph(['M12 15.5V21', 'M8.5 4h7l-1.2 5.2 3.2 3.3h-11l3.2-3.3z']),
  sweep: glyph(['M5 19.5V4.5h4.7v15h4.6v-15H19v15']),
  route: glyph(
    ['M5.5 18.5L10 10.5l4.5 4L18.5 5.5'],
    [
      'M5.5 16a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z',
      'M18.5 3a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z',
    ],
  ),
  journal: glyph([
    'M6 3.8h10.5a1.5 1.5 0 0 1 1.5 1.5v13.4a1.5 1.5 0 0 1-1.5 1.5H6z',
    'M9 8.5h6M9 12h6M9 15.5h3.5',
  ]),
  task: glyph([
    'M6.5 4.5h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2z',
    'M8.6 12.3l2.4 2.4 4.6-5',
  ]),
  download: glyph(['M12 4v11M7.5 10.5L12 15l4.5-4.5', 'M5 19.5h14']),
  screen: glyph([
    'M7.5 3.5h9a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1.5-1.5z',
    'M11 17.5h2',
  ]),
  fullscreen: glyph(['M4 9V4h5', 'M15 4h5v5', 'M20 15v5h-5', 'M9 20H4v-5']),
  language: glyph([
    'M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17z',
    'M3.5 12h17',
    'M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5s1.2-6.1 3.6-8.5z',
  ]),
  radar: glyph(
    ['M12 7.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9z', 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z'],
    ['M12 10.5a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3z'],
  ),
  grid: glyph(['M9 4v16', 'M15 4v16', 'M4 9h16', 'M4 15h16']),
  trash: glyph(['M4.5 7h15', 'M9.5 7V4.5h5V7', 'M6.5 7l1 12.5h9l1-12.5', 'M10 11v5M14 11v5']),
  settings: glyph(['M4 7h9M17 7h3M4 17h3M11 17h9', 'M15 4.5v5M9 14.5v5']),
  undo: glyph(['M9 5L4.5 9.5 9 14', 'M4.5 9.5H14a5 5 0 0 1 0 10h-3']),
  pencil: glyph(['M5 19l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L9 17.5z', 'M13.5 7l3 3']),
  close: glyph(['M6.5 6.5l11 11M17.5 6.5l-11 11']),
  /** Opens what lies below, as a list of choices. */
  chevron: glyph(['M7 9.5l5 5 5-5']),
  file: glyph(['M6 3.5h8l4 4v13H6z', 'M14 3.5v4h4', 'M12 17.5v-6M9.5 14l2.5-2.5 2.5 2.5']),
  send: glyph(['M4 4.5l16.5 7.5L4 19.5l2.8-7.5z', 'M6.8 12h6']),
  mic: glyph([
    'M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z',
    'M6.5 11a5.5 5.5 0 0 0 11 0',
    'M12 16.5v4M9 20.5h6',
  ]),
  parcel: glyph(['M3.5 4.5h17v15h-17z', 'M3.5 11.5l7.5-1.5 9.5 2.5', 'M11 10v9.5']),
  /** A compass needle: north filled, south outlined. */
  compass: glyph(['M8.2 12L12 20.5 15.8 12'], ['M12 3.5L15.8 12H8.2z']),
  /** Points up; turned to show a direction. */
  heading: glyph([], ['M12 2.5l7 18-7-4.2-7 4.2z']),
} satisfies Record<string, Glyph>;

export type GlyphName = keyof typeof GLYPHS;

/** Width of a glyph's strokes, in grid units. */
export const GLYPH_STROKE = 2;
export const GLYPH_GRID = 24;

/** A map symbol's tile, the same on the map and in forms: corner radius and pictogram size. */
export const TILE_RADIUS = 17;
export const TILE_GLYPH_SIZE = 19;

/**
 * The tile a symbol sits on: a pointy-top hexagon like the tiles of the logo, centred on (cx, cy)
 * with corners `radius` away. Its width is √3 × radius and its height 2 × radius.
 */
export function tilePath(cx: number, cy: number, radius: number): string {
  const corners = Array.from({ length: 6 }, (_, k) => {
    const angle = (Math.PI / 180) * (60 * k - 30);
    return `${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  });
  return `M${corners.join(' L')} Z`;
}
