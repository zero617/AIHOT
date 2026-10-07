// Spacing between outbound model calls, for endpoints that rate-limit by frequency rather than by
// quota (free tiers commonly allow a handful of requests per minute). Concurrency alone does not help
// there: one article costs half a dozen sequential calls, so even a single worker overruns the window.
// ponytail: only this file; if a second limiter is ever needed, move it to lib/.
import { setTimeout as sleep } from "node:timers/promises";

const schedules = new Map<string, { nextFreeAt: number; chain: Promise<void> }>();

/** Minimum gap between two model calls; 0 or unset means no spacing. */
function intervalMs(model: string): number {
  const envName = model === "default" ? "LLM_MIN_INTERVAL_MS" : `${model.replace(/[^a-z0-9]/gi, "_").toUpperCase()}_MIN_INTERVAL_MS`;
  const raw = Number(process.env[envName]);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/** Waits until this call may go out. Returns without waiting when spacing is off. */
export function paceModelCall(model = "default"): Promise<void> {
  const gap = intervalMs(model);
  if (!gap) return Promise.resolve();
  const schedule = schedules.get(model) ?? { nextFreeAt: 0, chain: Promise.resolve() };
  const turn = schedule.chain.then(async () => {
    const wait = schedule.nextFreeAt - Date.now();
    if (wait > 0) await sleep(wait);
    schedule.nextFreeAt = Date.now() + gap;
  });
  // Keep the chain alive even when one waiter is cancelled or throws.
  schedule.chain = turn.catch(() => {});
  schedules.set(model, schedule);
  return turn;
}

/** Testing hook: forgets the schedule so a case does not inherit the previous one's wait. */
export function resetPace(): void {
  schedules.clear();
}