// Short messages for the user, shown in the stack of cards at the top of the map, below the
// incidents, so that they never cover anything that asks for a tap. One list for the whole app:
// a notice either goes away by itself after a while or stays until the user closes it or its
// owner withdraws it.

/** Something the user can do from a notice, besides closing it. */
export interface NoticeAction {
  readonly label: string;
  readonly run: () => void;
}

interface Notice {
  readonly id: number;
  readonly text: string;
  readonly action: NoticeAction | null;
  /** A notice that stays can be closed; one that goes away by itself needs no close button. */
  readonly stays: boolean;
}

interface NoticeOptions {
  readonly action?: NoticeAction;
  /** Stays until closed or withdrawn, instead of going away after a few seconds. */
  readonly stays?: boolean;
}

/** How long a passing notice is shown, in milliseconds. */
const PASSING_MS = 5000;

class Notices {
  list: readonly Notice[] = $state.raw([]);
  #next = 1;
  readonly #timers = new Map<number, ReturnType<typeof setTimeout>>();

  /**
   * Shows a notice and returns its id, with which it can be withdrawn. The same passing notice
   * shown again while it is there is not repeated: it takes the new action, if any, and starts its
   * time again.
   */
  show(text: string, options: NoticeOptions = {}): number {
    const stays = options.stays === true;
    const action = options.action ?? null;
    const same = stays
      ? undefined
      : this.list.find((notice) => !notice.stays && notice.text === text);
    if (same !== undefined) {
      this.list = this.list.map((notice) => (notice === same ? { ...same, action } : notice));
      this.#expire(same.id);
      return same.id;
    }
    const id = this.#next++;
    this.list = [...this.list, { id, text, action, stays }];
    if (!stays) this.#expire(id);
    return id;
  }

  withdraw(id: number): void {
    clearTimeout(this.#timers.get(id));
    this.#timers.delete(id);
    this.list = this.list.filter((notice) => notice.id !== id);
  }

  /** Withdraws a passing notice after its time, counted from now. */
  #expire(id: number): void {
    clearTimeout(this.#timers.get(id));
    this.#timers.set(
      id,
      setTimeout(() => {
        this.withdraw(id);
      }, PASSING_MS),
    );
  }
}

export const notices = new Notices();

/** A notice that stays for as long as something is so: its text, and what can be done about it. */
export interface StandingNotice {
  readonly text: string;
  readonly action?: NoticeAction;
}

/**
 * Shows a notice that stays while `notice` returns one, and changes or withdraws it as that
 * changes; the user may close it meanwhile. Call it while a component initialises.
 */
export function useStandingNotice(notice: () => StandingNotice | null): void {
  let closedText: string | null = null;
  $effect(() => {
    const current = notice();
    if (current === null || current.text === closedText) return;
    const id = notices.show(current.text, {
      stays: true,
      ...(current.action ? { action: current.action } : {}),
    });
    return () => {
      // Closed by the user: the same message is not shown again until it changes.
      if (!notices.list.some((shown) => shown.id === id)) closedText = current.text;
      notices.withdraw(id);
    };
  });
}
