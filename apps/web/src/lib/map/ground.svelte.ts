// Whether the ground is raised in 3D (ADR-0102, ADR-0106): off whenever the app opens, since it
// costs the phone more battery and warmth, and turned off again when the screen rests
// (power/activity). How it is seen: leaning far back, and raised more from afar than up close.

/** How far the view leans back to show the raised ground, in degrees from straight down. */
export const GROUND_PITCH = 75;
/** How far two fingers may lean it while raised: nearly eye level. Flat, MapLibre's own 60°. */
export const GROUND_MAX_PITCH = 80;

/** Raised twice its height across a district, so gentle hills show; nearer its own up close. */
const FAR = { zoom: 9, exaggeration: 2 };
const NEAR = { zoom: 15, exaggeration: 1.3 };

/** How many times its height the ground is raised at `zoom`. */
export function groundExaggeration(zoom: number): number {
  const along = Math.min(1, Math.max(0, (zoom - FAR.zoom) / (NEAR.zoom - FAR.zoom)));
  return FAR.exaggeration + (NEAR.exaggeration - FAR.exaggeration) * along;
}

class Ground {
  /** The ground raised in 3D, the map leaning back to show it. */
  raised = $state(false);
}

export const ground = new Ground();
