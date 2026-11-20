# 0157. Daylight and the moon

- Status: Accepted
- Date: 2026-11-20

## Context

A team out on foot needs to know whether it gets there, and back, by daylight. One moving at night needs to know when the light goes, and how much the moon will give. Pau chose the light for the topographic map and the light and the moon for the tactical map.

## Decision

- **Worked out on the device, with no data** (`daylight/sky.ts`): the low-precision formulas of the astronomical almanacs, as Vladimir Agafonkin's SunCalc gathers them, good to a minute for the sun and a few minutes for the moon. Rising and setting are found by following the sun's and the moon's height through the day, which also gives no answer, rightly, in a polar day or night. Offline, as everything else.
- **«Alba» and «Noche»** are the nautical twilights, the sun 12° below the horizon: the moments the shapes of the ground can first and last be made out, as military planning uses them.
- **In a point's panel**, on the topographic and tactical maps (`daylight/WalkLight.svelte`): the next sunset with last light after it, or by night the sunrise. With the time on foot known (ADR-0156), a warning in amber when arriving with less than 30 minutes of light («la vuelta sería de noche»), in red when arriving in the dark.
- **On the tactical map**, a line in the margin under the declination, for the centre of the map: the next sunset or sunrise, and how much of the moon is lit. Tapped, it opens «Luz de hoy»: first light, sunrise, sunset, last light, and the moon, lit, waxing or waning, and when it rises and sets.

## Consequences

- Planning a walk or a night move needs no other app, and works with no connection.
- The times are for the open horizon: a deep valley loses the sun earlier.
