# Briefing del proyecto

**Nota (28 oct 2026):** el puesto de mando se descartó; ver [`docs/decisions/0058-no-command-posts.md`](decisions/0058-no-command-posts.md).

> Nombre: **Tesel** (antes Teselia y, provisionalmente, Malla). Viene de las teselas: las piezas de un mosaico y de un mapa digital. Decisión en `docs/decisions/0019-name-tesel.md`.
>
> Estado: aprobado para desarrollo · Fecha: 25 de octubre de 2026 · Versión objetivo: v0.1

## 1. Qué es

Tesel es una aplicación libre, gratuita y de código abierto de **consciencia situacional para la sociedad civil europea**: un mapa compartido en tiempo real donde un grupo ve a sus miembros, se comunica y marca lo que ocurre sobre el terreno, **también cuando no hay internet**, gracias a las redes de radio LoRa (MeshCore y Meshtastic).

Es la respuesta europea y abierta a lo que ATAK hace en Estados Unidos, con tres diferencias de principio:

1. **Nadie la controla.** Ni gobiernos ni empresas. Cualquiera puede usarla, también las administraciones, pero ninguna entidad decide quién puede o no puede.
2. **Funciona sin infraestructura.** Diseñada desde el primer día para el escenario en que cae la red móvil.
3. **Los datos son del grupo.** El servidor, cuando existe, solo ve datos cifrados que no puede leer.

## 2. Para quién

Para toda la sociedad civil, sin excluir a nadie:

- Protección civil y voluntariado de emergencias.
- Equipos de rescate y montaña.
- ONG y ayuda humanitaria.
- Grupos de ciudadanos: vecinos, grupos outdoor, personas preparadas para emergencias.
- Administraciones que quieran usarla (abierta a todos, controlada por nadie).

## 3. Escenarios en los que tiene que funcionar

| Escenario                                                  | Qué exige a la app                                              |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| Catástrofe natural (DANA, inundación, incendio, terremoto) | Mapa sin conexión, posiciones del equipo, zonas de peligro, SOS |
| Apagón general                                             | Funcionar solo con LoRa y batería; mensajes cortos y robustos   |
| Búsqueda de personas                                       | Posiciones en vivo, zonas asignadas, marcadores de pistas       |
| Eventos masivos                                            | Muchos usuarios a la vez, alertas, coordinación por grupos      |

## 4. Decisiones tomadas en el briefing

| Bloque                    | Decisión                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Licencia                  | EUPL-1.2 (licencia libre oficial de la UE)                                                                                                                      |
| Gobernanza                | Proyecto personal de Pau, que se abre a la comunidad al publicarse                                                                                              |
| Desarrollo                | Pau dirige, Claude programa                                                                                                                                     |
| Plataforma                | Aplicación web (principal) y apps de Android e iPhone hechas con el mismo código, a partir de la v0.1 (ADR-0016)                                                |
| Comunicaciones v0.1       | Internet + LoRa MeshCore (Bluetooth desde Chrome/Edge)                                                                                                          |
| Radios soportadas v0.1    | Elecrow ThinkNode M9, SenseCAP MeshTracker X1, LilyGO T-Deck Plus y SenseCAP T1000-E, con firmware MeshCore Companion Bluetooth (detalle en `docs/hardware.md`) |
| Comunicaciones después    | Compatibilidad con ATAK (protocolo CoT)                                                                                                                         |
| Infraestructura           | Funciona sin servidor; si hay servidor, sincroniza con él                                                                                                       |
| Servidor de pruebas       | VPS en IONOS (España), `tesel.eu`                                                                                                                               |
| Código                    | GitHub                                                                                                                                                          |
| Idiomas                   | Español e inglés                                                                                                                                                |
| Grupos                    | Coordinador y miembros                                                                                                                                          |
| Identidad                 | Sin cuenta: alias y clave generados en el dispositivo; unión al grupo por código QR                                                                             |
| Cifrado                   | Por canal: cada grupo comparte una clave secreta                                                                                                                |
| Privacidad de la posición | La decide cada usuario: compartir, pausar u ocultar                                                                                                             |
| Simbología                | Civil por defecto; OTAN APP-6 seleccionable más adelante                                                                                                        |
| Mapas                     | OpenStreetMap con descarga para usar sin conexión; después satélite, topográfico y náutico                                                                      |

