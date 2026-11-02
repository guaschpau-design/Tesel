import type { NodeId, SosCancelEvent, SosEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { createGroup } from '../groups/group.ts';
import { AlarmedSos } from './alarmed-sos.ts';
import { callToAlarm } from './sos-elsewhere.svelte.ts';

const ME = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
const group = createGroup('Rescate', null, 1);
const sos = (origin: NodeId, seq: number): SosEvent => ({
  type: 'sos',
  origin,
  seq,
  time: 1,
  kind: 'trapped',
  lat: 39.47,
  lon: -0.38,
  accuracy: null,
  text: 'Portal 3',
});

describe('the alarm for an SOS heard for a group not open', () => {
  it('sounds once for each call of someone else in a group of this device', () => {
    const alarmed = new AlarmedSos();
    const heard = { groupId: group.id, event: sos(BERTA, 7) };
    expect(callToAlarm(heard, [group], ME, alarmed)).toEqual({ group, event: heard.event });
    expect(callToAlarm(heard, [group], ME, alarmed)).toBeNull();
    // Opening the group then finds the call already sounded.
    expect(alarmed.claim(group.id, [`${BERTA}:7`])).toEqual([]);
  });

  it('stays silent for this device’s own call, and for a group it is not in', () => {
    const alarmed = new AlarmedSos();
    expect(callToAlarm({ groupId: group.id, event: sos(ME, 2) }, [group], ME, alarmed)).toBeNull();
    expect(callToAlarm({ groupId: 'otro', event: sos(BERTA, 3) }, [group], ME, alarmed)).toBeNull();
  });

  it('stays silent for a call whose cancellation was heard first', () => {
    const alarmed = new AlarmedSos();
    const cancel: SosCancelEvent = {
      type: 'sos-cancel',
      origin: BERTA,
      seq: 9,
      time: 2,
      sos: { origin: BERTA, seq: 8 },
    };
    expect(callToAlarm({ groupId: group.id, event: cancel }, [group], ME, alarmed)).toBeNull();
    expect(
      callToAlarm({ groupId: group.id, event: sos(BERTA, 8) }, [group], ME, alarmed),
    ).toBeNull();
  });
});
