<!-- Draws the other members of the group on the map, and reports taps on them. This device is
     drawn by SelfLayer. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';
  import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { clockEvery } from '../ui/now.svelte.ts';
  import { themeColor, toneExpression } from '../ui/theme.ts';
  import {
    addApp6DirectionImage,
    addApp6MemberImages,
    APP6_DIRECTION_IMAGE,
    type MilitaryLook,
  } from '../objects/app6-images.ts';
  import { memberFeatures } from './member-features.ts';
  import { nameLabel } from '../map/name-label.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { textProperty, type MapTaps } from '../map/taps.ts';

  interface Props {
    map: MapLibreMap;
    taps: MapTaps;
    positions: GroupState['positions'];
    members: GroupState['members'];
    memberStates: GroupState['memberStates'];
    teams: GroupState['teams'];
    sos: GroupState['sos'];
    sosCancels: GroupState['sosCancels'];
    self: NodeId;
    visible: boolean;
    /** On the tactical map, each member in their APP-6 symbol (ADR-0146). */
    military: MilitaryLook | null;
    onselect: (id: NodeId) => void;
  }

  let {
    map,
    taps,
    positions,
    members,
    memberStates,
    teams,
    sos,
    sosCancels,
    self,
    visible,
    military,
    onselect,
  }: Props = $props();

  const SOURCE = 'tesel-members';
  /** Stale markers are re-evaluated this often even when no event arrives. */
  const REFRESH_MS = 30_000;
  const now = clockEvery(REFRESH_MS);
  const data = $derived(
    memberFeatures(
      { positions, members, memberStates, teams, sos, sosCancels },
      self,
      now.seconds,
      military,
    ),
  );

  useOverlay(() => map, {
    level: 'members',
    data: { [SOURCE]: () => data },
    visible: () => visible,
    prepare: () => {
      if (military === null) return;
      addApp6MemberImages(map, military.locale);
      addApp6DirectionImage(map);
    },
    layers: () => {
      const halo = themeColor('map-halo');
      // Each member in their team's colour, or the members' own without a team.
      const colour = toneExpression(themeColor('member'));
      // A member calling for help is always named, and placed first (its layer is above), so the
      // others make room.
      const label = (calling: boolean) =>
        nameLabel({
          id: `${SOURCE}-label${calling ? '-sos' : ''}`,
          source: SOURCE,
          filter: ['==', ['get', 'sos'], calling],
          overlap: calling,
          opacity: ['case', ['get', 'stale'], 0.6, 1],
          distance: military === null ? 1.1 : 1.9,
        });
      // In APP-6 the symbol is drawn over the dot, which stays, unseen, to be tapped.
      const symbols: LayerSpecification[] =
        military === null
          ? []
          : [
              // The way each is moving, under their symbol, turned with the map.
              {
                id: `${SOURCE}-direction`,
                type: 'symbol',
                source: SOURCE,
                filter: ['has', 'heading'],
                layout: {
                  'icon-image': APP6_DIRECTION_IMAGE,
                  'icon-rotate': ['get', 'heading'],
                  'icon-rotation-alignment': 'map',
                  'icon-allow-overlap': true,
                  'icon-ignore-placement': true,
                },
              },
              {
                id: `${SOURCE}-app6`,
                type: 'symbol',
                source: SOURCE,
                layout: { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true },
                paint: {
                  'icon-opacity': ['case', ['get', 'stale'], 0.4, ['get', 'away'], 0.6, 1],
                },
              },
            ];
      return [
        {
          id: `${SOURCE}-dot`,
          type: 'circle',
          source: SOURCE,
          paint: {
            'circle-radius': military === null ? 8 : 16,
            // Someone resting or off duty is a ring in the member's colour: there, but not now.
            'circle-color': ['case', ['get', 'away'], halo, colour],
            'circle-opacity': military === null ? ['case', ['get', 'stale'], 0.4, 1] : 0,
            'circle-stroke-width': ['case', ['get', 'away'], 3, 2],
            'circle-stroke-color': ['case', ['get', 'away'], colour, halo],
            'circle-stroke-opacity': military === null ? 1 : 0,
          },
        },
        ...symbols,
        label(false),
        label(true),
      ];
    },
  });

  onMount(() =>
    taps.onFeature([`${SOURCE}-dot`], (feature) => {
      const id = textProperty(feature, 'id');
      if (id !== null) onselect(id as NodeId);
    }),
  );
</script>
