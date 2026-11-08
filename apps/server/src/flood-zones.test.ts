import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { floodZonesView, serveFloodZones, SNCZI_URL } from './flood-zones.ts';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
/** Valencia, in Web Mercator metres. */
const VALENCIA = '-46754,4783454,-35622,4793547';

async function server(answer: (url: string) => Response) {
  const asked: string[] = [];
  const app = Fastify();
  serveFloodZones(app, (url) => {
    asked.push(url);
    return Promise.resolve(answer(url));
  });
  await app.ready();
  return { app, asked };
}

describe('flood zones', () => {
  it('reads a view within Spain, and refuses others or malformed ones', () => {
    expect(floodZonesView({ BBOX: VALENCIA, WIDTH: '800', HEIGHT: '600' })).toEqual({
      bbox: [-46754, 4783454, -35622, 4793547],
      width: 800,
      height: 600,
    });
    // Paris; a box upside down; a picture too large; a missing side.
    expect(floodZonesView({ BBOX: '250000,6240000,270000,6260000', WIDTH: '8', HEIGHT: '8' })).toBe(
      null,
    );
    expect(floodZonesView({ BBOX: '-35622,4793547,-46754,4783454', WIDTH: '8', HEIGHT: '8' })).toBe(
      null,
    );
    expect(floodZonesView({ BBOX: VALENCIA, WIDTH: '4096', HEIGHT: '600' })).toBeNull();
    expect(floodZonesView({ BBOX: VALENCIA, WIDTH: '800' })).toBeNull();
  });

  it('asks the Ministry for its 100-year layer only, and passes on the picture', async () => {
    const { app, asked } = await server(
      () => new Response(PNG, { headers: { 'Content-Type': 'image/png' } }),
    );
    const reply = await app.inject({
      method: 'GET',
      url: `/v1/flood-zones?BBOX=${VALENCIA}&WIDTH=800&HEIGHT=600&LAYERS=other&URL=x`,
    });
    expect(reply.statusCode).toBe(200);
    expect(reply.headers['content-type']).toBe('image/png');
    expect(reply.headers['access-control-allow-origin']).toBe('*');
    expect(reply.rawPayload).toEqual(PNG);
    const url = new URL(asked[0] ?? '');
    expect(`${url.origin}${url.pathname}`).toBe(SNCZI_URL);
    expect(url.searchParams.get('LAYERS')).toBe('Zi_laminas_q100');
    expect(url.searchParams.get('CRS')).toBe('EPSG:3857');
    await app.close();
  });

  it('passes on no error page or other document, and asks nothing for a bad view', async () => {
    const { app, asked } = await server(
      () => new Response('<ServiceException/>', { headers: { 'Content-Type': 'text/xml' } }),
    );
    const failed = await app.inject({
      method: 'GET',
      url: `/v1/flood-zones?BBOX=${VALENCIA}&WIDTH=800&HEIGHT=600`,
    });
    expect(failed.statusCode).toBe(502);
    const outside = await app.inject({ method: 'GET', url: '/v1/flood-zones?BBOX=1,2,3' });
    expect(outside.statusCode).toBe(400);
    expect(asked).toHaveLength(1);
    await app.close();
  });
});