## 5. Alcance de la v0.1

### Entra

1. **Posiciones en vivo** de los miembros del grupo en el mapa.
2. **Chat de grupo** por canal.
3. **Marcadores y zonas**: puntos, líneas y áreas dibujadas y compartidas.
4. **SOS y alertas**: botón de emergencia y avisos al grupo.
5. **Mapa OpenStreetMap** con descarga de una zona para usarlo sin conexión.
6. **Grupos con roles** y unión por código QR.
7. **Internet y LoRa MeshCore** como medios de transporte.
8. **Modo puesto de mando local** (ver sección 6).

### Después de la v0.1

En la [hoja de ruta](hoja-de-ruta.md), fase a fase.

### No entra (por ahora)

- Voz y vídeo.
- Mensajes privados de persona a persona con cifrado extremo a extremo.

## 6. Los tres modos de funcionamiento

La app es la misma en los tres modos; cambia lo que hay disponible alrededor.

| Modo                | Situación                     | Cómo funciona                                                                                                                                                                                                                                                                    |
| ------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Conectado**       | Hay internet                  | Los móviles sincronizan con el servidor (VPS). LoRa, si está emparejada, actúa de respaldo.                                                                                                                                                                                      |
| **Malla**           | Solo LoRa                     | Cada móvil, emparejado con su radio MeshCore, habla con los demás de radio en radio. Sin servidor.                                                                                                                                                                               |
| **Puesto de mando** | Solo LoRa + un servidor local | Un portátil o una Raspberry Pi con wifi propio (y una radio conectada en su navegador) guarda el estado del incidente, da servicio por wifi a quien no tiene radio (también iPhone) y sincroniza con el VPS cuando vuelve internet ([ADR-0018](decisions/0018-command-post.md)). |

Una regla los une: **cualquier dispositivo que tenga a la vez radio e internet actúa de puente**, reenviando lo que llega por LoRa al servidor y al revés. No hace falta configurarlo.

## 7. Preparación previa: lo que cada persona debe hacer antes de la emergencia

Sin conexión no se puede instalar la app ni descargar mapas. Por eso la app guiará este procedimiento y lo marcará como completado:

1. Instalar la app desde el navegador (Chrome o Edge en Android y PC; Safari en iPhone, solo modo internet).
2. Unirse al grupo escaneando el código QR del coordinador.
3. Descargar el mapa de la zona de actuación.
4. Emparejar la radio MeshCore (firmware Companion BLE, v1.18 o superior) y comprobar que envía y recibe.

## 8. Límites técnicos que condicionan el diseño

| Límite                                                  | Valor                                                                    | Consecuencia                                                                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tamaño máximo de un mensaje de datos MeshCore por canal | 165 bytes                                                                | Protocolo binario compacto; Tesel sella cada mensaje de radio con 12 bytes propios, así que cada evento cabe en 153 bytes y los textos de chat en 139 (unos 140 caracteres sin acentos) |
| Ciclo de trabajo legal en 869,4–869,65 MHz (UE)         | 10 % del tiempo                                                          | Posiciones por LoRa cada pocos minutos, no cada segundo                                                                                                                                 |
| Bluetooth desde la web                                  | Solo Chrome y Edge (Android, Windows, macOS, Linux)                      | iPhone: solo modo internet o vía puesto de mando                                                                                                                                        |
| HTTPS obligatorio para instalar la app y usar Bluetooth | —                                                                        | El puesto de mando local necesita un certificado preparado de antemano                                                                                                                  |
| Mapas OpenStreetMap                                     | La política de uso de los servidores públicos prohíbe la descarga masiva | Servimos nuestros propios mapas vectoriales (PMTiles) desde el VPS                                                                                                                      |

## 9. Principios de calidad del código

Acordados para que el proyecto sea mantenible por cualquiera al liberarse (detalle en `CONTRIBUTING.md`):

1. Diseñar antes de programar: arquitectura, protocolo y decisiones documentadas.
2. Un reglamento único que siguen personas e IA, releído en cada sesión.
3. Comprobaciones automáticas: TypeScript estricto, formato, linter e integración continua.
4. Pruebas automáticas, sobre todo en protocolo y sincronización.
5. Refactorizar, no parchear.
6. Cambios pequeños, cada uno con su porqué.
7. Revisión independiente antes de cada versión y prueba de legibilidad antes de liberar.
8. Tecnología conocida a propósito.

