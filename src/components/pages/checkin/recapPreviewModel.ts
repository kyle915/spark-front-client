/**
 * Read-only recap preview — what the recap will ask, before the BA clocks in.
 *
 * BAs on one bar of signal clock in late and only then find out the recap
 * wants a shelf photo and a consumer count they never kept. The preview shows
 * every question and the photos to take, plus a short "Before your shift"
 * checklist, from the link alone. Opening it never identifies the BA, clocks
 * anything in, or creates an event (spark-api `ambassadors/recap_preview.py`,
 * `GET /api/public/checkin/<code>/preview`).
 *
 * Pure helpers only; the sheet and the page live in RecapPreview.tsx and
 * SparkRecapPreview.tsx.
 */
import { apiOrigin, choiceKind, isPhotoType } from "./checkinHelpers";
import type { Context } from "./checkinTypes";
import type { ShowWhen } from "./fieldConditions";

export type PreviewField = {
  id: string;
  name: string;
  type: string;
  required: boolean;
  options: string[];
  placeholder?: string;
  showWhen?: ShowWhen | null;
};
export type PreviewSection = { name: string; fields: PreviewField[] };
export type PreviewProgram = {
  id: string;
  name: string;
  label?: string;
  description?: string;
};
export type PreviewBucket = { name: string; helper: string; min: number };
export type RecapPreviewPayload = {
  brand?: Context["brand"];
  programs: PreviewProgram[];
  programPickerTitle?: string;
  program: PreviewProgram | null;
  /** Multi-program link opened with no (valid) program: ask which one. */
  needsProgram: boolean;
  template: {
    name: string;
    productSamples: boolean;
    sampleQtyLabel?: string;
    sections: PreviewSection[];
    products: { name: string; category?: string | null }[];
  } | null;
  photoBuckets: PreviewBucket[];
  /** The recap always needs at least this many photos in total. */
  minPhotos: number;
};

export const PREVIEW_BUTTON_LABEL = "Preview the recap";
export const PREVIEW_TITLE = "Recap preview";
export const PREVIEW_BUTTON_HINT =
  "See the questions and photos before you start. You won't be checked in.";
export const PREVIEW_INTRO =
  "Here's what the recap will ask after your shift. Nothing here is saved or sent, and you're not checked in.";

/** Page URL for the no-login preview (what the reminder email links to). */
export function previewPath(code: string, programId?: string | null): string {
  const base = `/checkin/${encodeURIComponent(code)}/preview`;
  return programId ? `${base}?program=${encodeURIComponent(programId)}` : base;
}

/** API URL for the preview payload. */
export function previewApiUrl(code: string, programId?: string | null): string {
  const base = `${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/preview`;
  return programId ? `${base}?program=${encodeURIComponent(programId)}` : base;
}

export type FieldKind =
  | "number"
  | "choice"
  | "multi"
  | "photo"
  | "long"
  | "text"
  | "signature"
  | "letter";

export function fieldKind(type: string): FieldKind {
  const t = (type || "").toLowerCase();
  if (t === "signature") return "signature";
  if (t === "letter") return "letter";
  if (isPhotoType(t)) return "photo";
  const choice = choiceKind(t);
  if (choice === "multiselect") return "multi";
  if (choice === "select") return "choice";
  if (t.includes("number") || t.includes("int") || t.includes("decimal")) return "number";
  if (t.includes("long") || t.includes("area") || t.includes("paragraph")) return "long";
  return "text";
}

