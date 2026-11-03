// The kinds of LoRa radio Tesel speaks, and making the link to the one the user picks (ADR-0098).
// The picker lists radios of every kind; the radio's Bluetooth service says which it is, and only
// that kind's code is loaded, then (ADR-0053).

import { MESHCORE_SERVICE } from '@tesel/meshcore/service';
import { MESHTASTIC_SERVICE } from '@tesel/meshtastic/service';
import { pickRadio, type RadioLink } from '@tesel/radio';

/** Asks the user to pick a radio of any kind, and makes the link for the kind it is. */
export async function pickedRadioLink(): Promise<RadioLink> {
  const { hold, service } = await pickRadio([MESHCORE_SERVICE, MESHTASTIC_SERVICE]);
  switch (service) {
    case MESHCORE_SERVICE:
      return (await import('@tesel/meshcore')).linkTo(hold);
    case MESHTASTIC_SERVICE:
      return (await import('@tesel/meshtastic')).linkTo(hold);
  }
}
