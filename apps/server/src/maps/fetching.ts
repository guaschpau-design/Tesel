// Reading from services on the network while an archive is built (build-*.ts): each request tried
// again a few times, waiting longer each time, before the build gives up, and many requests a few
// at a time.

/** How often a request is tried before the build gives up. */
const ATTEMPTS = 4;
/** Waited after the first failure, then twice as long, three times… */
const FIRST_WAIT_MS = 2000;

export async function attempt<T>(work: () => Promise<T>, firstWaitMs = FIRST_WAIT_MS): Promise<T> {
  for (let tried = 1; ; tried++) {
    try {
      return await work();
    } catch (error) {
      if (tried >= ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, firstWaitMs * tried));
    }
  }
}

/** Runs `work` on each item, `limit` at a time, and gives the results in the items' order. */
export async function inTurn<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      if (item !== undefined) results[index] = await work(item);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

/** The JSON a service answers, or an error saying what it answered instead. */
export async function fetchJson(url: string | URL, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok)
    throw new Error(`${String(url).slice(0, 120)} answered ${String(response.status)}`);
  return response.json();
}
