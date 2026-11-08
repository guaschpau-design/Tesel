import { describe, expect, it, vi } from 'vitest';

import { nativeNotification } from './native-notification.ts';

describe("Android's notifications as the browser's", () => {
  it('knows its permission at once, asks for it, and shows a notification', async () => {
    const device = {
      noticePermission: vi.fn(() => Promise.resolve({ state: 'default' as const })),
      requestNotices: vi.fn(() => Promise.resolve({ state: 'granted' as const })),
      alarm: vi.fn(() => Promise.resolve()),
    };
    const Notice = await nativeNotification(device);
    expect(Notice.permission).toBe('default');
    expect(await Notice.requestPermission()).toBe('granted');
    expect(Notice.permission).toBe('granted');
    new Notice('SOS · Berta', { body: 'Médica', tag: 'g/1' });
    expect(device.alarm).toHaveBeenCalledWith({
      title: 'SOS · Berta',
      body: 'Médica',
      tag: 'g/1',
    });
  });
});
