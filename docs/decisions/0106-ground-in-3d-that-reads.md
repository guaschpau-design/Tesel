# 0106. A ground in 3D that reads as raised

- Status: Accepted
- Date: 2026-11-03

## Context

The ground raised in 3D ([ADR-0102](0102-ground-in-3d.md)) looked hardly raised. Without the relief layer, which is off by default, slopes had no shadows, and raised ground of one colour reads as flat. The view leaned back only 60°, MapLibre's limit, and ended at a hard edge with nothing above it. The 1.5 exaggeration was too little from afar and too much up close.

## Decision

- **Shadows.** Raised ground is always shaded, whether or not the relief layer is on, more deeply than on a flat map. It is lit from the north-west of the land rather than of the screen, so shadows stay on the slopes that cast them as the view turns.
- **Leaning back.** Raising the ground leans the view 75°, and two fingers may lean it to 80°, near eye level. Laid flat, MapLibre's own 60° limit comes back.
- **A sky.** Over raised ground there is a sky, light or dark with the theme, and a haze that thickens towards the horizon, so far ridges read as far.
- **Height with the zoom.** The ground is raised twice its height across a district (zoom 9 and out) and 1.3 times close up (zoom 15 and in), changing smoothly between them. The style names only the source; the map sets the height as the zoom changes and after each new style.

## Consequences

- Raised ground costs a little more drawing, for the shading and the sky; it is still off when the app opens and laid flat when the screen rests.
- Leaning past 60° is marked experimental in MapLibre; if a phone draws it badly, the limit is one number (`GROUND_MAX_PITCH`).
- The relief layer's switch still says off while raised ground is shaded: the shading belongs to the 3D view, not to the layer.
