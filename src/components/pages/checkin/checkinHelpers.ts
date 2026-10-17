import { clearDraft } from "./recapDraft";
import type { DraftPhoto } from "./photoDraft";
import { coerceHeicFile, isHeicUpload } from "./heicUpload";
import { FIELD_PHOTO_PREP, prepareImageForUpload } from "@/utils/compressImageForUpload";
import { createLimiter } from "./uploadLimiter";
import {
  CLOCK_FETCH_TIMEOUT_MS,
} from "./offlineClock";
import {
  RECAP_FETCH_TIMEOUT_MS,
  flushPendingRecap,
  putCheckinPhoto,
  readPendingRecap,
} from "./offlineRecap";
import { recapSubmitErrorMessage } from "./recapSubmitError";
import type { CheckinResource, Clock, Context, Photo } from "./checkinTypes";
import type { PayableMileageClaim, PayableMileageState } from "./payableMileage";

// Pure helpers + public check-in API calls extracted from SparkCheckin.tsx
// in the step split — same behaviour, no changes.

export const draftPhotoOf = (p: Photo): DraftPhoto => ({
  id: p.id,
  blobName: p.blobName,
  category: p.category,
  name: p.file.name,
  type: p.file.type,
});

export const FALLBACK_ACCENT = "#C4D82E";

export function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

// Enough to use the connection, few enough that one stalled PUT doesn't hold
// up the rest. Serial uploads were the other half of "photos won't upload".
// Shared by every pick, restore and retry on the page.
export const photoUploads = createLimiter(3);
// Decoding a 12MP shot to re-encode it is the memory spike; two at a time.
export const photoPrep = createLimiter(2);

// Weak signal / rate limit / server hiccup: try again on our own before the
// BA has to notice. After these, the tile waits for Retry.
export const AUTO_RETRY_DELAYS_MS = [5_000, 20_000, 60_000];

export const UNREADABLE_PHOTO_MESSAGE =
  "This photo didn't stay saved on your phone — remove it and take or pick it again.";

export function retryableUploadFailure(failedOffline: boolean, reason: string): boolean {
  return (
    failedOffline ||
    /try again|too many|wait a minute|upload failed|couldn't prepare/i.test(reason)
  );
}

export async function fileIsReadable(file: File): Promise<boolean> {
  if (file.size === 0) return false;
  try {
    await file.slice(0, 64).arrayBuffer();
    return true;
  } catch {
    return false;
  }
}

/**
 * Parallel heic2any WASM OOMs iPhone Safari when a BA picks a big Camera Roll
 * batch. JPEG/PNG downscale can still run concurrent with PUTs; HEIC decode
 * waits its turn.
 */
let heicPrepChain: Promise<void> = Promise.resolve();

/** HEIC decode can hang on iPhone Safari — don't leave the tile on "uploading". */
export const HEIC_PREP_TIMEOUT_MS = 20_000;

/** HEIC→JPEG + field downscale (see FIELD_PHOTO_PREP). Videos pass through. */
export async function compressImage(file: File): Promise<File> {
  if (file.type.startsWith("video/") && !isHeicUpload(file)) return file;
  const coerced = await coerceHeicFile(file);
  if (!isHeicUpload(coerced)) {
    return prepareImageForUpload(coerced, FIELD_PHOTO_PREP);
  }
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const prev = heicPrepChain;
  heicPrepChain = prev.then(() => gate);
  await prev;
  try {
    const prepared = prepareImageForUpload(coerced, FIELD_PHOTO_PREP);
    const timed = new Promise<File>((_resolve, reject) => {
      window.setTimeout(
        () => reject(new Error("Photo took too long to convert — try JPEG, or tap Retry.")),
        HEIC_PREP_TIMEOUT_MS,
      );
    });
    return await Promise.race([prepared, timed]);
  } finally {
    release();
  }
}

/**
 * The resources to show, tolerating an API that only sends `trainingUrl`.
 *
 * The backend ships both keys during the deploy gap, but this page can also be
 * loaded against an older API, so the legacy field is folded into the same shape
 * rather than handled separately. Label and subtitle match what this component
 * hard-coded before the list existed, so a brand's card never silently rewords.
 */
export function checkinResources(ctx: Context): CheckinResource[] {
  if (ctx.resources?.length) return ctx.resources;
  const legacy = (ctx.trainingUrl || "").trim();
  if (!legacy) return [];
  return [
    {
      label: "BA reference & training",
      kind: "link",
      url: legacy,
      note: "Field guide, video, product sheets",
    },
  ];
}

