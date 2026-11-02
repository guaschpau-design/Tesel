// The Bluetooth service a MeshCore companion radio offers: the package's light entry,
// `@tesel/meshcore/service`, which the app loads at start to list MeshCore radios in the picker
// (ADR-0053, ADR-0098). It is the Nordic UART service MeshCore's SerialBLEInterface uses.

export const MESHCORE_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
