// SVG path data as PDF path operators, for drawings made as SVG, such as Tesel's mark (ADR-0118).
// Absolute commands only (M, L, H, V, A, Z), which is how the brand's files are written; arcs
// become Bézier curves, as PDF has none.

type Point = readonly [number, number];

const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
const COMMAND = /([MLHVAZ])([^MLHVAZ]*)/gi;

/** The operators that trace `d`, in the drawing's own units: to be filled or stroked after. */
export function svgPathOperators(d: string): string {
  const out: string[] = [];
  let at: Point = [0, 0];
  let start: Point = [0, 0];
  for (const [, letter = '', rest = ''] of d.matchAll(COMMAND)) {
    const values = (rest.match(NUMBER) ?? []).map(Number);
    if (letter !== letter.toUpperCase()) throw new Error(`Relative path command ${letter}`);
    const take = (count: number): number[][] => {
      const groups: number[][] = [];
      for (let index = 0; index + count <= values.length; index += count) {
        groups.push(values.slice(index, index + count));
      }
      return groups;
    };
    switch (letter) {
      case 'M':
        take(2).forEach(([x = 0, y = 0], index) => {
          at = [x, y];
          if (index === 0) start = at;
          out.push(`${pair(at)} ${index === 0 ? 'm' : 'l'}`);
        });
        break;
      case 'L':
        for (const [x = 0, y = 0] of take(2)) {
          at = [x, y];
          out.push(`${pair(at)} l`);
        }
        break;
      case 'H':
        for (const [x = 0] of take(1)) {
          at = [x, at[1]];
          out.push(`${pair(at)} l`);
        }
        break;
      case 'V':
        for (const [y = 0] of take(1)) {
          at = [at[0], y];
          out.push(`${pair(at)} l`);
        }
        break;
      case 'A':
        for (const [rx = 0, ry = 0, angle = 0, large = 0, sweep = 0, x = 0, y = 0] of take(7)) {
          const end: Point = [x, y];
          for (const [c1, c2, to] of arcCurves(at, end, rx, ry, angle, large !== 0, sweep !== 0)) {
            out.push(`${pair(c1)} ${pair(c2)} ${pair(to)} c`);
          }
          at = end;
        }
        break;
      case 'Z':
        out.push('h');
        at = start;
        break;
    }
  }
  return out.join(' ');
}

function pair([x, y]: Point): string {
  return `${String(Math.round(x * 1000) / 1000)} ${String(Math.round(y * 1000) / 1000)}`;
}

/** An elliptical arc as cubic curves of at most a quarter turn each (SVG 1.1, appendix F.6). */
function arcCurves(
  from: Point,
  to: Point,
  radiusX: number,
  radiusY: number,
  degrees: number,
  large: boolean,
  sweep: boolean,
): [Point, Point, Point][] {
  if (radiusX === 0 || radiusY === 0) return [[from, to, to]];
  const phi = (degrees * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from[0] - to[0]) / 2;
  const dy = (from[1] - to[1]) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  let rx = Math.abs(radiusX);
  let ry = Math.abs(radiusY);
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = (coef * rx * y1) / ry;
  const cyp = (-coef * ry * x1) / rx;
  const cx = cos * cxp - sin * cyp + (from[0] + to[0]) / 2;
  const cy = sin * cxp + cos * cyp + (from[1] + to[1]) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const ux = (x1 - cxp) / rx;
  const uy = (y1 - cyp) / ry;
  const theta = angle(1, 0, ux, uy);
  let turn = angle(ux, uy, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
  if (!sweep && turn > 0) turn -= 2 * Math.PI;
  if (sweep && turn < 0) turn += 2 * Math.PI;
  const segments = Math.max(1, Math.ceil(Math.abs(turn) / (Math.PI / 2) - 1e-9));
  const step = turn / segments;
  const k = (4 / 3) * Math.tan(step / 4);
  const place = (px: number, py: number): Point => [
    cx + rx * cos * px - ry * sin * py,
    cy + rx * sin * px + ry * cos * py,
  ];
  const curves: [Point, Point, Point][] = [];
  for (let index = 0; index < segments; index++) {
    const a1 = theta + index * step;
    const a2 = a1 + step;
    curves.push([
      place(Math.cos(a1) - k * Math.sin(a1), Math.sin(a1) + k * Math.cos(a1)),
      place(Math.cos(a2) + k * Math.sin(a2), Math.sin(a2) - k * Math.cos(a2)),
      place(Math.cos(a2), Math.sin(a2)),
    ]);
  }
  return curves;
}
