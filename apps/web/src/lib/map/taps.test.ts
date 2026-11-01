import type { LatLon } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { FakeMap } from './fake-map.ts';
import { MapTaps, textProperty } from './taps.ts';

/** A map drawing tasks under members, and a dispatcher listening to it. */
function setUp(tappable = () => true): { map: FakeMap; taps: MapTaps; opened: string[] } {
  const map = new FakeMap();
  map.addLayer({ id: 'tasks' });
  map.addLayer({ id: 'members' });
  const taps = new MapTaps(tappable);
  taps.listen(map.map);
  const opened: string[] = [];
  return { map, taps, opened };
}

describe('taps on the map', () => {
  it('go to the owner of the feature drawn on top, whichever owner came first', () => {
    const { map, taps, opened } = setUp();
    taps.onFeature(['tasks'], (feature) => opened.push(`task ${textProperty(feature, 'key')}`));
    taps.onFeature(['members'], (feature) => opened.push(`member ${textProperty(feature, 'id')}`));
    map.drawn.set('tasks', { key: 't1' });
    map.drawn.set('members', { id: 'berta' });
    map.tap(39.47, -0.37);
    map.drawn.delete('members');
    map.tap(39.47, -0.37);
    expect(opened).toEqual(['member berta', 'task t1']);
  });

  it('go to the tool in use instead, and to features again once it is put away', () => {
    const { map, taps, opened } = setUp();
    taps.onFeature(['members'], () => opened.push('member'));
    map.drawn.set('members', { id: 'berta' });
    const points: LatLon[] = [];
    const putAway = taps.takeAll((at) => points.push(at));
    map.tap(39.47, -0.37);
    putAway();
    map.tap(39.47, -0.37);
    expect(points).toEqual([{ lat: 39.47, lon: -0.37 }]);
    expect(opened).toEqual(['member']);
  });

  it('go to the place where they land when they hit no feature', () => {
    const { map, taps, opened } = setUp();
    taps.onFeature(['members'], () => opened.push('member'));
    const places: LatLon[] = [];
    taps.onPlace((at) => places.push(at));
    map.tap(39.47, -0.37);
    map.drawn.set('members', { id: 'berta' });
    map.tap(39.48, -0.36);
    expect(places).toEqual([{ lat: 39.47, lon: -0.37 }]);
    expect(opened).toEqual(['member']);
  });

  it('open nothing while features are not to be opened', () => {
    let tappable = false;
    const { map, taps, opened } = setUp(() => tappable);
    taps.onFeature(['members'], () => opened.push('member'));
    map.drawn.set('members', { id: 'berta' });
    map.tap(39.47, -0.37);
    tappable = true;
    map.tap(39.47, -0.37);
    expect(opened).toEqual(['member']);
  });

  it('open nothing of a layer switched off, even before the map has drawn it away', () => {
    const { map, taps, opened } = setUp();
    taps.onFeature(['members'], () => opened.push('member'));
    taps.onFeature(['tasks'], () => opened.push('task'));
    map.drawn.set('members', { id: 'berta' });
    map.drawn.set('tasks', { key: 't1' });
    map.map.setLayoutProperty('members', 'visibility', 'none');
    map.tap(39.47, -0.37);
    expect(opened).toEqual(['task']);
  });
});
