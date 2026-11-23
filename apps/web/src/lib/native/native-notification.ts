// The browser's Notification, as the app uses it (ui/system-notifications.ts), over Android's
// notifications (ADR-0125): an Android web view has none. One that must stay until tapped
// (`requireInteraction`), an SOS's, sounds and vibrates as an alarm; any other shows as another
// app's would (ADR-0166). Either shows only while the app is not on screen, which the app knows
// better than its page.

import type { NoticePermission, TeselDevicePlugin } from './tesel-device.ts';

type Device = Pick<TeselDevicePlugin, 'noticePermission' | 'requestNotices' | 'alarm' | 'notice'>;

/**
 * A Notification class over the plugin. Its permission is read once, before the app starts, as
 * the browser's is there at once; asking for it updates it.
 */
export async function nativeNotification(device: Device): Promise<typeof Notification> {
  // Unknown if Android could not say: asked again when the alarm asks for it.
  let permission: NoticePermission = await device.noticePermission().then(
    ({ state }) => state,
    (): NoticePermission => 'default',
  );

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
      const shown = { title, body: this.body, tag: this.tag };
      const showing =
        options.requireInteraction === true ? device.alarm(shown) : device.notice(shown);
      showing.catch((reason: unknown) => {
        console.warn('A notification could not be shown', reason);
      });
    }
  }

  return NativeNotification as unknown as typeof Notification;
}
