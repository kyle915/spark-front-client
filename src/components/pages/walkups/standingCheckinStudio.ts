/**
 * Helpers for Standing Check-In Studio form state on /walkups.
 *
 * Photo buckets may be a flat list or a program-keyed map. Resources are
 * BA-facing PDF/link/image buttons. The standing code is never edited here.
 */

export type StudioBucket = {
  name: string;
  helper: string;
  min: string;
};

export type StudioResource = {
  label: string;
  kind: "pdf" | "link" | "image";
  url: string;
  note: string;
};

export type StudioProgram = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type BucketMode = "flat" | "byProgram";

export function emptyBucket(): StudioBucket {
  return { name: "", helper: "", min: "" };
}

export function emptyResource(): StudioResource {
  return { label: "", kind: "pdf", url: "", note: "" };
}

export function normalizeBucketsFromConfig(
  raw: unknown,
): { mode: BucketMode; flat: StudioBucket[]; byProgram: Record<string, StudioBucket[]> } {
  const toBucket = (item: unknown): StudioBucket | null => {
    if (typeof item === "string") {
      const name = item.trim();
      return name ? { name, helper: "", min: "" } : null;
    }
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    if (!name) return null;
    return {
      name,
      helper: String(row.helper ?? "").trim(),
      min: row.min != null && row.min !== "" ? String(row.min) : "",
    };
  };

  if (Array.isArray(raw)) {
    const flat = raw.map(toBucket).filter((b): b is StudioBucket => Boolean(b));
    return { mode: "flat", flat: flat.length ? flat : [emptyBucket()], byProgram: {} };
  }

  if (raw && typeof raw === "object") {
    const byProgram: Record<string, StudioBucket[]> = {};
    for (const [key, items] of Object.entries(raw as Record<string, unknown>)) {
      const program = key.trim();
      if (!program || !Array.isArray(items)) continue;
      const buckets = items.map(toBucket).filter((b): b is StudioBucket => Boolean(b));
      byProgram[program] = buckets.length ? buckets : [emptyBucket()];
    }
    if (Object.keys(byProgram).length > 0) {
      return { mode: "byProgram", flat: [emptyBucket()], byProgram };
    }
  }

  return { mode: "flat", flat: [emptyBucket()], byProgram: {} };
}

export function bucketsToPayload(
  mode: BucketMode,
  flat: StudioBucket[],
  byProgram: Record<string, StudioBucket[]>,
): unknown {
  const serialize = (rows: StudioBucket[]) =>
    rows
      .map((b) => {
        const name = b.name.trim();
        if (!name) return null;
        const out: Record<string, unknown> = { name };
        const helper = b.helper.trim();
        if (helper) out.helper = helper;
        const minRaw = b.min.trim();
        if (minRaw) {
          const min = Number(minRaw);
          if (!Number.isNaN(min) && min > 0) out.min = min;
        }
        return out;
      })
      .filter(Boolean);

  if (mode === "byProgram") {
    const map: Record<string, unknown[]> = {};
    for (const [program, rows] of Object.entries(byProgram)) {
      const list = serialize(rows) as unknown[];
      if (list.length) map[program] = list;
    }
    return map;
  }
  return serialize(flat);
}

export function resourcesFromApi(
  rows: ReadonlyArray<{
    label: string;
    kind: string;
    url: string;
    note?: string | null;
  }> | null | undefined,
): StudioResource[] {
  if (!rows?.length) return [emptyResource()];
  return rows.map((r) => {
    const kind = (r.kind || "pdf").toLowerCase();
    return {
      label: r.label,
      kind: kind === "link" || kind === "image" ? kind : "pdf",
      url: r.url,
      note: r.note ?? "",
    };
  });
}

export function resourcesToInput(rows: StudioResource[]) {
  return rows
    .map((r) => {
      const label = r.label.trim();
      const url = r.url.trim();
      if (!label || !url) return null;
      return {
        label,
        url,
        kind: r.kind,
        note: r.note.trim() || null,
      };
    })
    .filter(Boolean) as Array<{
    label: string;
    url: string;
    kind: string;
    note: string | null;
  }>;
}

export function programIdsForSave(
  selectedIds: string[],
  defaultId: string | null,
): string[] {
  const uniq = Array.from(new Set(selectedIds.filter(Boolean)));
  if (!uniq.length) return [];
  if (defaultId && uniq.includes(defaultId)) {
    return [defaultId, ...uniq.filter((id) => id !== defaultId)];
  }
  return uniq;
}
