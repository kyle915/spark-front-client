/**
 * Offline-first live shift tap counter + verbatim consumer quote scratchpad.
 *
 * Persisted 100% locally in `localStorage` (falling back to in-memory storage
 * in private browsing) keyed by check-in code + session token tail so every
 * tap survives page reloads, camera memory pressure, and dead-zone stores with
 * zero network traffic.
 *
 * When the ambassador opens their recap or clocks out, `syncLiveCounterToRecapDraft`
 * bridges the live counts and quotes into `recapDraft.ts` (`RecapDraft`) so
 * `RecapForm` pre-populates cleanly while remaining 100% editable before submit.
 */
import {
  isConsumersSampledCountField,
  templateHasConsumersSampledField,
} from "@/recap/engagementsFromSamples";
import {
  catalogSampleOptions,
  isProductsSampledMultiselect,
  matchProductForSampleOption,
  optionSkuName,
  sampleOptionSelected,
} from "@/recap/productsSampledQty";
import type { Template, TemplateField, TemplateProduct } from "./checkinTypes";
import type { StorageLike } from "./offlineClock";
import { liveStorage } from "./offlineRecap";
import {
  asRecapDraft,
  draftTokenTail,
  pickRestoredDraft,
  readDraft,
  writeDraft,
  type RecapDraft,
} from "./recapDraft";

export type LiveShiftQuote = {
  id: string;
  text: string;
  savedAt: number;
};

export type LiveShiftSkuCounts = {
  samples: number;
  sold: number;
};

export type LiveShiftLastSynced = {
  samples: Record<string, string>;
  engagements: string;
  values: Record<string, string | string[]>;
};

export type LiveShiftCounterState = {
  v: 1;
  updatedAt: number;
  consumersSampled: number;
  skus: Record<string, LiveShiftSkuCounts>;
  quotes: LiveShiftQuote[];
  lastSynced?: LiveShiftLastSynced;
};

export type CounterSkuItem = {
  id: string;
  name: string;
  category: string | null;
  /** Option string when synthesized from a multiselect field with no catalog rows. */
  optionValue?: string;
};

export const liveCounterStorageKey = (code: string, token: string): string =>
  `@spark.checkin.liveCounter/${code}/${draftTokenTail(token)}`;

function storeOf(storage?: StorageLike): StorageLike {
  return storage ?? liveStorage();
}

function clampNonNegInt(n: unknown): number {
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.min(99999, Math.round(num));
}

export function emptyLiveShiftCounter(): LiveShiftCounterState {
  return {
    v: 1,
    updatedAt: 0,
    consumersSampled: 0,
    skus: {},
    quotes: [],
  };
}

