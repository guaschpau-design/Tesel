# Prueba de campo de la v0.1

Lista para probar Tesel en condiciones reales antes de publicar la v0.1. Las pruebas automáticas cubren el código; esto cubre lo que solo se ve con móviles, radios y distancia de verdad. Apunta en cada punto qué pasó (y una captura si algo falla) y pásamelo: lo convierto en correcciones.

## Antes de salir

- [ ] Radios preparadas con MeshCore Companion Bluetooth v1.18 o superior, todas con el mismo ajuste de radio (EU/UK Narrow, o Portugal 868), y cargadas ([`hardware.md`](hardware.md)). La app MeshCore, cerrada.
- [ ] En cada móvil: Tesel abierta desde `https://tesel.eu/app/`, añadida a la pantalla de inicio, con nombre elegido.
- [ ] Mapa de la zona de la prueba descargado en cada móvil («Más» → «Mapas sin conexión»).
- [ ] Un grupo creado por quien coordina y todos unidos con el QR.
- [ ] Quien coordina dibuja la zona del operativo; a cada uno le sale «Descargar» y la descarga termina.

## 1. Con internet (10 minutos)

- [ ] Todos ven a los demás en el mapa al compartir la posición; al pausarla se queda la última; al ocultarla desaparece.
- [ ] El chat llega en ambos sentidos en pocos segundos.
- [ ] Un marcador y una zona dibujados por una persona los ven todas; los puede borrar otra.
- [ ] Un SOS llega a todos; «Recibido» le llega a quien lo envió; quien lo envió lo cancela.
- [ ] Una alerta crítica de quien coordina se queda en pantalla hasta confirmarla.
- [ ] Quien coordina pasa lista: a cada uno le sale «¿Estáis todos bien?», responde «Estoy bien» y quien pasó lista ve quién falta.
- [ ] Una tarea con sitio para otra persona: le avisa, el botón «Tareas» lo cuenta y, al darla por hecha, quien la creó lo ve.
- [ ] iPhone: todo lo anterior funciona igual en Safari.

## 2. Sin internet, con radios (30 minutos)

Todos con datos móviles y wifi desactivados, Bluetooth encendido, radio conectada desde la palabra de conexión de arriba → «Conectar radio» (arriba debe poner «Por radio»).

- [ ] La primera vez, el sistema pide el PIN de la radio (123456 si no se ha cambiado). Si no lo pide, Tesel lo dice en pocos segundos y muestra cómo emparejarla: apunta qué dispositivo y qué navegador.
- [ ] Al conectar, el panel muestra el nombre de la radio y el canal del grupo. La app de MeshCore muestra un canal nuevo con el nombre del grupo, sin haber tocado los otros.
- [ ] El chat llega por radio. Apunta cuánto tarda.
- [ ] Las posiciones se actualizan por radio (cada pocos minutos, no al momento).
- [ ] Una tarea y su cambio a «Hecha» llegan por radio.
- [ ] Un pase de lista llega por radio y las respuestas de todos vuelven, aunque varias salgan a la vez.
- [ ] Un SOS llega por radio; se repite hasta que alguien pulsa «Recibido»; la cancelación también llega.
- [ ] El tiempo de emisión de la última hora (panel «Conexiones») se queda por debajo del 100 %.
- [ ] Alcance: separaos poco a poco y apunta la distancia a la que dejan de llegar los mensajes, en ciudad y, si podéis, desde un sitio alto.
- [ ] Una persona con radio y con datos móviles hace de puente: lo que escribe alguien solo por radio llega a otra persona que solo tiene internet, y al revés.
- [ ] Si alguien usa la app de MeshCore cerca, sus mensajes aparecen en la pestaña «MeshCore» del chat.

## 3. iPhone con radio (opcional, 10 minutos)

- [ ] En el navegador Bluefy, abrir `https://tesel.eu/app/` y conectar una radio. Apunta si conecta y si envía y recibe.

## Qué apuntar

- Qué no se entendió a la primera, con las palabras de quien lo probó.
- Distancias, tiempos de llegada y batería de móviles y radios al final.
- Cualquier error, con captura y la hora aproximada.
