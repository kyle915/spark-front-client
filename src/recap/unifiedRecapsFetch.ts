/**
 * Coordinated legacy + custom Recaps fetch pipeline.
 *
 * Both GraphQL documents stay separate (server shapes differ), but page
 * size, cursors, and load-more planning share one helper so the UI never
 * advances one pipeline without the other when both have more rows.
 */

import {
  RECAPS_PAGE_SIZE,
  recapsListPageVariables,
  type RecapsListPageVars,
} from "./recapsListPagination";

export type UnifiedRecapsPageVars = {
  legacy: RecapsListPageVars;
  custom: RecapsListPageVars;
};

export type UnifiedRecapsCursorState = {
  legacyAfter: string | null;
  customAfter: string | null;
  legacyHasMore: boolean;
  customHasMore: boolean;
  enableLegacy: boolean;
  enableCustom: boolean;
};

export type UnifiedRecapsLoadPlan = {
  /** Fetch next legacy page in this Load more tick. */
  fetchLegacy: boolean;
  /** Fetch next custom page in this Load more tick. */
  fetchCustom: boolean;
  legacyVars: RecapsListPageVars | null;
  customVars: RecapsListPageVars | null;
  /** True when either enabled pipeline still has pages. */
  hasMore: boolean;
};

/** Same cursor window for both recap document types. */
export function unifiedRecapsPageVariables(
  after: string | null = null,
): UnifiedRecapsPageVars {
  const page = recapsListPageVariables(after);
  return { legacy: page, custom: { ...page } };
}

/**
 * Plan the next coordinated Load more step.
 *
 * When both kinds are enabled and both report hasMore, fetch them in
 * parallel with their own cursors (still one user-facing page). When
 * only one has more, advance that pipeline alone so the merged list
 * can keep growing.
 */
export function planUnifiedRecapsLoadMore(
  state: UnifiedRecapsCursorState,
): UnifiedRecapsLoadPlan {
  const fetchLegacy = Boolean(state.enableLegacy && state.legacyHasMore);
  const fetchCustom = Boolean(state.enableCustom && state.customHasMore);
  return {
    fetchLegacy,
    fetchCustom,
    legacyVars: fetchLegacy
      ? recapsListPageVariables(state.legacyAfter)
      : null,
    customVars: fetchCustom
      ? recapsListPageVariables(state.customAfter)
      : null,
    hasMore: fetchLegacy || fetchCustom,
  };
}

/** Merge pageInfo from a load-more response into cursor state. */
export function applyUnifiedRecapsPageInfo(
  state: UnifiedRecapsCursorState,
  next: {
    legacy?: { endCursor?: string | null; hasNextPage?: boolean | null } | null;
    custom?: { endCursor?: string | null; hasNextPage?: boolean | null } | null;
  },
): UnifiedRecapsCursorState {
  let legacyAfter = state.legacyAfter;
  let legacyHasMore = state.legacyHasMore;
  let customAfter = state.customAfter;
  let customHasMore = state.customHasMore;
  if (next.legacy) {
    legacyAfter = next.legacy.endCursor ?? null;
    legacyHasMore = Boolean(next.legacy.hasNextPage);
  }
  if (next.custom) {
    customAfter = next.custom.endCursor ?? null;
    customHasMore = Boolean(next.custom.hasNextPage);
  }
  return {
    ...state,
    legacyAfter,
    customAfter,
    legacyHasMore,
    customHasMore,
  };
}

export { RECAPS_PAGE_SIZE };
