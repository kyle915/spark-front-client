/**
 * Shared page variables for legacy + custom Recaps list queries.
 *
 * Both pipelines must use the same `first`/`after` so the UI does not
 * double-fetch mismatched pages. SparkRecapsList already loads both; this
 * helper is the single place to change page size / cursor shape.
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

/** Same cursor window for both recap document types. */
export function unifiedRecapsPageVariables(
  after: string | null = null,
): UnifiedRecapsPageVars {
  const page = recapsListPageVariables(after);
  return { legacy: page, custom: { ...page } };
}

export { RECAPS_PAGE_SIZE };
