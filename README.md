# Tesel

**Consciencia situacional para equipos.** Posiciones, mensajes, alertas e incidentes de todo el equipo en un mapa común y en tiempo real: con internet o, cuando la red cae, por radio LoRa (MeshCore o Meshtastic). Software libre, cifrado de extremo a extremo y sin cuentas.

**Situational awareness for teams.** The whole team's positions, messages, alerts and incidents on one shared map, in real time: over the internet or, when the network goes down, over LoRa radio (MeshCore or Meshtastic). Free software, end-to-end encrypted, no accounts.

> Estado: en desarrollo, hacia la v0.1. · Status: in development, towards v0.1.
>
> El nombre viene de las **teselas**, las piezas de un mosaico y de un mapa digital: muchas pequeñas que solo juntas forman la imagen. · The name comes from **tesserae**: the small tiles of a mosaic, and of a digital map.

**Pruébala · Try it:** <https://tesel.eu> — se publica sola con cada cambio que pasa las pruebas · published automatically on every change that passes CI.

## Principios · Principles

- **Nadie lo controla.** Libre (EUPL-1.2), gratuito y sin cuentas. · **Nobody controls it.** Free software (EUPL-1.2), no cost, no accounts.
- **Funciona sin infraestructura.** Pensado para cuando cae la red móvil. · **Works without infrastructure.** Built for when the mobile network fails.
- **Los datos son del grupo.** El servidor solo ve datos cifrados. · **The data belongs to the group.** Servers only ever see ciphertext.

## Documentación · Documentation

| Documento                                    | Contenido                                |
| -------------------------------------------- | ---------------------------------------- |
| [docs/briefing.md](docs/briefing.md)         | Visión, alcance y planning (español)     |
| [docs/hoja-de-ruta.md](docs/hoja-de-ruta.md) | Qué viene después, por fases (español)   |
| [ARCHITECTURE.md](ARCHITECTURE.md)           | How the system is built                  |
| [docs/protocol.md](docs/protocol.md)         | Wire format specification                |
| [docs/hardware.md](docs/hardware.md)         | Supported radios and how to flash them   |
| [docs/decisions/](docs/decisions/)           | Architecture decision records            |
| [CONTRIBUTING.md](CONTRIBUTING.md)           | Rules for every contributor, human or AI |

## Desarrollo · Development

Requires Node.js 22.18 or later and pnpm 10; CI and the server image use Node 24.22.1.

```sh
pnpm install
pnpm dev     # web app and server
pnpm check   # what CI checks, except the end-to-end tests and the server image
```

## Licencia · Licence

[EUPL-1.2](LICENSE). Las licencias de las dependencias de la app se publican con ella, en `third-party-notices.txt`. · The licences of the app's dependencies ship with it, in `third-party-notices.txt`.

> **Uso comercial y mapa satélite.** De lejos, el mapa satélite usa por defecto el mosaico Sentinel-2 cloudless 2024 de EOX, **solo para uso no comercial** (CC BY-NC-SA 4.0). Un despliegue comercial debe compilar la app con `VITE_SATELLITE_MOSAIC=s2cloudless-2016` (CC BY 4.0) o licenciar el mosaico a EOX. · **Commercial use and the satellite map.** From afar, the satellite map shows EOX's Sentinel-2 cloudless 2024 mosaic by default, **for non-commercial use only** (CC BY-NC-SA 4.0). A commercial deployment must build the app with `VITE_SATELLITE_MOSAIC=s2cloudless-2016` (CC BY 4.0) or license the mosaic from EOX. See [ADR-0051](docs/decisions/0051-satellite-mosaic-licence.md).
