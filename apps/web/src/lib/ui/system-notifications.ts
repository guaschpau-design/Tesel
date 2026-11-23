// The notifications of the phone or the computer, which bring the app back with a tap, shown
// while the app is not on screen and the user has allowed them in More. An SOS's stays until it is
// tapped and, in the Android app, sounds as an alarm (incidents/alarm.ts); what whoever
// coordinates is told (groups/GroupNews.svelte) shows as any other notification (ADR-0166).

export interface SystemNotice {
  readonly title: string;
  readonly body: string;
  /** Notifications with the same tag replace each other instead of piling up. */
  readonly tag: string;
}

/**
 * Whether system notifications can be shown here at all: looked at when asked, as the Android app
 * supplies them before the app starts (lib/native).
 */
export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Asks the user to allow notifications; true if they are allowed. Call it from a tap. */
export async function allowNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

/**
 * Shows a notification if the app is not on screen, where its own notice says it already. An
 * urgent one stays until the user taps it, and the Android app sounds it as an alarm.
 */
export async function notifyAway(notice: SystemNotice, urgent: boolean): Promise<void> {
  if (document.visibilityState !== 'hidden') return;
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const { title, body, tag } = notice;
  const options: NotificationOptions = { body, tag, requireInteraction: urgent };
  // Through the service worker where there is one: the only way on Android.
  // (Missing outside a secure context, whatever the types say.)
  const registration =
    'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (registration) await registration.showNotification(title, options);
  else new Notification(title, options);
}
