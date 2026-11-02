// Plays a scenario on a group: one simulated device per member, each event sent when its moment
// comes, or everything at once for a short scenario that should already have happened.

import { deriveGroupKeys } from '@tesel/protocol';
import { plan, ScenarioPerformer, type Scenario } from '@tesel/scenario';

import { SimulatedDevice } from './device.ts';

export interface PlayOptions {
  /** Base URL of the group's server. */
  readonly server: string;
  /** The group's secret, as its invitation carries it. */
  readonly secret: Uint8Array;
  /**
   * How many times faster than real time. `Infinity` sends everything at once, dated as if it had
   * happened over the scenario's duration until now; the relay's limits (protocol §8) make that
   * practical for scenarios of a few hundred events.
   */
  readonly speed: number;
  /** Seconds between position reports of each member. */
  readonly positionEvery: number;
  readonly log?: (line: string) => void;
}

export async function play(scenario: Scenario, options: PlayOptions): Promise<void> {
  const events = plan(scenario, { positionEvery: options.positionEvery });
  const keys = deriveGroupKeys(options.secret);
  const devices = new Map<string, SimulatedDevice>();
  try {
    // Inside the `try`: devices connected before one that fails are closed too.
    for (const member of scenario.members) {
      devices.set(member.alias, await SimulatedDevice.connect(options.server, keys));
    }
    const cast = new Map([...devices].map(([alias, device]) => [alias, device.nodeId]));
    const performer = new ScenarioPerformer(cast);
    const instant = !Number.isFinite(options.speed);
    const startMs = Date.now();
    const startTime = Math.floor(startMs / 1000) - (instant ? scenario.duration : 0);
    for (const event of events) {
      if (!instant) await waitUntil(startMs + (event.at * 1000) / options.speed);
      const device = devices.get(event.by);
      if (device === undefined) throw new Error(`no device for ${event.by}`);
      const time = instant ? startTime + event.at : Math.floor(Date.now() / 1000);
      const actor = { alias: event.by, publicKey: device.identity.publicKey };
      await performer.perform(event, actor, (draft) => device.publish(draft, time));
      if (event.action.type !== 'position') options.log?.(`${event.by}: ${event.action.type}`);
    }
  } finally {
    for (const device of devices.values()) device.close();
  }
}

function waitUntil(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms - Date.now())));
}
