// The usage page (ADR-0117): the daily figures of usage.ts for the last 30 days, as a page of
// plain HTML with drawings in SVG, for whoever runs the server. No scripts and no style
// attributes, which the site's Content-Security-Policy forbids: the styles are stats.css. Its
// words are Spanish, as are those of the people who run tesel.eu.

import type { StoredTotals, UsageRow } from './envelope-store.ts';
import { METRICS } from './usage.ts';

export const STATS_DAYS = 30;

const PAGE_NAMES: Readonly<Record<string, string>> = {
  '/': 'Portada',
  '/en/': 'Portada en inglés',
  '/legal/': 'Aviso legal',
  '/en/legal/': 'Aviso legal en inglés',
  '/app/': 'App (cargas desde la red)',
};

/** One figure, day by day, oldest first. */
type Series = readonly number[];

export interface StatsInput {
  /** The days shown, oldest first, YYYY-MM-DD. */
  readonly days: readonly string[];
  readonly rows: readonly UsageRow[];
  readonly totals: StoredTotals;
}

export function statsPage({ days, rows, totals }: StatsInput): string {
  const byDay = new Map(days.map((day) => [day, new Map<string, number>()]));
  for (const row of rows) byDay.get(row.day)?.set(row.metric, row.value);
  const series = (pick: (figures: ReadonlyMap<string, number>) => number): Series =>
    days.map((day) => pick(byDay.get(day) ?? new Map()));
  const sumOf = (prefix: string) => (figures: ReadonlyMap<string, number>) =>
    [...figures].reduce((sum, [metric, value]) => sum + (metric.startsWith(prefix) ? value : 0), 0);
  const one = (metric: string) => (figures: ReadonlyMap<string, number>) =>
    figures.get(metric) ?? 0;

  const visitors = series(one(METRICS.visitors));
  const views = series(sumOf(METRICS.views));
  const connections = series(one(METRICS.connections));
  const groups = series(one(METRICS.groups));
  const envelopes = series(one(METRICS.envelopes));
  const today = days.at(-1) ?? '';

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Tesel · Uso</title><link rel="stylesheet" href="/stats/stats.css"></head>
<body><main>
<header><h1>Tesel · Uso</h1>
<p>Recuentos anónimos por día de los últimos ${String(STATS_DAYS)} días, hasta hoy, ${escape(today.split('-').reverse().join('/'))}. Sin cookies ni direcciones: solo cuántos.</p></header>
<section class="tiles">
${tile('Visitantes de la web', visitors, 'Suma de los visitantes distintos de cada día')}
${tile('Páginas vistas', views, 'Web y app, sin robots')}
${tile('Conexiones de la app', connections, 'Cada vez que una app se conecta al servidor')}
${tile('Mensajes guardados', envelopes, 'Mensajes cifrados que la app ha subido')}
<div class="tile"><p class="label">Ahora en el servidor</p><p class="big">${count(totals.groups)}</p><p class="note">grupos con mensajes guardados (${count(totals.envelopes)} mensajes)</p></div>
</section>
<section><h2>Web: visitantes por día</h2>${bars(days, visitors)}</section>
<section><h2>App: conexiones por día</h2>${bars(days, connections)}</section>
<section><h2>App: grupos activos por día</h2>${bars(days, groups)}</section>
<section class="tables">
${table(
  'Páginas',
  'Vistas',
  named(rows, METRICS.views, (path) => PAGE_NAMES[path] ?? path),
)}
${table(
  'De dónde llegan',
  'Visitas',
  named(rows, METRICS.from, (site) => (site === 'other' ? 'Otros sitios' : site)),
)}
</section>
<footer><p>Visitas de robots y buscadores, aparte: ${count(sumAll(rows, METRICS.robots))}. Los días van en hora de España. La app guardada en el móvil se abre sin pedir nada al servidor, así que las cargas de la app son menos que las veces que se usa.</p></footer>
</main></body></html>
`;
}

export const STATS_CSS = `:root{color-scheme:light;--ink:#18191b;--muted:#565b60;--line:#d5d8d6;--lime:#99c938;--deep:#49660e}
*{box-sizing:border-box}body{margin:0;background:#f4f5f4;color:var(--ink);font:16px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif}
main{max-width:1000px;margin:0 auto;padding:32px 16px 48px}h1{margin:0 0 4px;font-size:28px}h2{margin:0 0 12px;font-size:18px}
header p,footer p,.note{color:var(--muted);font-size:14px}section{margin-top:32px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.tile{background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px}.tile p{margin:0}
.label{font-weight:600;font-size:14px}.big{font-size:30px;font-weight:700;margin:6px 0 2px!important;font-variant-numeric:tabular-nums}
.chart{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px}.chart svg{display:block;width:100%;height:auto}
.tables{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--line);font-size:14px}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
tr:last-child td{border-bottom:0}th{color:var(--muted);font-weight:600}`;

function tile(label: string, values: Series, note: string): string {
  const last7 = values.slice(-7).reduce((a, b) => a + b, 0);
  const all = values.reduce((a, b) => a + b, 0);
  return `<div class="tile"><p class="label">${escape(label)}</p><p class="big">${count(last7)}</p><p class="note">en 7 días · ${count(all)} en ${String(STATS_DAYS)} días</p><p class="note">${escape(note)}</p></div>`;
}

/** Bars, one a day, scaled to the highest, with the highest and the first and last days marked. */
function bars(days: readonly string[], values: Series): string {
  const width = 960;
  const height = 180;
  const left = 40;
  const bottom = 24;
  const top = 10;
  const highest = Math.max(1, ...values);
  const slot = (width - left) / Math.max(1, values.length);
  const y = (value: number) => height - bottom - ((height - bottom - top) * value) / highest;
  const rects = values
    .map((value, index) => {
      const x = left + index * slot + slot * 0.15;
      return `<rect x="${x.toFixed(1)}" y="${y(value).toFixed(1)}" width="${(slot * 0.7).toFixed(1)}" height="${(height - bottom - y(value)).toFixed(1)}" rx="2" fill="#99c938"><title>${escape(days[index] ?? '')}: ${count(value)}</title></rect>`;
    })
    .join('');
  const label = (day: string | undefined) =>
    escape((day ?? '').slice(5).split('-').reverse().join('/'));
  return `<div class="chart"><svg viewBox="0 0 ${String(width)} ${String(height)}" role="img" aria-label="Valores por día">
<line x1="${String(left)}" x2="${String(width)}" y1="${String(top)}" y2="${String(top)}" stroke="#e1e4e1"/>
<line x1="${String(left)}" x2="${String(width)}" y1="${String(height - bottom)}" y2="${String(height - bottom)}" stroke="#c9cdca"/>
<text x="${String(left - 6)}" y="${String(top + 4)}" text-anchor="end" font-size="12" fill="#565b60">${count(highest)}</text>
<text x="${String(left - 6)}" y="${String(height - bottom)}" text-anchor="end" font-size="12" fill="#565b60">0</text>
${rects}
<text x="${String(left)}" y="${String(height - 6)}" font-size="12" fill="#565b60">${label(days[0])}</text>
<text x="${String(width)}" y="${String(height - 6)}" text-anchor="end" font-size="12" fill="#565b60">${label(days.at(-1))}</text>
</svg></div>`;
}

/** The figures under a prefix added up over the days, named, the largest first. */
function named(
  rows: readonly UsageRow[],
  prefix: string,
  name: (key: string) => string,
): [string, number][] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.metric.startsWith(prefix)) continue;
    const key = row.metric.slice(prefix.length);
    totals.set(key, (totals.get(key) ?? 0) + row.value);
  }
  return [...totals].sort((a, b) => b[1] - a[1]).map(([key, value]) => [name(key), value]);
}

function table(title: string, unit: string, entries: readonly [string, number][]): string {
  const body =
    entries.length === 0
      ? '<tr><td colspan="2">Aún nada</td></tr>'
      : entries
          .map(
            ([name, value]) =>
              `<tr><td>${escape(name)}</td><td class="n">${count(value)}</td></tr>`,
          )
          .join('');
  return `<div><h2>${escape(title)}</h2><table><thead><tr><th>${escape(title === 'Páginas' ? 'Página' : 'Sitio')}</th><th class="n">${escape(unit)}</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function sumAll(rows: readonly UsageRow[], metric: string): number {
  return rows.reduce((sum, row) => sum + (row.metric === metric ? row.value : 0), 0);
}

function count(value: number): string {
  return value.toLocaleString('es-ES');
}

function escape(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );
}
