/**
 * Display helpers for receipt readings and staff-only recap flags
 * (`recapReceiptAudit`, `recapStaffFlags`, `receiptSpendSummary`). Pure, so
 * the panel and the Receipt checks page read the same way.
 */

export type FlagSeverity = "high" | "medium" | "low";

export const FLAG_KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All kinds" },
  { value: "duplicate_receipt", label: "Duplicate receipt" },
  { value: "store_mismatch", label: "Receipt from another store" },
  { value: "short_clock", label: "Very short clock-in" },
  { value: "late_staff_filing", label: "Filed late by staff" },
  { value: "duplicate_photo", label: "Duplicate photo" },
  { value: "receipt_math", label: "Receipt doesn't add up" },
];

const KIND_LABEL = new Map(FLAG_KIND_OPTIONS.map((o) => [o.value, o.label]));

export function flagKindLabel(kind: string): string {
  return KIND_LABEL.get(kind) ?? kind.replace(/_/g, " ");
}

const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/** Open flags first, then high → low, then newest. */
export function sortFlags<
  T extends { severity: string; resolvedAt?: string | null; createdAt?: string | null },
>(flags: readonly T[]): T[] {
  return [...flags].sort((a, b) => {
    const open = Number(Boolean(a.resolvedAt)) - Number(Boolean(b.resolvedAt));
    if (open !== 0) return open;
    const sev = (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3);
    if (sev !== 0) return sev;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });
}

export function severityTone(severity: string): {
  label: string;
  color: string;
  background: string;
  border: string;
} {
  switch (severity) {
    case "high":
      return {
        label: "High",
        color: "var(--spark-flag-ink, #ffb59d)",
        background: "rgba(239,90,42,0.14)",
        border: "rgba(239,90,42,0.55)",
      };
    case "medium":
      return {
        label: "Medium",
        color: "var(--spark-warn-ink, #f5c042)",
        background: "rgba(245,192,66,0.12)",
        border: "rgba(245,192,66,0.45)",
      };
    default:
      return {
        label: "Low",
        color: "var(--spark-text-secondary)",
        background: "rgba(var(--spark-ink-rgb),0.04)",
        border: "var(--spark-border)",
      };
  }
}

/** "62.70" → "$62.70"; null / "" → "—". */
export function formatMoney(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? "−" : ""}$${abs}`;
}

/** "14:07" → "2:07 PM"; anything else → "". */
export function receiptTimeLabel(hhmm: string | null | undefined): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm ?? "");
  if (!m) return "";
  const hour = Number(m[1]);
  const suffix = hour < 12 ? "AM" : "PM";
  return `${hour % 12 || 12}:${m[2]} ${suffix}`;
}

/** "2026-10-23" → "Oct 23, 2026"; anything else passes through. */
export function receiptDateLabel(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return iso ?? "";
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}, ${m[1]}`;
}

export function readingStatusLabel(status: string): string {
  switch (status) {
    case "read":
      return "Read";
    case "unreadable":
      return "Partly read";
    case "pending":
      return "Waiting to be read";
    case "failed":
      return "Couldn't read";
    case "not_a_receipt":
      return "Not a receipt";
    default:
      return status;
  }
}

/** "Total Wine & More #903 · Palm Beach Gardens" from the reading parts. */
export function storeLine(r: {
  merchant: string;
  storeNumber: string;
  city: string;
  stateCode?: string;
}): string {
  const name = [r.merchant || "Store", r.storeNumber ? `#${r.storeNumber}` : ""]
    .filter(Boolean)
    .join(" ");
  const place = [r.city, r.stateCode].filter(Boolean).join(", ");
  return place ? `${name} · ${place}` : name;
}

export function confidenceLabel(confidence: number | null | undefined): string {
  if (confidence == null) return "";
  if (confidence >= 0.85) return "High confidence";
  if (confidence >= 0.6) return "Medium confidence";
  return "Low confidence";
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The last 30 days, ending today, as YYYY-MM-DD. */
export function defaultRange(today: Date = new Date()): { from: string; to: string } {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
  return { from: iso(start), to: iso(today) };
}

export function csvFileName(scope: string, from: string, to: string): string {
  const slug = (scope || "all-brands")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `receipt-spend_${slug || "brand"}_${from}_${to}.csv`;
}
