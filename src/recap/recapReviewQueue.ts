export const RECAP_REVIEW_QUEUE_KEY = "spark.recapReviewQueue.v1";

export type RecapReviewQueueItem = {
  uuid: string;
  isCustom: boolean;
  href: string;
  approved?: boolean;
  archived?: boolean;
};

export type RecapReviewQueueState = {
  items: RecapReviewQueueItem[];
  lastOpenedUuid: string | null;
  returnHref: string | null;
  updatedAt: number;
};

export type RecapQueueNeighbors = {
  index: number;
  total: number;
  prev: RecapReviewQueueItem | null;
  next: RecapReviewQueueItem | null;
  nextUnapproved: RecapReviewQueueItem | null;
  returnHref: string | null;
};

export function loadRecapReviewQueue(): RecapReviewQueueState | null {
  try {
    const raw = sessionStorage.getItem(RECAP_REVIEW_QUEUE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RecapReviewQueueState> | null;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    const items: RecapReviewQueueItem[] = [];
    for (const item of parsed.items) {
      if (
        item &&
        typeof item.uuid === "string" &&
        item.uuid &&
        typeof item.href === "string" &&
        item.href
      ) {
        items.push({
          uuid: item.uuid,
          isCustom: Boolean(item.isCustom),
          href: item.href,
          ...(typeof item.approved === "boolean"
            ? { approved: item.approved }
            : {}),
          ...(typeof item.archived === "boolean"
            ? { archived: item.archived }
            : {}),
        });
      }
    }
    return {
      items,
      lastOpenedUuid:
        typeof parsed.lastOpenedUuid === "string" ? parsed.lastOpenedUuid : null,
      returnHref:
        typeof parsed.returnHref === "string" ? parsed.returnHref : null,
      updatedAt:
        typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveRecapReviewQueue(opts: {
  items: RecapReviewQueueItem[];
  lastOpenedUuid?: string | null;
  returnHref?: string | null;
}): void {
  try {
    const existing = loadRecapReviewQueue();
    const lastOpenedUuid =
      opts.lastOpenedUuid !== undefined
        ? opts.lastOpenedUuid
        : existing?.lastOpenedUuid ?? null;
    const returnHref =
      opts.returnHref !== undefined
        ? opts.returnHref
        : existing?.returnHref ?? null;
    const state: RecapReviewQueueState = {
      items: opts.items,
      lastOpenedUuid,
      returnHref,
      updatedAt: Date.now(),
    };
    sessionStorage.setItem(RECAP_REVIEW_QUEUE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export function markRecapOpenedInQueue(uuid: string): void {
  if (!uuid) return;
  try {
    const existing = loadRecapReviewQueue();
    if (!existing) return;
    if (existing.lastOpenedUuid === uuid) return;
    const next: RecapReviewQueueState = {
      ...existing,
      lastOpenedUuid: uuid,
      updatedAt: Date.now(),
    };
    sessionStorage.setItem(RECAP_REVIEW_QUEUE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function markRecapReviewedInQueue(
  uuid: string,
  patch: { approved?: boolean; archived?: boolean; removed?: boolean },
): void {
  if (!uuid) return;
  try {
    const existing = loadRecapReviewQueue();
    if (!existing) return;
    const items = patch.removed
      ? existing.items.filter((item) => item.uuid !== uuid)
      : existing.items.map((item) =>
          item.uuid === uuid
            ? {
                ...item,
                ...(patch.approved !== undefined
                  ? { approved: patch.approved }
                  : {}),
                ...(patch.archived !== undefined
                  ? { archived: patch.archived }
                  : {}),
              }
            : item,
        );
    const next: RecapReviewQueueState = {
      ...existing,
      items,
      lastOpenedUuid: uuid,
      updatedAt: Date.now(),
    };
    sessionStorage.setItem(RECAP_REVIEW_QUEUE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function getRecapQueueNeighbors(
  currentUuid: string | null | undefined,
  queue: RecapReviewQueueState | null = loadRecapReviewQueue(),
): RecapQueueNeighbors | null {
  if (!currentUuid || !queue || queue.items.length === 0) return null;
  const idx = queue.items.findIndex((item) => item.uuid === currentUuid);
  if (idx === -1) return null;
  const prev = idx > 0 ? queue.items[idx - 1] : null;
  const next = idx + 1 < queue.items.length ? queue.items[idx + 1] : null;

  let nextUnapproved: RecapReviewQueueItem | null = null;
  for (let i = idx + 1; i < queue.items.length; i += 1) {
    const candidate = queue.items[i];
    if (!candidate.approved && !candidate.archived) {
      nextUnapproved = candidate;
      break;
    }
  }
  if (!nextUnapproved) {
    for (let i = 0; i < idx; i += 1) {
      const candidate = queue.items[i];
      if (!candidate.approved && !candidate.archived) {
        nextUnapproved = candidate;
        break;
      }
    }
  }

  return {
    index: idx + 1,
    total: queue.items.length,
    prev,
    next,
    nextUnapproved,
    returnHref: queue.returnHref,
  };
}

/**
 * Picks the next recap to review from the currently visible list.
 * When `lastOpenedUuid` is present in the list, advances past it to the
 * next unapproved item (wrapping to earlier unapproved items if at the end).
 */
export function pickNextReviewItem<
  T extends { uuid: string; approved?: boolean; archivedAt?: string | null },
>(
  items: readonly T[],
  lastOpenedUuid: string | null | undefined = loadRecapReviewQueue()
    ?.lastOpenedUuid,
): T | null {
  const candidates = items.filter(
    (item) => !item.approved && !item.archivedAt,
  );
  const pool = candidates.length > 0 ? candidates : items;
  if (pool.length === 0) return null;
  if (!lastOpenedUuid) return pool[0];

  const lastIdxInItems = items.findIndex((item) => item.uuid === lastOpenedUuid);
  if (lastIdxInItems >= 0) {
    for (let i = lastIdxInItems + 1; i < items.length; i += 1) {
      const item = items[i];
      if (!item.approved && !item.archivedAt) return item;
    }
    for (let i = 0; i < lastIdxInItems; i += 1) {
      const item = items[i];
      if (!item.approved && !item.archivedAt) return item;
    }
  }

  const nonMatching = pool.find((item) => item.uuid !== lastOpenedUuid);
  return nonMatching ?? pool[0];
}
