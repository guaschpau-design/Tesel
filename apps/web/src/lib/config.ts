// Build-time configuration, from Vite environment variables.

/**
 * Base map in PMTiles format, absolute or relative to the app. The server image uses the map its
 * server publishes (deploy/vps/maps.sh); without one, development uses the Protomaps demo
 * archive, which is meant for testing only and must not be used in production.
 */
export function basemapUrl(): string {
  const configured = import.meta.env['VITE_BASEMAP_URL'] as string | undefined;
  return new URL(configured || 'https://demo-bucket.protomaps.com/v4.pmtiles', window.location.href)
    .href;
}

/** Absolute URL of the vendored glyphs and sprites (public/map-assets). */
export function mapAssetsUrl(): string {
  return new URL(`${import.meta.env.BASE_URL}map-assets/`, window.location.href).href;
}

/**
 * Absolute URL of the licences of the third-party code the app ships, which the build writes
 * (scripts/third-party-notices.ts).
 */
export function thirdPartyNoticesUrl(): string {
  return new URL(`${import.meta.env.BASE_URL}third-party-notices.txt`, window.location.href).href;
}

/**
 * Server proposed for new groups (protocol §8), or null if this build has none. VITE_SERVER_URL may
 * be relative to the app: the server image builds the app with "/", so every server proposes
 * itself. Coordinators can change it when they create a group.
 */
export function defaultServerUrl(): string | null {
  const configured = import.meta.env['VITE_SERVER_URL'] as string | undefined;
  return configured ? new URL(configured, window.location.href).href : null;
}

/**
 * Where invitation links point (protocol §6), ending in `/`: VITE_PUBLIC_APP_URL, the web app on
 * the internet, in a build not served from there, as the Android app's (ADR-0124); otherwise where
 * this app is served from. Whoever has the Android app opens such a link in it, anyone else in the
 * browser.
 */
export function invitationAppUrl(): string {
  const configured = import.meta.env['VITE_PUBLIC_APP_URL'] as string | undefined;
  return new URL(configured || import.meta.env.BASE_URL, window.location.href).href;
}

/** EOX's Sentinel-2 cloudless mosaics the satellite map can show from afar (ADR-0051). */
const SATELLITE_MOSAICS = ['s2cloudless-2024', 's2cloudless-2016'] as const;
export type SatelliteMosaic = (typeof SATELLITE_MOSAICS)[number];

/**
 * The satellite map's mosaic, VITE_SATELLITE_MOSAIC. The 2024 mosaic is the default and is free for
 * non-commercial use only (CC BY-NC-SA 4.0); a commercial deployment builds with the 2016 mosaic
 * (CC BY 4.0) or licenses the newer one from EOX. A value this build does not know stops the app,
 * so that no deployment shows a mosaic it did not choose.
 */
export function satelliteMosaic(): SatelliteMosaic {
  const configured = import.meta.env['VITE_SATELLITE_MOSAIC'] as string | undefined;
  if (!configured) return 's2cloudless-2024';
  const mosaic = SATELLITE_MOSAICS.find((known) => known === configured);
  if (mosaic === undefined) {
    throw new Error(
      `VITE_SATELLITE_MOSAIC is "${configured}"; expected one of ${SATELLITE_MOSAICS.join(', ')}`,
    );
  }
  return mosaic;
}