function parseQuote(raw: unknown): LiveShiftQuote | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Partial<LiveShiftQuote>;
  const text = typeof q.text === "string" ? q.text.trim() : "";
  if (!text) return null;
  return {
    id:
      typeof q.id === "string" && q.id.trim()
        ? q.id
        : `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    savedAt:
      typeof q.savedAt === "number" && Number.isFinite(q.savedAt) ? q.savedAt : 0,
  };
}

export function asLiveShiftCounter(raw: unknown): LiveShiftCounterState | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<LiveShiftCounterState>;
  if (d.v != null && d.v !== 1) return null;

  const skus: Record<string, LiveShiftSkuCounts> = {};
  if (d.skus && typeof d.skus === "object" && !Array.isArray(d.skus)) {
    for (const [key, val] of Object.entries(d.skus)) {
      if (!val || typeof val !== "object") continue;
      const entry = val as Partial<LiveShiftSkuCounts>;
      const samples = clampNonNegInt(entry.samples);
      const sold = clampNonNegInt(entry.sold);
      if (samples > 0 || sold > 0) {
        skus[key] = { samples, sold };
      }
    }
  }

  const quotes: LiveShiftQuote[] = Array.isArray(d.quotes)
    ? d.quotes.map(parseQuote).filter((q): q is LiveShiftQuote => q !== null)
    : [];

  let lastSynced: LiveShiftLastSynced | undefined;
  if (d.lastSynced && typeof d.lastSynced === "object") {
    const ls = d.lastSynced as Partial<LiveShiftLastSynced>;
    lastSynced = {
      samples:
        ls.samples && typeof ls.samples === "object" ? { ...ls.samples } : {},
      engagements: typeof ls.engagements === "string" ? ls.engagements : "",
      values:
        ls.values && typeof ls.values === "object" ? { ...ls.values } : {},
    };
  }

  return {
    v: 1,
    updatedAt:
      typeof d.updatedAt === "number" && Number.isFinite(d.updatedAt)
        ? d.updatedAt
        : 0,
    consumersSampled: clampNonNegInt(d.consumersSampled),
    skus,
    quotes,
    ...(lastSynced ? { lastSynced } : {}),
  };
}

export function readLiveShiftCounter(
  code: string,
  token: string,
  storage?: StorageLike,
): LiveShiftCounterState {
  if (!code || !token) return emptyLiveShiftCounter();
  try {
    const raw = storeOf(storage).getItem(liveCounterStorageKey(code, token));
    if (!raw) return emptyLiveShiftCounter();
    return asLiveShiftCounter(JSON.parse(raw) as unknown) ?? emptyLiveShiftCounter();
  } catch {
    return emptyLiveShiftCounter();
  }
}

export function writeLiveShiftCounter(
  code: string,
  token: string,
  next: Omit<LiveShiftCounterState, "v" | "updatedAt">,
  storage?: StorageLike,
): LiveShiftCounterState {
  const cleanedSkus: Record<string, LiveShiftSkuCounts> = {};
  for (const [k, v] of Object.entries(next.skus || {})) {
    const samples = clampNonNegInt(v?.samples);
    const sold = clampNonNegInt(v?.sold);
    if (samples > 0 || sold > 0) {
      cleanedSkus[k] = { samples, sold };
    }
  }
  const payload: LiveShiftCounterState = {
    v: 1,
    updatedAt: Date.now(),
    consumersSampled: clampNonNegInt(next.consumersSampled),
    skus: cleanedSkus,
    quotes: (next.quotes || [])
      .map((q) => ({ ...q, text: q.text.trim() }))
      .filter((q) => Boolean(q.text)),
    ...(next.lastSynced ? { lastSynced: next.lastSynced } : {}),
  };
  if (!code || !token) return payload;
  try {
    storeOf(storage).setItem(
      liveCounterStorageKey(code, token),
      JSON.stringify(payload),
    );
  } catch {
    /* storage quota / private mode */
  }
  return payload;
}

export function clearLiveShiftCounter(
  code: string,
  token: string,
  storage?: StorageLike,
): void {
  if (!code || !token) return;
  try {
    storeOf(storage).removeItem(liveCounterStorageKey(code, token));
  } catch {
    /* disposable */
  }
}

export function liveCounterTotals(state: LiveShiftCounterState): {
  totalSamples: number;
  totalSold: number;
  consumersSampled: number;
  quoteCount: number;
} {
  let totalSamples = 0;
  let totalSold = 0;
  for (const entry of Object.values(state.skus || {})) {
    totalSamples += clampNonNegInt(entry.samples);
    totalSold += clampNonNegInt(entry.sold);
  }
  return {
    totalSamples,
    totalSold,
    consumersSampled: clampNonNegInt(state.consumersSampled),
    quoteCount: (state.quotes || []).length,
  };
}

export function hasLiveCounterActivity(state: LiveShiftCounterState | null | undefined): boolean {
  if (!state) return false;
  const totals = liveCounterTotals(state);
  return (
    totals.totalSamples > 0 ||
    totals.totalSold > 0 ||
    totals.consumersSampled > 0 ||
    totals.quoteCount > 0
  );
}

export function hasSavedLiveCounterActivity(
  code: string,
  token: string,
  storage?: StorageLike,
): boolean {
  return hasLiveCounterActivity(readLiveShiftCounter(code, token, storage));
}

/**
 * Resolve active SKUs from the tenant Product catalog (`template.products`),
 * falling back to `Products Sampled` multiselect options only when the catalog
 * list is empty.
 */
export function resolveActiveCounterSkus(
  template: Template | null | undefined,
): CounterSkuItem[] {
  const products: TemplateProduct[] = template?.products ?? [];
  if (products.length > 0) {
    return [...products]
      .filter((p) => Boolean((p.name ?? "").trim()))
      .sort((a, b) => {
        const ca = (a.category ?? "").localeCompare(b.category ?? "");
        if (ca !== 0) return ca;
        return a.name.localeCompare(b.name);
      })
      .map((p) => ({
        id: String(p.id),
        name: p.name.trim(),
        category: (p.category ?? "").trim() || null,
      }));
  }

  const allFields = (template?.sections ?? []).flatMap((s) => s.fields ?? []);
  const multi = allFields.find((f) => isProductsSampledMultiselect(f));
  if (!multi || !Array.isArray(multi.options)) return [];

  const seen = new Set<string>();
  const out: CounterSkuItem[] = [];
  for (const opt of multi.options) {
    const raw = (opt ?? "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const skuName = optionSkuName(raw);
    const parts = raw.split(/\s+[—–-]\s+/);
    const category =
      parts.length >= 2 && parts[0]?.trim() && parts[0].trim() !== skuName
        ? parts[0].trim()
        : null;
    out.push({
      id: `opt:${raw}`,
      name: skuName,
      category,
      optionValue: raw,
    });
  }
  return out;
}

function normText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

const SOLD_FIELD_RE =
  /\b(units?\s+sold|cans?\s+sold|bottles?\s+sold|packs?\s+sold|cases?\s+sold|products?\s+sold|items?\s+sold|total\s+sold|sold|purchased)\b/i;
const SOLD_EXCLUDE_RE =
  /spend|receipt|dollar|amount|price|cost|card|giveaway|promo|intent|likely|plan\s+to|bar|sampl/i;

function isNumericTemplateField(field: TemplateField): boolean {
  const t = (field.type ?? "").toLowerCase();
  return t === "number" || t === "integer" || t === "int" || t === "decimal";
}

function isTextTemplateField(field: TemplateField): boolean {
  const t = (field.type ?? "").toLowerCase();
  return (
    t === "text" ||
    t === "long_text" ||
    t === "longtext" ||
    t === "textarea" ||
    t === "string"
  );
}

function findQuoteTargetField(fields: TemplateField[]): TemplateField | null {
  const textFields = fields.filter(isTextTemplateField);
  if (textFields.length === 0) return null;

  const explicit = textFields.find((f) =>
    /quote|verbatim|consumer.*sa(?:id|y)|shopper.*sa(?:id|y)|what.*(?:people|consumers?).*sa(?:id|y)/i.test(
      f.name,
    ),
  );
  if (explicit) return explicit;

  const feedback = textFields.find(
    (f) =>
      /consumer\s+feedback|shopper\s+feedback|customer\s+feedback|helpful\s+feedback|feedback|reaction|testimonial/i.test(
        f.name,
      ) &&
      !/store\s*manager|account|organizer|venue|competitor|staff|liquor\s+manager/i.test(
        f.name,
      ),
  );
  if (feedback) return feedback;

  const fallbackNotes = textFields.find(
    (f) =>
      /\b(highlights?|comments?|notes?)\b/i.test(f.name) &&
      !/store|account|competitor|mileage|address|number|manager|venue/i.test(
        f.name,
      ),
  );
  return fallbackNotes ?? null;
}

export function formatQuoteLines(quotes: readonly LiveShiftQuote[]): string {
  return quotes
    .map((q) => q.text.replace(/^["“”'\s]+|["“”'\s]+$/g, "").trim())
    .filter(Boolean)
    .map((clean) => `"${clean}"`)
    .join("\n");
}

function canOverwriteScalar(
  current: string | string[] | undefined,
  prevSynced: string | string[] | undefined,
): boolean {
  if (Array.isArray(current)) return false;
  const cur = String(current ?? "").trim();
  if (!cur) return true;
  if (typeof prevSynced === "string" && cur === prevSynced.trim()) return true;
  return false;
}

/**
 * Sync live shift counter counts + consumer quotes into `RecapDraft` in
 * `localStorage` so `RecapForm` pre-populates when the ambassador starts
 * their recap or clocks out.
 *
 * Non-destructive: any field the ambassador manually edited inside `RecapForm`
 * (diverging from `lastSynced`) is preserved untouched.
 */
export function syncLiveCounterToRecapDraft({
  code,
  token,
  template,
  serverDraft = null,
  storage,
}: {
  code: string;
  token: string;
  template: Template | null | undefined;
  serverDraft?: RecapDraft | null;
  storage?: StorageLike;
}): boolean {
  if (!code || !token) return false;
  const state = readLiveShiftCounter(code, token, storage);
  const hadPreviousSync = Boolean(state.lastSynced);
  if (!hasLiveCounterActivity(state) && !hadPreviousSync) return false;

  const existingLocal = readDraft(code, token, "shift", storage);
  const base = pickRestoredDraft(existingLocal, asRecapDraft(serverDraft));
  const values: Record<string, string | string[]> = { ...(base?.values ?? {}) };
  const samples: Record<string, string> = { ...(base?.samples ?? {}) };
  let engagements = base?.engagements ?? "";

  const prevSynced: LiveShiftLastSynced = state.lastSynced ?? {
    samples: {},
    engagements: "",
    values: {},
  };
  const nextSynced: LiveShiftLastSynced = {
    samples: {},
    engagements: "",
    values: {},
  };

  const allFields = (template?.sections ?? []).flatMap((s) => s.fields ?? []);
  const products = template?.products ?? [];
  const skus = resolveActiveCounterSkus(template);

  // 1. Per-SKU Samples -> `draft.samples[productId]` + `Products Sampled` multiselect pills
  for (const sku of skus) {
    if (sku.id.startsWith("opt:")) continue;
    const count = state.skus[sku.id]?.samples ?? 0;
    const nextVal = count > 0 ? String(count) : "";
    const prevVal = prevSynced.samples[sku.id];
    if (!nextVal && prevVal === undefined) continue;

    if (canOverwriteScalar(samples[sku.id], prevVal)) {
      if (nextVal) {
        samples[sku.id] = nextVal;
        nextSynced.samples[sku.id] = nextVal;
      } else {
        delete samples[sku.id];
      }
    } else if (samples[sku.id]) {
      nextSynced.samples[sku.id] = samples[sku.id];
    }
  }

  const sampledMultiselect = allFields.find((f) => isProductsSampledMultiselect(f));
  if (sampledMultiselect) {
    const availableOptions =
      products.length > 0
        ? catalogSampleOptions(products)
        : (sampledMultiselect.options ?? []);
    const existingSelection = Array.isArray(values[sampledMultiselect.id])
      ? [...(values[sampledMultiselect.id] as string[])]
      : [];
    const prevSelection = Array.isArray(prevSynced.values[sampledMultiselect.id])
      ? (prevSynced.values[sampledMultiselect.id] as string[])
      : [];

    const activeOptions: string[] = [];
    for (const opt of availableOptions) {
      if (products.length > 0) {
        const matched = matchProductForSampleOption(opt, products);
        if (matched && (state.skus[String(matched.id)]?.samples ?? 0) > 0) {
          activeOptions.push(opt);
        }
      } else if ((state.skus[`opt:${opt}`]?.samples ?? 0) > 0) {
        activeOptions.push(opt);
      }
    }

    // Remove options that were previously auto-added by the counter and tapped back to 0,
    // while keeping any pills the BA manually tapped in RecapForm.
    let merged = existingSelection.filter((sel) => {
      const wasAutoAdded = sampleOptionSelected(sel, prevSelection);
      if (!wasAutoAdded) return true;
      return sampleOptionSelected(sel, activeOptions);
    });
    for (const opt of activeOptions) {
      if (!sampleOptionSelected(opt, merged)) {
        merged = [...merged, opt];
      }
    }
    if (merged.length > 0 || prevSelection.length > 0) {
      values[sampledMultiselect.id] = merged;
      nextSynced.values[sampledMultiselect.id] = merged;
    }
  }

  // 2. Per-SKU Sold -> per-SKU numeric sold fields, or single aggregate units-sold numeric field
  const numericSoldFields = allFields.filter(
    (f) =>
      isNumericTemplateField(f) &&
      SOLD_FIELD_RE.test(f.name) &&
      !SOLD_EXCLUDE_RE.test(f.name),
  );
  let matchedAnyPerSkuSold = false;
  for (const sku of skus) {
    const soldCount = state.skus[sku.id]?.sold ?? 0;
    const skuNorm = normText(sku.name);
    if (!skuNorm) continue;
    const perSkuField = numericSoldFields.find((f) =>
      normText(f.name).includes(skuNorm),
    );
    if (!perSkuField) continue;
    matchedAnyPerSkuSold = true;
    const nextVal = soldCount > 0 ? String(soldCount) : "";
    const prevVal = prevSynced.values[perSkuField.id];
    if (!nextVal && prevVal === undefined) continue;
    if (canOverwriteScalar(values[perSkuField.id], prevVal)) {
      if (nextVal) {
        values[perSkuField.id] = nextVal;
        nextSynced.values[perSkuField.id] = nextVal;
      } else {
        delete values[perSkuField.id];
      }
    }
  }

  if (!matchedAnyPerSkuSold && numericSoldFields.length === 1) {
    const aggField = numericSoldFields[0]!;
    const { totalSold } = liveCounterTotals(state);
    const nextVal = totalSold > 0 ? String(totalSold) : "";
    const prevVal = prevSynced.values[aggField.id];
    if (nextVal || prevVal !== undefined) {
      if (canOverwriteScalar(values[aggField.id], prevVal)) {
        if (nextVal) {
          values[aggField.id] = nextVal;
          nextSynced.values[aggField.id] = nextVal;
        } else {
          delete values[aggField.id];
        }
      }
    }
  }

  // 3. Total Consumers Sampled (strictly separate from SKU sample count)
  const consumersVal =
    state.consumersSampled > 0 ? String(state.consumersSampled) : "";
  if (templateHasConsumersSampledField(allFields)) {
    for (const field of allFields) {
      if (!isConsumersSampledCountField(field.name)) continue;
      const prevVal = prevSynced.values[field.id];
      if (!consumersVal && prevVal === undefined) continue;
      if (canOverwriteScalar(values[field.id], prevVal)) {
        if (consumersVal) {
          values[field.id] = consumersVal;
          nextSynced.values[field.id] = consumersVal;
        } else {
          delete values[field.id];
        }
      }
    }
  } else if (consumersVal || prevSynced.engagements) {
    if (canOverwriteScalar(engagements, prevSynced.engagements)) {
      engagements = consumersVal;
      nextSynced.engagements = consumersVal;
    }
  }

  // 4. Verbatim Consumer Quotes -> best quote / consumer feedback field
  const quoteField = findQuoteTargetField(allFields);
  if (quoteField) {
    const formattedQuotes = formatQuoteLines(state.quotes);
    const prevVal = prevSynced.values[quoteField.id];
    const currentRaw = values[quoteField.id];
    if (formattedQuotes || prevVal !== undefined) {
      if (canOverwriteScalar(currentRaw, prevVal)) {
        if (formattedQuotes) {
          values[quoteField.id] = formattedQuotes;
          nextSynced.values[quoteField.id] = formattedQuotes;
        } else {
          delete values[quoteField.id];
        }
      } else if (typeof currentRaw === "string" && formattedQuotes) {
        // BA manually typed notes in RecapForm AND added new quotes on the
        // scratchpad: append any missing quote lines without clobbering their prose.
        const missingLines = formattedQuotes
          .split("\n")
          .filter((line) => line && !currentRaw.includes(line));
        if (missingLines.length > 0) {
          const combined = `${currentRaw.trimEnd()}\n${missingLines.join("\n")}`;
          values[quoteField.id] = combined;
          nextSynced.values[quoteField.id] = combined;
        }
      }
    }
  }

  writeDraft(
    code,
    token,
    {
      values,
      samples,
      engagements,
      ...(base?.usedCorpoCard !== undefined
        ? { usedCorpoCard: base.usedCorpoCard }
        : {}),
      ...(base?.store ? { store: base.store } : {}),
      ...(base?.photos ? { photos: base.photos } : {}),
      ...(base?.coBrands ? { coBrands: base.coBrands } : {}),
    },
    "shift",
    storage,
  );

  writeLiveShiftCounter(
    code,
    token,
    {
      consumersSampled: state.consumersSampled,
      skus: state.skus,
      quotes: state.quotes,
      lastSynced: nextSynced,
    },
    storage,
  );

  return true;
}
