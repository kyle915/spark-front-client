import { useCallback, useState } from "react";

/**
 * State that remembers its last value in this browser, so a view someone
 * set up (a date range, a filter) is still there when they come back.
 *
 * Purely a convenience: storage can be unavailable (private window,
 * blocked site data), so every read and write is guarded and the page works
 * the same without it. `validate` rejects stale or malformed saved values —
 * return the value to accept it, or null to fall back to `initial`.
 */
export function readSticky<T>(
  key: string,
  initial: T,
  validate: (raw: unknown) => T | null,
): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return initial;
    return validate(JSON.parse(raw)) ?? initial;
  } catch {
    return initial;
  }
}

export function writeSticky(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* not persisted this time — nothing else depends on it */
  }
}

export function useStickyState<T>(
  key: string,
  initial: T,
  validate: (raw: unknown) => T | null,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => readSticky(key, initial, validate));
  const set = useCallback(
    (next: T) => {
      setValue(next);
      writeSticky(key, next);
    },
    [key],
  );
  return [value, set];
}

export default useStickyState;
