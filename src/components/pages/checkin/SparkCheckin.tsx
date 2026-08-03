import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { bucketCountHint } from "./photoBuckets";

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
};
type TemplateSection = { id: string; name: string; fields: TemplateField[] };
type TemplateProduct = { id: string; name: string; imageUrl: string | null };
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
type PhotoBucket = { id: string; name: string; helper: string; min: number };
/** One program on the brand's standing link. `id` is their EventType id. */
type EventTypeOption = { id: string; name: string };
type StoreOption = { name: string; address: string };
type Context = {
  // OPTIONAL on a standing tenant link: until the BA picks a store + date there
  // is no event yet, so nothing here may be dereferenced unguarded.
  event?: { uuid: string; name: string; address: string | null; startTime: string | null; endTime: string | null; date?: string | null };
  brand: { name: string; primaryColor: string | null };
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
  };
  // Tenant-link mode — ONE durable link shared across every activation, so BAs
  // never type an event code. `needsEventDetails` means ask for store + date on
  // the identify step; the API then finds-or-creates the event.
  mode?: "tenant";
  needsEventDetails?: boolean;
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
  // The brand's BA reference hub (/training/<code>), if configured. Rendered
  // on the landing screen AND once clocked in — "what am I supposed to say
  // about this SKU" is a question a BA has at the table, not at home.
  trainingUrl?: string;
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

// A BA on store LTE uploading 20 straight-off-the-camera iPhone photos is
// pushing ~80MB. Downscaling to a long edge of 1600px at JPEG 0.82 lands each
// one around 200-400KB with no visible loss in the recap PDF or the gallery.
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.82;
// Below this, re-encoding costs more than it saves.
const COMPRESS_MIN_BYTES = 400 * 1024;
// Enough to use the connection, few enough that one stalled PUT doesn't hold
// up the rest. Serial uploads were the other half of "photos won't upload".
const UPLOAD_CONCURRENCY = 3;

/**
 * Downscale + re-encode an image for upload. Best-effort by design: on ANY
 * failure — unsupported codec, canvas tainted, out of memory on an old phone —
 * it returns the original file rather than losing the photo.
 */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < COMPRESS_MIN_BYTES) return file;

  let url: string | null = null;
  try {
    url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url as string;
    });

    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    if (!longest) return file;
    const scale = Math.min(1, MAX_IMAGE_EDGE / longest);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    // If the re-encode didn't actually help, keep the original.
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    if (url) URL.revokeObjectURL(url);
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

/** The brand's BA reference hub, when the tenant has one configured. */
function TrainingLink({ url, accent }: { url?: string; accent: string }) {
  const href = (url || "").trim();
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        margin: "0 0 14px",
        padding: "13px 16px",
        borderRadius: 12,
        border: `1px solid ${accent}55`,
        background: `${accent}14`,
        color: "inherit",
        textDecoration: "none",
        minHeight: 44,
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          BA reference &amp; training
        </span>
        <span style={{ fontSize: 12.5, opacity: 0.7 }}>
          Field guide, video, product sheets
        </span>
      </span>
      <span style={{ fontSize: 18, opacity: 0.6 }} aria-hidden="true">
        ↗
      </span>
    </a>
  );
}

