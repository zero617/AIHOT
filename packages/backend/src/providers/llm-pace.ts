// Spacing between outbound model calls, for endpoints that rate-limit by frequency rather than by
// quota (free tiers commonly allow a handful of requests per minute). Concurrency alone does not help
// there: one article costs half a dozen sequential calls, so even a single worker overruns the window.
// ponytail: only this file; if a second limiter is ever needed, move it to lib/.
import { setTimeout as sleep } from "node:timers/promises";

let nextFreeAt = 0;
// Serialises callers so two processes never both read the same free slot and claim it.
let chain: Promise<void> = Promise.resolve();

/** Minimum gap between two model calls; 0 or unset means no spacing. */
function intervalMs(): number {
  const raw = Number(process.env.LLM_MIN_INTERVAL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/** Waits until this call may go out. Returns without waiting when spacing is off. */
export function paceModelCall(): Promise<void> {
  const gap = intervalMs();
  if (!gap) return Promise.resolve();
  const turn = chain.then(async () => {
    const wait = nextFreeAt - Date.now();
    if (wait > 0) await sleep(wait);
    nextFreeAt = Date.now() + gap;
  });
  // Keep the chain alive even when one waiter is cancelled or throws.
  chain = turn.catch(() => {});
  return turn;
}

/** Testing hook: forgets the schedule so a case does not inherit the previous one's wait. */
export function resetPace(): void {
  nextFreeAt = 0;
  chain = Promise.resolve();
}