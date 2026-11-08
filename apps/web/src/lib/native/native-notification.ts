// The browser's Notification, as the alarm uses it (incidents/alarm.ts), over Android's
// notifications (ADR-0125): an Android web view has none. A notification sounds and vibrates as an
// alarm, and shows only while the app is not on screen, which the app knows better than its page.

import type { NoticePermission, TeselDevicePlugin } from './tesel-device.ts';

type Device = Pick<TeselDevicePlugin, 'noticePermission' | 'requestNotices' | 'alarm'>;

/**
 * A Notification class over the plugin. Its permission is read once, before the app starts, as
 * the browser's is there at once; asking for it updates it.
 */
export async function nativeNotification(device: Device): Promise<typeof Notification> {
  let permission: NoticePermission = (await device.noticePermission()).state;

  class NativeNotification {
    readonly title: string;
    readonly body: string;
    readonly tag: string;

    static get permission(): NoticePermission {
      return permission;
    }

    static async requestPermission(): Promise<NoticePermission> {
      permission = (await device.requestNotices()).state;
      return permission;
    }

    constructor(title: string, options: NotificationOptions = {}) {
      this.title = title;
      this.body = options.body ?? '';
      this.tag = options.tag ?? title;
      device.alarm({ title, body: this.body, tag: this.tag }).catch((reason: unknown) => {
        console.warn('A notification could not be shown', reason);
      });
    }
  }

  return NativeNotification as unknown as typeof Notification;
}
