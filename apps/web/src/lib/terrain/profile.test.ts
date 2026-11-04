import { describe, expect, it } from 'vitest';

import { levelStep, PROFILE_HEIGHT, profileDrawing } from './profile.ts';

describe('levelStep', () => {
  it('picks a round step that gives two to four levels', () => {
    expect(levelStep(20)).toBe(10);
    expect(levelStep(45)).toBe(20);
    expect(levelStep(130)).toBe(50);
    expect(levelStep(900)).toBe(500);
  });
});

describe('profileDrawing', () => {
  it('draws the ground between round levels below and above it', () => {
    const drawing = profileDrawing([102, 140, 188, 160], 1500);
    expect(drawing.levels.map((level) => level.metres)).toEqual([100, 150, 200]);
    // Higher ground is drawn higher up, nearer the top.
    const ys = drawing.line.split(' L').map((point) => Number(point.split(' ')[1]));
    expect(ys[2]).toBeLessThan(ys[0] ?? 0);
    expect(drawing.levels[0]?.y).toBe(drawing.bottom);
    expect(drawing.bottom).toBeLessThan(PROFILE_HEIGHT);
  });

  it('does not blow ten metres of flat ground up to the whole height', () => {
    const drawing = profileDrawing([50, 52, 51], 400);
    const top = drawing.levels.at(-1)?.metres ?? 0;
    const bottom = drawing.levels[0]?.metres ?? 0;
    expect(top - bottom).toBeGreaterThanOrEqual(20);
  });

  it('says how much the heights are stretched against the distance', () => {
    // 100 m of height over 1 km: the plot's height stands for about 100 m, its width for 1 km.
    const drawing = profileDrawing([0, 100], 1000);
    expect(drawing.exaggeration).toBeGreaterThan(3);
    // Over 50 m, 100 m of height is drawn smaller than it is.
    expect(profileDrawing([0, 100], 50).exaggeration).toBeLessThan(1);
  });
});
