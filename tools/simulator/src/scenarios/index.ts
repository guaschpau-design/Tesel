import type { Scenario } from '@tesel/scenario';
import { turia, turiaInEnglish } from './turia.ts';

/** Scenarios by name, for the command line. */
export const SCENARIOS: ReadonlyMap<string, Scenario> = new Map([
  [turia.name, turia],
  [turiaInEnglish.name, turiaInEnglish],
]);
