import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { notices } from './notices.svelte.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  for (const notice of notices.list) notices.withdraw(notice.id);
  vi.useRealTimers();
});

describe('notices', () => {
  it('lets a passing notice go after a few seconds', () => {
    notices.show('Guardado');
    expect(notices.list.map((notice) => notice.text)).toEqual(['Guardado']);
    vi.advanceTimersByTime(5000);
    expect(notices.list).toEqual([]);
  });

  it('keeps a notice that stays until it is withdrawn', () => {
    const run = vi.fn();
    const id = notices.show('Hay una versión nueva', {
      stays: true,
      action: { label: 'Actualizar', run },
    });
    vi.advanceTimersByTime(60_000);
    expect(notices.list).toEqual([
      { id, text: 'Hay una versión nueva', action: { label: 'Actualizar', run }, stays: true },
    ]);
    notices.withdraw(id);
    expect(notices.list).toEqual([]);
  });

  it('shows the same passing notice once, for longer', () => {
    notices.show('Enviado');
    vi.advanceTimersByTime(4000);
    notices.show('Enviado');
    expect(notices.list.map((notice) => notice.text)).toEqual(['Enviado']);
    vi.advanceTimersByTime(4000);
    expect(notices.list).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(notices.list).toEqual([]);
  });

  it('shows notices in the order they came', () => {
    notices.show('Primero');
    notices.show('Segundo', { stays: true });
    expect(notices.list.map((notice) => notice.text)).toEqual(['Primero', 'Segundo']);
  });
});
