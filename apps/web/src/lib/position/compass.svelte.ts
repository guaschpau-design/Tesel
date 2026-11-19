// Where this device points, from its compass (ADR-0148): degrees clockwise from true north, for
// this device's own symbol on the tactical map. Only shown here, never sent: it changes without
// moving, and is only right with the phone held flat in the hand. Browsers give it as the
// absolute orientation's alpha (Android) or as `webkitCompassHeading` (iPhone), which asks the
// user first; either way it is turned by the screen's own rotation.

/** The heading changes on screen only by more than this, in degrees, nor more often than this. */
const STEP_DEGREES = 3;
const EVERY_MS = 150;

/** iPhone's compass, and its permission, beyond the standard event. */
interface WebkitOrientation extends DeviceOrientationEvent {
  readonly webkitCompassHeading?: number;
}
interface OrientationPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

/** The heading a reading gives, or null if it gives none. */
export function headingOf(
  event: { alpha: number | null; absolute: boolean; webkitCompassHeading?: number },
  screenAngle: number,
): number | null {
  let heading: number | null = null;
  if (typeof event.webkitCompassHeading === 'number') heading = event.webkitCompassHeading;
  // Alpha turns anticlockwise from north; only an absolute one is tied to north.
  else if (event.absolute && event.alpha !== null) heading = 360 - event.alpha;
  if (heading === null) return null;
  return (((heading + screenAngle) % 360) + 360) % 360;
}

class Compass {
  #heading: number | null = $state(null);
  #users = 0;
  #last = 0;
  readonly #listen = (event: Event) => {
    const reading = event as WebkitOrientation;
    const heading = headingOf(reading, screen.orientation.angle);
    const now = Date.now();
    if (heading === null || now - this.#last < EVERY_MS) return;
    const previous = this.#heading;
    const turned = previous === null ? 360 : Math.abs(((heading - previous + 540) % 360) - 180);
    if (turned < STEP_DEGREES) return;
    this.#last = now;
    this.#heading = heading;
  };

  /** Where the device points now, or null while the compass says nothing. */
  get heading(): number | null {
    return this.#heading;
  }

  /**
   * Asks for the compass where the browser wants a tap to (iPhone); elsewhere does nothing. Called
   * from the tap that chooses the tactical map.
   */
  async ask(): Promise<void> {
    const orientation = (globalThis as { DeviceOrientationEvent?: OrientationPermission })
      .DeviceOrientationEvent;
    if (orientation?.requestPermission === undefined) return;
    try {
      await orientation.requestPermission();
    } catch {
      // Refused, or not asked from a tap: the symbol shows the GPS's direction instead.
    }
  }

  /** Listens to the compass until the returned function is called. */
  start(): () => void {
    if (this.#users++ === 0) {
      window.addEventListener('deviceorientationabsolute', this.#listen);
      window.addEventListener('deviceorientation', this.#listen);
    }
    return () => {
      if (--this.#users > 0) return;
      window.removeEventListener('deviceorientationabsolute', this.#listen);
      window.removeEventListener('deviceorientation', this.#listen);
      this.#heading = null;
    };
  }
}

/** This device's compass, which this device's symbol reads. */
export const compass = new Compass();
