/** Server cap on `users` is 100. Stay at that page instead of asking for 500. */
export const PEOPLE_PAGE_SIZE = 100;

export type PeopleServerRole = "AMBASSADOR" | "CLIENT" | "SPARK";

export type PeopleServerFilters = {
  tenantId?: string | null;
  name?: string;
  email?: string;
  /** Free-text across first/last/email when API supports UserFiltersInput.search */
  search?: string;
  role?: PeopleServerRole;
};

export type PeoplePageInfo = {
  hasNextPage?: boolean | null;
  endCursor?: string | null;
} | null | undefined;

/** Cursor for the next `users` page, or null when there isn't one. */
export function peopleEndCursor(pageInfo: PeoplePageInfo): string | null {
  const cursor = pageInfo?.endCursor;
  return typeof cursor === "string" && cursor.length > 0 ? cursor : null;
}

/** True when `pageInfo` says another page exists and we have a cursor for it. */
export function peopleHasMore(pageInfo: PeoplePageInfo): boolean {
  return Boolean(pageInfo?.hasNextPage) && peopleEndCursor(pageInfo) !== null;
}

/** Append later pages without duplicating ids already on screen. */
export function mergePeopleById<T extends { id: string }>(
  base: T[],
  extra: T[],
): T[] {
  if (extra.length === 0) return base;
  const seen = new Set(base.map((row) => row.id));
  const appended = extra.filter((row) => !seen.has(row.id));
  return appended.length === 0 ? base : [...base, ...appended];
}

const ROLE_TO_SERVER: Record<string, PeopleServerRole> = {
  "spark-admin": "SPARK",
  admin: "SPARK",
  client: "CLIENT",
  ambassador: "AMBASSADOR",
};

/**
 * Prefer a single `search` filter (name OR email OR first/last). Fall back
 * to name/email split for older API builds that lack `search`.
 */
export function peopleServerFilters(input: {
  tenantId?: string | null;
  search: string;
  role: string;
}): PeopleServerFilters {
  const filters: PeopleServerFilters = {};
  if (input.tenantId) filters.tenantId = input.tenantId;
  const role = ROLE_TO_SERVER[input.role];
  if (role) filters.role = role;
  const search = input.search.trim();
  if (!search) return filters;
  // Unified search — API ORs first_name / last_name / email.
  filters.search = search;
  return filters;
}

export function peopleSearchIsActive(search: string, role: string): boolean {
  return Boolean(search.trim() || (role && role !== "all"));
}
