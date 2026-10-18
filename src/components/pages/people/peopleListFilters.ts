/** Server cap on `users` is 100. Stay at that page instead of asking for 500. */
export const PEOPLE_PAGE_SIZE = 100;

export type PeopleServerRole = "AMBASSADOR" | "CLIENT" | "SPARK";

export type PeopleServerFilters = {
  tenantId?: string | null;
  name?: string;
  email?: string;
  role?: PeopleServerRole;
};

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
