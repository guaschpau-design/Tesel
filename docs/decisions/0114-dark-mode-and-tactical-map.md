# 0114. Dark mode, chosen in Settings, and the tactical map

- Status: Accepted
- Date: 2026-11-04

## Context

The app turned dark only when the phone was in dark mode, and nothing in the app said so or let it be chosen. At night, in a command post or in a vehicle, a team wants the app dark whatever the phone does. In dark mode the street map was Protomaps' dark style, with roads in several greys and browns and green parks that compete with what the team marks.

## Decision

- **A "Dark mode" switch in Settings**, with an (i) that says what it does. It is remembered on this device (preference `theme`). Until it is touched, the app follows the phone's mode, as before; once touched, it stays light or dark whatever the phone does.
- **The look in use is written on the page** as `data-theme` on the root element (`ui/appearance.svelte.ts`). app.css defines the dark colours once, under `:root[data-theme='dark']`, instead of a media query. Reading the look in use updates the page first, so the map's style, which reads app.css's colours, always gets those of the look it is drawn for.
- **In dark mode the street map is the tactical map.** The land is graphite like the app's dark surfaces. Roads are greys that grow lighter with their rank, with no colour of their own, and water and green areas are barely tinted. What the team marks (members, zones, SOS calls, tasks) is all that has colour on it. The layers panel names it "Tactical" and draws it so; the street map is still the default base map, so dark mode shows the tactical map unless another base map was chosen. The topographic map and the satellite keep their dark versions.

## Consequences

- One switch; no third "automatic" choice to explain. Going back to following the phone needs no setting: the starting point is it.
- Before the preferences are read, for a fraction of a second at start, the phone's mode is shown; a person who chose otherwise may see it change once.
- A new colour that differs in dark is added to the `:root[data-theme='dark']` block of app.css, which the palette test checks for contrast.
