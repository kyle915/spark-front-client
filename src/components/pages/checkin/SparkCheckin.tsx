import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useParams } from "react-router";
import { bucketCountHint } from "./photoBuckets";
import { PHOTO_CAP } from "./photoCap";
import { isHeicUpload } from "./heicUpload";
import {
  engagementsFromSamplesGiven,
  templateHasConsumersSampledField,
} from "@/recap/engagementsFromSamples";
import {
  DropOffLocationsField,
} from "@/recap/DropOffLocationsField";
import {
  isDropOffLocationsField,
  parseDropOffLocations,
  productSamplesFromDropOffs,
  validateDropOffLocationsValue,
} from "@/recap/dropOffLocations";
import {
  isProductsSampledMultiselect,
  matchProductForSampleOption,
  productSampleQtyHelper,
  productSampleQtyUnit,
  productSamplesFromSelections,
} from "@/recap/productsSampledQty";
import {
  FIELD_PHOTO_PREP,
  prepareImageForUpload,
} from "@/utils/compressImageForUpload";
import { browserPlayableContentType } from "@/utils/recapFileUrl";
import {
  CLOCK_FETCH_TIMEOUT_MS,
  clearCachedContext,
  clearPendingClock,
  enqueueClockIn,
  flushPendingClock,
  isOfflineClockFailure,
  offlineClockBanner,
  readCachedContext,
  readPendingClock,
  writeCachedContext,
  type PendingClockIn,
} from "./offlineClock";
import {
  RECAP_FETCH_TIMEOUT_MS,
  clearPendingRecap,
  enqueueRecap,
  flushPendingRecap,
  offlineRecapBanner,
  putCheckinPhoto,
  readPendingRecap,
  type PendingRecap,
} from "./offlineRecap";
import {
  clearPendingMileage,
  enqueueMileage,
  flushPendingMileage,
  offlineMileageBanner,
  provisionalClaimFromPending,
  readPendingMileage,
  type PendingMileage,
} from "./offlineMileage";
import {
  CHECK_IN_SOMEWHERE_ELSE,
  CLEAR_LEFTOVER_ERROR,
  isLeftoverCheckinSession,
  LEFTOVER_BANNER_BODY,
  LEFTOVER_BANNER_BODY_RECAP,
  LEFTOVER_BANNER_TITLE,
  LEFTOVER_ESCAPE_LINK,
  LEFTOVER_PRIMARY_BUSY,
  LEFTOVER_PRIMARY_CTA,
  LEFTOVER_PRIMARY_CTA_RECAP,
  LEFTOVER_SECONDARY_CTA,
  START_OVER_LINK,
} from "./leftoverCheckin";
import {
  canAttemptOpenPunchResume,
  shouldDropSessionToken,
  shouldKeepCachedSession,
} from "./checkinSession";
import { ActionMorphButton } from "@/motion/ActionMorphButton";
import { holdActionSuccess, type ActionPhase } from "@/motion/opsMotion";
import { recapSubmitErrorMessage } from "./recapSubmitError";
import { TenantLogo } from "@/layout/TenantLogo";
import { shouldShowSamplingStopCard } from "./samplingStops";
import PayableMileageStep from "./PayableMileageStep";
import {
  formatPayableMiles,
  isMileageCustomFieldName,
  payableMileageComplete,
  shouldCollectPayableMileage,
  type PayableMileageClaim,
  type PayableMileageState,
} from "./payableMileage";
import {
  SECOND_SHIFT_HINT,
  SECOND_SHIFT_LABEL,
  SECOND_SHIFT_PROMPT,
  supportsStandingSecondShift,
} from "./secondShift";
import {
  eventTypeDescription,
  eventTypeSkipsIdentifyLocation,
  eventTypesUseDescriptorPicker,
} from "./eventTypeDescriptor";

/**
 * Public, no-login web check-in for a BA working a specific event.
 *
 * The URL carries the event's walk-up code (`/checkin/:code`). A BA opens it,
 * types who they are, clocks in, works, clocks out, and files the event's FULL
 * custom recap template — photos and all — right in the browser. No app, no
 * account. It's the web twin of the mobile walk-up flow; the backend
 * (`/api/public/checkin/*`) mints a signed session token on identify that
 * authorizes the follow-up clock / photo-upload / recap calls.
 *
 * Plain fetch (no Relay / JWT) so it works fully logged-out. The session token
 * is kept in localStorage keyed by the code, so a returning link resumes where
 * the BA left off (clocked in → clock out → recap → done).
 */

// ── Types mirroring the backend payload (ambassadors/checkin_web.build_public_context)
type TemplateField = {
  id: string;
  name: string;
  required: boolean;
  type: string; // number | text | long_text | select | multiselect | photo | ...
  options: string[];
  /** BA-facing example copy (quality bar). Never submitted as the value. */
  placeholder?: string;
};
type TemplateSection = { id: string; name: string; fields: TemplateField[] };
type TemplateProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  /** ProductType name when the API includes it (for Category — Name match). */
  category?: string | null;
};
type Template = {
  id: string;
  name: string;
  productSamples: boolean;
  sections: TemplateSection[];
  products: TemplateProduct[];
};
type Clock = {
  state: "not_started" | "clocked_in" | "clocked_out";
  clockInAt: string | null;
  clockOutAt: string | null;
};
type MileageLeg = {
  uuid: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  miles: number | null;
  amount: number | null;
};
/**
 * Odometer state for this BA on this event. `enabled` mirrors the gig's
 * track_mileage toggle, so the control is absent entirely for brands that
 * don't reimburse driving.
 */
type Mileage = {
  enabled: boolean;
  active: MileageLeg | null;
  legs: MileageLeg[];
  totalMiles: number;
  totalAmount: number;
};
type SamplingStop = {
  uuid: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  recordedAt: string | null;
};
/**
 * One labelled photo dropzone on the recap step.
 *
 * `id` is the brand's own FileRecapCategory id — sent back with every photo
 * dropped here so the recap PDF can separate the table shot from the shelf
 * shot from the receipt, instead of piling all of them into one category.
 * `min` is a nudge the BA can see ("3 of 8 suggested"), never a gate: a BA in a
 * store parking lot on one bar has to be able to finish and clock out. Nothing
 * reads it but the counter in `PhotoBucketZone` — not `submit`, not the API.
 */
type PhotoBucket = {
  id: string;
  name: string;
  helper: string;
  min: number;
  /** Optional MIME accept for the bucket's file inputs (e.g. image/*,video/*). */
  accept?: string;
};
/** One program on the brand's standing link. `id` is their EventType id. */
type EventTypeOption = { id: string; name: string };
/**
 * One BA-facing reference button under the header.
 *
 * `kind` is a RENDERING instruction, not a file type, and `image` is the one
 * that earns the whole shape: Feel Free's photo release is a QR a CONSUMER
 * scans off the BA's screen to sign their own release. A hyperlink cannot
 * serve that — you can't scan a code with the phone displaying it — so an
 * `image` opens a big inline viewer instead of navigating. `link` and `pdf`
 * both open a new tab and differ only in the affordance the button shows.
 *
 * The backend sanitises these (tenants.models.normalize_checkin_resources),
 * so `url` is already known to be http(s) or root-relative by the time it is
 * here.
 */
type CheckinResource = {
  label: string;
  kind?: "link" | "pdf" | "image";
  url: string;
  note?: string;
};
type StoreOption = { name: string; address: string };
type UnfiledShift = {
  eventDate: string | null;
  name: string;
  address: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockState: string;
};
type Context = {
  // OPTIONAL on a standing tenant link: until the BA picks a store + date there
  // is no event yet, so nothing here may be dereferenced unguarded.
  event?: {
    uuid: string;
    name: string;
    address: string | null;
    startTime: string | null;
    endTime: string | null;
    date?: string | null;
    storeManagerName?: string | null;
    storeManagerPhone?: string | null;
  };
  brand: {
    name: string;
    primaryColor: string | null;
    /** Same tenant.image URL tenantPublic / spark-form feed TenantLogo. */
    image?: string | null;
    logoUrl?: string | null;
    requestUrlName?: string | null;
  };
  template?: Template | null;
  // Labelled photo dropzones, in render order. Absent/empty for every brand
  // that hasn't opted in, which is the signal to keep the single generic grid.
  photoBuckets?: PhotoBucket[];
  session?: {
    ambassadorName: string;
    clock: Clock;
    hasRecap: boolean;
    pendingReview: boolean;
    mileage?: Mileage;
    stops?: SamplingStop[];
    payableMileage?: PayableMileageState;
  };
  // Tenant-link mode — ONE durable link shared across every activation, so BAs
  // never type an event code. `needsEventDetails` means ask for store + date on
  // the identify step; the API then finds-or-creates the event.
  mode?: "tenant";
  needsEventDetails?: boolean;
  // 3rd-party / agency URL: skip punch, go name + date + store + questions.
  recapOnly?: boolean;
  recentLocations?: StoreOption[];
  // Roaming brands (Feel Free) pick a MARKET instead of typing a store
  // address: the event is keyed on the market so a whole crew shares one, and
  // the individual spots are logged as stops during the shift.
  locationMode?: "address" | "market";
  markets?: string[];
  // The programs this brand runs off this ONE link (Liquid Death: Retail
  // Sampling and Event Activation). The BA's pick is stamped on the event,
  // which is what decides their recap form and their photo buckets.
  //
  // Fewer than two and the page must ask NOTHING: a one-option dropdown is a
  // worse version of no dropdown, and single-program brands (Total Wireless,
  // Feel Free) have to look exactly as they do today.
  eventTypes?: EventTypeOption[];
  // The brand's BA references, in order — training deck, photo-release QR,
  // the /training/<code> hub. Rendered on the landing screen AND once clocked
  // in: "what am I supposed to say about this SKU" is a question a BA has at
  // the table, not at home, and the release QR is needed mid-shift by
  // definition.
  resources?: CheckinResource[];
  // Standing link only: shifts this BA already clocked that still need a recap.
  unfiledShifts?: UnfiledShift[];
  // Legacy single-URL twin of `resources`, still sent by the API. Read only as
  // a fallback (see `checkinResources`) so this page keeps working against an
  // API that predates the list.
  trainingUrl?: string;
  // Standing GET with a bearer that failed: expired / bad_session / …
  // Absent on a clean landing (no token) and on a restored session.
  sessionError?: string;
  error?: string;
  message?: string;
};

// `id` is what upload results are keyed on. It used to be the array index
// captured before the loop — which meant picking N photos at once wrote every
// result to the SAME slot, leaving the other N-1 stuck on "uploading" forever
// and permanently wedging the Submit button. Never key async results by index.
type Photo = {
  id: string;
  file: File;
  blobName: string | null;
  previewUrl: string;
  state: "uploading" | "done" | "failed";
  // Which labelled bucket this was dropped into, or null for the generic grid
  // (every brand without buckets). Sent per file on submit; the backend
  // validates it against that brand's own buckets and falls back to its
  // "photos" category for anything it doesn't recognise.
  category: string | null;
};

const FALLBACK_ACCENT = "#C4D82E";

function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

// Enough to use the connection, few enough that one stalled PUT doesn't hold
// up the rest. Serial uploads were the other half of "photos won't upload".
const UPLOAD_CONCURRENCY = 3;

/**
 * Parallel heic2any WASM OOMs iPhone Safari when a BA picks a big Camera Roll
 * batch. JPEG/PNG downscale can still run concurrent with PUTs; HEIC decode
 * waits its turn.
 */
let heicPrepChain: Promise<void> = Promise.resolve();

/** HEIC→JPEG + field downscale (see FIELD_PHOTO_PREP). Videos pass through. */
async function compressImage(file: File): Promise<File> {
  if (file.type.startsWith("video/")) return file;
  if (!isHeicUpload(file)) {
    return prepareImageForUpload(file, FIELD_PHOTO_PREP);
  }
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const prev = heicPrepChain;
  heicPrepChain = prev.then(() => gate);
  await prev;
  try {
    return await prepareImageForUpload(file, FIELD_PHOTO_PREP);
  } finally {
    release();
  }
}

/** Run `fn` over `items` with at most `limit` in flight. */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/**
 * The resources to show, tolerating an API that only sends `trainingUrl`.
 *
 * The backend ships both keys during the deploy gap, but this page can also be
 * loaded against an older API, so the legacy field is folded into the same shape
 * rather than handled separately. Label and subtitle match what this component
 * hard-coded before the list existed, so a brand's card never silently rewords.
 */
function checkinResources(ctx: Context): CheckinResource[] {
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

/** Shared chrome, so an opens-a-tab button and an opens-a-viewer button match. */
const resourceCard = (accent: string) =>
  ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
    padding: "13px 16px",
    borderRadius: 12,
    border: `1px solid ${accent}55`,
    background: `${accent}14`,
    color: "inherit",
    textDecoration: "none",
    textAlign: "left",
    font: "inherit",
    cursor: "pointer",
    minHeight: 44,
  }) as const;

/**
 * Full-screen QR viewer.
 *
 * Sized and coloured for ONE job: a consumer scanning it off the BA's phone from
 * a foot or two away. That drives three things worth not "tidying" later —
 *
 *  - the code sits on PURE WHITE with its own padding. No scrim, no accent wash
 *    and no opacity over the image: tinting a QR is how you make it unreadable
 *    to a camera that's already fighting store glare.
 *  - it takes essentially the full viewport width. The source PNG is 1230px, so
 *    even at full width on a 3x phone it's being downscaled, never blown up.
 *  - the sheet scrolls, so the code never gets shrunk to fit next to the caption
 *    on a short screen.
 */
