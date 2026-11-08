// The Android app's own native plugin (apps/mobile, TeselDevicePlugin.java, ADR-0125): the
// location from Android, keeping the app running with the screen off, and system notifications.

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/** A fix as Android gives it: degrees, metres, degrees from north, metres a second, milliseconds. */
export interface NativeFix {
  readonly lat: number;
  readonly lon: number;
  readonly accuracy: number | null;
  readonly heading: number | null;
  readonly speed: number | null;
  readonly time: number;
}

/** Why there is no fix: the location is not allowed, or Android has none to give. */
export interface NativeFixProblem {
  readonly problem: 'denied' | 'unavailable';
}

export type NoticePermission = 'granted' | 'denied' | 'default';

export interface TeselDevicePlugin {
  /** Starts the location, asking for it first if need be; fixes come as "fix" events. */
  watchLocation(): Promise<void>;
  /** Stops the location. */
  clearLocation(): Promise<void>;
  /**
   * Keeps the app running with the screen off, with Android's ongoing notification saying why,
   * or lets it stop as any app.
   */
  keepRunning(options: {
    readonly on: boolean;
    readonly title: string;
    readonly text: string;
  }): Promise<void>;
  /** Whether the app may show notifications. */
  noticePermission(): Promise<{ readonly state: NoticePermission }>;
  /** Asks to show notifications, where Android asks (13 and later). */
  requestNotices(): Promise<{ readonly state: NoticePermission }>;
  /** A notification that must be noticed, with sound and vibration, unless the app is on screen. */
  alarm(options: {
    readonly title: string;
    readonly body: string;
    readonly tag: string;
  }): Promise<void>;
  addListener(event: 'fix', listener: (fix: NativeFix) => void): Promise<PluginListenerHandle>;
  addListener(
    event: 'fixProblem',
    listener: (problem: NativeFixProblem) => void,
  ): Promise<PluginListenerHandle>;
}

export const teselDevice = registerPlugin<TeselDevicePlugin>('TeselDevice');
