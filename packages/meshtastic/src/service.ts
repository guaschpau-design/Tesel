// The Bluetooth service of a Meshtastic radio and its characteristics, as Meshtastic documents
// them for client apps. The package's light entry, `@tesel/meshtastic/service`, which the app loads
// at start to list Meshtastic radios in the picker (ADR-0053, ADR-0098).

export const MESHTASTIC_SERVICE = '6ba1b218-15a8-461f-9fa8-5dcae273eafd';

/** Written with one `ToRadio` message at a time. */
export const TO_RADIO = 'f75c76d2-129e-4dad-a1dd-7866124401e7';
/** Read one `FromRadio` message at a time, until it reads empty. */
export const FROM_RADIO = '2c55e69e-4993-11ed-b878-0242ac120002';
/** Notifies when the radio has more to read. */
export const FROM_NUM = 'ed9da18c-a800-4f66-a670-aa7547e34453';
