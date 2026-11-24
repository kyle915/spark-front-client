/**
 * Plain helpers for KPI tiles that explain themselves (tenantKpiExplanation /
 * tenantKpiStatus) and for the recap template editor's check before saving.
 * No React, no Relay — tested in kpiExplain.test.ts.
 */

/** Server tile keys (snake_case), as tenantKpiExplanation takes them. */
export type KpiMetric =
  | "products_sold"
  | "consumers_reached"
  | "samples_distributed"
  | "total_engagements"
  | "first_time_consumers"
  | "brand_aware_consumers"
  | "willing_to_purchase";

export type KpiStatus = {
  untrackedMetrics: readonly string[];
  pending: readonly { metric: string; recaps: number; wouldAdd?: number | null }[];
};

/**
 * Which server metric the collapsed "Consumers sampled" tile is showing.
 * collapseSamplingKpis falls back reached → samples → engagements, so the
 * explanation must follow the same value or it would not match the tile.
 */
export function samplingTileMetric(
  key: "consumersSampled" | "samplesDistributed" | "totalEngagements",
  totals: { consumersReached: number; samplesDistributed: number },
): KpiMetric {
  if (key === "samplesDistributed") return "samples_distributed";
  if (key === "totalEngagements") return "total_engagements";
  if (totals.consumersReached) return "consumers_reached";
  if (totals.samplesDistributed) return "samples_distributed";
  return "total_engagements";
}

export const NOT_TRACKED_TEXT = "Not tracked on this form";

/** True when no recap form has a field for this number and the tile reads 0:
 *  show "Not tracked on this form", not a zero. */
export function isNotTracked(
  metric: KpiMetric | undefined,
  value: number,
  status: KpiStatus | null,
): boolean {
  if (!metric || !status || value !== 0) return false;
  return status.untrackedMetrics.includes(metric);
}

/** "+3 pending approval" beside a tile, or null. */
export function pendingHint(
  metric: KpiMetric | undefined,
  status: KpiStatus | null,
): string | null {
  if (!metric || !status) return null;
  const row = status.pending.find((p) => p.metric === metric);
  if (!row || row.recaps <= 0) return null;
  return `+${row.recaps.toLocaleString()} pending approval`;
}

/** How a field came to count, in words a client can read. */
export function howLabel(how: string): string {
  if (how === "confirmed") return "Confirmed by Ignite";
  if (how === "wording") return "Matched by its wording";
  return "Standard recap number";
}

/** The template editor's mapping card anchor: the dashboard's "Fix mapping"
 *  link and the editor's "Review mapping" land on it. */
export const METRIC_MAPPING_ANCHOR = "metric-mapping";

/** Where staff fix what a form counts: the template editor's mapping card. */
export function mappingHref(templateUuid: string): string {
  return `/recap-templates/${encodeURIComponent(templateUuid)}/edit#${METRIC_MAPPING_ANCHOR}`;
}

export function recapsText(n: number): string {
  return `${n.toLocaleString()} ${n === 1 ? "recap" : "recaps"}`;
}

/** One line for a left-out bucket: "3 recaps · would add 10". */
export function excludedLine(b: { recaps: number; wouldAdd?: number | null }): string {
  const base = recapsText(b.recaps);
  if (b.wouldAdd == null) return `${base} not counted yet`;
  return `${base} · would add ${b.wouldAdd.toLocaleString()}`;
}

/** Templates a staff member can open to fix the mapping, deduplicated. */
export function fixTargets(
  sources: readonly { templateUuid?: string | null; templateName: string }[],
  notTracked: readonly { templateUuid?: string | null; templateName: string }[],
): { uuid: string; name: string }[] {
  const seen = new Set<string>();
  const out: { uuid: string; name: string }[] = [];
  for (const t of [...notTracked, ...sources]) {
    if (!t.templateUuid || seen.has(t.templateUuid)) continue;
    seen.add(t.templateUuid);
    out.push({ uuid: t.templateUuid, name: t.templateName });
  }
  return out;
}

/* ───────────── template editor: check before saving ───────────── */

export type TemplatePreview = {
  missingMetrics: readonly { key: string; label: string }[];
  uncountedFields: readonly string[];
};

/** True when the editor should ask before saving. */
export function previewNeedsAck(preview: TemplatePreview | null | undefined): boolean {
  if (!preview) return false;
  return preview.missingMetrics.length > 0 || preview.uncountedFields.length > 0;
}

/** The warning's sentences, plain and in order. */
export function previewLines(preview: TemplatePreview): string[] {
  const lines: string[] = [];
  if (preview.missingMetrics.length) {
    const labels = preview.missingMetrics.map((m) => m.label.toLowerCase());
    lines.push(
      `No field on this form feeds ${joinList(labels)}. Clients will see “${NOT_TRACKED_TEXT.toLowerCase()}” for ${
        labels.length === 1 ? "it" : "them"
      }.`,
    );
  }
  for (const name of preview.uncountedFields) {
    lines.push(
      `“${name}” looks like a count, but Spark will not add it to any number. Confirm what it counts in the mapping below.`,
    );
  }
  return lines;
}

function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, or ${items.at(-1)}`;
}
