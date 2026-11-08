import { describe, expect, it } from 'vitest';

import { distanceMeters } from '@tesel/core';
import { ReportPolicy } from './report-policy.ts';

const VALENCIA = { lat: 39.4699, lon: -0.3763 };
const NEARBY = { lat: 39.47, lon: -0.3763 }; // about 11 m north
const FURTHER = { lat: 39.4704, lon: -0.3763 }; // about 55 m north

const place = (lat: number) => ({ at: { lat, lon: -0.3763 }, accuracy: 4 });

/** A policy that has published `first` at 1000 s. */
function published(first: { at: typeof VALENCIA; accuracy: number }): ReportPolicy {
  const policy = new ReportPolicy();
  policy.next(first, 1000);
  return policy;
}

describe('position reports', () => {
  it('measures distances on the Earth', () => {
    expect(distanceMeters(VALENCIA, { lat: 40.4168, lon: -3.7038 })).toBeCloseTo(302_000, -4);
    expect(distanceMeters(VALENCIA, NEARBY)).toBeCloseTo(11, 0);
  });

  it('reports the first fix at once', () => {
    expect(new ReportPolicy().next({ at: VALENCIA, accuracy: 40 }, 1000)).toBe('fix');
  });

  it('reports a move once the next fix goes on the same way, and not more than every 5 s', () => {
    const policy = published({ at: VALENCIA, accuracy: 4 });
    expect(policy.next(place(39.4701), 1002)).toBeNull();
    expect(policy.next(place(39.4703), 1004)).toBeNull();
    expect(policy.next(place(39.4705), 1006)).toBe('fix');
    expect(policy.last?.at.lat).toBe(39.4705);
  });

  it('reports a move every 5 s at most, on foot every 15 s', () => {
    /** When a device going north at `speed` m/s is first published after the start. */
    const firstMove = (speed: number) => {
      const policy = published({ at: VALENCIA, accuracy: 4 });
      for (let seconds = 1; seconds <= 30; seconds++) {
        const lat = 39.4699 + (seconds * speed) / 111_000;
        if (policy.next(place(lat), 1000 + seconds) === 'fix') return seconds;
      }
      return null;
    };
    // Running or in a vehicle, as soon as the move is borne out, ten metres on.
    expect(firstMove(4)).toBe(6);
    // Briskly on foot, the move is as sure as soon, and waits.
    expect(firstMove(2.2)).toBe(15);
  });

  it('takes a jump within the two fixes’ uncertainty for the GPS wandering, not a move', () => {
    const policy = published({ at: VALENCIA, accuracy: 25 });
    expect(policy.next({ at: NEARBY, accuracy: 25 }, 1010)).toBeNull();
    expect(policy.next({ at: NEARBY, accuracy: 25 }, 1020)).toBeNull();
  });

  it('takes jumps away that come back for the GPS wandering, however sure they claim to be', () => {
    const policy = published({ at: VALENCIA, accuracy: 10 });
    for (let time = 1010; time < 1060; time += 10) {
      const lat = time % 20 === 0 ? 39.4699 : 39.4704;
      expect(policy.next({ at: { lat, lon: -0.3763 }, accuracy: 10 }, time)).toBeNull();
    }
    expect(policy.next({ at: FURTHER, accuracy: 10 }, 1060)).toBe('again');
    expect(policy.last?.at).toEqual(VALENCIA);
  });

  it('reports a move that stays away a minute', () => {
    const policy = published({ at: VALENCIA, accuracy: 10 });
    expect(policy.next({ at: FURTHER, accuracy: 10 }, 1010)).toBeNull();
    expect(policy.next({ at: FURTHER, accuracy: 10 }, 1040)).toBeNull();
    expect(policy.next({ at: FURTHER, accuracy: 10 }, 1070)).toBe('fix');
  });

  it('reports a much sharper fix of the same place: the GPS has settled', () => {
    const policy = published({ at: VALENCIA, accuracy: 40 });
    expect(policy.next({ at: NEARBY, accuracy: 30 }, 1010)).toBeNull();
    expect(policy.next({ at: NEARBY, accuracy: 20 }, 1011)).toBe('fix');
  });

  it('while standing still, publishes the same place again every minute', () => {
    const policy = published({ at: VALENCIA, accuracy: 25 });
    expect(policy.next({ at: NEARBY, accuracy: 25 }, 1059)).toBeNull();
    expect(policy.next({ at: NEARBY, accuracy: 25 }, 1060)).toBe('again');
    expect(policy.last).toEqual({ at: VALENCIA, accuracy: 25, time: 1060 });
  });
});