function QrViewer({
  resource,
  onClose,
}: {
  resource: CheckinResource;
  onClose: () => void;
}) {
  // Esc to close, and don't let the page behind scroll under the viewer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={resource.label}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(8,10,14,0.88)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "18px 12px 28px",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          maxWidth: 560,
          gap: 12,
          marginBottom: 12,
          flex: "0 0 auto",
        }}
      >
        <span style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>
          {resource.label}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            border: "1px solid rgba(255,255,255,0.35)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            borderRadius: 999,
            width: 40,
            height: 40,
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
            flex: "0 0 auto",
          }}
        >
          &times;
        </button>
      </div>

      {/* Stop clicks on the code itself from dismissing it — a consumer leaning
          in to scan will touch the screen, and losing the code mid-scan is the
          one failure this flow can't afford. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 14,
          width: "100%",
          maxWidth: 520,
          flex: "0 0 auto",
          boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
        }}
      >
        <img
          src={resource.url}
          alt={resource.label}
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      </div>

      <p
        style={{
          color: "rgba(255,255,255,0.86)",
          fontSize: 13.5,
          lineHeight: 1.45,
          textAlign: "center",
          maxWidth: 420,
          margin: "14px 0 0",
          flex: "0 0 auto",
        }}
      >
        {resource.note || "Have them scan this with their phone camera."}
        <br />
        <span style={{ opacity: 0.65 }}>
          Turn your screen brightness up if it won&apos;t scan.
        </span>
      </p>
    </div>
  );
}

/**
 * The brand's BA references as buttons, under the header on every screen.
 *
 * Renders nothing when the brand has none configured, which is most of them — an
 * empty bordered box would be worse than the absence.
 */
function ResourceButtons({
  resources,
  accent,
}: {
  resources: CheckinResource[];
  accent: string;
}) {
  const [viewing, setViewing] = useState<CheckinResource | null>(null);
  if (!resources.length) return null;

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          margin: "0 0 14px",
        }}
      >
        {resources.map((r, i) => {
          const body = (
            <>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{r.label}</span>
                {r.note ? (
                  <span style={{ fontSize: 12.5, opacity: 0.7 }}>{r.note}</span>
                ) : null}
              </span>
              <span style={{ fontSize: 18, opacity: 0.6 }} aria-hidden="true">
                {r.kind === "image" ? "⤢" : "↗"}
              </span>
            </>
          );

          // An image opens the viewer in place; anything else stays a real
          // anchor, so long-press, "open in new tab" and copy-link all keep
          // working for a BA who wants the deck on another device.
          return r.kind === "image" ? (
            <button
              key={`${r.url}-${i}`}
              type="button"
              onClick={() => setViewing(r)}
              style={resourceCard(accent)}
            >
              {body}
            </button>
          ) : (
            <a
              key={`${r.url}-${i}`}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              style={resourceCard(accent)}
            >
              {body}
            </a>
          );
        })}
      </div>
      {viewing ? (
        <QrViewer resource={viewing} onClose={() => setViewing(null)} />
      ) : null}
    </>
  );
}

function apiOrigin(): string {
  try {
    return new URL(import.meta.env.VITE_GRAPHQL_ENDPOINT as string).origin;
  } catch {
    return "";
  }
}

async function fetchWithTimeout(
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

const isPhotoType = (t: string) => t.includes("photo") || t.includes("image");
const choiceKind = (t: string): "select" | "multiselect" | null => {
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
const CHECKIN_MAX_PAST_DAYS = 90;
const CHECKIN_MAX_FUTURE_DAYS = 14;

const shiftedISO = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const todayISO = (): string => {
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
const normalizePlace = (value: string): string =>
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
type Identity = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  /** Last market or store address submitted on identify for this code. */
  lastPlace?: string;
  /** Last program id — needed when Product Seeding omitted a place. */
  lastEventTypeId?: string;
};
const IDENTITY_KEY = (code: string) => `@spark.checkin.who/${code}`;

const readIdentity = (code: string): Identity => {
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

const writeIdentity = (code: string, who: Identity): void => {
  try {
    window.localStorage.setItem(IDENTITY_KEY(code), JSON.stringify(who));
  } catch {
    /* private mode / quota — prefill is a convenience, never required */
  }
};

// Draft of the recap answers, so a BA never retypes a shift's worth of notes.
//
// The page already survived a reload for IDENTITY and the session TOKEN, but
// everything typed into the recap lived in React state alone. On a phone that
// is not a rare edge: iOS discards a backgrounded tab under memory pressure,
// so a BA who answers a call mid-recap comes back to an empty form. That is
// exactly the "deletes content if momentarily idle" the Feel Free team hit.
//
// Keyed by code + SESSION TOKEN, not code alone: the token is minted per
// clock-in, so a reload inside one shift restores the draft while the next
// shift starts clean instead of inheriting yesterday's answers.
//
// Text only. Photos are already uploaded to GCS as they're picked, but a
// restored photo has no File to preview, and half-rendering one is worse than
// re-picking it — that stays a separate change.
type RecapDraft = {
  v: 1;
  savedAt: number;
  values: Record<string, string | string[]>;
  samples: Record<string, string>;
  engagements: string;
};

const DRAFT_KEY = (code: string, token: string) =>
  `@spark.checkin.draft/${code}/${token.slice(-24)}`;

// Every accessor is guarded: Safari private mode throws on localStorage, and a
// storage failure must never be the reason a BA can't file their recap.
const readDraft = (code: string, token: string): RecapDraft | null => {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY(code, token));
    if (!raw) return null;
    const d = JSON.parse(raw) as RecapDraft;
    if (!d || d.v !== 1) return null;
    return d;
  } catch {
    return null;
  }
};

const writeDraft = (code: string, token: string, draft: Omit<RecapDraft, "v" | "savedAt">) => {
  try {
    const payload: RecapDraft = { v: 1, savedAt: Date.now(), ...draft };
    window.localStorage.setItem(DRAFT_KEY(code, token), JSON.stringify(payload));
    return payload.savedAt;
  } catch {
    return null;
  }
};

const clearDraft = (code: string, token: string) => {
  try {
    window.localStorage.removeItem(DRAFT_KEY(code, token));
  } catch {
    /* nothing to do — the draft is disposable by definition */
  }
};

/** True when this session already has typed answers waiting on-device. */
const hasRecapDraft = (code: string, token: string): boolean => {
  const d = readDraft(code, token);
  if (!d) return false;
  if ((d.engagements || "").trim()) return true;
  if (Object.keys(d.samples || {}).some((k) => (d.samples[k] || "").trim())) {
    return true;
  }
  return Object.values(d.values || {}).some((v) =>
    Array.isArray(v) ? v.length > 0 : Boolean(String(v || "").trim()),
  );
};

async function postCheckinClock(
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

async function postCheckinPayableMileage(
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

async function postCheckinRecap(
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

async function flushQueuedRecap(code: string) {
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

const fmtTime = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).replace(":00", "");
};

const fmtDay = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const raw = String(iso);
  const d = new Date(raw.includes("T") ? raw : `${raw.slice(0, 10)}T12:00:00`);
  if (isNaN(d.getTime())) return raw.slice(0, 10);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

export default function SparkCheckin() {
  const { code = "" } = useParams<{ code: string }>();
  const storeKey = `spark.checkin.${code}`;

  const [ctx, setCtx] = useState<Context | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(storeKey);
    } catch {
      return null;
    }
  });
  // One silent resume per page life — reset when the BA taps Start over.
  const resumeAttempted = useRef(false);

  // ── Load / refresh context (with the session token if we have one) ─────────
  const refresh = useCallback(async () => {
    if (!code) return;
    try {
      // Session token rides a header, never the URL — keeps the bearer out of
      // access logs / browser history / Referer.
      const res = await fetch(`${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}`, {
        headers: token ? { "X-Checkin-Session": token } : undefined,
      });
      const json = (await res.json()) as Context;
      if (!res.ok || json.error) {
        setLoadErr(json.message || "This check-in link isn't active.");
        setCtx(null);
      } else {
        // Session (clocked-in) payloads historically omitted locationMode.
        // Keep the standing-link market mode so Feel Free still shows
        // Log this stop after identify.
        const prior = readCachedContext<Context>(code);
        const keepCache = shouldKeepCachedSession({
          incomingHasSession: Boolean(json.session),
          cachedHasSession: Boolean(prior?.session),
          cachedEventDate: prior?.event?.date,
          today: todayISO(),
          isLeftover: isLeftoverCheckinSession,
        });
        if (keepCache && prior?.session) {
          // Bare tenant landing after a soft miss — keep showing today's
          // clocked-in shell instead of flashing identify / wiping cache.
          setCtx({
            ...prior,
            locationMode: json.locationMode ?? prior.locationMode,
            markets: json.markets?.length ? json.markets : prior.markets,
            brand: json.brand ?? prior.brand,
            resources: json.resources?.length ? json.resources : prior.resources,
          });
        } else {
          setCtx((prev) => {
            const next = {
              ...json,
              locationMode: json.locationMode ?? prev?.locationMode,
              markets: json.markets?.length ? json.markets : prev?.markets,
            };
            writeCachedContext(code, next);
            return next;
          });
        }
        setLoadErr(null);
        // Only drop a bearer the API named dead. Wiping on every bare tenant
        // payload is what made a BA look "not clocked in" after leaving for
        // the photo-release QR while Attendance still had their punch.
        if (
          shouldDropSessionToken({
            mode: json.mode,
            hasToken: Boolean(token),
            hasSession: Boolean(json.session),
            sessionError: json.sessionError,
          })
        ) {
          try {
            window.localStorage.removeItem(storeKey);
          } catch {
            /* private mode */
          }
          setToken(null);
        }
      }
    } catch {
      const cached = readCachedContext<Context>(code);
      if (cached) {
        // Last good shell — a BA who already opened this link can still
        // clock in / draft a recap when the reload itself has no bars.
        setCtx(cached);
        setLoadErr(null);
      } else {
        setLoadErr("Couldn't load this check-in. Check your connection and reload.");
      }
    }
  }, [code, token, storeKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Lost local session but still on this phone for the same shift: re-identify
  // with saved name/phone + last market/store so open_shift_event_for restores
  // the server punch on ANY standing code (FF / LD / TH / BD / …). Skips when
  // Start over cleared the cache intentionally.
  useEffect(() => {
    if (!ctx) return;
    if (resumeAttempted.current) return;

    const who = readIdentity(code);
    const cached = readCachedContext<Context>(code);
    const pending = readPendingClock(code);
    const place =
      (who.lastPlace || "").trim() ||
      (cached?.event?.address || "").trim();
    if (
      !canAttemptOpenPunchResume({
        mode: ctx.mode,
        recapOnly: ctx.recapOnly,
        hasLiveSession: Boolean(token && ctx.session),
        firstName: who.firstName,
        phone: who.phone,
        place,
        hasToken: Boolean(token),
        hasPendingClock: Boolean(pending),
        cachedClockedIn: cached?.session?.clock?.state === "clocked_in",
      })
    ) {
      return;
    }

    resumeAttempted.current = true;
    const isMarket = (ctx.locationMode || "address") === "market";
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/identify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              firstName: who.firstName,
              lastName: who.lastName,
              phone: who.phone,
              email: who.email,
              eventDate: todayISO(),
              ...(who.lastEventTypeId
                ? { eventTypeId: who.lastEventTypeId }
                : {}),
              ...(place
                ? isMarket
                  ? { market: place }
                  : { address: place }
                : {}),
            }),
          },
        );
        const json = (await res.json()) as {
          sessionToken?: string;
          session?: Context["session"];
        };
        if (cancelled || !res.ok || !json.sessionToken) return;
        try {
          window.localStorage.setItem(storeKey, json.sessionToken);
        } catch {
          /* private mode */
        }
        writeIdentity(code, {
          ...who,
          ...(place.trim() ? { lastPlace: place } : {}),
        });
        setToken(json.sessionToken);
      } catch {
        /* leave them on identify — manual Start check-in still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx, token, code, storeKey]);

  // Flush clock-in + recap queues even if the BA is still on identify
  // (they started over) or the recap form is closed. Idempotent.
  useEffect(() => {
    if (!code) return;
    const flush = () => {
      void flushPendingClock({
        code,
        postClock: (body) => postCheckinClock(code, body),
      }).then(() =>
        flushPendingMileage({
          code,
          postMileage: (body) => postCheckinPayableMileage(code, body),
        }),
      ).then((result) => {
        if (result === "flushed" || result === "already") void refresh();
        return flushQueuedRecap(code);
      }).then((result) => {
        if (result === "flushed" || result === "already") void refresh();
      });
    };
    const onOnline = () => flush();
    const onVis = () => {
      if (document.visibilityState === "visible") flush();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVis);
    flush();
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [code, refresh]);

  // Same crew works these stores week after week, so the link has to be
  // reusable. Dropping the session token returns them to the store + date
  // step for a fresh event; their NAME is kept (see IDENTITY_KEY) so a repeat
  // BA only answers "which store, what day".
  const startAnother = useCallback(() => {
    resumeAttempted.current = false;
    try {
      window.localStorage.removeItem(storeKey);
      clearPendingClock(code);
      clearPendingRecap(code);
      clearPendingMileage(code);
      clearCachedContext(code);
      if (token) clearDraft(code, token);
    } catch {
      /* private mode — clearing state below is enough for this session */
    }
    setToken(null);
    setCtx(null);
    setLoadErr(null);
  }, [storeKey, code, token]);

  const accent = ctx?.brand.primaryColor || FALLBACK_ACCENT;
  const clockState = ctx?.session?.clock.state ?? "not_started";
  const identified = Boolean(token && ctx?.session);
  // Filed content only — the API's has_recap() ignores empty clock-out stubs.
  const hasRecap = Boolean(ctx?.session?.hasRecap);

  if (loadErr) {
    return (
      <Shell framed brand={ctx?.brand}>
        <p
          className="text-xs uppercase tracking-[0.22em] text-stone-500 mb-2"
        >
          Walk-up check-in
        </p>
        <h1
          className="text-2xl font-bold mb-3"
          style={{ fontFamily: "Georgia, serif" }}
        >
          This check-in link isn't active.
        </h1>
        <p className="text-sm text-stone-600 mb-4">{loadErr}</p>
        <p className="text-sm text-stone-600">
          If you were sent here for a shift, ask your Ignite contact for a
          new link. This page is for brand ambassadors — it will not sign
          you into Spark.
        </p>
      </Shell>
    );
  }
  if (!ctx) {
    return (
      <Shell framed>
        <p className="text-sm text-stone-500">Loading check-in…</p>
      </Shell>
    );
  }

  return (
    <Shell brand={ctx.brand}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <Header ctx={ctx} />
        {/* Sits directly under the header so it's present on the landing
            screen AND after clock-in — the BA asks "how do I pitch this?"
            at the table, not before they leave the house, and the
            photo-release QR is only ever needed with a consumer
            standing in front of them. */}
        <ResourceButtons resources={checkinResources(ctx)} accent={accent} />
        {!identified ? (
          <IdentifyStep
            code={code}
            accent={accent}
            storeKey={storeKey}
            onDone={setToken}
            needsEventDetails={Boolean(ctx.needsEventDetails)}
            recapOnly={Boolean(ctx.recapOnly)}
            recentLocations={ctx.recentLocations || []}
            locationMode={ctx.locationMode || "address"}
            markets={ctx.markets || []}
            eventTypes={ctx.eventTypes || []}
          />
        ) : (
          <CheckedInFlow
            code={code}
            token={token as string}
            ctx={ctx}
            accent={accent}
            clockState={clockState}
            hasRecap={hasRecap}
            onRefresh={refresh}
            onStartAnother={startAnother}
          />
        )}
        <p style={{ fontSize: 11, opacity: 0.4, marginTop: 22, textAlign: "center" }}>
          Spark by Ignite
        </p>
      </div>
    </Shell>
  );
}

