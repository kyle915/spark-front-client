import type { CoBrandOptions } from "./coBrandRecap";
import type { ProgramOption } from "./eventTypeDescriptor";
import type { ShowWhen } from "./fieldConditions";
import type { PayableMileageState } from "./payableMileage";
import type { RecapDraft } from "./recapDraft";

// Types mirroring the backend payload (ambassadors/checkin_web.build_public_context).
// Extracted from SparkCheckin.tsx in the step split — same shapes, no changes.
export type TemplateField = {
  id: string;
  name: string;
  required: boolean;
  type: string; // number | text | long_text | select | multiselect | photo | ...
  options: string[];
  /** BA-facing example copy (quality bar). Never submitted as the value. */
  placeholder?: string;
  /** Shown only while another choice field has this option picked. */
  showWhen?: ShowWhen | null;
};
export type TemplateSection = { id: string; name: string; fields: TemplateField[] };
export type TemplateProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  /** ProductType name when the API includes it (for Category — Name match). */
  category?: string | null;
};
export type Template = {
  id: string;
  name: string;
  productSamples: boolean;
  sections: TemplateSection[];
  products: TemplateProduct[];
  /** Per-SKU count copy from the template (e.g. "Cans sampled"); empty = generic. */
  sampleQtyLabel?: string;
  sampleQtyTotalLabel?: string;
  /** Section names answered once per brand on a multi-brand activation. */
  coBrandSections?: string[];
};
export type Clock = {
  state: "not_started" | "clocked_in" | "clocked_out";
  clockInAt: string | null;
  clockOutAt: string | null;
};
export type MileageLeg = {
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
export type Mileage = {
  enabled: boolean;
  active: MileageLeg | null;
  legs: MileageLeg[];
  totalMiles: number;
  totalAmount: number;
};
export type SamplingStop = {
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
export type PhotoBucket = {
  id: string;
  name: string;
  helper: string;
  min: number;
  /** Optional MIME accept for the bucket's file inputs (e.g. image/*,video/*). */
  accept?: string;
};
/** One program on the brand's standing link. `id` is their EventType id. */
export type EventTypeOption = ProgramOption;
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
export type CheckinResource = {
  label: string;
  kind?: "link" | "pdf" | "image";
  url: string;
  note?: string;
};
export type StoreOption = {
  name: string;
  address: string;
  /** Present when the API knows the account/event pin. Optional — missing skips proximity. */
  lat?: number | null;
  lng?: number | null;
};
export type UnfiledShift = {
  eventDate: string | null;
  name: string;
  address: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  clockState: string;
};
export type Context = {
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
  // Sibling brands (brand group) this BA can also report on; null for
  // every tenant without a group.
  coBrands?: CoBrandOptions | null;
  // Labelled photo dropzones, in render order. Absent/empty for every brand
  // that hasn't opted in, which is the signal to keep the single generic grid.
  photoBuckets?: PhotoBucket[];
  // Present only for brands whose recap title must be "Store Name #1234"
  // (Torch); the values prefill the recap form's Store boxes.
  storeIdentity?: StoreIdentity | null;
  session?: {
    ambassadorName: string;
    clock: Clock;
    hasRecap: boolean;
    pendingReview: boolean;
    /** Unfiled answers for this shift. Absent until a draft has been saved. */
    recapDraft?: RecapDraft | null;
    /** Second filing on the same event. Never the open shift's answers. */
    additionalRecapDraft?: RecapDraft | null;
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
  // Brand heading for that picker (Torch: "What's your execution type?").
  programPickerTitle?: string;
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
export type Photo = {
  id: string;
  file: File;
  blobName: string | null;
  previewUrl: string;
  state: "uploading" | "done" | "failed";
  /** Epoch ms when this photo entered `uploading` — stall detection. */
  uploadStartedAt?: number;
  // Which labelled bucket this was dropped into, or null for the generic grid
  // (every brand without buckets). Sent per file on submit; the backend
  // validates it against that brand's own buckets and falls back to its
  // "photos" category for anything it doesn't recognise.
  category: string | null;
  /** Last upload error — shown on the Retry banner so BAs know why. */
  failReason?: string | null;
  /** Failed on connectivity (timeout / dropped), not a server reject. */
  failedOffline?: boolean;
  /** `file` is already the compressed upload copy — retries skip re-encoding. */
  prepared?: boolean;
  /** The photo's bytes are gone on this phone; no retry can send it. */
  unrecoverable?: boolean;
  /** Failed, with an automatic retry scheduled. */
  autoRetry?: boolean;
  /** SHA-256 of the compressed copy sent with the recap. */
  sha256?: string;
  /** Advisory photo check. Never blocks the upload. */
  check?: { kind: "pending" | "unavailable" | "warn" | "ok"; message: string; dismissed: boolean };
};


/** Prefill for the recap form's Store boxes (brands that need "Store Name #1234"). */
export type StoreIdentity = { name: string; number: string };