function apiOrigin(): string {
  try {
    return new URL(import.meta.env.VITE_GRAPHQL_ENDPOINT as string).origin;
  } catch {
    return "";
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
 * Name and cell only — deliberately nothing that could identify a store, a
 * client or a shift, so a shared or borrowed phone leaks nothing about the
 * work.
 */
type Identity = { firstName: string; lastName: string; phone: string; email: string };
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

const fmtTime = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).replace(":00", "");
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
        setCtx(json);
        setLoadErr(null);
      }
    } catch {
      setLoadErr("Couldn't load this check-in. Check your connection and reload.");
    }
  }, [code, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Same crew works these stores week after week, so the link has to be
  // reusable. Dropping the session token returns them to the store + date
  // step for a fresh event; their NAME is kept (see IDENTITY_KEY) so a repeat
  // BA only answers "which store, what day".
  const startAnother = useCallback(() => {
    try {
      window.localStorage.removeItem(storeKey);
    } catch {
      /* private mode — clearing state below is enough for this session */
    }
    setToken(null);
    setCtx(null);
    setLoadErr(null);
  }, [storeKey]);

  const accent = ctx?.brand.primaryColor || FALLBACK_ACCENT;
  const clockState = ctx?.session?.clock.state ?? "not_started";
  const identified = Boolean(token && ctx?.session);
  const hasRecap = Boolean(ctx?.session?.hasRecap);

  if (loadErr) {
    return (
      <Shell>
        <div style={{ ...card, textAlign: "center", maxWidth: 440 }}>
          <p style={{ fontSize: 15, opacity: 0.85 }}>{loadErr}</p>
        </div>
      </Shell>
    );
  }
  if (!ctx) {
    return (
      <Shell>
        <p style={{ opacity: 0.6 }}>Loading…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <Header ctx={ctx} accent={accent} />
        {/* Sits directly under the header so it's present on the landing
            screen AND after clock-in — the BA asks "how do I pitch this?"
            at the table, not before they leave the house. */}
        <TrainingLink url={ctx.trainingUrl} accent={accent} />
        {!identified ? (
          <IdentifyStep
            code={code}
            accent={accent}
            storeKey={storeKey}
            onDone={setToken}
            needsEventDetails={Boolean(ctx.needsEventDetails)}
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
          Powered by Spark by Ignite
        </p>
      </div>
    </Shell>
  );
}

// ── Header ────────────────────────────────────────────────────────────────
function Header({ ctx, accent }: { ctx: Context; accent: string }) {
  const ev = ctx.event;
  // A standing tenant link has no event until the BA picks a store, so the
  // header leads with the brand and says what's about to happen instead of
  // rendering an empty title block.
  if (!ev) {
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>
          {ctx.brand.name || "Check in"}
        </div>
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
      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>
        {ctx.brand.name || "Check in"}
      </div>
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

  const submit = async () => {
    setErr(null);
    if (!firstName.trim()) return setErr("Enter your name.");
    if (!phone.trim()) return setErr("Enter a phone number.");
    if (needsEventDetails) {
      // Required, and asked BEFORE the store, because it decides which form the
      // BA gets. The backend falls back to the brand's default rather than
      // rejecting a request with no program, so this check is the only thing
      // standing between a distracted BA and the wrong recap.
      if (hasPrograms && !eventTypeId) return setErr("Pick the event you're working.");
      if (isMarket) {
        if (!market) return setErr("Pick your market.");
      } else if (!address.trim()) {
        return setErr("Enter the store address.");
      }
      if (!eventDate) return setErr("Pick the date you're working.");
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
                eventDate,
                ...(hasPrograms ? { eventTypeId } : {}),
                ...(isMarket ? { market } : { storeName, address }),
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
      // Remember them for the next event on this same link.
      writeIdentity(code, { firstName, lastName, phone, email });
      onDone(json.sessionToken);
    } catch {
      setErr("Network error. Try again.");
      setBusy(false);
    }
  };

  return (
    <div style={card}>
      <h2 style={h2}>Who's working?</h2>
      <p style={{ fontSize: 13, opacity: 0.6, margin: "0 0 14px" }}>
        Tell us who you are so your lead can confirm your hours.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input style={{ ...input, flex: "1 1 140px" }} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input style={{ ...input, flex: "1 1 140px" }} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <input style={input} placeholder="Mobile phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
        </>
      ) : null}

      {needsEventDetails ? (
        <>
          <h2 style={{ ...h2, marginTop: 22 }}>Where are you working?</h2>

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

          <label style={{ fontSize: 12, opacity: 0.6, display: "block", margin: "10px 0 4px" }}>
            Date you're working
          </label>
          <input
            style={input}
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </>
      ) : null}

      {err ? <p style={errText}>{err}</p> : null}
      <button style={{ ...primaryBtn(accent), marginTop: 6 }} disabled={busy} onClick={submit}>
        {busy ? "Starting…" : "Start check-in"}
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
  const [showRecap, setShowRecap] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const post = (path: string, body: Record<string, unknown>) =>
    fetch(`${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: token, ...body }),
    });

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
    // Best-effort geolocation — clocking works even if it's denied/unavailable.
    const withCoords = (coords: { latitude?: number; longitude?: number }) =>
      post("clock", { kind, ...coords })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) setMsg(json.message || "Couldn't record that.");
        })
        .catch(() => setMsg("Network error. Try again."))
        .finally(async () => {
          setBusy("");
          await onRefresh();
        });
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

  // ── Sampling stops ────────────────────────────────────────────────────
  // A roaming crew's event is the MARKET, so the individual spots need their
  // own record — and it has to be captured here, in the moment, not recalled
  // into the recap hours later.
  const stops = ctx.session?.stops ?? [];
  const [stopBusy, setStopBusy] = useState(false);
  const [stopName, setStopName] = useState("");

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

  if (hasRecap && clockState !== "clocked_in") {
    return (
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 6 }}>✓</div>
        <h2 style={{ ...h2, marginBottom: 6 }}>You're all set</h2>
        <p style={{ fontSize: 14, opacity: 0.7 }}>
          Your recap is in{pending ? " and is pending your lead's confirmation" : ""}. Thanks for the great work!
        </p>
        {/* Without this the page is a dead end: the session sticks, so a BA
            coming back for their next event would just see this screen again.
            Only on the standing link — an event code covers one event, so
            there is no "another" to log. */}
        {ctx.mode === "tenant" ? (
          <button
            onClick={onStartAnother}
            style={{ ...primaryBtn(accent), marginTop: 18, width: "100%" }}
          >
            Log another event
          </button>
        ) : null}
      </div>
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
        onCancel={() => setShowRecap(false)}
        onSubmitted={async () => {
          setShowRecap(false);
          await onRefresh();
        }}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.5 }}>
              Time clock
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
              {clockState === "clocked_in" ? "On the clock" : clockState === "clocked_out" ? "Clocked out" : "Not started"}
            </div>
            {ctx.session?.clock.clockInAt ? (
              <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>
                In {fmtTime(ctx.session.clock.clockInAt)}
                {ctx.session.clock.clockOutAt ? ` · Out ${fmtTime(ctx.session.clock.clockOutAt)}` : ""}
              </div>
            ) : null}
          </div>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: clockState === "clocked_in" ? accent : "rgba(0,0,0,0.2)",
            }}
          />
        </div>
        {/* ONE action at a time, in order: clock in → file recap → clock out.
            Clock-out is deliberately withheld until the recap is in. A BA who
            can clock out first files the recap from the car, or not at all —
            gating it keeps the write-up happening on site while the shift is
            still fresh, and makes the clock reflect the real end of work.
            Nobody can get stranded on the clock: the auto-clock-out cron
            closes anything left open. */}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          {clockState === "not_started" ? (
            <button style={primaryBtn(accent)} disabled={busy !== ""} onClick={() => clock("in")}>
              {busy === "in" ? "Clocking in…" : "Clock in"}
            </button>
          ) : null}

          {/* Recap first — that's the intended order, so it stays the primary
              button. But clock out is ALWAYS reachable. BAs reported being
              unable to "sign out": their recap wouldn't submit (photos), and
              clock out only appeared after a recap existed, so a failed upload
              silently kept them on the clock with no way to end the shift.
              Never gate ending a shift on another action succeeding. */}
          {clockState === "clocked_in" && !hasRecap ? (
            <>
              <button style={primaryBtn(accent)} onClick={() => setShowRecap(true)}>
                File recap
              </button>
              <button style={secondaryBtn} disabled={busy !== ""} onClick={() => clock("out")}>
                {busy === "out" ? "Clocking out…" : "Clock out"}
              </button>
            </>
          ) : null}

          {clockState === "clocked_in" && hasRecap ? (
            <>
              <button style={primaryBtn(accent)} disabled={busy !== ""} onClick={() => clock("out")}>
                {busy === "out" ? "Clocking out…" : "Clock out"}
              </button>
              <button style={secondaryBtn} onClick={() => setShowRecap(true)}>
                Edit recap
              </button>
            </>
          ) : null}

          {/* Clocked out with no recap — an older shift, or the auto-clock-out
              cron closed them. Still let them file it, but this must NOT be
              the only way out: a BA whose last shift ended without a recap
              would otherwise be trapped on that dead event forever, unable to
              start today's. Hence the escape hatch below. */}
          {clockState === "clocked_out" && !hasRecap ? (
            <>
              <button style={primaryBtn(accent)} onClick={() => setShowRecap(true)}>
                File recap
              </button>
              {ctx.mode === "tenant" ? (
                <button style={secondaryBtn} onClick={onStartAnother}>
                  Log another event
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        {msg ? <p style={errText}>{msg}</p> : null}
      </div>

      {/* Wrong store or wrong day is easy to do on a shared link, and the
          BA can't fix it themselves once the session is minted. A quiet way
          back beats an admin having to merge two events later. Not offered
          mid-shift on a per-event link, where there is no other event to
          move to. */}
      {ctx.mode === "tenant" && clockState === "clocked_in" ? (
        <button
          onClick={onStartAnother}
          style={{
            background: "none",
            border: "none",
            padding: 4,
            fontSize: 12,
            opacity: 0.55,
            textDecoration: "underline",
            cursor: "pointer",
            alignSelf: "center",
          }}
        >
          Wrong store or date? Start over
        </button>
      ) : null}

      {/* Where they sampled. Only while on the clock — a stop before clock-in
          or after clock-out isn't work. */}
      {clockState === "clocked_in" ? (
        <div style={card}>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
            Where are you sampling?
          </p>
          <p style={{ fontSize: 12, opacity: 0.55, margin: "4px 0 10px" }}>
            Tap this at each spot. We grab the location for you — the name is
            just so you recognise it later.
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

      {clockState === "not_started" ? (
        <p style={{ fontSize: 13, opacity: 0.6, textAlign: "center" }}>Clock in when you arrive to start your shift.</p>
      ) : null}
      {clockState === "clocked_in" && !hasRecap ? (
        <p style={{ fontSize: 13, opacity: 0.6, textAlign: "center" }}>
          You're on the clock. File your recap when you're done. If it won't go
          through, clock out anyway — you can come back and file it after.
        </p>
      ) : null}
      {clockState === "clocked_in" && hasRecap ? (
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
  onCancel,
  onSubmitted,
}: {
  code: string;
  token: string;
  template: Template | null;
  photoBuckets?: PhotoBucket[];
  accent: string;
  brandName: string;
  onCancel: () => void;
  onSubmitted: () => Promise<void>;
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
  const [values, setValues] = useState<Record<string, string | string[]>>(() => {
    const seed: Record<string, string | string[]> = {};
    if (!brandName) return seed;
    for (const section of template?.sections ?? []) {
      for (const f of section.fields) {
        if (f.name.trim().toLowerCase() === "event name" && !isPhotoType(f.type)) {
          seed[f.id] = brandName;
        }
      }
    }
    return seed;
  });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [samples, setSamples] = useState<Record<string, string>>({});
  const [engagements, setEngagements] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const photoSeq = useRef(0);

  const uploadingCount = photos.filter((p) => p.state === "uploading").length;
  const failedCount = photos.filter((p) => p.state === "failed").length;

  const hasPhotoField = useMemo(
    () => (template?.sections ?? []).some((s) => s.fields.some((f) => isPhotoType(f.type))),
    [template],
  );
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
  // shot is 3-5MB and a BA files 20 of them from a store parking lot.
  const uploadOne = async (id: string, original: File) => {
    try {
      const file = await compressImage(original);
      const urlRes = await fetch(`${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: token, filename: file.name, contentType: file.type || "image/jpeg" }),
      });
      const meta = await urlRes.json();
      if (!urlRes.ok || !meta.uploadUrl) throw new Error(meta.message || "no url");
      const put = await fetch(meta.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      if (!put.ok) throw new Error("upload failed");
      setPhotos((p) =>
        p.map((ph) => (ph.id === id ? { ...ph, blobName: meta.blobName, state: "done" } : ph)),
      );
    } catch {
      setPhotos((p) => p.map((ph) => (ph.id === id ? { ...ph, state: "failed" } : ph)));
    }
  };

  const uploadFiles = async (files: FileList | null, category: string | null = null) => {
    if (!files || !files.length) return;
    const batch: Photo[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${photoSeq.current++}`,
      file,
      blobName: null,
      previewUrl: URL.createObjectURL(file),
      state: "uploading" as const,
      category,
    }));
    setPhotos((p) => [...p, ...batch]);
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
  const removePhoto = (id: string) => setPhotos((p) => p.filter((ph) => ph.id !== id));

  const submit = async () => {
    setErr(null);
    // Required non-photo fields must be answered.
    for (const s of template?.sections ?? []) {
      for (const f of s.fields) {
        if (!f.required || isPhotoType(f.type)) continue;
        const v = values[f.id];
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
    if (donePhotos.length === 0) {
      return setErr(
        failedCount > 0
          ? "No photos uploaded yet. Tap Retry, or check your signal."
          : "Add at least one photo of your event.",
      );
    }

    const fieldValues = Object.entries(values)
      .map(([id, v]) => ({ customFieldId: id, value: Array.isArray(v) ? JSON.stringify(v) : String(v) }))
      .filter((fv) => fv.value !== "" && fv.value !== "[]");
    const productSamples = Object.entries(samples)
      .map(([productId, q]) => ({ productId, quantity: Number(q) }))
      .filter((s) => Number.isFinite(s.quantity) && s.quantity > 0);

    setBusy(true);
    try {
      const res = await fetch(`${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/recap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session: token,
          fieldValues,
          files: donePhotos.map((p) => ({ blobName: p.blobName, category: p.category })),
          productSamples,
          totalEngagements: engagements.trim() === "" ? null : Number(engagements),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErr(json.message || "Couldn't submit your recap.");
        setBusy(false);
        return;
      }
      await onSubmitted();
    } catch {
      setErr("Network error. Try again.");
      setBusy(false);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {template.sections.map((section) => (
        <div key={section.id} style={card}>
          <h2 style={h2}>{section.name}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            {section.fields.map((f) => (
              <FieldInput
                key={f.id}
                field={f}
                value={values[f.id]}
                accent={accent}
                onChange={(v) => setVal(f.id, v)}
                onAddPhotos={uploadFiles}
                photos={loosePhotos}
                onRemovePhoto={removePhoto}
              />
            ))}
          </div>
        </div>
      ))}

      {template.productSamples && template.products.length > 0 ? (
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

      <div style={card}>
        <label style={label}>Total engagements</label>
        <input style={input} inputMode="numeric" placeholder="e.g. 120" value={engagements} onChange={(e) => setEngagements(e.target.value)} />
        {buckets.length === 0 && !hasPhotoField ? (
          <>
            <label style={{ ...label, marginTop: 10 }}>
              Photos <span style={{ color: "#EF5A2A" }}>*</span>
            </label>
            <PhotoGrid photos={loosePhotos} onAdd={() => fileRef.current?.click()} onRemove={removePhoto} accent={accent} />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                void uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </>
        ) : null}
      </div>

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

      {uploadingCount > 0 ? (
        <p style={{ textAlign: "center", fontSize: 13, opacity: 0.7 }}>
          Uploading photos… {photos.length - uploadingCount} of {photos.length} done
        </p>
      ) : null}

      {failedCount > 0 ? (
        <div style={{ ...card, borderColor: "#EF5A2A", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontSize: 13 }}>
            {failedCount} photo{failedCount === 1 ? "" : "s"} didn't upload.
          </span>
          <button style={{ ...secondaryBtn, width: "auto", padding: "8px 14px", margin: 0 }} onClick={retryFailed}>
            Retry
          </button>
        </div>
      ) : null}

      {err ? <p style={{ ...errText, textAlign: "center" }}>{err}</p> : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button style={secondaryBtn} onClick={onCancel} disabled={busy}>
          Back
        </button>
        <button style={primaryBtn(accent)} onClick={submit} disabled={busy || uploadingCount > 0}>
          {busy
            ? "Submitting…"
            : failedCount > 0
              ? `Submit without ${failedCount} photo${failedCount === 1 ? "" : "s"}`
              : "Submit recap"}
        </button>
      </div>
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
}: {
  field: TemplateField;
  value: string | string[] | undefined;
  accent: string;
  onChange: (v: string | string[]) => void;
  onAddPhotos: (files: FileList | null) => void;
  photos: Photo[];
  onRemovePhoto: (id: string) => void;
}) {
  const localRef = useRef<HTMLInputElement | null>(null);
  const req = field.required ? <span style={{ color: "#EF5A2A" }}> *</span> : null;

  if (isPhotoType(field.type)) {
    return (
      <div>
        <label style={label}>
          {field.name}
          {req}
        </label>
        <PhotoGrid photos={photos} onAdd={() => localRef.current?.click()} onRemove={onRemovePhoto} accent={accent} />
        <input ref={localRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => {
          onAddPhotos(e.target.files);
          e.target.value = "";
        }} />
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
    const arr = Array.isArray(value) ? value : [];
    const toggle = (o: string) => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
    return (
      <div>
        <label style={label}>
          {field.name}
          {req}
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {field.options.map((o) => {
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
      </div>
    );
  }

  const isLong = field.type.includes("long") || field.type.includes("area") || field.type.includes("paragraph");
  const isNumber = field.type.includes("number") || field.type.includes("int") || field.type.includes("decimal");
  return (
    <div>
      <label style={label}>
        {field.name}
        {req}
      </label>
      {isLong ? (
        <textarea
          style={{ ...input, minHeight: 84, resize: "vertical" }}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          style={input}
          inputMode={isNumber ? "numeric" : "text"}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
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
  const ref = useRef<HTMLInputElement | null>(null);
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
        onAdd={() => ref.current?.click()}
        onRemove={onRemove}
        accent={accent}
      />
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          onAdd(e.target.files, bucket.id);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function PhotoGrid({
  photos,
  onAdd,
  onRemove,
  accent,
}: {
  photos: Photo[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  accent: string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
      {photos.map((p) => (
        <div key={p.id} style={{ position: "relative", width: 72, height: 72 }}>
          <img
            src={p.previewUrl}
            alt=""
            style={{
              width: 72,
              height: 72,
              objectFit: "cover",
              borderRadius: 10,
              opacity: p.state === "done" ? 1 : 0.5,
              border: p.state === "failed" ? "2px solid #EF5A2A" : "1px solid rgba(0,0,0,0.1)",
            }}
          />
          {p.state === "uploading" ? (
            <span style={photoBadge}>…</span>
          ) : p.state === "failed" ? (
            <span style={{ ...photoBadge, color: "#EF5A2A" }}>!</span>
          ) : null}
          <button onClick={() => onRemove(p.id)} style={photoRemove} aria-label="Remove photo">
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        style={{
          width: 72,
          height: 72,
          borderRadius: 10,
          border: `2px dashed ${accent}`,
          background: "transparent",
          fontSize: 26,
          color: accent,
          cursor: "pointer",
        }}
      >
        +
      </button>
    </div>
  );
}

// ── Chrome ──────────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return <div style={wrap}>{children}</div>;
}

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#fafafa",
  color: "#14181a",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "28px 16px 48px",
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
    padding: "13px 16px",
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
  padding: "13px 16px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "transparent",
  color: "#14181a",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
