// Whether the ground is raised in 3D (ADR-0102): off whenever the app opens, since it costs the
// phone more battery and warmth, and turned off again when the screen rests (power/activity).

/** How far the view leans back to show the raised ground, in degrees from straight down. */
export const GROUND_PITCH = 60;

class Ground {
  /** The ground raised in 3D, the map leaning back to show it. */
  raised = $state(false);
}

export const ground = new Ground();
