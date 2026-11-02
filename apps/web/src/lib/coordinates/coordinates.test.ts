import { describe, expect, it } from 'vitest';

import { COORDINATE_FORMATS, formatCoordinate, parseCoordinate } from './coordinates.ts';

const VALENCIA = { lat: 39.4699, lon: -0.3763 };

describe('coordinates', () => {
  it('writes a point in every format', () => {
    expect(formatCoordinate(VALENCIA, 'decimal')).toBe('39.46990, -0.37630');
    expect(formatCoordinate(VALENCIA, 'dms')).toBe('39°28′11.6″ N 0°22′34.7″ W');
    expect(formatCoordinate(VALENCIA, 'utm')).toBe('30S 725695E 4372210N');
    expect(formatCoordinate(VALENCIA, 'mgrs')).toBe('30S YJ 25695 72210');
  });

  it('reads back what it writes, in every format', () => {
    for (const format of COORDINATE_FORMATS) {
      const text = formatCoordinate(VALENCIA, format) ?? '';
      const back = parseCoordinate(text);
      expect(back?.lat, text).toBeCloseTo(VALENCIA.lat, 4);
      expect(back?.lon, text).toBeCloseTo(VALENCIA.lon, 4);
    }
  });

  it('writes a dictated coordinate back as it was dictated', () => {
    for (const text of ['30S 725000E 4373000N', '30S YJ 25000 73000']) {
      const point = parseCoordinate(text);
      const format = text.includes('E') ? 'utm' : 'mgrs';
      expect(point && formatCoordinate(point, format)).toBe(text);
    }
  });

  it('reads degrees as people write them', () => {
    const near = (text: string) => {
      const point = parseCoordinate(text);
      expect(point?.lat, text).toBeCloseTo(VALENCIA.lat, 3);
      expect(point?.lon, text).toBeCloseTo(VALENCIA.lon, 3);
    };
    near('39.4699 -0.3763');
    near('39.4699,-0.3763');
    near('39,4699 -0,3763');
    near('39,4699; -0,3763');
    near(`39°28'11.6"N 0°22'34.7"W`);
    near('39º 28′ 11,6″ N, 0º 22′ 34,7″ O');
    near('N 39 28.193 W 0 22.578');
    near('0°22′34.7″ W 39°28′11.6″ N');
  });

  it('reads UTM with a latitude band or a hemisphere', () => {
    for (const text of ['30S 725695 4372210', '30 S 725695E 4372210N', '30N 725695 4372210']) {
      const point = parseCoordinate(text);
      expect(point?.lat, text).toBeCloseTo(VALENCIA.lat, 4);
      expect(point?.lon, text).toBeCloseTo(VALENCIA.lon, 4);
    }
    const sydney = parseCoordinate('56S 334368 6250948');
    expect(sydney?.lat).toBeCloseTo(-33.8688, 4);
  });

  it('refuses text that is no coordinate', () => {
    const texts = [
      '',
      'Valencia',
      '91 0',
      '39.4 -0.3 2',
      '39°61′ N 0° W',
      '30S 725695',
      // A sign and a letter that disagree, even on zero.
      '39 N -0 30 E',
    ];
    for (const text of texts) {
      expect(parseCoordinate(text), text).toBeNull();
    }
  });

  it('has no UTM or MGRS near the poles', () => {
    expect(formatCoordinate({ lat: 85, lon: 0 }, 'utm')).toBeNull();
    expect(formatCoordinate({ lat: 85, lon: 0 }, 'decimal')).toBe('85.00000, 0.00000');
  });
});
