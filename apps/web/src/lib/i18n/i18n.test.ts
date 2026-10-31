import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { en, type Plural } from './en.ts';
import { detectLocale, locales, nextLocale, resolveLocale, translator } from './index.ts';

describe('translations', () => {
  it('detects the browser language, defaulting to Spanish', () => {
    expect(detectLocale(['en-GB', 'es'])).toBe('en');
    expect(detectLocale(['fr-FR'])).toBe('es');
  });

  it('shows the language chosen, or else the browser’s', () => {
    expect(resolveLocale('auto', ['en-US'])).toBe('en');
    expect(resolveLocale('es', ['en-US'])).toBe('es');
  });

  it('switches to the next language, round the list', () => {
    expect(nextLocale('es')).toBe('en');
    expect(nextLocale('en')).toBe('es');
  });

  it('fills placeholders', () => {
    expect(translator('en')('downloading', { done: 3, total: 10 })).toBe('Downloading… 3 of 10');
  });

  it('writes numbers as each language does', () => {
    expect(translator('en')('downloading', { done: 1500, total: 12000 })).toBe(
      'Downloading… 1,500 of 12,000',
    );
    expect(translator('es')('downloading', { done: 1500, total: 12000 })).toBe(
      'Descargando… 1500 de 12.000',
    );
  });

  it('picks the plural form the count asks for', () => {
    const english = translator('en');
    expect(english('logLoaded', { count: 1, total: 4 })).toBe('Log loaded: 1 new event of 4.');
    expect(english('logLoaded', { count: 0, total: 4 })).toBe('Log loaded: 0 new events of 4.');
    const spanish = translator('es');
    expect(spanish('chatUnread', { count: 1 })).toBe('Chat: 1 nuevo');
    expect(spanish('chatUnread', { count: 2 })).toBe('Chat: 2 nuevos');
  });

  it('falls back to the "other" form for a category a text does not give', () => {
    // Spanish puts a million in "many".
    expect(translator('es')('drawPointsCount', { count: 1_000_000 })).toBe('1.000.000 puntos');
  });

  it('uses the same placeholders in every language and plural form', () => {
    const forms = (message: string | Plural) =>
      typeof message === 'string' ? [message] : Object.values(message);
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const [expected] = forms(en[key]).map(placeholders);
      for (const messages of Object.values(locales)) {
        for (const form of forms(messages[key])) expect(placeholders(form)).toEqual(expected);
      }
    }
  });
});

describe('texts in use', () => {
  it('has no text that nothing shows', async () => {
    const root = join(import.meta.dirname, '..', '..');
    const files = (await readdir(root, { recursive: true })).filter(
      (file) => /\.(ts|svelte)$/.test(file) && !file.includes('i18n'),
    );
    const sources = (
      await Promise.all(files.map((file) => readFile(join(root, file), 'utf8')))
    ).join('\n');
    const unused = Object.keys(en).filter((key) => !sources.includes(`'${key}'`));
    expect(unused).toEqual([]);
  });
});
