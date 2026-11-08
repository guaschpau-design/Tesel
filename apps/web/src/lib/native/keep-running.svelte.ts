// Keeps the Android app running with the screen off while it has something to do there
// (ADR-0125): sharing the position, which uses the location, or a radio linked. Android shows its
// ongoing notification meanwhile, saying which. Otherwise the app stops in the background as a web
// page does, and catches up when it comes back.

import type { Translate } from '../i18n/index.ts';
import type { TeselDevicePlugin } from './tesel-device.ts';

type Device = Pick<TeselDevicePlugin, 'keepRunning'>;

/** What the app is doing that needs it running. */
export interface Running {
  /** Something uses the location (sharing the position, guiding, a danger area). */
  readonly located: boolean;
  /** A radio is linked. */
  readonly linked: boolean;
}

/** What Android's ongoing notification says, or null to let the app stop. */
export function runningNotice(
  running: Running,
  t: Translate,
): { readonly title: string; readonly text: string } | null {
  if (!running.located && !running.linked) return null;
  const doing = [
    ...(running.located ? [t('runningLocation')] : []),
    ...(running.linked ? [t('runningRadio')] : []),
  ];
  return { title: t('runningTitle'), text: doing.join(' · ') };
}

/** Follows what the app is doing, `running` read reactively, for as long as the app lives. */
export function keepRunningWhile(device: Device, running: () => Running, t: () => Translate): void {
  let last = '';
  $effect.root(() => {
    $effect(() => {
      const notice = runningNotice(running(), t());
      const key = JSON.stringify(notice);
      if (key === last) return;
      last = key;
      const options =
        notice === null ? { on: false, title: '', text: '' } : { on: true, ...notice };
      device.keepRunning(options).catch((reason: unknown) => {
        console.warn('Keeping the app running failed', reason);
      });
    });
  });
}
