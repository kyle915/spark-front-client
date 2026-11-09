/**
 * Coordinated legacy + custom Recaps fetch pipeline.
 *
 * Both GraphQL documents stay separate (server shapes differ), but page
 * size, cursors, load-more planning, and imperative dual fetches share
 * one helper so the UI never advances one pipeline without the other
 * when both have more rows.
 */

import { fetchQuery } from "relay-runtime";
import type { Environment, FetchPolicy } from "relay-runtime";
import { CustomRecapsListQuery } from "@/api/queries/CustomRecapsListQuery";
import type { CustomRecapsListQuery as CustomRecapsListQueryType } from "@api/queries/__generated__/CustomRecapsListQuery.graphql";
import { RecapsListQuery } from "@/api/queries/RecapsListQuery";
import type { RecapsListQuery as RecapsListQueryType } from "@api/queries/__generated__/RecapsListQuery.graphql";
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

export type UnifiedRecapsFetchResult = {
  legacy: RecapsListQueryType["response"] | null;
  custom: CustomRecapsListQueryType["response"] | null;
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

/**
 * One coordinated imperative fetch for legacy + custom list ops.
 *
 * Call sites pass which pipelines to hit and their variables; both
 * GraphQL documents stay under the hood.
 */
export async function fetchUnifiedRecapsPage(
  environment: Environment,
  opts: {
    fetchLegacy?: boolean;
    fetchCustom?: boolean;
    legacyVariables?: RecapsListQueryType["variables"] | null;
    customVariables?: CustomRecapsListQueryType["variables"] | null;
    fetchPolicy?: FetchPolicy;
  },
): Promise<UnifiedRecapsFetchResult> {
  const fetchLegacy = Boolean(opts.fetchLegacy && opts.legacyVariables);
  const fetchCustom = Boolean(opts.fetchCustom && opts.customVariables);
  const fetchPolicy = opts.fetchPolicy ?? "store-or-network";
  const [legacy, custom] = await Promise.all([
    fetchLegacy
      ? fetchQuery<RecapsListQueryType>(
          environment,
          RecapsListQuery,
          opts.legacyVariables as RecapsListQueryType["variables"],
          { fetchPolicy },
        ).toPromise()
      : Promise.resolve(null),
    fetchCustom
      ? fetchQuery<CustomRecapsListQueryType>(
          environment,
          CustomRecapsListQuery,
          opts.customVariables as CustomRecapsListQueryType["variables"],
          { fetchPolicy },
        ).toPromise()
      : Promise.resolve(null),
  ]);
  return {
    legacy: legacy ?? null,
    custom: custom ?? null,
  };
}

/** Load-more convenience: plan vars + shared q/filters → dual fetch. */
export async function fetchUnifiedRecapsFromPlan(
  environment: Environment,
  plan: UnifiedRecapsLoadPlan,
  extras: {
    q?: string | null;
    legacyFilters?: RecapsListQueryType["variables"]["filters"];
    customFilters?: CustomRecapsListQueryType["variables"]["filters"];
    fetchPolicy?: FetchPolicy;
  } = {},
): Promise<UnifiedRecapsFetchResult> {
  return fetchUnifiedRecapsPage(environment, {
    fetchLegacy: plan.fetchLegacy,
    fetchCustom: plan.fetchCustom,
    legacyVariables: plan.legacyVars
      ? {
          ...plan.legacyVars,
          q: extras.q ?? null,
          filters: extras.legacyFilters ?? null,
        }
      : null,
    customVariables: plan.customVars
      ? {
          ...plan.customVars,
          q: extras.q ?? null,
          filters: extras.customFilters ?? null,
        }
      : null,
    fetchPolicy: extras.fetchPolicy ?? "network-only",
  });
}

export { RECAPS_PAGE_SIZE };
