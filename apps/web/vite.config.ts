import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { contentSecurityPolicy } from './scripts/content-security-policy.ts';
import { thirdPartyNotices } from './scripts/third-party-notices.ts';

// TESEL_BASE lets the app be served from a sub-path, e.g. "/app/" in the server image.
const base = process.env['TESEL_BASE'] ?? '/';
// VITE_TARGET "android" builds the app the Android app carries (apps/mobile, ADR-0124): its files
// are in the app itself, so there is no service worker (lib/platform.ts).
const inAndroidApp = process.env['VITE_TARGET'] === 'android';

export default defineConfig({
  base,
  build: {
    // MapLibre's chunk is about 1 MB on its own, by design; anything else that big is news.
    chunkSizeWarningLimit: 1100,
    rolldownOptions: {
      output: {
        // MapLibre, about half the app, in a file of its own: a release of the app leaves its name
        // unchanged, so browsers and the service worker keep the copy they have (ADR-0053).
        codeSplitting: {
          groups: [{ name: 'maplibre', test: /[\\/]node_modules[\\/]maplibre-gl[\\/]/ }],
        },
      },
    },
  },
  plugins: [
    svelte(),
    contentSecurityPolicy(),
    thirdPartyNotices([
      {
        // The service worker's runtime, which vite-plugin-pwa bundles apart from the app.
        name: 'workbox-core, workbox-precaching, workbox-routing, workbox-strategies',
        license: 'MIT',
        notice: 'workbox',
      },
    ]),
    VitePWA({
      disable: inAndroidApp,
      // Updates wait for the user to accept them (see UpdatePrompt.svelte).
      registerType: 'prompt',
      manifest: {
        name: 'Tesel',
        short_name: 'Tesel',
        description:
          'Consciencia situacional para equipos: posiciones, mensajes, tareas e incidentes en un mapa común y en tiempo real, con una red de respaldo propia cuando caen la telefonía o la electricidad.',
        lang: 'es',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#18191b',
        theme_color: '#18191b',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The whole app, glyphs and sprites are cached at install so the map works offline, and so
        // are the third-party licences, which the fallback to index.html would otherwise answer.
        // Map tiles are not handled here: downloaded areas live in IndexedDB.
        globPatterns: ['**/*.{js,mjs,css,html,png,svg,pbf,json,webmanifest,txt}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Icons are linked with ?v= so browsers fetch new ones; the cache serves them all the same.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^v$/],
        // A tap on an alarm notification brings the app to the front.
        importScripts: ['notification-click.js'],
      },
    }),
  ],
});
