/** Server cap on `users` is 100. Stay at that page instead of asking for 500. */
export const PEOPLE_PAGE_SIZE = 100;

export type PeopleServerRole = "AMBASSADOR" | "CLIENT" | "SPARK";

export type PeopleServerFilters = {
  tenantId?: string | null;
  name?: string;
  email?: string;
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
 * Name and email are AND on the API, and `name` matches first or last name,
 * not the joined string. A multi-word query sends the longest token (usually
 * the last name). An address-looking query goes to email.
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
  const emailLike =
    search.includes("@") || (!/\s/.test(search) && search.includes("."));
  if (emailLike) {
    filters.email = search;
    return filters;
  }
  const tokens = search.split(/\s+/).filter(Boolean);
  filters.name = tokens.reduce(
    (longest, token) => (token.length > longest.length ? token : longest),
    tokens[0] ?? search,
  );
  return filters;
}

export function peopleSearchIsActive(search: string, role: string): boolean {
  return Boolean(search.trim() || (role && role !== "all"));
}
