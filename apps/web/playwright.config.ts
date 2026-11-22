import { defineConfig, devices } from '@playwright/test';

import { APP_PORT, SERVER_PORT, SERVER_URL } from './e2e/ports.ts';

/** Copies the synthetic basemap into the build, as itself and as each of the server's archives. */
const STAND_INS = [
  "const fs = require('fs'), basemap = 'e2e/fixtures/test-basemap.pmtiles';",
  "fs.copyFileSync(basemap, 'dist/test-basemap.pmtiles');",
  "fs.mkdirSync('dist/maps', { recursive: true });",
  "for (const name of ['buildings', 'aid-points'])",
  "fs.copyFileSync(basemap, 'dist/maps/' + name + '.pmtiles');",
].join(' ');

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    locale: 'es-ES',
    ...devices['Pixel 7'],
    launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: [
    {
      // Production build pointed at the synthetic basemap and the test relay server. The basemap
      // stands in for the server's own archives too (buildings, aid points): it has
      // none of their layers, so none are drawn, and a download finds its tiles.
      command:
        `VITE_BASEMAP_URL=http://localhost:${APP_PORT}/test-basemap.pmtiles ` +
        `VITE_MAPS_URL=http://localhost:${APP_PORT}/maps/ ` +
        `VITE_SERVER_URL=${SERVER_URL} vite build && ` +
        `node -e "${STAND_INS}" && ` +
        `vite preview --port ${APP_PORT} --strictPort`,
      port: APP_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // The relay server, with its database in memory so every run starts empty. It gathers no
      // weather warnings: tests stand in for them (e2e/weather.e2e.ts).
      command: `TESEL_PORT=${SERVER_PORT} TESEL_DB=:memory: TESEL_WEATHER=off node ../server/src/main.ts`,
      url: `${SERVER_URL}/healthz`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