## 10. Planning

Una semana de desarrollo más uno o dos días de margen, aceptados para no recortar las reglas de calidad.

| Día | Entrega                                                                                                                                         | Prueba de Pau                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 0   | Briefing, reglamento, arquitectura, especificación del protocolo, decisiones, esqueleto del repositorio y codificador del protocolo con pruebas | Revisar el briefing                          |
| 1   | App instalable, mapa, descarga de zona sin conexión, español e inglés                                                                           | Instalarla en Android y PC                   |
| 2   | Identidad local, grupos con roles, unión por código QR                                                                                          | Crear un grupo y unir otro móvil             |
| 3   | Servidor en el VPS: posiciones y chat por internet, cifrados                                                                                    | Dos móviles viéndose en el mapa              |
| 4   | Marcadores, zonas, SOS, alertas, privacidad de la posición                                                                                      | Simular un incidente                         |
| 5   | MeshCore: posiciones, chat y SOS por LoRa                                                                                                       | Probar con sus radios, sin datos móviles     |
| 6   | Modo puesto de mando y sincronización al volver internet                                                                                        | Portátil o Raspberry Pi como puesto de mando |
| 7   | Limpieza, revisión independiente, guía de preparación y publicación de la v0.1                                                                  | Prueba de campo con 2–3 personas             |
| 8–9 | Margen                                                                                                                                          | —                                            |

El día 5 es el de más riesgo: la integración con la radio solo se valida con equipos reales.

## 11. Lo que necesito de Pau

- [x] Repositorio en GitHub conectado a la sesión con permiso de escritura (`guaschpau-design/Tesel`), con publicación automática en `https://tesel.eu`.
- [x] VPS europeo (IONOS, plan M, Debian 13, centro de datos en España) y dominio `tesel.eu`; servidor en marcha en `https://tesel.eu`. El dominio anterior, `teselia.eu`, redirige a `tesel.eu`: conviene mantenerlo registrado al menos un año.
- [ ] Modelos de las radios MeshCore y Meshtastic disponibles; radios MeshCore con firmware Companion BLE v1.18 o superior.
- [ ] Unos 30 minutos diarios de pruebas con un Android con Chrome, un PC y, si es posible, un iPhone.
- [x] Mapa propio en el VPS (España, Portugal y las islas).
- [ ] Cambio de nombre a Tesel en el VPS: ejecutar una vez el comando de instalación. Pasa el servidor a `tesel.eu`, conserva el mapa y hace que `teselia.eu` redirija ([ADR-0019](decisions/0019-name-tesel.md)):

  ```sh
  ssh -t root@31.70.148.92 "curl -fsSL https://raw.githubusercontent.com/guaschpau-design/Tesel/main/deploy/vps/install.sh | bash -s -- --domain tesel.eu --redirect-from teselia.eu"
  ```

- [ ] Hacer pública la imagen del servidor con el nombre nuevo, si GitHub la crea privada: github.com/guaschpau-design → Packages → `tesel-server` → Package settings → Change visibility → Public.
- [ ] Búsqueda de la marca TESEL en EUIPO (TMview), clases 9 y 42.

- [x] Cuando CI haya publicado la primera imagen firmada, ejecutar otra vez en el VPS el comando de instalación de arriba (sin `--redirect-from`, que se conserva): solo arranca imágenes firmadas por CI, vuelve sola a la versión anterior si la nueva no arranca, hace copias de seguridad cada noche y envía las cabeceras de seguridad ([ADR-0049](decisions/0049-signed-images-and-checked-updates.md)).
- [ ] Día 7: dos o tres personas con radio para la [prueba de campo](prueba-de-campo.md).

## 12. Cuestiones abiertas

| Cuestión                                                                                                           | Cuándo se decide                                                                       |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Registro de un identificador de aplicación (`data_type`) en MeshCore; mientras tanto usamos el rango de desarrollo | Al tener la v0.1 funcionando (MeshCore exige demostrar el proyecto antes de asignarlo) |
| Fuente de mapas satélite para toda Europa con licencia libre                                                       | Al abordar mapas satélite                                                              |