/** Short type hint shown under each question. */
export function fieldTypeHint(field: Pick<PreviewField, "type" | "options">): string {
  const kind = fieldKind(field.type);
  switch (kind) {
    case "number":
      return "Number";
    case "choice":
      return "Pick one";
    case "multi":
      return "Pick all that apply";
    case "photo":
      return "Photos";
    case "long":
      return "A few sentences";
    case "signature":
      return "Sign with a finger or mouse";
    case "letter":
      return "One letter";
    case "text":
      return "Short answer";
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

/** "Only if Store traffic is Busy" for a field that depends on another. */
export function conditionHint(
  field: Pick<PreviewField, "showWhen">,
  allFields: ReadonlyArray<Pick<PreviewField, "id" | "name">>,
): string | null {
  const rule = field.showWhen;
  if (!rule) return null;
  const source = allFields.find((f) => f.id === rule.fieldId);
  if (!source) return null;
  const value = (rule.includes ?? "").trim();
  if (!value) return `Only asked for some answers to ${source.name}`;
  return `Only if ${source.name} is ${value}`;
}

/** "at least 3", "at least 1", "optional". */
export function photoCountLabel(min: number): string {
  if (min > 0) return `at least ${min}`;
  return "optional";
}

export type ChecklistItem = { text: string; note?: string | null };
export type Checklist = {
  /** Numbers to count or keep track of during the demo. */
  counts: ChecklistItem[];
  /** Required answers picked from a list. */
  answers: ChecklistItem[];
  /** Photos to take, by bucket. */
  photos: ChecklistItem[];
};

const stripColon = (s: string) => s.trim().replace(/[:\s]+$/, "");

/**
 * The "Before your shift" summary, generated from the form: required number
 * fields to count, required choices to note, product counts, and the photos.
 */
export function buildChecklist(payload: RecapPreviewPayload): Checklist {
  const counts: ChecklistItem[] = [];
  const answers: ChecklistItem[] = [];
  const photos: ChecklistItem[] = [];
  const template = payload.template;
  const fields = template?.sections.flatMap((s) => s.fields) ?? [];

  if (template?.productSamples) {
    const unit = stripColon(template.sampleQtyLabel || "") || "Amount sampled";
    counts.push({
      text: `${unit}, for each product`,
      note:
        template.products.length > 0
          ? `${template.products.length} product${template.products.length === 1 ? "" : "s"} on the list`
          : null,
    });
  }

  for (const f of fields) {
    if (!f.required) continue;
    const note = conditionHint(f, fields);
    const kind = fieldKind(f.type);
    if (kind === "number") {
      counts.push({ text: stripColon(f.name), note });
    } else if (kind === "choice" || kind === "multi") {
      const opts = f.options.slice(0, 4).join(", ");
      const more = f.options.length > 4 ? ` and ${f.options.length - 4} more` : "";
      answers.push({
        text: stripColon(f.name),
        note: [opts ? `${opts}${more}` : null, note].filter(Boolean).join(" · ") || null,
      });
    } else if (kind === "photo") {
      photos.push({ text: stripColon(f.name), note: note ?? "required" });
    } else if (kind === "signature" || kind === "letter") {
      answers.push({ text: stripColon(f.name), note });
    }
  }

  if (payload.photoBuckets.length > 0) {
    for (const b of payload.photoBuckets) {
      photos.push({ text: b.name, note: photoCountLabel(b.min) });
    }
  }
  if (photos.length === 0 && payload.minPhotos > 0) {
    photos.push({
      text: "Photos of your setup",
      note: `at least ${payload.minPhotos}`,
    });
  }
  return { counts, answers, photos };
}

export function questionCount(payload: RecapPreviewPayload): number {
  return payload.template?.sections.reduce((n, s) => n + s.fields.length, 0) ?? 0;
}

/**
 * Preview built from the check-in context the page already holds (after the
 * BA has identified). Uses the event's REAL template and buckets, so a shift
 * joined onto a scheduled event with its own form previews that form.
 */
export function previewFromContext(ctx: Context): RecapPreviewPayload | null {
  if (!ctx.template || ctx.timesheetOnly) return null;
  const t = ctx.template;
  return {
    brand: ctx.brand,
    programs: [],
    program: ctx.event?.eventType
      ? { id: ctx.event.eventType.id, name: ctx.event.eventType.name }
      : null,
    needsProgram: false,
    template: {
      name: t.name,
      productSamples: t.productSamples,
      sampleQtyLabel: t.sampleQtyLabel,
      sections: t.sections.map((s) => ({
        name: s.name,
        fields: s.fields.map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          required: f.required,
          options: f.options ?? [],
          placeholder: f.placeholder,
          showWhen: f.showWhen ?? null,
        })),
      })),
      products: t.products.map((p) => ({ name: p.name, category: p.category })),
    },
    photoBuckets: (ctx.photoBuckets ?? []).map((b) => ({
      name: b.name,
      helper: b.helper,
      min: b.min,
    })),
    minPhotos: 1,
  };
}

// ── Offline copy ────────────────────────────────────────────────────────────
// The service worker keeps the page shell and the last API answer; this is the
// same answer in localStorage for browsers where the worker isn't running
// (in-app browsers, private tabs). Read only when the network fails.
const STORE_PREFIX = "spark.checkin.preview.v1";

const storeKey = (code: string, programId?: string | null) =>
  `${STORE_PREFIX}.${code.toUpperCase()}.${programId || "default"}`;

export function writeCachedPreview(
  code: string,
  programId: string | null | undefined,
  payload: RecapPreviewPayload,
): void {
  try {
    localStorage.setItem(
      storeKey(code, programId),
      JSON.stringify({ savedAt: Date.now(), payload }),
    );
  } catch {
    /* storage full or blocked — the preview still works online */
  }
}

export function readCachedPreview(
  code: string,
  programId?: string | null,
): RecapPreviewPayload | null {
  try {
    const raw = localStorage.getItem(storeKey(code, programId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { payload?: RecapPreviewPayload };
    return parsed?.payload ?? null;
  } catch {
    return null;
  }
}

export type PreviewLoad =
  | { kind: "ok"; payload: RecapPreviewPayload; offline: boolean }
  | { kind: "error"; message: string; code?: string };

export const PREVIEW_OFFLINE_NO_COPY =
  "No signal, and this phone hasn't saved the recap preview yet. Try again when you have a connection.";

/** Fetch the preview; fall back to this phone's saved copy when offline. */
export async function loadRecapPreview(
  code: string,
  programId: string | null | undefined,
  doFetch: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<PreviewLoad> {
  try {
    const res = await doFetch(previewApiUrl(code, programId));
    const json = (await res.json()) as RecapPreviewPayload & {
      error?: string;
      message?: string;
    };
    if (!res.ok || json.error) {
      return {
        kind: "error",
        code: json.error,
        message: json.message || "Couldn't load the recap preview.",
      };
    }
    writeCachedPreview(code, programId, json);
    return { kind: "ok", payload: json, offline: false };
  } catch {
    const cached = readCachedPreview(code, programId);
    if (cached) return { kind: "ok", payload: cached, offline: true };
    return { kind: "error", code: "offline", message: PREVIEW_OFFLINE_NO_COPY };
  }
}