export function apiOrigin(): string {
  try {
    return new URL(import.meta.env.VITE_GRAPHQL_ENDPOINT as string).origin;
  } catch {
    return "";
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = CLOCK_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export const isPhotoType = (t: string) => t.includes("photo") || t.includes("image");
export const choiceKind = (t: string): "select" | "multiselect" | null => {
  if (t === "multiselect" || t.includes("multi")) return "multiselect";
  if (t === "select" || t.includes("dropdown")) return "select";
  return null;
};

// Local calendar date as YYYY-MM-DD for the date input. Uses the LOCAL parts,
// never toISOString() — that converts to UTC first, so a BA checking in after
// ~5pm Pacific would be handed tomorrow's date.
// Bounds for the "date you're working" picker, mirroring the server's window
// (CHECKIN_MAX_PAST_DAYS / CHECKIN_MAX_FUTURE_DAYS in events/checkin_views.py).
// Kept in the picker as well as on the server so a BA sees the limit in the
// calendar instead of typing a date and getting an error back.
export const CHECKIN_MAX_PAST_DAYS = 90;
export const CHECKIN_MAX_FUTURE_DAYS = 14;

export const shiftedISO = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const todayISO = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * TS twin of the backend's `normalize_place` (ambassadors/checkin_web.py).
 * Must stay in step with it: the server keys find-or-create on this shape, so
 * this is how the page decides a GPS-derived address is "the same store" as
 * one already on the list rather than a new one.
 */
export const normalizePlace = (value: string): string =>
  (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Who this phone said they were last time, per link.
 *
 * A standing link is worked by the same handful of BAs all season, so making
 * them retype their name and cell for every event is the difference between a
 * tool they use and one they avoid. Stored per code, on their own device.
 *
 * Name and cell only for PII — plus the last market/store they used on this
 * link so a lost session can re-identify and resume today's open punch without
 * retyping (Michelle / Feel Free: left for the release QR, came back blank).
 */
export type Identity = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  /** Last market or store address submitted on identify for this code. */
  lastPlace?: string;
  /** Last program id — needed when Product Seeding omitted a place. */
  lastEventTypeId?: string;
};
export const IDENTITY_KEY = (code: string) => `@spark.checkin.who/${code}`;

export const readIdentity = (code: string): Identity => {
  const empty: Identity = { firstName: "", lastName: "", phone: "", email: "" };
  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY(code));
    if (!raw) return empty;
    const p = JSON.parse(raw) as Partial<Identity>;
    return {
      firstName: p.firstName || "",
      lastName: p.lastName || "",
      phone: p.phone || "",
      email: p.email || "",
      lastPlace: (p.lastPlace || "").trim() || undefined,
      lastEventTypeId: (p.lastEventTypeId || "").trim() || undefined,
    };
  } catch {
    return empty;
  }
};

export const writeIdentity = (code: string, who: Identity): void => {
  try {
    window.localStorage.setItem(IDENTITY_KEY(code), JSON.stringify(who));
  } catch {
    /* private mode / quota — prefill is a convenience, never required */
  }
};

// Answers autosave in recapDraft.ts (device) and recapServerDraft.ts
// (unfiled server copy). Photos stay in photoDraft.ts.

export async function postCheckinClock(
  code: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; alreadyIn?: boolean }> {
  const res = await fetchWithTimeout(
    `${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/clock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  let alreadyIn = false;
  try {
    const json = (await res.clone().json()) as { alreadyIn?: boolean; clock?: Clock };
    alreadyIn = Boolean(json.alreadyIn || json.clock?.state === "clocked_in");
  } catch {
    /* gateway / empty */
  }
  return { ok: res.ok, status: res.status, alreadyIn };
}

export async function postCheckinPayableMileage(
  code: string,
  body: Record<string, unknown>,
): Promise<{
  ok: boolean;
  status: number;
  claim?: PayableMileageClaim | null;
  payableMileage?: PayableMileageState | null;
  message?: string;
}> {
  const res = await fetchWithTimeout(
    `${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/payable-mileage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  let claim: PayableMileageClaim | null | undefined;
  let payableMileage: PayableMileageState | null | undefined;
  let message: string | undefined;
  try {
    const json = (await res.clone().json()) as {
      claim?: PayableMileageClaim;
      payableMileage?: PayableMileageState;
      message?: string;
      error?: string;
    };
    claim = json.claim ?? json.payableMileage?.claim ?? null;
    payableMileage = json.payableMileage;
    message = json.message || json.error;
  } catch {
    /* gateway / empty */
  }
  return { ok: res.ok, status: res.status, claim, payableMileage, message };
}

export async function postCheckinRecap(
  code: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; already?: boolean; message?: string }> {
  const res = await fetchWithTimeout(
    `${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/recap`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    RECAP_FETCH_TIMEOUT_MS,
  );
  let already = false;
  let success: boolean | undefined;
  let message: string | undefined;
  try {
    const json = (await res.clone().json()) as {
      already?: boolean;
      alreadySubmitted?: boolean;
      hasRecap?: boolean;
      success?: boolean;
      message?: string;
      error?: string;
    };
    already = Boolean(json.already || json.alreadySubmitted || json.hasRecap);
    success = json.success;
    message = recapSubmitErrorMessage(json, res.status);
  } catch {
    message = recapSubmitErrorMessage(null, res.status);
  }
  if (res.status === 409) already = true;
  return { ok: res.ok && success !== false, status: res.status, already, message };
}

export async function flushQueuedRecap(code: string) {
  const pending = readPendingRecap(code);
  const result = await flushPendingRecap({
    code,
    postRecap: (body) => postCheckinRecap(code, body),
    putPhoto: async (file, sessionToken) => {
      const compressed = await compressImage(file);
      return putCheckinPhoto({
        code,
        token: sessionToken,
        file: compressed,
        apiOrigin: apiOrigin(),
      });
    },
  });
  if ((result === "flushed" || result === "already") && pending) {
    clearDraft(code, pending.token);
  }
  return result;
}

export const fmtTime = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).replace(":00", "");
};

export const fmtDay = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const raw = String(iso);
  const d = new Date(raw.includes("T") ? raw : `${raw.slice(0, 10)}T12:00:00`);
  if (isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

