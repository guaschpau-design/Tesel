import { describe, expect, it } from 'vitest';

import { statsPage } from './stats-page.ts';
import { METRICS, UNKNOWN_COUNTRY } from './usage.ts';

const DAY = '2026-11-20';

function page(figures: Readonly<Record<string, number>>): string {
  return statsPage({
    days: [DAY],
    rows: Object.entries(figures).map(([metric, value]) => ({ day: DAY, metric, value })),
    totals: { groups: 0, envelopes: 0 },
  });
}

/** The rows of the table of countries, as text. */
function countryRows(html: string): string[] {
  const table = /<h2>Desde qué países<\/h2><table>.*?<tbody>(.*?)<\/tbody>/s.exec(html)?.[1] ?? '';
  return [...table.matchAll(/<tr>(.*?)<\/tr>/g)].map(([, row = '']) =>
    row
      .replace(/<\/td><td[^>]*>/g, ' | ')
      .replace(/<[^>]+>/g, '')
      .trim(),
  );
}

describe('the usage page by country', () => {
  it('names each country in Spanish with its flag, the most first, then the unknown', () => {
    const html = page({
      [`${METRICS.country}PT`]: 3,
      [`${METRICS.country}ES`]: 40,
      [`${METRICS.appCountry}ES`]: 25,
      [`${METRICS.appCountry}FR`]: 4,
      [`${METRICS.country}${UNKNOWN_COUNTRY}`]: 2,
    });
    expect(countryRows(html)).toEqual([
      '🇪🇸 España | 40 | 25',
      '🇫🇷 Francia | 0 | 4',
      '🇵🇹 Portugal | 3 | 0',
      'No se sabe | 2 | 0',
    ]);
    // The attribution DB-IP's licence asks for.
    expect(html).toContain('<a href="https://db-ip.com">IP Geolocation by DB-IP</a>');
  });

  it('adds up the countries past the first ten', () => {
    const codes = ['ES', 'PT', 'FR', 'DE', 'IT', 'GB', 'US', 'NL', 'BE', 'CH', 'AT', 'MX'];
    const html = page(
      Object.fromEntries(codes.map((code, index) => [`${METRICS.country}${code}`, 100 - index])),
    );
    const rows = countryRows(html);
    expect(rows).toHaveLength(11);
    expect(rows.at(-1)).toBe('Otros países (2) | 179 | 0');
  });

  it('says when there is nothing yet', () => {
    expect(countryRows(page({}))).toEqual(['Aún nada']);
  });
});
