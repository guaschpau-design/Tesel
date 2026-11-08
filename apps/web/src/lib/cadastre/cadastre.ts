// The cadastres' maps: parcels with their numbers, and in Spain the rural polygons that, with the
// parcel, are how a plot in the country is named ("polígono 12, parcela 345"). Spain's Dirección
// General del Catastro and France's IGN publish them as free WMS. Spain's terms forbid tiled
// requests and bulk downloads (ADR-0036), so they are shown as pictures of the view
// (map/wms/view-picture.ts), only online. Portugal has no national cadastre service to show.

import type { ViewService } from '../map/wms/view-picture.ts';

/** Below this zoom a view holds too many parcels to read them. */
export const CADASTRE_MIN_ZOOM = 15;

export const CADASTRES: readonly ViewService[] = [
  {
    id: 'spain',
    // The peninsula, the Balearic and the Canary Islands.
    bounds: { west: -18.2, south: 27.6, east: 4.4, north: 43.8 },
    url: 'https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx',
    version: '1.1.1',
    layers: 'Catastro',
    style: '',
    credit:
      '<a href="https://www.sedecatastro.gob.es" target="_blank">© Dirección General del Catastro</a>',
  },
  {
    id: 'france',
    // Metropolitan France.
    bounds: { west: -5.2, south: 41.3, east: 9.6, north: 51.1 },
    url: 'https://data.geopf.fr/wms-r/wms',
    version: '1.3.0',
    layers: 'CADASTRALPARCELS.PARCELLAIRE_EXPRESS',
    // The style with each parcel's number.
    style: 'PCI vecteur',
    // The Licence Ouverte 2.0 asks for the producers and the date of the last update. The service
    // gives no date the app can rely on, so the credit names the producers only.
    credit: '<a href="https://www.ign.fr" target="_blank">DGFiP / IGN – PCI Express</a>',
  },
];

export const CADASTRE_CREDITS = CADASTRES.map((service) => service.credit);
