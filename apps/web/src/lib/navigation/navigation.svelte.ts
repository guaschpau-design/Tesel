// Where this device is being guided, if anywhere. One target at a time, set from any panel.

import { closePanel } from '../ui/panels.svelte.ts';
import type { Leg } from './leg.ts';
import type { NavigationTarget } from './target.ts';

export const navigation = $state({
  target: null as NavigationTarget | null,
  /** The way to go now, while guidance shows it; null otherwise. */
  leg: null as Leg | null,
});

export function navigateTo(target: NavigationTarget): void {
  navigation.target = target;
  closePanel();
}

export function stopNavigating(): void {
  navigation.target = null;
}
