/**
 * Propose-then-confirm helpers for agency CSV imports.
 * A guess is imported only when `applied` is true. Model suggestions
 * arrive with `applied: false` and stay out until someone turns them on.
 */

export type ColumnGuess = {
  header: string;
  field: string;
  fieldLabel: string;
  reason: string;
  source: "rules" | "model" | "none" | "confirmed";
  applied: boolean;
};

export type FieldChoice = {
  key: string;
  label: string;
};

export type StoreCandidate = {
  id: number;
  name: string;
  city: string;
  state: string;
  reason: string;
};

export type StoreMatch = {
  reason: string;
  aiReason: string;
  candidates: StoreCandidate[];
};

const SOURCES = new Set(["rules", "model", "none", "confirmed"]);

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseColumnGuessPayload(json: string | null | undefined): {
  guesses: ColumnGuess[];
  fields: FieldChoice[];
} {
  if (!json) return { guesses: [], fields: [] };
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { guesses: [], fields: [] };
  }
  if (!data || typeof data !== "object") return { guesses: [], fields: [] };
  const raw = data as { guesses?: unknown; fields?: unknown };
  const guesses: ColumnGuess[] = [];
  if (Array.isArray(raw.guesses)) {
    for (const item of raw.guesses) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const header = asText(row.header).trim();
      if (!header) continue;
      const source = asText(row.source);
      guesses.push({
        header,
        field: asText(row.field),
        fieldLabel: asText(row.field_label),
        reason: asText(row.reason),
        source: SOURCES.has(source) ? (source as ColumnGuess["source"]) : "none",
        applied: row.applied === true && Boolean(asText(row.field)),
      });
    }
  }
  const fields: FieldChoice[] = [];
  if (Array.isArray(raw.fields)) {
    for (const item of raw.fields) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const key = asText(row.key);
      if (!key) continue;
      fields.push({ key, label: asText(row.label) || key });
    }
  }
  return { guesses, fields };
}

/** Spark fields checked on more than one header. Those fields are not imported. */
export function duplicateColumnFields(guesses: readonly ColumnGuess[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const guess of guesses) {
    if (!guess.applied || !guess.field) continue;
    if (seen.has(guess.field)) dupes.add(guess.field);
    else seen.add(guess.field);
  }
  return [...dupes];
}

/**
 * Columns a person turned on. A field checked on two headers is left out
 * of the map entirely — the screen blocks commit until one is unchecked.
 */
export function confirmedColumnMap(
  guesses: readonly ColumnGuess[],
): Record<string, string> {
  const blocked = new Set(duplicateColumnFields(guesses));
  const out: Record<string, string> = {};
  for (const guess of guesses) {
    if (!guess.applied || !guess.field || !guess.header) continue;
    if (blocked.has(guess.field)) continue;
    out[guess.field] = guess.header;
  }
  return out;
}

export function setGuessIncluded(
  guesses: readonly ColumnGuess[],
  header: string,
  included: boolean,
): ColumnGuess[] {
  return guesses.map((guess) => {
    if (guess.header !== header) return guess;
    return { ...guess, applied: included && Boolean(guess.field) };
  });
}

export function setGuessField(
  guesses: readonly ColumnGuess[],
  header: string,
  field: string,
  fields: readonly FieldChoice[],
): ColumnGuess[] {
  const choice = fields.find((item) => item.key === field);
  return guesses.map((guess) => {
    if (guess.header !== header) return guess;
    if (!field) {
      return { ...guess, field: "", fieldLabel: "", applied: false };
    }
    return {
      ...guess,
      field,
      fieldLabel: choice?.label || field,
      applied: true,
    };
  });
}

export function storeMatchFromNormalized(
  json: string | null | undefined,
): StoreMatch | null {
  if (!json) return null;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const match = (data as { store_match?: unknown }).store_match;
  if (!match || typeof match !== "object") return null;
  const row = match as {
    reason?: unknown;
    ai_reason?: unknown;
    candidates?: unknown;
  };
  const candidates: StoreCandidate[] = [];
  if (Array.isArray(row.candidates)) {
    for (const item of row.candidates) {
      if (!item || typeof item !== "object") continue;
      const candidate = item as Record<string, unknown>;
      const id = Number(candidate.id);
      const name = asText(candidate.name).trim();
      if (!Number.isFinite(id) || !name) continue;
      candidates.push({
        id,
        name,
        city: asText(candidate.city),
        state: asText(candidate.state),
        reason: asText(candidate.reason),
      });
    }
  }
  const reason = asText(row.reason);
  const aiReason = asText(row.ai_reason);
  if (!reason && !aiReason && candidates.length === 0) return null;
  return { reason, aiReason, candidates };
}
