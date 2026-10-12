/**
 * At most `limit` tasks in flight across every caller. Each library pick,
 * draft restore and Retry used to bring its own pool of 3, so a BA with a
 * few batches and a Retry had a dozen photos decoding and uploading at once.
 */
export function createLimiter(limit: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active < limit) active++;
    // A finishing task hands its slot straight to the next waiter, so a new
    // caller can't slip in between and push the count past the limit.
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}
