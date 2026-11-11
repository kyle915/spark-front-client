/**
 * fetch with a deadline, for every check-in request that an ambassador is
 * waiting on. On one bar of signal a bare fetch can stall for minutes
 * without ever rejecting — the page spins, and the offline fallbacks (which
 * only run when the request FAILS) never get their turn. Aborting turns a
 * stall into an ordinary connectivity failure the existing queues handle.
 */
export const CHECKIN_FETCH_TIMEOUT_MS = 20_000;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const withTimeout =
  (doFetch: FetchLike, timeoutMs = CHECKIN_FETCH_TIMEOUT_MS): FetchLike =>
  async (input, init) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await doFetch(input, { ...(init ?? {}), signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  };

/** The default for live requests. Tests inject their own FetchLike. */
export const timedFetch: FetchLike = (input, init) =>
  withTimeout((i, n) => fetch(i, n))(input, init);
