/**
 * Session-scoped persistence for Admin Ask Spark threads.
 *
 * Keeps the active Admin Ask Spark conversation intact across pop-up closes
 * and route transitions (e.g., Dashboard -> Recaps -> Shelf & Voice) per
 * selected brand (and per recap/event for scoped detail pop-ups), while
 * isolating threads between brands and clearing cleanly on logout or Clear.
 *
 * Kept Relay-free so unit tests run cleanly before Relay artifact generation.
 */

export type PersistedAiChartSeries = {
  readonly label: string;
  readonly data: readonly number[];
};

export type PersistedAiChart = {
  readonly type: string;
  readonly title?: string | null;
  readonly labels: readonly string[];
  readonly series: readonly PersistedAiChartSeries[];
};

export type AdminAskTurn = {
  id: string;
  question: string;
  ok: boolean;
  answer: string;
  reason?: string | null;
  chart?: PersistedAiChart | null;
  thoughtFor: number | null;
};

export type AdminAskThreadScope = "tenant" | "recap" | "event";

export const ADMIN_ASK_THREAD_STORAGE_PREFIX = "spark.askAi.thread:v1:";
export const MAX_PERSISTED_ADMIN_ASK_TURNS = 30;

/**
 * Build a collision-free sessionStorage key scoped to the active brand and
 * (for detail modals) the specific recap or event.
 */
export function adminAskThreadKey(input: {
  tenantId: string | null | undefined;
  scope: AdminAskThreadScope;
  recapId?: string | null;
  eventId?: string | null;
}): string | null {
  const tid = (input.tenantId ?? "").trim();
  if (!tid) return null;
  if (input.scope === "recap") {
    const rid = (input.recapId ?? "").trim();
    return rid
      ? `${ADMIN_ASK_THREAD_STORAGE_PREFIX}${tid}:recap:${rid}`
      : null;
  }
  if (input.scope === "event") {
    const eid = (input.eventId ?? "").trim();
    return eid
      ? `${ADMIN_ASK_THREAD_STORAGE_PREFIX}${tid}:event:${eid}`
      : null;
  }
  return `${ADMIN_ASK_THREAD_STORAGE_PREFIX}${tid}:tenant`;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function sanitizeChart(raw: unknown): PersistedAiChart | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.type !== "string" || !Array.isArray(obj.labels) || !Array.isArray(obj.series)) {
    return null;
  }
  const labels = obj.labels.filter((x): x is string => typeof x === "string");
  const series: PersistedAiChartSeries[] = [];
  for (const s of obj.series) {
    if (!s || typeof s !== "object") continue;
    const item = s as Record<string, unknown>;
    if (typeof item.label !== "string" || !Array.isArray(item.data)) continue;
    const nums = item.data.filter(
      (n): n is number => typeof n === "number" && Number.isFinite(n),
    );
    series.push({ label: item.label, data: nums });
  }
  return {
    type: obj.type,
    title: typeof obj.title === "string" ? obj.title : null,
    labels,
    series,
  };
}

function sanitizeTurn(raw: unknown): AdminAskTurn | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.id !== "string" ||
    !obj.id ||
    typeof obj.question !== "string" ||
    !obj.question.trim() ||
    typeof obj.ok !== "boolean" ||
    typeof obj.answer !== "string"
  ) {
    return null;
  }
  const thoughtFor =
    typeof obj.thoughtFor === "number" && Number.isFinite(obj.thoughtFor)
      ? obj.thoughtFor
      : null;
  const reason = typeof obj.reason === "string" ? obj.reason : null;
  const chart = sanitizeChart(obj.chart);
  return {
    id: obj.id,
    question: obj.question,
    ok: obj.ok,
    answer: obj.answer,
    ...(reason != null ? { reason } : {}),
    ...(chart ? { chart } : {}),
    thoughtFor,
  };
}

/** Load the persisted thread for `key`, or `[]` when missing/invalid. */
export function loadAdminAskThread(key: string | null): AdminAskTurn[] {
  if (!key) return [];
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: AdminAskTurn[] = [];
    for (const entry of parsed) {
      const clean = sanitizeTurn(entry);
      if (clean) out.push(clean);
    }
    return out.slice(-MAX_PERSISTED_ADMIN_ASK_TURNS);
  } catch {
    return [];
  }
}

/**
 * Save `turns` for `key`, trimming to the latest `MAX_PERSISTED_ADMIN_ASK_TURNS`.
 * Removes the key when empty, and gracefully trims further on quota errors.
 */
export function saveAdminAskThread(
  key: string | null,
  turns: readonly AdminAskTurn[],
): void {
  if (!key) return;
  const storage = getStorage();
  if (!storage) return;
  if (turns.length === 0) {
    try {
      storage.removeItem(key);
    } catch {
      // ignore storage errors
    }
    return;
  }

  let slice = turns.slice(-MAX_PERSISTED_ADMIN_ASK_TURNS);
  while (slice.length > 0) {
    try {
      storage.setItem(key, JSON.stringify(slice));
      return;
    } catch {
      // QuotaExceededError or private mode: drop oldest half and retry once
      if (slice.length === 1) return;
      slice = slice.slice(Math.ceil(slice.length / 2));
    }
  }
}

/** Append a single turn to the persisted thread for `key` (safe even after unmount). */
export function appendAdminAskTurn(
  key: string | null,
  turn: AdminAskTurn,
): AdminAskTurn[] {
  if (!key) return [turn];
  const existing = loadAdminAskThread(key);
  const next = existing.some((t) => t.id === turn.id)
    ? existing
    : [...existing, turn].slice(-MAX_PERSISTED_ADMIN_ASK_TURNS);
  saveAdminAskThread(key, next);
  return next;
}

/** Clear one persisted Ask Spark thread. */
export function clearAdminAskThread(key: string | null): void {
  if (!key) return;
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

/** Clear all persisted Admin Ask Spark threads (e.g. on logout). */
export function clearAllAdminAskThreads(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i);
      if (k && k.startsWith(ADMIN_ASK_THREAD_STORAGE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      storage.removeItem(k);
    }
  } catch {
    // ignore storage errors
  }
}
