import { describe, expect, it } from 'vitest';

import { translator } from '../i18n/index.ts';
import { diaryDays } from './diary-days.ts';
import type { DiaryLine } from './diary.ts';

const t = translator('es');

function line(at: string, text: string): DiaryLine {
  return {
    key: text,
    type: 'chat',
    time: new Date(at).getTime() / 1000,
    author: 'Ana',
    text,
    at: null,
  };
}

describe('the diary by day', () => {
  it('names today and yesterday, dates the days before, and puts the newest first', () => {
    const now = new Date('2026-11-15T10:00').getTime();
    const days = diaryDays(
      [
        line('2026-11-13T22:00', 'antes'),
        line('2026-11-14T21:07', 'ayer'),
        line('2026-11-15T09:05', 'primera'),
        line('2026-11-15T09:21', 'última'),
      ],
      { t, locale: 'es', now },
    );
    expect(days.map((day) => day.name)).toEqual(['Hoy', 'Ayer', 'viernes, 13 de noviembre']);
    expect(days[0]?.lines.map((each) => each.text)).toEqual(['última', 'primera']);
  });

  it('has no day without lines', () => {
    expect(diaryDays([], { t, locale: 'es', now: Date.now() })).toEqual([]);
  });
});