// ── Header ────────────────────────────────────────────────────────────────
function Header({ ctx }: { ctx: Context }) {
  const ev = ctx.event;
  // A standing tenant link has no event until the BA picks a store, so the
  // title says what's about to happen. The brand mark lives in the chrome
  // (same TenantLogo as /spark-form), not as shouting name copy here.
  if (!ev) {
    if (ctx.recapOnly) {
      return (
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 2px", lineHeight: 1.15 }}>File a recap</h1>
          <div style={{ fontSize: 13, opacity: 0.6 }}>
            Date, your name, the store, then the recap questions.
          </div>
        </div>
      );
    }
    return (
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 2px", lineHeight: 1.15 }}>Start your shift</h1>
        <div style={{ fontSize: 13, opacity: 0.6 }}>Clock in, work, then file your recap — all from this page.</div>
      </div>
    );
  }
  // Date from `date`, time ONLY from a real `startTime`. A walk-in event has
  // no scheduled start, and its date is stored at noon UTC — coalescing the
  // two used to render "Sat, Aug 1 · 5 AM" for a shift with no start time.
  const dayISO = ev.date || ev.startTime;
  const when = dayISO
    ? new Date(dayISO).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        // The date is a UTC-noon marker; read it back in UTC so it can't slip
        // a day for a BA west of Greenwich.
        timeZone: ev.date && !ev.startTime ? "UTC" : undefined,
      })
    : "";
  const window_ = ev.startTime
    ? `${fmtTime(ev.startTime)}${ev.endTime ? `–${fmtTime(ev.endTime)}` : ""}`
    : "";
  return (
    <div style={{ marginBottom: 18 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 2px", lineHeight: 1.15 }}>{ev.name}</h1>
      <div style={{ fontSize: 13, opacity: 0.6 }}>
        {when}
        {when && window_ ? " · " : ""}
        {window_}
      </div>
      {ev.address ? <div style={{ fontSize: 13, opacity: 0.55, marginTop: 2 }}>{ev.address}</div> : null}
    </div>
  );
}

// ── Step 1: identify ────────────────────────────────────────────────────────
function IdentifyStep({
  code,
  accent,
  storeKey,
  onDone,
  needsEventDetails = false,
  recapOnly = false,
  recentLocations = [],
  locationMode = "address",
  markets = [],
  eventTypes = [],
}: {
  code: string;
  accent: string;
  storeKey: string;
  onDone: (t: string) => void;
  needsEventDetails?: boolean;
  recapOnly?: boolean;
  recentLocations?: StoreOption[];
  locationMode?: "address" | "market";
  markets?: string[];
  eventTypes?: EventTypeOption[];
}) {
  // Repeat BAs are the norm on a standing link — the same crew works these
  // stores week after week. Remember who they said they were so the second
  // and twentieth check-ins are just "which store, what day".
  const isMarket = locationMode === "market" && markets.length > 0;
  const [market, setMarket] = useState("");
  // Two or more programs on this link and the BA has to say which one they're
  // working — it picks their recap form and their photo buckets. ONE program is
  // not a question, so nothing renders and nothing is sent: that's every brand
  // but Liquid Death, and they must look untouched.
  const hasPrograms = eventTypes.length > 1;
  // Deliberately NOT pre-selected. The default would be right most of the time
  // and silently wrong the rest, and a BA scanning a form they've filled twenty
  // times won't re-read a field that already has an answer.
  const [eventTypeId, setEventTypeId] = useState("");
  const selectedEventType = eventTypes.find((t) => t.id === eventTypeId);
  const skipWorkLocation = eventTypeSkipsIdentifyLocation(
    selectedEventType?.name,
  );

  const saved = readIdentity(code);
  const [firstName, setFirstName] = useState(saved.firstName);
  const [lastName, setLastName] = useState(saved.lastName);
  const [phone, setPhone] = useState(saved.phone);
  const [email, setEmail] = useState(saved.email);
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  // Default to today — the overwhelmingly common case is a BA checking in for
  // the shift they're standing in.
  const [eventDate, setEventDate] = useState(() => todayISO());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [unfiled, setUnfiled] = useState<UnfiledShift[]>([]);

  // Picking a known store fills BOTH fields, so the address matches an existing
  // event's exactly and this BA joins it rather than forking a near-duplicate.
  //
  // `l.name` is the matched event's TITLE, not a store name — "8/2/2026 - 1155 E
  // State St · Retail Sampling". Copying one of those into the store-name box
  // got it appended in parentheses, producing an event called "8/2/2026 - 1155 E
  // State St (8/2/2026 - 1155 E State St · Retail Sampling)". Only carry a name
  // that actually names a store: one that doesn't already contain the address.
  const pickStore = (value: string) => {
    setAddress(value);
    const hit = recentLocations.find((l) => l.address === value);
    const looksLikeATitle =
      hit && normalizePlace(hit.name).includes(normalizePlace(hit.address));
    if (hit && hit.name && !looksLikeATitle && !storeName.trim()) setStoreName(hit.name);
  };

  // "Use my current location" — the phone knows where it is, so the BA
  // shouldn't have to type a street address one-handed in a parking lot.
  //
  // If the resolved address is within a hair of a store we already know, snap
  // to the KNOWN one instead. The backend keys find-or-create on the
  // normalized address, so a GPS-derived string that differs by a word from
  // the spelling the first BA used would fork a second event for the same
  // activation — the exact thing this flow exists to prevent.
  const useMyLocation = () => {
    setErr(null);
    if (!navigator.geolocation) {
      setErr("This phone won't share its location. Type the address instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/where`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              }),
            },
          );
          const json = await res.json();
          if (json.address) {
            const known = recentLocations.find(
              (l) => normalizePlace(l.address) === normalizePlace(json.address),
            );
            if (known) pickStore(known.address);
            else setAddress(json.address);
          } else {
            setErr("Couldn't name that spot — type the address instead.");
          }
        } catch {
          setErr("Couldn't look that up. Type the address instead.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setErr("Location is off for this site. Type the address instead.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  useEffect(() => {
    if (recapOnly || !needsEventDetails || !phone.trim()) {
      setUnfiled([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetch(
        `${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/unfiled-recaps`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstName, lastName, phone }),
        },
      )
        .then((r) => r.json())
        .then((json: { shifts?: UnfiledShift[] }) => {
          if (!cancelled && Array.isArray(json.shifts)) setUnfiled(json.shifts);
        })
        .catch(() => {
          if (!cancelled) setUnfiled([]);
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code, needsEventDetails, firstName, lastName, phone, recapOnly]);

  const submit = async (overrides?: { eventDate?: string; address?: string; market?: string }) => {
    setErr(null);
    if (!firstName.trim()) return setErr("Enter your name.");
    if (!recapOnly && !phone.trim()) return setErr("Enter a phone number.");
    const date = overrides?.eventDate ?? eventDate;
    const addr = overrides?.address ?? address;
    const mkt = overrides?.market ?? market;
    // Unfiled-shift taps supply an address even when Product Seeding is selected.
    const omitPlace = skipWorkLocation && !overrides?.address && !overrides?.market;
    if (needsEventDetails) {
      // Required, and asked BEFORE the store, because it decides which form the
      // BA gets. The backend falls back to the brand's default rather than
      // rejecting a request with no program, so this check is the only thing
      // standing between a distracted BA and the wrong recap.
      if (hasPrograms && !eventTypeId) return setErr("Pick the event you're working.");
      if (!omitPlace) {
        if (isMarket) {
          if (!mkt) return setErr("Pick your market.");
        } else if (recapOnly) {
          if (!storeName.trim()) return setErr("Enter the store name.");
          if (!addr.trim()) return setErr("Enter the store address.");
        } else if (!addr.trim()) {
          return setErr("Enter the store address.");
        }
      }
      if (!date) return setErr("Pick the date you're working.");
    }
    setBusy(true);
    try {
      const res = await fetch(`${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          needsEventDetails
            ? {
                firstName,
                lastName,
                phone,
                email,
                eventDate: date,
                ...(hasPrograms ? { eventTypeId } : {}),
                ...(omitPlace
                  ? {}
                  : isMarket
                    ? { market: mkt }
                    : { storeName, address: addr }),
              }
            : { firstName, lastName, phone, email },
        ),
      });
      const json = await res.json();
      if (!res.ok || !json.sessionToken) {
        setErr(json.message || "Couldn't start your check-in.");
        setBusy(false);
        return;
      }
      try {
        window.localStorage.setItem(storeKey, json.sessionToken);
      } catch {
        /* private mode — token still held in memory for this session */
      }
      // Remember them for the next event on this same link — including the
      // market/store (or deferred seeding address from the API) so a lost
      // session can resume today's open punch.
      const place = omitPlace
        ? String(json.event?.address || "").trim()
        : isMarket
          ? mkt
          : addr;
      writeIdentity(code, {
        firstName,
        lastName,
        phone,
        email,
        ...(place.trim() ? { lastPlace: place.trim() } : {}),
        ...(eventTypeId.trim()
          ? { lastEventTypeId: eventTypeId.trim() }
          : {}),
      });
      onDone(json.sessionToken);
    } catch {
      setErr("No service. Stay on this page and tap again when you have a bar.");
      setBusy(false);
    }
  };

  return (
    <div style={card}>
      <h2 style={h2}>Who's working?</h2>
      <p style={{ fontSize: 13, opacity: 0.6, margin: "0 0 14px" }}>
        {recapOnly
          ? "Your name on this recap. Phone is optional."
          : "Tell us who you are so your lead can confirm your hours."}
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input style={{ ...input, flex: "1 1 140px" }} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input style={{ ...input, flex: "1 1 140px" }} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <input style={input} placeholder={recapOnly ? "Mobile phone (optional)" : "Mobile phone"} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input style={input} placeholder="Email (optional)" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />

      {needsEventDetails && hasPrograms ? (
        <>
          {/* Asked before the store, because this is the answer that picks the
              BA's recap form and their photo buckets — a retail demo and an
              activation want different fields and different shots. Same control
              as the market picker below so the page reads as one form. */}
          <h2 style={{ ...h2, marginTop: 22 }}>What event are you working?</h2>
          <p style={{ fontSize: 13, opacity: 0.6, margin: "0 0 14px" }}>
            This sets up the right recap for your shift.
          </p>
          {eventTypesUseDescriptorPicker(eventTypes) ? (
            <div
              role="radiogroup"
              aria-label="What event are you working?"
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              {eventTypes.map((t) => {
                const selected = eventTypeId === t.id;
                const description = eventTypeDescription(t.name);
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setEventTypeId(t.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: selected
                        ? `2px solid ${accent}`
                        : "1px solid #e7e5e4",
                      background: selected ? "rgba(255,255,255,0.95)" : "#fff",
                      boxShadow: selected
                        ? "0 0 0 1px rgba(0,0,0,0.04)"
                        : "none",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#1c1917",
                        marginBottom: description ? 4 : 0,
                      }}
                    >
                      {t.name}
                    </div>
                    {description ? (
                      <div
                        style={{
                          fontSize: 13,
                          lineHeight: 1.45,
                          color: "#57534e",
                        }}
                      >
                        {description}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <select
              style={{ ...input, appearance: "none" }}
              value={eventTypeId}
              onChange={(e) => setEventTypeId(e.target.value)}
            >
              <option value="">Select your event…</option>
              {eventTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </>
      ) : null}

      {needsEventDetails ? (
        <>
          {!skipWorkLocation ? (
            <>
          <h2 style={{ ...h2, marginTop: 22 }}>{recapOnly ? "Which store?" : "Where are you working?"}</h2>

          {/* ROAMING crews pick a market. Their whole day lands on ONE event
              per market, and the individual spots get logged as stops while
              they work — far better data than a store address they'd have to
              pick before they know where they'll end up. */}
          {isMarket ? (
            <>
              <p style={{ fontSize: 13, opacity: 0.6, margin: "0 0 14px" }}>
                Pick your market. You'll log each spot you sample as you go.
              </p>
              <select
                style={{ ...input, appearance: "none" }}
                value={market}
                onChange={(e) => setMarket(e.target.value)}
              >
                <option value="">Select your market…</option>
                {markets.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </>
          ) : recapOnly ? (
            <>
          <p style={{ fontSize: 13, opacity: 0.6, margin: "0 0 14px" }}>
            Type the store name and address. Required.
          </p>
          <input
            style={input}
            placeholder="Store name"
            autoComplete="off"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
          />
          <input
            style={input}
            placeholder="Store address"
            autoComplete="off"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
            </>
          ) : (
            <>
          <p style={{ fontSize: 13, opacity: 0.6, margin: "0 0 14px" }}>
            Pick your store from the list if it's there — that keeps you on the
            same event as anyone else working with you today.
          </p>
          <input
            style={input}
            placeholder="Store address"
            list="spark-checkin-stores"
            autoComplete="off"
            value={address}
            onChange={(e) => pickStore(e.target.value)}
          />
          {/* The phone already knows where it is — typing a street address
              one-handed in a parking lot is the worst part of this form. */}
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            style={{
              background: "transparent",
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: locating ? "default" : "pointer",
              opacity: locating ? 0.6 : 1,
              marginBottom: 10,
            }}
          >
            {locating ? "Finding you…" : "📍 Use my current location"}
          </button>
          {/* Native datalist: real autocomplete on iOS and Android with no
              dependency and no custom dropdown to fight with on a phone. */}
          <datalist id="spark-checkin-stores">
            {recentLocations.map((l) => (
              <option key={l.address} value={l.address}>
                {l.name || l.address}
              </option>
            ))}
          </datalist>
          <input
            style={input}
            placeholder="Store name (optional)"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
          />
            </>
          )}
            </>
          ) : (
            <p style={{ fontSize: 13, opacity: 0.6, margin: "14px 0 0" }}>
              Drop-off location and mileage are on the Product Seeding recap —
              no store step here.
            </p>
          )}

          {unfiled.length > 0 && !recapOnly ? (
            <div style={{ margin: "14px 0 8px" }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 6px" }}>
                Still need a recap
              </p>
              <p style={{ fontSize: 12, opacity: 0.55, margin: "0 0 8px" }}>
                You already clocked these days. Tap one to file it — even if it
                was Friday.
              </p>
              {unfiled.map((s) => (
                <button
                  key={`${s.eventDate}-${s.address}-${s.name}`}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (s.eventDate) setEventDate(s.eventDate);
                    if (isMarket) setMarket(s.address);
                    else setAddress(s.address);
                    void submit({
                      eventDate: s.eventDate ?? undefined,
                      address: s.address,
                      market: s.address,
                    });
                  }}
                  style={{
                    ...secondaryBtn,
                    width: "100%",
                    textAlign: "left",
                    marginBottom: 8,
                  }}
                >
                  {fmtDay(s.eventDate)}
                  {s.address ? ` · ${s.address}` : s.name ? ` · ${s.name}` : ""}
                  {s.clockOutAt ? " · clocked out" : ""}
                </button>
              ))}
            </div>
          ) : null}

          <label style={{ fontSize: 12, opacity: 0.6, display: "block", margin: "10px 0 4px" }}>
            {recapOnly ? "Date of this recap" : "Date you're working"}
          </label>
          <p style={{ fontSize: 12, opacity: 0.55, margin: "0 0 6px" }}>
            {recapOnly
              ? "The day the sampling happened. You can pick any day in the last "
              : "Working a past shift? Change this to the day you actually worked. You can pick any day in the last "}
            {CHECKIN_MAX_PAST_DAYS} days.
          </p>
          <input
            style={input}
            type="date"
            min={shiftedISO(-CHECKIN_MAX_PAST_DAYS)}
            max={shiftedISO(CHECKIN_MAX_FUTURE_DAYS)}
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </>
      ) : null}

      {err ? <p style={errText}>{err}</p> : null}
      <button style={{ ...primaryBtn(accent), marginTop: 6 }} disabled={busy} onClick={() => void submit()}>
        {busy ? "Starting…" : recapOnly ? "Continue to recap" : "Start check-in"}
      </button>
    </div>
  );
}

// ── Steps 2-4: clock in/out + recap ─────────────────────────────────────────
function CheckedInFlow({
  code,
  token,
  ctx,
  accent,
  clockState,
  hasRecap,
  onRefresh,
  onStartAnother,
}: {
  code: string;
  token: string;
  ctx: Context;
  accent: string;
  clockState: Clock["state"];
  onStartAnother: () => void;
  hasRecap: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"" | "in" | "out">("");
  const [inPhase, setInPhase] = useState<ActionPhase>("idle");
  // Recap-only first landing must still go through payable mileage when enabled
  // — jumping straight to RecapForm used to 400 with needs_payable_mileage.
  const bootRecapOnly =
    Boolean(ctx.recapOnly) &&
    !hasRecap &&
    !(
      ctx.mode === "tenant" &&
      isLeftoverCheckinSession(ctx.event?.date, todayISO())
    );
  const bootNeedMiles =
    bootRecapOnly &&
    shouldCollectPayableMileage({
      brand: ctx.brand,
      payableMileage: ctx.session?.payableMileage,
    }) &&
    !payableMileageComplete(ctx.session?.payableMileage) &&
    !readPendingMileage(code);
  const [showRecap, setShowRecap] = useState(
    () => bootRecapOnly && !bootNeedMiles,
  );
  const [showMileageStep, setShowMileageStep] = useState(() => bootNeedMiles);
  const [payableMileage, setPayableMileage] = useState<PayableMileageState | null>(
    () => {
      const base = ctx.session?.payableMileage ?? null;
      const pending = readPendingMileage(code);
      if (!pending || !base) return base;
      return { ...base, claim: provisionalClaimFromPending(pending) };
    },
  );
  // Locked in when mileage step saves — avoids RecapForm mounting before
  // setPayableMileage commits (Alicia had to re-type required Mileage).
  const [confirmedPayableMiles, setConfirmedPayableMiles] = useState<number | null>(
    () => {
      if (bootNeedMiles) return null;
      const pending = readPendingMileage(code);
      if (pending) return pending.provisionalMiles;
      const c = ctx.session?.payableMileage?.claim;
      return c?.completed && Number.isFinite(c.payableMiles) ? c.payableMiles : null;
    },
  );
  const [recapAsNew, setRecapAsNew] = useState(false);
  const openRecap = (asNew: boolean) => {
    setRecapAsNew(asNew);
    if (asNew) {
      setConfirmedPayableMiles(null);
      clearPendingMileage(code);
      setQueuedMileage(null);
    }
    const needMiles = shouldCollectPayableMileage({
      brand: ctx.brand,
      payableMileage: payableMileage ?? ctx.session?.payableMileage,
    });
    // Second / another filing always re-collects; first shift reuses a saved claim
    // (or an offline provisional still waiting to flush).
    const complete =
      !asNew &&
      (Boolean(readPendingMileage(code)) ||
        payableMileageComplete(payableMileage ?? ctx.session?.payableMileage, {
          forceNew: false,
        }));
    if (needMiles && !complete) {
      setShowMileageStep(true);
      setShowRecap(false);
      return;
    }
    setShowMileageStep(false);
    setShowRecap(true);
  };
  const [msg, setMsg] = useState<string | null>(null);
  const [keepLeftover, setKeepLeftover] = useState(false);
  const [clearing, setClearing] = useState(false);
  const today = todayISO();
  // Prior-day leftover banner (any standing code). Hidden only after the BA
  // explicitly chooses "Stay on that day".
  const leftover =
    ctx.mode === "tenant" &&
    !keepLeftover &&
    isLeftoverCheckinSession(ctx.event?.date, today);
  // Second shift is Feel Free + same calendar day only. Gate on the event
  // date (not keepLeftover) so "Stay on that day" never shows "second shift
  // today" on a prior-day session.
  const secondShiftOk = supportsStandingSecondShift({
    mode: ctx.mode,
    brand: ctx.brand,
    recapOnly: ctx.recapOnly,
    eventDate: ctx.event?.date,
    today,
  });
  const [queuedClock, setQueuedClock] = useState<PendingClockIn | null>(() =>
    readPendingClock(code),
  );
  const [queuedRecap, setQueuedRecap] = useState<PendingRecap | null>(() =>
    readPendingRecap(code),
  );
  const [queuedMileage, setQueuedMileage] = useState<PendingMileage | null>(() =>
    readPendingMileage(code),
  );
  // Local draft (typed answers) — same phone, same session token. Lets the
  // clocked-in CTA say Continue instead of File when they already started.
  const [draftWaiting, setDraftWaiting] = useState(() =>
    hasRecapDraft(code, token),
  );
  useEffect(() => {
    setDraftWaiting(hasRecapDraft(code, token));
  }, [code, token, showRecap]);
  // A queued clock-in is the shift they already started. Treat it as on the
  // clock so they can fill the recap offline instead of staring at Clock in.
  const effectiveClock: Clock["state"] =
    queuedClock && clockState === "not_started" ? "clocked_in" : clockState;
  const clockInAt = queuedClock?.clockedInAt ?? ctx.session?.clock.clockInAt ?? null;

  const post = (path: string, body: Record<string, unknown>, timeoutMs?: number) =>
    fetchWithTimeout(
      `${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/${path}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: token, ...body }),
      },
      timeoutMs ?? CLOCK_FETCH_TIMEOUT_MS,
    );

  const clearClockIn = async () => {
    setMsg(null);
    setClearing(true);
    const mustClose = effectiveClock === "clocked_in";
    try {
      const res = await post("clear-clock", {});
      if (mustClose && !res.ok && res.status !== 401) {
        setMsg(CLEAR_LEFTOVER_ERROR);
        setClearing(false);
        return;
      }
    } catch {
      if (mustClose) {
        setMsg(CLEAR_LEFTOVER_ERROR);
        setClearing(false);
        return;
      }
    }
    onStartAnother();
  };

  const queueOfflineIn = (coords: { latitude?: number; longitude?: number }, tappedAt: string) => {
    const row = enqueueClockIn({
      code,
      token,
      clockedInAt: tappedAt,
      ...coords,
    });
    setQueuedClock(row);
    setMsg(offlineClockBanner(row.clockedInAt));
  };

  const tryFlushPending = useCallback(async () => {
    const result = await flushPendingClock({
      code,
      postClock: async (body) => {
        const res = await post("clock", body);
        let alreadyIn = false;
        try {
          const json = (await res.clone().json()) as { alreadyIn?: boolean; clock?: Clock };
          alreadyIn = Boolean(json.alreadyIn || json.clock?.state === "clocked_in");
        } catch {
          /* body may be empty on a gateway error */
        }
        return { ok: res.ok, status: res.status, alreadyIn };
      },
    });
    if (result === "flushed" || result === "already") {
      setQueuedClock(readPendingClock(code));
      await onRefresh();
    }
    return result;
    // `post` closes over code+token, which are stable for this session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, token, onRefresh]);

  const tryFlushMileage = useCallback(async () => {
    const result = await flushPendingMileage({
      code,
      postMileage: async (body) => {
        const res = await post("payable-mileage", body);
        let claim: PayableMileageClaim | null | undefined;
        try {
          const json = (await res.clone().json()) as {
            claim?: PayableMileageClaim;
            payableMileage?: PayableMileageState;
          };
          claim = json.claim ?? json.payableMileage?.claim ?? null;
          if (json.payableMileage) setPayableMileage(json.payableMileage);
        } catch {
          /* gateway */
        }
        return { ok: res.ok, status: res.status, claim };
      },
    });
    setQueuedMileage(readPendingMileage(code));
    if (result === "flushed" || result === "already") {
      await onRefresh();
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, token, onRefresh]);

  const tryFlushRecap = useCallback(async () => {
    const result = await flushQueuedRecap(code);
    if (result === "flushed" || result === "already") {
      setQueuedRecap(readPendingRecap(code));
      await onRefresh();
    }
    return result;
  }, [code, onRefresh]);

  useEffect(() => {
    if (!queuedClock && !queuedRecap && !queuedMileage) return;
    const run = () => {
      void (async () => {
        if (queuedClock) await tryFlushPending();
        if (queuedMileage) await tryFlushMileage();
        if (queuedRecap) await tryFlushRecap();
      })();
    };
    const onOnline = () => run();
    window.addEventListener("online", onOnline);
    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVis);
    run();
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [
    queuedClock,
    queuedRecap,
    queuedMileage,
    tryFlushPending,
    tryFlushMileage,
    tryFlushRecap,
  ]);

  // While the BA is ON THE CLOCK and this page is open, drop a location pin
  // every few minutes so ops can see they're on site rather than only having
  // the two clock punches.
  //
  // HONEST LIMIT: mobile browsers suspend timers when the tab is backgrounded
  // or the screen locks, so this is a trail for as long as the page is in
  // front of them — NOT continuous background tracking. Only the native app
  // can do that. Don't sell this to a client as full-shift tracking.
  //
  // The server independently refuses any ping when the BA isn't clocked in,
  // so a page left open in a pocket after clock-out records nothing.
  useEffect(() => {
    if (clockState !== "clocked_in") return;
    if (!navigator.geolocation) return;

    let stopped = false;
    const sendPing = () => {
      if (stopped || document.visibilityState !== "visible") return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (stopped) return;
          void post("ping", {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }).catch(() => {
            /* a dropped pin is never worth interrupting the BA */
          });
        },
        () => {
          /* denied or unavailable — clocking still works, just no trail */
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 },
      );
    };

    sendPing();
    const id = window.setInterval(sendPing, 3 * 60 * 1000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
    // `post` is recreated each render but closes only over code+token, which
    // are stable for the life of this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockState, code, token]);

  const clock = async (kind: "in" | "out") => {
    setMsg(null);
    setBusy(kind);
    if (kind === "in") setInPhase("pending");
    const tappedAt = new Date().toISOString();
    // Second shift (or any new punch after a filed recap): never reuse a
    // leftover offline queue — that idempotency key can no-op the clock-in
    // and leave the BA stuck on "You're all set".
    const startingFreshShift = kind === "in" && hasRecap;
    if (startingFreshShift && queuedClock) {
      clearPendingClock(code);
      setQueuedClock(null);
    }
    // Best-effort geolocation — clocking works even if it's denied/unavailable.
    const withCoords = async (coords: { latitude?: number; longitude?: number }) => {
      try {
        if (kind === "out" && queuedClock) {
          const flushed = await tryFlushPending();
          if (flushed === "retry") {
            setMsg(offlineClockBanner(queuedClock.clockedInAt));
            return;
          }
        }
        const useQueued = kind === "in" && !startingFreshShift && queuedClock;
        const res = await post("clock", {
          kind,
          ...coords,
          ...(kind === "in"
            ? {
                clockedInAt: useQueued ? queuedClock.clockedInAt : tappedAt,
                ...(useQueued ? { idempotencyKey: queuedClock.id } : {}),
              }
            : {}),
        });
        let json: { message?: string; alreadyIn?: boolean; clock?: Clock } = {};
        try {
          json = (await res.json()) as typeof json;
        } catch {
          json = {};
        }
        if (!res.ok) {
          if (kind === "in" && isOfflineClockFailure({ status: res.status })) {
            setInPhase("success");
            await holdActionSuccess();
            queueOfflineIn(coords, tappedAt);
            return;
          }
          if (kind === "in") setInPhase("idle");
          setMsg(json.message || "Couldn't record that.");
          return;
        }
        if (kind === "in") {
          // Online success must drop any pending row so a later second-shift
          // clock-in cannot replay the first shift's idempotency key.
          clearPendingClock(code);
          setQueuedClock(null);
          setInPhase("success");
          await holdActionSuccess();
        }
        await onRefresh();
      } catch (error) {
        if (kind === "in" && isOfflineClockFailure({ error })) {
          setInPhase("success");
          await holdActionSuccess();
          queueOfflineIn(coords, tappedAt);
          return;
        }
        if (kind === "in") setInPhase("idle");
        setMsg("Network error. Try again.");
      } finally {
        setBusy("");
      }
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => void withCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => void withCoords({}),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    } else {
      void withCoords({});
    }
  };

  // ── Drive (odometer) ──────────────────────────────────────────────────
  // One GPS fix on Start, one on Stop; the server routes between them over
  // real roads. NOT a live trail — mobile Safari stops giving us positions the
  // moment the screen locks, so a breadcrumb loop here would under-report the
  // drive while looking precise. The app is the only true tracker.
  const mileage = ctx.session?.mileage;
  const [driveBusy, setDriveBusy] = useState(false);

  // ── Sampling stops ────────────────────────────────────────────────────
  // A roaming crew's event is the MARKET, so the individual spots need their
  // own record — and it has to be captured here, in the moment, not recalled
  // into the recap hours later. Torch (store sampling) never sees this card.
  const stops = ctx.session?.stops ?? [];
  const [stopBusy, setStopBusy] = useState(false);
  const [stopName, setStopName] = useState("");
  const showStopCard = shouldShowSamplingStopCard({
    clockState,
    locationMode: ctx.locationMode,
    brand: ctx.brand,
  });

  const drive = (action: "start" | "stop") => {
    setMsg(null);
    setDriveBusy(true);
    const send = (coords: { latitude?: number; longitude?: number }) =>
      post(`mileage/${action}`, coords)
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) setMsg(json.message || "Couldn't update the drive.");
          else if (json.warning) setMsg(json.warning);
        })
        .catch(() => setMsg("Network error. Try again."))
        .finally(async () => {
          setDriveBusy(false);
          await onRefresh();
        });
    if (!navigator.geolocation) {
      setDriveBusy(false);
      setMsg("This phone can't share location, so we can't log the drive.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        void send({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => {
        // A Start with no fix is useless — refuse it rather than open a leg
        // that can never produce a distance. A Stop still goes through so the
        // BA is never stuck with a running timer.
        if (action === "start") {
          setDriveBusy(false);
          setMsg("Turn on location to log your drive.");
        } else {
          void send({});
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  const logStop = () => {
    setMsg(null);
    setStopBusy(true);
    const send = (coords: { latitude?: number; longitude?: number }) =>
      post("sampling-stop", { ...coords, name: stopName })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) setMsg(json.message || "Couldn't log that stop.");
          else setStopName("");
        })
        .catch(() => setMsg("Network error. Try again."))
        .finally(async () => {
          setStopBusy(false);
          await onRefresh();
        });
    if (!navigator.geolocation) {
      // No GPS is survivable — a typed name still records where they were.
      void send({});
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        void send({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => void send({}),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  const pending = ctx.session?.pendingReview;
  // Never hardcode "Second shift" for forceNew — API resolves Second / Third /
  // Shift N from filed count. An explicit front label was overwriting shift-2
  // claims on third filings and prefilling leftover "file another" drafts.
  const activePayable =
    payableMileage ?? ctx.session?.payableMileage ?? null;

  if (showMileageStep && activePayable) {
    return (
      <PayableMileageStep
        accent={accent}
        payableMileage={activePayable}
        forceNew={recapAsNew && ctx.mode === "tenant"}
        busy={busy !== ""}
        onBack={() => setShowMileageStep(false)}
        onContinue={(miles) => {
          if (miles != null && Number.isFinite(miles)) {
            setConfirmedPayableMiles(miles);
          }
          setShowMileageStep(false);
          setShowRecap(true);
        }}
        onSave={async (body) => {
          const storage =
            activePayable.matchedStorage ??
            activePayable.storageUnits.find(
              (u) =>
                u.market.trim().toLowerCase() ===
                (body.storageMarket || "").trim().toLowerCase(),
            ) ??
            null;
          const queueOffline = () => {
            if (!token) return { claim: null as PayableMileageClaim | null, error: "Session expired." };
            const pending = enqueueMileage({
              code,
              token,
              startedFromStorage: body.startedFromStorage,
              stops: body.stops,
              storageMarket: body.storageMarket,
              forceNew: Boolean(body.forceNew),
              noMileage: Boolean(body.noMileage),
              storage,
            });
            const claim = provisionalClaimFromPending(pending);
            setPayableMileage((prev) =>
              prev ? { ...prev, claim } : { ...activePayable, claim },
            );
            setConfirmedPayableMiles(claim.payableMiles);
            setQueuedMileage(pending);
            setMsg(offlineMileageBanner());
            return { claim };
          };
          try {
            const res = await post("payable-mileage", {
              startedFromStorage: body.startedFromStorage,
              stops: body.stops,
              storageMarket: body.storageMarket,
              forceNew: Boolean(body.forceNew),
              noMileage: Boolean(body.noMileage),
            });
            const data = (await res.json().catch(() => ({}))) as {
              payableMileage?: PayableMileageState;
              claim?: PayableMileageClaim;
              error?: string;
              message?: string;
            };
            if (!res.ok) {
              if (isOfflineClockFailure({ status: res.status })) {
                return queueOffline();
              }
              const error =
                data.message || data.error || "Couldn't save mileage.";
              setMsg(error);
              return { claim: null, error };
            }
            clearPendingMileage(code);
            setQueuedMileage(null);
            if (data.payableMileage) setPayableMileage(data.payableMileage);
            const claim =
              data.claim ?? data.payableMileage?.claim ?? null;
            if (!claim) {
              return {
                claim: null,
                error: "Mileage saved but we couldn't open the recap. Try again.",
              };
            }
            if (Number.isFinite(claim.payableMiles)) {
              setConfirmedPayableMiles(claim.payableMiles);
            }
            return { claim };
          } catch (error) {
            if (isOfflineClockFailure({ error })) {
              return queueOffline();
            }
            const errMsg = "Couldn't save mileage. Check your signal.";
            setMsg(errMsg);
            return { claim: null, error: errMsg };
          }
        }}
      />
    );
  }

  if (showRecap) {
    return (
      <RecapForm
        code={code}
        token={token}
        template={ctx.template ?? null}
        photoBuckets={ctx.photoBuckets}
        accent={accent}
        brandName={ctx.brand.name || ""}
        eventDate={ctx.event?.date}
        forceNew={(recapAsNew || Boolean(ctx.recapOnly && hasRecap)) && ctx.mode === "tenant"}
        payableMiles={
          confirmedPayableMiles ??
          (recapAsNew ? null : activePayable?.claim?.payableMiles) ??
          null
        }
        onCancel={() => {
          if (ctx.recapOnly && !hasRecap) onStartAnother();
          else setShowRecap(false);
        }}
        onSubmitted={async () => {
          setShowRecap(false);
          setQueuedRecap(null);
          await onRefresh();
        }}
        onQueued={() => {
          setShowRecap(false);
          setQueuedRecap(readPendingRecap(code));
        }}
      />
    );
  }

  if (hasRecap && clockState !== "clocked_in" && !leftover) {
    return (
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 6 }}>✓</div>
        <h2 style={{ ...h2, marginBottom: 6 }}>You're all set</h2>
        <p style={{ fontSize: 14, opacity: 0.7 }}>
          Your recap is in{pending ? " and is pending your lead's confirmation" : ""}. Thanks for the great work!
        </p>
        {ctx.event?.date ? (
          <p style={{ fontSize: 13, opacity: 0.55, marginTop: 8 }}>
            {fmtDay(ctx.event.date)}
            {ctx.event.address ? ` · ${ctx.event.address}` : ""}
          </p>
        ) : null}
        {/* Standing clock links share one event per place/day. Gloria (Feel
            Free Tampa) was stuck here after a 12-minute morning punch + recap:
            "You're all set" hid Clock in, so the riverwalk shift could not
            start or end. Clock in again on the same event. Recap-only stays
            recap-only. Per-event codes stay done. */}
        {ctx.mode === "tenant" ? (
          <>
            {secondShiftOk ? (
              <div
                style={{
                  marginTop: 18,
                  textAlign: "left",
                  padding: "14px 14px 4px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(0,0,0,0.02)",
                }}
              >
                <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>
                  {SECOND_SHIFT_PROMPT}
                </p>
                <p style={{ fontSize: 13, opacity: 0.65, margin: "0 0 12px" }}>
                  {SECOND_SHIFT_HINT}
                </p>
                {!ctx.recapOnly ? (
                  <button
                    onClick={() => {
                      // Drop any stale offline queue before starting shift 2.
                      clearPendingClock(code);
                      setQueuedClock(null);
                      void clock("in");
                    }}
                    disabled={busy !== ""}
                    style={{ ...primaryBtn(accent), width: "100%", marginBottom: 8 }}
                  >
                    {busy === "in" ? "Clocking in…" : "Yes — start second shift"}
                  </button>
                ) : null}
                <button
                  onClick={() => openRecap(true)}
                  style={{
                    ...(ctx.recapOnly ? primaryBtn(accent) : secondaryBtn),
                    width: "100%",
                    marginBottom: 8,
                  }}
                >
                  {ctx.recapOnly
                    ? `Yes — file ${SECOND_SHIFT_LABEL.toLowerCase()} recap`
                    : `File ${SECOND_SHIFT_LABEL.toLowerCase()} recap`}
                </button>
              </div>
            ) : (
              <>
                {!ctx.recapOnly ? (
                  <button
                    onClick={() => clock("in")}
                    disabled={busy !== ""}
                    style={{ ...primaryBtn(accent), marginTop: 18, width: "100%" }}
                  >
                    {busy === "in" ? "Clocking in…" : "Clock in"}
                  </button>
                ) : null}
                <button
                  onClick={() => openRecap(true)}
                  style={{
                    ...(ctx.recapOnly ? primaryBtn(accent) : secondaryBtn),
                    marginTop: ctx.recapOnly ? 18 : 10,
                    width: "100%",
                  }}
                >
                  {ctx.recapOnly ? "File another recap" : "File another recap (same store)"}
                </button>
              </>
            )}
            <button
              onClick={onStartAnother}
              style={{ ...secondaryBtn, marginTop: 10, width: "100%" }}
            >
              {ctx.recapOnly
                ? "File for another store / date"
                : secondShiftOk
                  ? "Different market? Start over"
                  : "Check in at a different store"}
            </button>
            {msg ? <p style={{ ...errText, marginTop: 12 }}>{msg}</p> : null}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {leftover ? (
        <div
          style={{
            ...card,
            borderColor: "rgba(239, 90, 42, 0.35)",
            background: "#fffaf7",
          }}
        >
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#ef5a2a",
            }}
          >
            {LEFTOVER_BANNER_TITLE}
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, margin: "6px 0 4px" }}>
            {fmtDay(ctx.event?.date)}
            {ctx.event?.address ? ` · ${ctx.event.address}` : ""}
          </p>
          <p style={{ fontSize: 13, opacity: 0.7, margin: "0 0 12px" }}>
            {ctx.recapOnly ? LEFTOVER_BANNER_BODY_RECAP : LEFTOVER_BANNER_BODY}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              style={primaryBtn(accent)}
              disabled={clearing || busy !== ""}
              onClick={() => void clearClockIn()}
            >
              {clearing
                ? LEFTOVER_PRIMARY_BUSY
                : ctx.recapOnly
                  ? LEFTOVER_PRIMARY_CTA_RECAP
                  : LEFTOVER_PRIMARY_CTA}
            </button>
            <button
              style={secondaryBtn}
              disabled={clearing}
              onClick={() => setKeepLeftover(true)}
            >
              {LEFTOVER_SECONDARY_CTA}
            </button>
          </div>
        </div>
      ) : null}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.5 }}>
              Time clock
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
              {effectiveClock === "clocked_in" ? "On the clock" : effectiveClock === "clocked_out" ? "Clocked out" : "Not started"}
            </div>
            {ctx.event?.date ? (
              <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>
                {fmtDay(ctx.event.date)}
                {ctx.event.address ? ` · ${ctx.event.address}` : ""}
              </div>
            ) : null}
            {clockInAt ? (
              <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>
                In {fmtTime(clockInAt)}
                {ctx.session?.clock.clockOutAt ? ` · Out ${fmtTime(ctx.session.clock.clockOutAt)}` : ""}
                {queuedClock ? " · saved on this device" : ""}
              </div>
            ) : null}
          </div>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: effectiveClock === "clocked_in" ? accent : "rgba(0,0,0,0.2)",
            }}
          />
        </div>
        {clockState === "clocked_in" &&
        (ctx.event?.storeManagerName || ctx.event?.storeManagerPhone) ? (
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px solid rgba(28, 25, 23, 0.08)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#78716c",
              }}
            >
              Ask for
            </div>
            {ctx.event.storeManagerName ? (
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 3, color: "#1c1917" }}>
                {ctx.event.storeManagerName}
              </div>
            ) : null}
            {ctx.event.storeManagerPhone ? (
              <a
                href={telHref(ctx.event.storeManagerPhone)}
                style={{
                  display: "inline-block",
                  marginTop: 2,
                  fontSize: 14,
                  fontWeight: 600,
                  color: accent,
                  textDecoration: "none",
                }}
              >
                {ctx.event.storeManagerPhone}
              </a>
            ) : null}
          </div>
        ) : null}
        {/* ONE action at a time, in order: clock in → file recap → clock out.
            Clock-out is deliberately withheld until the recap is in. A BA who
            can clock out first files the recap from the car, or not at all —
            gating it keeps the write-up happening on site while the shift is
            still fresh, and makes the clock reflect the real end of work.
            Nobody can get stranded on the clock: the auto-clock-out cron
            closes anything left open. */}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          {effectiveClock === "not_started" && !leftover ? (
            <ActionMorphButton
              style={primaryBtn(accent)}
              disabled={busy !== ""}
              onClick={() => clock("in")}
              phase={inPhase}
              pendingLabel="Clocking in…"
              successLabel="Clocked in"
            >
              Clock in
            </ActionMorphButton>
          ) : null}

          {/* Recap first — that's the intended order, so it stays the primary
              button. But clock out is ALWAYS reachable. BAs reported being
              unable to "sign out": their recap wouldn't submit (photos), and
              clock out only appeared after a recap existed, so a failed upload
              silently kept them on the clock with no way to end the shift.
              Never gate ending a shift on another action succeeding. */}
          {effectiveClock === "clocked_in" && !hasRecap ? (
            <>
              <button style={primaryBtn(accent)} onClick={() => openRecap(false)}>
                {queuedRecap
                  ? "Edit saved recap"
                  : draftWaiting
                    ? "Continue your recap"
                    : "File recap"}
              </button>
              <button style={secondaryBtn} disabled={busy !== ""} onClick={() => clock("out")}>
                {busy === "out" ? "Clocking out…" : "Clock out"}
              </button>
            </>
          ) : null}

          {effectiveClock === "clocked_in" && hasRecap ? (
            <>
              <button style={primaryBtn(accent)} disabled={busy !== ""} onClick={() => clock("out")}>
                {busy === "out" ? "Clocking out…" : "Clock out"}
              </button>
              <button style={secondaryBtn} onClick={() => openRecap(false)}>
                Edit recap
              </button>
              {secondShiftOk ? (
                <button style={secondaryBtn} onClick={() => openRecap(true)}>
                  File {SECOND_SHIFT_LABEL.toLowerCase()}
                </button>
              ) : ctx.mode === "tenant" ? (
                <button style={secondaryBtn} onClick={() => openRecap(true)}>
                  File another
                </button>
              ) : null}
            </>
          ) : null}

          {/* Clocked out with no recap — an older shift, or the auto-clock-out
              cron closed them. Still let them file it, but this must NOT be
              the only way out: a BA whose last shift ended without a recap
              would otherwise be trapped on that dead event forever, unable to
              start today's. Hence the escape hatch below. */}
          {effectiveClock === "clocked_out" && !hasRecap ? (
            <>
              {ctx.mode === "tenant" && !ctx.recapOnly && !leftover ? (
                <button style={primaryBtn(accent)} disabled={busy !== ""} onClick={() => clock("in")}>
                  {busy === "in" ? "Clocking in…" : "Clock in"}
                </button>
              ) : null}
              <button style={secondaryBtn} onClick={() => openRecap(false)}>
                {draftWaiting ? "Continue your recap" : "File recap"}
              </button>
              {ctx.mode === "tenant" && !leftover ? (
                <button
                  style={secondaryBtn}
                  onClick={() => onStartAnother()}
                >
                  {CHECK_IN_SOMEWHERE_ELSE}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        {queuedClock ? (
          <p style={{ ...errText, color: "#92400e" }}>
            {offlineClockBanner(queuedClock.clockedInAt)}
          </p>
        ) : null}
        {queuedMileage ? (
          <p style={{ ...errText, color: "#92400e" }}>
            {offlineMileageBanner()}
          </p>
        ) : null}
        {queuedRecap ? (
          <p style={{ ...errText, color: "#92400e" }}>
            {offlineRecapBanner(queuedRecap.submittedAt)}
          </p>
        ) : null}
        {msg && !queuedClock && !queuedMileage && !queuedRecap ? (
          <p style={errText}>{msg}</p>
        ) : null}
      </div>

      {/* Wrong store / new shift on a shared standing link — BAs need a clear
          escape before they punch the wrong day. Not offered mid-shift on a
          per-event link, where there is no other event to move to. */}
      {ctx.mode === "tenant" && (clockState === "clocked_in" || clockState === "not_started") ? (
        <button
          onClick={() => (leftover ? void clearClockIn() : onStartAnother())}
          style={{
            background: "none",
            border: "none",
            padding: "8px 4px",
            fontSize: leftover ? 13 : 15,
            fontWeight: leftover ? 600 : 700,
            lineHeight: 1.35,
            color: leftover ? "inherit" : accent,
            opacity: leftover ? 0.75 : 1,
            textDecoration: "underline",
            textUnderlineOffset: 3,
            cursor: "pointer",
            alignSelf: "center",
            textAlign: "center",
            maxWidth: "100%",
          }}
        >
          {leftover ? LEFTOVER_ESCAPE_LINK : START_OVER_LINK}
        </button>
      ) : null}

      {/* Where they sampled. Roaming / market crews only (Feel Free). Torch
          stays on the store they clocked into — no second stop card. */}
      {showStopCard ? (
        <div style={card}>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
            Log your stop
          </p>
          <p style={{ fontSize: 12, opacity: 0.55, margin: "4px 0 10px" }}>
            Where are you sampling? Tap this at each spot. We grab the
            location for you — the name is just so you recognise it later.
          </p>
          <input
            style={input}
            placeholder="Spot name (optional) — e.g. Whole Foods patio"
            value={stopName}
            onChange={(e) => setStopName(e.target.value)}
          />
          <button
            style={{ ...secondaryBtn, width: "100%", margin: "8px 0 0" }}
            disabled={stopBusy}
            onClick={logStop}
          >
            {stopBusy ? "Logging…" : "📍 Log this stop"}
          </button>

          {stops.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <p className="mono" style={{ fontSize: 11, opacity: 0.5, margin: "0 0 6px", letterSpacing: "0.1em" }}>
                {stops.length} STOP{stops.length === 1 ? "" : "S"} TODAY
              </p>
              {stops.map((st, i) => (
                <div
                  key={st.uuid}
                  style={{
                    display: "flex",
                    gap: 8,
                    fontSize: 13,
                    padding: "6px 0",
                    borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <span style={{ opacity: 0.45, minWidth: 18 }}>{i + 1}.</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {st.name || st.address || "Logged stop"}
                    {st.name && st.address ? (
                      <span style={{ display: "block", fontSize: 11, opacity: 0.55 }}>
                        {st.address}
                      </span>
                    ) : null}
                  </span>
                  <span style={{ opacity: 0.55, whiteSpace: "nowrap" }}>
                    {fmtTime(st.recordedAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Mileage — only for gigs with track_mileage on, and only once the BA
          is actually on the clock (no logging drives before a shift). */}
      {mileage?.enabled && clockState === "clocked_in" ? (
        <div style={card}>
          <div className="row" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>
              {mileage.active ? "Drive in progress" : "Driving for this event?"}
            </span>
            <button
              style={mileage.active ? secondaryBtn : primaryBtn(accent)}
              disabled={driveBusy}
              onClick={() => drive(mileage.active ? "stop" : "start")}
            >
              {driveBusy
                ? "One sec…"
                : mileage.active
                  ? "Stop drive"
                  : "Start drive"}
            </button>
          </div>

          {mileage.legs.length > 0 ? (
            <p style={{ fontSize: 13, marginTop: 10 }}>
              {mileage.legs.length} trip{mileage.legs.length === 1 ? "" : "s"} ·{" "}
              <strong>{mileage.totalMiles} mi</strong>
              {mileage.totalAmount > 0 ? (
                <> · <strong>${mileage.totalAmount.toFixed(2)}</strong></>
              ) : null}
            </p>
          ) : null}

          <p style={{ fontSize: 12, opacity: 0.55, marginTop: 8 }}>
            {mileage.active
              ? "Tap Stop when you park. We measure the driving distance between where you started and where you stopped."
              : "Tap Start before you pull away, Stop when you park. Log each leg separately."}
          </p>
        </div>
      ) : null}

      {effectiveClock === "not_started" ? (
        <p style={{ fontSize: 13, opacity: 0.6, textAlign: "center" }}>Clock in when you arrive to start your shift.</p>
      ) : null}
      {effectiveClock === "clocked_in" && !hasRecap ? (
        <p style={{ fontSize: 13, opacity: 0.6, textAlign: "center" }}>
          {draftWaiting
            ? "Your answers are saved on this phone. Continue your recap whenever you're ready — reopen this check-in link if you leave."
            : "You're on the clock. File your recap when you're done. If it won't go through, clock out anyway — you can come back and file it after."}
        </p>
      ) : null}
      {effectiveClock === "clocked_in" && hasRecap ? (
        <p style={{ fontSize: 13, opacity: 0.6, textAlign: "center" }}>
          Recap's in. Clock out to finish your shift.
        </p>
      ) : null}
    </div>
  );
}

// ── Recap form (renders the full custom template) ───────────────────────────
function RecapForm({
  code,
  token,
  template,
  photoBuckets,
  accent,
  brandName,
  eventDate,
  forceNew = false,
  shiftLabel,
  payableMiles = null,
  onCancel,
  onSubmitted,
  onQueued,
}: {
  code: string;
  token: string;
  template: Template | null;
  photoBuckets?: PhotoBucket[];
  accent: string;
  brandName: string;
  eventDate?: string | null;
  forceNew?: boolean;
  shiftLabel?: string;
  /** When set, pre-fills the Mileage field from the itinerary (editable for detours). */
  payableMiles?: number | null;
  onCancel: () => void;
  onSubmitted: () => Promise<void>;
  onQueued: () => void;
}) {
  // Prefill the brand into an "Event Name" field. Spark already knows the
  // brand, and every Total Wireless recap wants the same answer — making the
  // BA type it on a phone keyboard is pure friction, and hand-typing is how
  // you end up with "total wirless" in a client report. Still editable.
  //
  // Matched on the field NAME, so a template using different wording simply
  // doesn't prefill and the BA types it exactly as before — the same
  // name-matching approach the recap metrics use, but here a miss is
  // harmless rather than a wrong number.
  // A restored draft wins over the brand prefill: if the BA edited Event Name
  // before the tab was discarded, their wording is the answer, not ours.
  const restored = useRef<RecapDraft | null>(readDraft(code, token));

  const [values, setValues] = useState<Record<string, string | string[]>>(() => {
    const seed: Record<string, string | string[]> = {};
    if (brandName) {
      for (const section of template?.sections ?? []) {
        for (const f of section.fields) {
          if (f.name.trim().toLowerCase() === "event name" && !isPhotoType(f.type)) {
            seed[f.id] = brandName;
          }
        }
      }
    }
    // Feel Free payable miles — lock the Mileage field to the itinerary value.
    if (payableMiles != null && Number.isFinite(payableMiles)) {
      for (const section of template?.sections ?? []) {
        for (const f of section.fields) {
          if (isMileageCustomFieldName(f.name) && !isPhotoType(f.type)) {
            seed[f.id] = String(payableMiles);
          }
        }
      }
    }
    return { ...seed, ...(restored.current?.values ?? {}), ...(
      payableMiles != null && Number.isFinite(payableMiles)
        ? Object.fromEntries(
            (template?.sections ?? [])
              .flatMap((s) => s.fields)
              .filter((f) => isMileageCustomFieldName(f.name))
              .map((f) => [f.id, String(payableMiles)]),
          )
        : {}
    ) };
  });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const photosRef = useRef<Photo[]>([]);
  photosRef.current = photos;
  const [samples, setSamples] = useState<Record<string, string>>(
    () => restored.current?.samples ?? {},
  );
  const [engagements, setEngagements] = useState(
    () => restored.current?.engagements ?? "",
  );
  const [savedAt, setSavedAt] = useState<number | null>(
    () => restored.current?.savedAt ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<ActionPhase>("idle");
  const [err, setErr] = useState<string | null>(null);
  const libraryRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const photoSeq = useRef(0);

  // Debounced so a BA typing a long answer isn't writing to storage per
  // keystroke, but short enough that "momentarily idle" is already saved.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const at = writeDraft(code, token, { values, samples, engagements });
      if (at) setSavedAt(at);
    }, 500);
    return () => window.clearTimeout(t);
  }, [code, token, values, samples, engagements]);

  // Mileage step → RecapForm can race: lock miles into required field values
  // whenever the itinerary claim arrives (or updates).
  useEffect(() => {
    if (payableMiles == null || !Number.isFinite(payableMiles)) return;
    const miles = String(payableMiles);
    setValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const section of template?.sections ?? []) {
        for (const f of section.fields) {
          if (!isMileageCustomFieldName(f.name) || isPhotoType(f.type)) continue;
          const cur = next[f.id];
          const empty =
            cur == null ||
            (Array.isArray(cur) ? cur.length === 0 : String(cur).trim() === "");
          // Only fill when empty — don't clobber a detour bump the BA typed.
          if (empty) {
            next[f.id] = miles;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [payableMiles, template]);

  const uploadingCount = photos.filter((p) => p.state === "uploading").length;
  const failedCount = photos.filter((p) => p.state === "failed").length;

  const hasPhotoField = useMemo(
    () => (template?.sections ?? []).some((s) => s.fields.some((f) => isPhotoType(f.type))),
    [template],
  );
  const templateFields = useMemo(
    () => (template?.sections ?? []).flatMap((s) => s.fields),
    [template],
  );
  const hasProductsSampledMultiselect = useMemo(
    () => templateFields.some((f) => isProductsSampledMultiselect(f)),
    [templateFields],
  );
  const hasDropOffLocations = useMemo(
    () => templateFields.some((f) => isDropOffLocationsField(f)),
    [templateFields],
  );
  // Torch (and most retail templates) already ask "total number of consumers
  // sampled". That IS Spark's engagements metric — don't make the BA type it
  // again in the native Total engagements box.
  const hideEngagementsInput = templateHasConsumersSampledField(templateFields);
  // Labelled buckets replace the single generic grid outright. They also beat
  // `hasPhotoField`: that flag HIDES the grid whenever the template carries an
  // image field, which is how adding template fields produces prompts instead
  // of buckets. Buckets are explicit brand config, so they win.
  const buckets = photoBuckets ?? [];
  // Photos with no bucket. For every brand without buckets that is all of
  // them, so the generic grid and any image-type template field behave exactly
  // as they did before buckets existed.
  const loosePhotos = photos.filter((p) => p.category === null);

  const setVal = (id: string, v: string | string[]) => setValues((p) => ({ ...p, [id]: v }));

  // Upload one photo, keyed by its stable id. Compresses first — a raw iPhone
  // shot is 3-5MB and a BA may file dozens from a parking lot on LTE.
  const uploadOne = async (id: string, original: File) => {
    try {
      const file = await compressImage(original);
      const { blobName } = await putCheckinPhoto({
        code,
        token,
        file,
        apiOrigin: apiOrigin(),
      });
      setPhotos((p) =>
        p.map((ph) => (ph.id === id ? { ...ph, blobName, state: "done" } : ph)),
      );
    } catch {
      setPhotos((p) => p.map((ph) => (ph.id === id ? { ...ph, state: "failed" } : ph)));
    }
  };

  const uploadFiles = async (files: FileList | null, category: string | null = null) => {
    if (!files || !files.length) return;
    const room = Math.max(0, PHOTO_CAP - photosRef.current.length);
    if (room === 0) {
      setErr(`Photo limit reached (${PHOTO_CAP}). Remove some to add more.`);
      return;
    }
    const picked = Array.from(files);
    const accepted = picked.slice(0, room);
    if (picked.length > accepted.length) {
      setErr(
        `Only ${room} more photo${room === 1 ? "" : "s"} fit (max ${PHOTO_CAP}). Added the first ${accepted.length}.`,
      );
    } else {
      setErr(null);
    }
    const batch: Photo[] = accepted.map((file) => ({
      id: `${Date.now()}-${photoSeq.current++}`,
      file,
      blobName: null,
      previewUrl: URL.createObjectURL(file),
      state: "uploading" as const,
      category,
    }));
    // Keep the ref ahead of re-render so a second library pick mid-upload
    // still sees the true remaining room.
    photosRef.current = [...photosRef.current, ...batch];
    setPhotos(photosRef.current);
    await runWithConcurrency(batch, UPLOAD_CONCURRENCY, (ph) => uploadOne(ph.id, ph.file));
  };

  const retryFailed = async () => {
    const stuck = photos.filter((p) => p.state === "failed");
    if (!stuck.length) return;
    setErr(null);
    setPhotos((p) => p.map((ph) => (ph.state === "failed" ? { ...ph, state: "uploading" } : ph)));
    await runWithConcurrency(stuck, UPLOAD_CONCURRENCY, (ph) => uploadOne(ph.id, ph.file));
  };

  // Keyed by id, never by index. Each bucket renders its OWN filtered slice, so
  // position 0 of a bucket is some arbitrary position in `photos` — the same
  // index-vs-id confusion that once wrote every upload result into one slot.
  const removePhoto = (id: string) => {
    const next = photosRef.current.filter((ph) => ph.id !== id);
    photosRef.current = next;
    setPhotos(next);
  };

  const submit = async () => {
    setErr(null);
    // Ensure itinerary miles are in values before required-field checks
    // (covers any race where the mileage step → recap handoff lagged).
    const valuesForSubmit = { ...values };
    if (payableMiles != null && Number.isFinite(payableMiles)) {
      for (const f of templateFields) {
        if (!isMileageCustomFieldName(f.name) || isPhotoType(f.type)) continue;
        const cur = valuesForSubmit[f.id];
        const empty =
          cur == null ||
          (Array.isArray(cur) ? cur.length === 0 : String(cur).trim() === "");
        if (empty) valuesForSubmit[f.id] = String(payableMiles);
      }
    }
    // Required non-photo fields must be answered.
    for (const s of template?.sections ?? []) {
      for (const f of s.fields) {
        if (!f.required || isPhotoType(f.type)) continue;
        const v = valuesForSubmit[f.id];
        if (isDropOffLocationsField(f)) {
          const dropErr = validateDropOffLocationsValue(
            Array.isArray(v) ? JSON.stringify(v) : String(v ?? ""),
          );
          if (dropErr) return setErr(dropErr);
          continue;
        }
        const empty = v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");
        if (empty) return setErr(`Please fill in "${f.name}".`);
      }
    }
    const donePhotos = photos.filter((p) => p.state === "done" && p.blobName);
    // Only block on uploads genuinely in flight, and say how many. Photos that
    // FAILED must never block: a BA standing in a parking lot on one bar has
    // to be able to finish and clock out. The button label tells them exactly
    // how many they're leaving behind, and Retry is right there.
    if (uploadingCount > 0) {
      return setErr(
        `Still uploading ${uploadingCount} photo${uploadingCount === 1 ? "" : "s"} — one moment.`,
      );
    }
    const offlineNow = typeof navigator !== "undefined" && navigator.onLine === false;
    if (donePhotos.length === 0) {
      if (!(failedCount > 0 && offlineNow)) {
        return setErr(
          failedCount > 0
            ? "No photos uploaded yet. Tap Retry, or check your signal."
            : "Add at least one photo of your event.",
        );
      }
    }

    const fieldValues = Object.entries(valuesForSubmit)
      .map(([id, v]) => ({ customFieldId: id, value: Array.isArray(v) ? JSON.stringify(v) : String(v) }))
      .filter((fv) => fv.value !== "" && fv.value !== "[]");
    // Prefer Drop-off Locations JSON (Product Seeding), then Products Sampled
    // pills, then the plain per-SKU qty grid.
    const fromDropOffs = (() => {
      const out: { productId: string; quantity: number }[] = [];
      for (const f of templateFields) {
        if (!isDropOffLocationsField(f)) continue;
        const raw = valuesForSubmit[f.id];
        const locs = parseDropOffLocations(
          Array.isArray(raw) ? JSON.stringify(raw) : String(raw ?? ""),
        );
        out.push(...productSamplesFromDropOffs(locs));
      }
      // Merge duplicate productIds if multiple drop-off fields ever exist.
      const totals = new Map<string, number>();
      for (const row of out) {
        totals.set(row.productId, (totals.get(row.productId) ?? 0) + row.quantity);
      }
      return [...totals.entries()].map(([productId, quantity]) => ({
        productId,
        quantity,
      }));
    })();
    const fromPills = (() => {
      if (!hasProductsSampledMultiselect) return [] as { productId: string; quantity: number }[];
      const selected: string[] = [];
      for (const f of templateFields) {
        if (!isProductsSampledMultiselect(f)) continue;
        const raw = values[f.id];
        if (Array.isArray(raw)) selected.push(...raw.map(String));
      }
      return productSamplesFromSelections(
        selected,
        samples,
        template?.products ?? [],
        (raw) => {
          const n = Number(raw);
          return Number.isFinite(n) ? n : null;
        },
      );
    })();
    const fromGrid = Object.entries(samples)
      .map(([productId, q]) => ({ productId, quantity: Number(q) }))
      .filter((s) => Number.isFinite(s.quantity) && s.quantity > 0);
    const productSamples =
      fromDropOffs.length > 0
        ? fromDropOffs
        : fromPills.length > 0
          ? fromPills
          : hasProductsSampledMultiselect
            ? []
            : fromGrid;
    const fromSamples = engagementsFromSamplesGiven(templateFields, values);
    const typed = engagements.trim() === "" ? null : Number(engagements);
    const totalEngagements = fromSamples ?? (Number.isFinite(typed) ? typed : null);
    const submittedAt = new Date().toISOString();

    const queueThisSubmit = async () => {
      const photoFiles: Record<string, File> = {};
      const files = photos
        .filter((p) => p.state !== "uploading")
        .map((p) => {
          if (!p.blobName) photoFiles[p.id] = p.file;
          return {
            id: p.id,
            blobName: p.blobName,
            category: p.category,
            filename: p.file.name || "photo.jpg",
            contentType: browserPlayableContentType({
              type: p.file.type,
              name: p.file.name,
            }),
          };
        });
      await enqueueRecap({
        code,
        token,
        fieldValues,
        files,
        productSamples,
        totalEngagements,
        forceNew,
        shiftLabel: forceNew ? shiftLabel : undefined,
        secondShift: Boolean(forceNew && shiftLabel),
        submittedAt,
        photoFiles,
      });
      // Draft stays until the server ACKs — flushQueuedRecap clears it.
      onQueued();
    };

    setBusy(true);
    setSubmitPhase("pending");
    try {
      // Recap can be drafted offline. If a clock-in is still queued, attach
      // it first so the API sees the shift that started at tap time.
      await flushPendingClock({
        code,
        postClock: (body) => postCheckinClock(code, { session: token, ...body }),
      });
      await flushPendingMileage({
        code,
        postMileage: (body) =>
          postCheckinPayableMileage(code, { session: token, ...body }),
      });
      if (offlineNow) {
        await queueThisSubmit();
        setSubmitPhase("success");
        await holdActionSuccess();
        return;
      }
      const existing = readPendingRecap(code);
      const recapBody = {
        session: token,
        idempotencyKey: existing && existing.token === token ? existing.id : undefined,
        fieldValues,
        files: donePhotos.map((p) => ({ blobName: p.blobName, category: p.category })),
        productSamples,
        totalEngagements,
        forceNew,
        ...(forceNew && shiftLabel
          ? { shiftLabel, secondShift: true }
          : {}),
      };
      const posted = await postCheckinRecap(code, recapBody);
      if (!posted.ok && !posted.already) {
        if (isOfflineClockFailure({ status: posted.status })) {
          await queueThisSubmit();
          return;
        }
        setErr(posted.message || "Couldn't submit your recap.");
        setBusy(false);
        setSubmitPhase("idle");
        return;
      }
      // Filed — the draft has served its purpose. Cleared before the parent
      // unmounts this form so a later shift can't resurrect these answers.
      clearDraft(code, token);
      setSubmitPhase("success");
      await holdActionSuccess();
      await onSubmitted();
    } catch (error) {
      if (isOfflineClockFailure({ error })) {
        await queueThisSubmit();
        setSubmitPhase("success");
        await holdActionSuccess();
        return;
      }
      setErr("Network error. Try again.");
      setBusy(false);
      setSubmitPhase("idle");
    }
  };

  if (!template) {
    return (
      <div style={{ ...card, textAlign: "center" }}>
        <p style={{ opacity: 0.7 }}>This event has no recap form set up. Ask your lead.</p>
        <button style={{ ...secondaryBtn, marginTop: 12 }} onClick={onCancel}>
          Back
        </button>
      </div>
    );
  }

  const pendingClock = readPendingClock(code);
  const pendingRecap = readPendingRecap(code);
  const pendingMileage = readPendingMileage(code);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {eventDate ? (
        <p style={{ fontSize: 13, opacity: 0.65, margin: 0 }}>
          Recap for {fmtDay(eventDate)}
          {forceNew && shiftLabel
            ? ` · ${shiftLabel}`
            : forceNew
              ? " · additional filing"
              : ""}
        </p>
      ) : null}
      {pendingClock ? (
        <p style={{ ...errText, color: "#92400e", margin: 0 }}>
          {offlineClockBanner(pendingClock.clockedInAt)} You can still fill this
          recap — it stays on this device until it sends.
        </p>
      ) : null}
      {pendingMileage ? (
        <p style={{ ...errText, color: "#92400e", margin: 0 }}>
          {offlineMileageBanner()}
        </p>
      ) : null}
      {pendingRecap ? (
        <p style={{ ...errText, color: "#92400e", margin: 0 }}>
          {offlineRecapBanner(pendingRecap.submittedAt)}
        </p>
      ) : null}
      {payableMiles != null && Number.isFinite(payableMiles) ? (
        <div
          style={{
            ...card,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
          }}
        >
          <strong>Route miles: {formatPayableMiles(payableMiles)}</strong>
          <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.9 }}>
            {Number(payableMiles) === 0
              ? "No reimbursable mileage for this shift. You can still bump the Mileage field below if needed."
              : "Pre-filled from Google Maps driving directions through your stops (when available). If construction or detours added distance, bump the Mileage field below before you submit."}
          </p>
        </div>
      ) : null}
      {template.sections.map((section) => {
        // Mileage moves to the end of the recap (after photos). Skip empty
        // sections that only held mileage fields.
        const fields = section.fields.filter(
          (f) => !isMileageCustomFieldName(f.name),
        );
        if (fields.length === 0) return null;
        return (
        <div key={section.id} style={card}>
          <h2 style={h2}>{section.name}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            {fields.map((f) => (
              <FieldInput
                key={f.id}
                field={f}
                value={values[f.id]}
                accent={accent}
                onChange={(v) => setVal(f.id, v)}
                onAddPhotos={uploadFiles}
                photos={loosePhotos}
                onRemovePhoto={removePhoto}
                products={template.products}
                sampleQtys={samples}
                onSampleQtyChange={(productId, qty) =>
                  setSamples((s) => ({ ...s, [productId]: qty }))
                }
                qtyContextName={template.name}
              />
            ))}
          </div>
        </div>
        );
      })}

      {/* Full per-SKU qty grid only when there is no Products Sampled
          multiselect and no Drop-off Locations repeater — LD seeding
          captures cases per stop on that field instead. */}
      {template.productSamples &&
      template.products.length > 0 &&
      !hasProductsSampledMultiselect &&
      !hasDropOffLocations ? (
        <div style={card}>
          <h2 style={h2}>Products sampled</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            {template.products.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover" }} />
                ) : null}
                <span style={{ flex: 1, fontSize: 14 }}>{p.name}</span>
                <input
                  style={{ ...input, width: 88, margin: 0 }}
                  inputMode="numeric"
                  placeholder="0"
                  value={samples[p.id] ?? ""}
                  onChange={(e) => setSamples((s) => ({ ...s, [p.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!hideEngagementsInput || (buckets.length === 0 && !hasPhotoField) ? (
      <div style={card}>
        {!hideEngagementsInput ? (
          <>
            <label style={label}>Total engagements</label>
            <input style={input} inputMode="numeric" placeholder="e.g. 120" value={engagements} onChange={(e) => setEngagements(e.target.value)} />
          </>
        ) : null}
        {buckets.length === 0 && !hasPhotoField ? (
          <>
            <label style={{ ...label, marginTop: hideEngagementsInput ? 0 : 10 }}>
              Photos <span style={{ color: "#EF5A2A" }}>*</span>
            </label>
            <PhotoGrid
              photos={loosePhotos}
              onAdd={() => libraryRef.current?.click()}
              onTake={() => cameraRef.current?.click()}
              onRemove={removePhoto}
              accent={accent}
            />
            <PhotoFileInputs
              libraryRef={libraryRef}
              cameraRef={cameraRef}
              onFiles={(files) => void uploadFiles(files)}
            />
          </>
        ) : null}
      </div>
      ) : null}

      {buckets.length > 0 ? (
        <div style={card}>
          <h2 style={h2}>Photos</h2>
          <p style={{ fontSize: 13, opacity: 0.6, margin: "6px 0 0" }}>
            Put each shot in its own group so they land in the right place on
            the client report.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 14 }}>
            {buckets.map((b) => (
              <PhotoBucketZone
                key={b.id}
                bucket={b}
                photos={photos.filter((p) => p.category === b.id)}
                onAdd={uploadFiles}
                onRemove={removePhoto}
                accent={accent}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Total mileage — end of the recap (after photos), still required. */}
      {(() => {
        const mileageFields = template.sections.flatMap((s) =>
          s.fields.filter((f) => isMileageCustomFieldName(f.name)),
        );
        if (mileageFields.length === 0) return null;
        return (
          <div style={card}>
            <h2 style={h2}>Mileage</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
              {mileageFields.map((f) =>
                payableMiles != null && Number.isFinite(payableMiles) ? (
                  <div key={f.id}>
                    <label style={label}>
                      {f.name}
                      {f.required ? (
                        <span style={{ color: "#EF5A2A" }}> *</span>
                      ) : null}
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.1"
                      style={{
                        ...input,
                        background: "#fff",
                        color: "#065f46",
                        fontWeight: 600,
                      }}
                      value={
                        values[f.id] != null && !Array.isArray(values[f.id])
                          ? String(values[f.id])
                          : String(payableMiles)
                      }
                      onChange={(e) => setVal(f.id, e.target.value)}
                    />
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6b7280" }}>
                      Suggested {formatPayableMiles(payableMiles)}. Increase if
                      detours / construction added miles.
                    </p>
                  </div>
                ) : (
                  <FieldInput
                    key={f.id}
                    field={f}
                    value={values[f.id]}
                    accent={accent}
                    onChange={(v) => setVal(f.id, v)}
                    onAddPhotos={uploadFiles}
                    photos={loosePhotos}
                    onRemovePhoto={removePhoto}
                    products={template.products}
                    sampleQtys={samples}
                    onSampleQtyChange={(productId, qty) =>
                      setSamples((s) => ({ ...s, [productId]: qty }))
                    }
                    qtyContextName={template.name}
                  />
                ),
              )}
            </div>
          </div>
        );
      })()}

      {uploadingCount > 0 ? (
        <p style={{ textAlign: "center", fontSize: 13, opacity: 0.7 }}>
          Uploading photos… {photos.length - uploadingCount} of {photos.length} done
        </p>
      ) : null}

      {failedCount > 0 ? (
        <div style={{ ...card, borderColor: "#EF5A2A", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 13 }}>
              {failedCount} photo{failedCount === 1 ? "" : "s"} didn't upload.
              Tap Retry — or re-pick from your library (JPEG works best if HEIC keeps failing).
            </span>
            <button style={{ ...secondaryBtn, width: "auto", padding: "8px 14px", margin: 0 }} onClick={retryFailed}>
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {err ? <p style={{ ...errText, textAlign: "center" }}>{err}</p> : null}

      {/* Say it out loud. Half the Feel Free feedback was not knowing whether
          anything was kept — a BA who doesn't trust the form retypes into
          Notes first, which is the friction we're removing. */}
      {savedAt ? (
        <p
          style={{
            fontSize: 12,
            opacity: 0.55,
            textAlign: "center",
            margin: 0,
          }}
        >
          Saved on this device — you can close this and come back.
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button style={secondaryBtn} onClick={onCancel} disabled={busy}>
          Back
        </button>
        <ActionMorphButton
          style={primaryBtn(accent)}
          onClick={submit}
          disabled={busy || uploadingCount > 0}
          phase={submitPhase}
          pendingLabel="Submitting…"
          successLabel="Submitted"
        >
          {failedCount > 0
            ? `Submit without ${failedCount} photo${failedCount === 1 ? "" : "s"}`
            : "Submit recap"}
        </ActionMorphButton>
      </div>
    </div>
  );
}

// ── Multiselect (Products Sampled gets search when the SKU list is long) ──
function MultiselectFieldInput({
  field,
  value,
  accent,
  onChange,
  products,
  sampleQtys,
  onSampleQtyChange,
  req,
  labelStyle,
  qtyContextName,
}: {
  field: TemplateField;
  value: string | string[] | undefined;
  accent: string;
  onChange: (v: string[]) => void;
  products: TemplateProduct[];
  sampleQtys: Record<string, string>;
  onSampleQtyChange?: (productId: string, qty: string) => void;
  req: ReactNode;
  labelStyle: CSSProperties;
  qtyContextName?: string | null;
}) {
  const [skuFilter, setSkuFilter] = useState("");
  const arr = Array.isArray(value) ? value : [];
  const qtyMode =
    isProductsSampledMultiselect(field) &&
    Boolean(onSampleQtyChange) &&
    products.length > 0;
  const qtyUnit = productSampleQtyUnit(qtyContextName ?? field.name);
  const searchable = field.options.length > 24;
  const visibleOptions = useMemo(() => {
    const q = skuFilter.trim().toLowerCase();
    if (!q) return field.options;
    return field.options.filter((o) => o.toLowerCase().includes(q));
  }, [field.options, skuFilter]);

  const toggle = (o: string) => {
    const next = arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o];
    onChange(next);
    if (!qtyMode || !onSampleQtyChange) return;
    const product = matchProductForSampleOption(o, products);
    if (!product) return;
    if (next.includes(o)) {
      if (sampleQtys[product.id] == null) onSampleQtyChange(product.id, "");
    } else {
      onSampleQtyChange(product.id, "");
    }
  };
  const selectedWithProduct = qtyMode
    ? arr
        .map((o) => {
          const product = matchProductForSampleOption(o, products);
          return product ? { option: o, product } : null;
        })
        .filter((row): row is { option: string; product: TemplateProduct } =>
          Boolean(row),
        )
    : [];

  return (
    <div>
      <label style={labelStyle}>
        {field.name}
        {req}
      </label>
      {qtyMode ? (
        <p style={{ fontSize: 13, opacity: 0.6, margin: "4px 0 0" }}>
          {productSampleQtyHelper(qtyContextName ?? field.name)}
          {searchable ? ` Search filters the list (${arr.length} selected).` : null}
        </p>
      ) : null}
      {searchable ? (
        <input
          style={{ ...input, marginTop: 8 }}
          type="search"
          value={skuFilter}
          onChange={(e) => setSkuFilter(e.target.value)}
          placeholder="Search SKUs or brand line…"
          enterKeyHint="search"
          autoComplete="off"
        />
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        {visibleOptions.map((o) => {
          const on = arr.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 13,
                cursor: "pointer",
                border: on ? "none" : "1px solid rgba(0,0,0,0.15)",
                background: on ? accent : "transparent",
                color: on ? "#0a0d09" : "inherit",
              }}
            >
              {o}
            </button>
          );
        })}
      </div>
      {searchable && visibleOptions.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.5, marginTop: 8 }}>
          No SKUs match “{skuFilter.trim()}”.
        </p>
      ) : null}
      {selectedWithProduct.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 12,
          }}
        >
          {selectedWithProduct.map(({ option, product }) => (
            <div
              key={product.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt=""
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    objectFit: "cover",
                  }}
                />
              ) : null}
              <span style={{ flex: 1, fontSize: 14, minWidth: 0 }} title={option}>
                {product.name}
              </span>
              <input
                style={{ ...input, width: 88, margin: 0 }}
                inputMode="numeric"
                placeholder={qtyUnit}
                aria-label={`${qtyUnit === "cases" ? "Cases" : "Cans"} — ${product.name}`}
                value={sampleQtys[product.id] ?? ""}
                onChange={(e) => onSampleQtyChange?.(product.id, e.target.value)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── One template field ───────────────────────────────────────────────────────
function FieldInput({
  field,
  value,
  accent,
  onChange,
  onAddPhotos,
  photos,
  onRemovePhoto,
  products = [],
  sampleQtys = {},
  onSampleQtyChange,
  qtyContextName,
}: {
  field: TemplateField;
  value: string | string[] | undefined;
  accent: string;
  onChange: (v: string | string[]) => void;
  onAddPhotos: (files: FileList | null) => void;
  photos: Photo[];
  onRemovePhoto: (id: string) => void;
  products?: TemplateProduct[];
  sampleQtys?: Record<string, string>;
  onSampleQtyChange?: (productId: string, qty: string) => void;
  qtyContextName?: string | null;
}) {
  const libraryRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const req = field.required ? <span style={{ color: "#EF5A2A" }}> *</span> : null;

  if (isDropOffLocationsField(field)) {
    return (
      <DropOffLocationsField
        label={field.name}
        value={typeof value === "string" ? value : Array.isArray(value) ? JSON.stringify(value) : ""}
        onChange={(v) => onChange(v)}
        products={products}
        required={field.required}
        theme="checkin"
        accent={accent}
      />
    );
  }

  if (isPhotoType(field.type)) {
    return (
      <div>
        <label style={label}>
          {field.name}
          {req}
        </label>
        <PhotoGrid
          photos={photos}
          onAdd={() => libraryRef.current?.click()}
          onTake={() => cameraRef.current?.click()}
          onRemove={onRemovePhoto}
          accent={accent}
        />
        <PhotoFileInputs
          libraryRef={libraryRef}
          cameraRef={cameraRef}
          onFiles={onAddPhotos}
        />
      </div>
    );
  }

  const kind = choiceKind(field.type);
  if (kind === "select") {
    return (
      <div>
        <label style={label}>
          {field.name}
          {req}
        </label>
        <select style={input} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (kind === "multiselect") {
    return (
      <MultiselectFieldInput
        field={field}
        value={value}
        accent={accent}
        onChange={onChange}
        products={products}
        sampleQtys={sampleQtys}
        onSampleQtyChange={onSampleQtyChange}
        req={req}
        labelStyle={label}
        qtyContextName={qtyContextName}
      />
    );
  }

  const isLong = field.type.includes("long") || field.type.includes("area") || field.type.includes("paragraph");
  const isNumber = field.type.includes("number") || field.type.includes("int") || field.type.includes("decimal");
  const example = (field.placeholder || "").trim();
  return (
    <div>
      <label style={label}>
        {field.name}
        {req}
      </label>
      {isLong ? (
        <textarea
          style={{ ...input, minHeight: example ? 120 : 84, resize: "vertical" }}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={example || undefined}
        />
      ) : (
        <input
          style={input}
          inputMode={isNumber ? "numeric" : "text"}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={example || (isNumber ? undefined : undefined)}
        />
      )}
    </div>
  );
}


/**
 * One labelled dropzone. Its own hidden input and its own slice of `photos`,
 * so a bucket never shows — or removes — another bucket's shots.
 *
 * The count is live and advisory. A BA who's short on consumer shots can see it
 * at a glance ("3 of 8 suggested"), but nothing here blocks Submit: failed
 * uploads already don't, and a soft target must not be stricter than a failed
 * upload. What the chip says, and why it must not look like a validation
 * error, is `bucketCountHint`.
 */
function PhotoBucketZone({
  bucket,
  photos,
  onAdd,
  onRemove,
  accent,
}: {
  bucket: PhotoBucket;
  photos: Photo[];
  onAdd: (files: FileList | null, category: string | null) => void;
  onRemove: (id: string) => void;
  accent: string;
}) {
  const libraryRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  // Count what actually landed, not what was picked — a photo still uploading
  // or failed isn't in the client's report yet, so counting it would tell a BA
  // they're done when they aren't.
  const done = photos.filter((p) => p.state === "done").length;
  const hint = bucketCountHint(done, bucket.min);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <label style={{ ...label, marginBottom: 0, flex: 1 }}>{bucket.name}</label>
        {hint ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              // Keep "0 of 8 suggested" on one line; the label beside it is
              // flex:1 and wraps instead.
              whiteSpace: "nowrap",
              // Muted until the target is reached, green once it is. NEVER the
              // #EF5A2A this page uses for a required field — see
              // `bucketCountHint`.
              ...(hint.met ? { color: "#2E7D32" } : { opacity: 0.5 }),
            }}
          >
            {hint.text}
          </span>
        ) : null}
      </div>
      {bucket.helper ? (
        <p style={{ fontSize: 12, opacity: 0.6, margin: "2px 0 0" }}>{bucket.helper}</p>
      ) : null}
      <PhotoGrid
        photos={photos}
        onAdd={() => libraryRef.current?.click()}
        onTake={() => cameraRef.current?.click()}
        onRemove={onRemove}
        accent={accent}
        allowVideo={Boolean(bucket.accept?.includes("video"))}
      />
      <PhotoFileInputs
        libraryRef={libraryRef}
        cameraRef={cameraRef}
        onFiles={(files) => onAdd(files, bucket.id)}
        accept={bucket.accept || "image/*"}
      />
    </div>
  );
}

/**
 * Library picker first, camera second.
 *
 * `capture="environment"` on the ONLY file input opens the camera on iOS and
 * blocks Camera Roll multi-select — the "Take photo" tile Kyle screenshotted
 * on Consumer Sampling Pictures. The library input has no capture attribute
 * and is `multiple`, so iOS offers Photo Library / Files and a BA can pick
 * the table, product, receipts, and crowd shots in one go. HEIC stays on
 * `accept="image/*"` (listing MIME types falls back to the Files app). Buckets
 * that opt into video pass `accept="image/*,video/*"` so library + camera
 * can add both.
 */
function PhotoFileInputs({
  libraryRef,
  cameraRef,
  onFiles,
  accept = "image/*",
}: {
  libraryRef: RefObject<HTMLInputElement | null>;
  cameraRef: RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList | null) => void;
  accept?: string;
}) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    onFiles(e.target.files);
    e.target.value = "";
  };
  return (
    <>
      <input
        ref={libraryRef}
        type="file"
        accept={accept}
        multiple
        style={{ display: "none" }}
        onChange={handle}
      />
      <input
        ref={cameraRef}
        type="file"
        accept={accept}
        capture="environment"
        style={{ display: "none" }}
        onChange={handle}
      />
    </>
  );
}

function PhotoGrid({
  photos,
  onAdd,
  onTake,
  onRemove,
  accent,
  allowVideo = false,
}: {
  photos: Photo[];
  onAdd: () => void;
  onTake: () => void;
  onRemove: (id: string) => void;
  accent: string;
  allowVideo?: boolean;
}) {
  const tile: CSSProperties = {
    minWidth: 120,
    minHeight: 120,
    borderRadius: 16,
    background: "transparent",
    fontWeight: 700,
    cursor: "pointer",
    padding: "16px 12px",
  };
  const done = photos.filter((p) => p.state === "done").length;
  const atCap = photos.length >= PHOTO_CAP;
  const mediaWord = allowVideo ? "photos/videos" : "photos";

  return (
    <div>
      <p
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          opacity: 0.55,
          margin: "0 0 6px",
        }}
      >
        {done}/{PHOTO_CAP}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        {photos.map((p) => {
          const isVideo = p.file.type.startsWith("video/");
          return (
          <div key={p.id} style={{ position: "relative", width: 120, height: 120 }}>
            {isVideo ? (
              <video
                src={p.previewUrl}
                muted
                playsInline
                style={{
                  width: 120,
                  height: 120,
                  objectFit: "cover",
                  borderRadius: 10,
                  opacity: p.state === "done" ? 1 : 0.5,
                  border: p.state === "failed" ? "2px solid #EF5A2A" : "1px solid rgba(0,0,0,0.1)",
                  background: "#111",
                }}
              />
            ) : (
              <img
                src={p.previewUrl}
                alt=""
                style={{
                  width: 120,
                  height: 120,
                  objectFit: "cover",
                  borderRadius: 10,
                  opacity: p.state === "done" ? 1 : 0.5,
                  border: p.state === "failed" ? "2px solid #EF5A2A" : "1px solid rgba(0,0,0,0.1)",
                }}
              />
            )}
            <span
              style={{
                ...photoBadge,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                background:
                  p.state === "failed"
                    ? "rgba(239,90,42,0.72)"
                    : p.state === "uploading"
                      ? "rgba(20,24,26,0.55)"
                      : "rgba(46,125,50,0.55)",
                color: "#fff",
              }}
            >
              {p.state === "done" && isVideo ? "video" : p.state}
            </span>
            <button onClick={() => onRemove(p.id)} style={photoRemove} aria-label="Remove photo">
              ×
            </button>
          </div>
          );
        })}
        {!atCap ? (
          <>
            <button
              type="button"
              onClick={onAdd}
              style={{
                ...tile,
                border: `2px dashed ${accent}`,
                fontSize: 15,
                color: accent,
              }}
            >
              {allowVideo ? "Upload media" : "Upload photos"}
            </button>
            <button
              type="button"
              onClick={onTake}
              style={{
                ...tile,
                border: "2px dashed rgba(0,0,0,0.22)",
                fontSize: 13,
                color: "inherit",
                opacity: 0.75,
              }}
            >
              {allowVideo ? "Take photo/video" : "Take photo"}
            </button>
          </>
        ) : null}
      </div>
      <p style={{ fontSize: 12, opacity: 0.55, margin: "6px 0 0" }}>
        {atCap
          ? `Limit ${PHOTO_CAP} ${mediaWord}. Remove one to add another.`
          : allowVideo
            ? "You can select many photos or videos from your library."
            : "You can select many from your library. iPhone photos are fine."}
      </p>
    </div>
  );
}

// ── Chrome ──────────────────────────────────────────────────────────────────
// Matches /approve cream chrome so a dead or live check-in link still
// looks like Ignite — not a blank Tailwind canvas, and never /login.
const IGNITE_HOME = "https://www.igniteproductions.co/";
const IGNITE_SUPPORT = "staffing@igniteproductions.co";

function Shell({
  children,
  framed = false,
  brand,
}: {
  children: React.ReactNode;
  framed?: boolean;
  brand?: Context["brand"] | null;
}) {
  return (
    <div style={wrap}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 28,
          }}
        >
          <a
            href={IGNITE_HOME}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
            }}
          >
            <img
              src="/legal/spark-logo.png"
              alt="Spark by Ignite"
              style={{ height: 28, width: "auto" }}
            />
          </a>
          {brand ? (
            <TenantLogo
              variant="header"
              tone="light"
              name={brand.name}
              requestUrlName={brand.requestUrlName}
              image={brand.image}
              logoUrl={brand.logoUrl}
            />
          ) : null}
        </header>
        {framed ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e7e5e4",
              borderRadius: 24,
              padding: "28px 24px",
              boxShadow: "0 1px 2px rgba(28, 25, 23, 0.04)",
            }}
          >
            {children}
          </div>
        ) : (
          children
        )}
        <p
          style={{
            marginTop: 24,
            textAlign: "center",
            fontSize: 12,
            color: "#a8a29e",
          }}
        >
          Questions?{" "}
          <a href={`mailto:${IGNITE_SUPPORT}`} style={{ color: "#78716c" }}>
            {IGNITE_SUPPORT}
          </a>
          {" · "}
          <a href={IGNITE_HOME} style={{ color: "#78716c" }}>
            igniteproductions.co
          </a>
        </p>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "100dvh",
  background: "#faf7f1",
  color: "#1c1917",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "48px 20px 56px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 18,
  padding: 18,
};
const h2: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: 0 };
const label: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 4,
  opacity: 0.8,
};
const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  fontSize: 15,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "#fff",
  color: "#14181a",
  marginTop: 8,
  outline: "none",
};
const errText: React.CSSProperties = { color: "#EF5A2A", fontSize: 13, marginTop: 10, marginBottom: 0 };
const photoBadge: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
  color: "#fff",
};
const photoRemove: React.CSSProperties = {
  position: "absolute",
  top: -6,
  right: -6,
  width: 20,
  height: 20,
  borderRadius: 999,
  border: "none",
  background: "#14181a",
  color: "#fff",
  fontSize: 14,
  lineHeight: "20px",
  cursor: "pointer",
  padding: 0,
};
function primaryBtn(accent: string): React.CSSProperties {
  return {
    flex: 1,
    padding: "12px 16px",
    minHeight: 44,
    borderRadius: 12,
    border: "none",
    background: accent,
    color: "#0a0d09",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  };
}
const secondaryBtn: React.CSSProperties = {
  flex: 1,
  padding: "12px 16px",
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "transparent",
  color: "#14181a",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
