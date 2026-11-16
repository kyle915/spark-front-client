/**
 * Store names: pure helpers for the "These look like the same store" page.
 * No Relay imports, so this file is unit-tested on its own.
 */

export type StoreNameAlias = {
  uuid: string;
  name: string;
  /** Records (events, and requests with no event yet) carrying this name. */
  records: number;
  /** Up to three "City, ST" the name is used in. */
  places: string;
};

export type StoreNameGroup = {
  groupKey: string;
  canonicalName: string;
  /** "chain": one banner spelled differently. "store": one numbered store. */
  kind: string;
  /** "rule": same once capitals and punctuation are ignored. "ai": suggested. */
  source: string;
  reason: string;
  canonicalRecords: number;
  affectedRecords: number;
  names: StoreNameAlias[];
};

export type StoreNameAccepted = {
  uuid: string;
  name: string;
  canonicalName: string;
  records: number;
};

export const plural = (n: number, one: string, many = `${one}s`): string =>
  `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** How the store charts compare two names: capitals and spacing ignored. */
export const nameKey = (name: string): string =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

/** The names of a group that are ticked. Unticked ones stay as suggestions. */
export function chosenAliases(
  group: StoreNameGroup,
  unticked: ReadonlySet<string>,
): StoreNameAlias[] {
  return group.names.filter((n) => !unticked.has(n.uuid));
}

/**
 * How many records would be shown under another name if this is accepted.
 * When staff keep a different spelling, the records under the spelling first
 * suggested move too, and a ticked name equal to the one kept does not.
 */
export function recordsAffected(
  group: StoreNameGroup,
  unticked: ReadonlySet<string>,
  keepName: string,
): number {
  const keep = nameKey(keepName || group.canonicalName);
  let total = 0;
  for (const alias of chosenAliases(group, unticked)) {
    if (nameKey(alias.name) !== keep) total += alias.records;
  }
  if (keep !== nameKey(group.canonicalName)) total += group.canonicalRecords;
  return total;
}

/** Why Accept is off, or null when it can be pressed. */
export function acceptBlocker(
  group: StoreNameGroup,
  unticked: ReadonlySet<string>,
  keepName: string,
  maxGroupSize: number,
): string | null {
  const chosen = chosenAliases(group, unticked);
  if (chosen.length === 0) return "Tick at least one name.";
  if (!(keepName || group.canonicalName).trim()) return "Enter the name to keep.";
  if (chosen.length + 1 > maxGroupSize) {
    return `Accept at most ${maxGroupSize} names at a time. Untick some and accept the rest after.`;
  }
  return null;
}

/** One plain sentence under a group saying what an accept does. */
export function acceptSummary(
  group: StoreNameGroup,
  unticked: ReadonlySet<string>,
  keepName: string,
): string {
  const keep = (keepName || group.canonicalName).trim();
  const affected = recordsAffected(group, unticked, keep);
  if (affected === 0) {
    return `No records use these spellings right now. Accepting only affects future ones.`;
  }
  return `${plural(affected, "record")} will be shown as “${keep}” in reports. The records themselves are not changed.`;
}

export const kindLabel = (kind: string): string =>
  kind === "store" ? "One store" : "One chain";

export const sourceLabel = (source: string): string =>
  source === "ai"
    ? "Suggested match. Check it before accepting."
    : "Same name once capitals and punctuation are ignored.";
