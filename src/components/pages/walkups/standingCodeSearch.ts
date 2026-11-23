export type StandingCodeSearchFields = {
  name?: string | null;
  code?: string | null;
  teamCode?: string | null;
  teamTitle?: string | null;
  programs?: ReadonlyArray<string | null> | null;
};

/** True when every word in the query appears in the brand, code, or programs. */
export function matchesStandingCodeQuery(
  query: string,
  fields: StandingCodeSearchFields,
): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = [fields.name, fields.code, fields.teamCode, fields.teamTitle, ...(fields.programs ?? [])]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .toLowerCase();
  return words.every((word) => hay.includes(word));
}
