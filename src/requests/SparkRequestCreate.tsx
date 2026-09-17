import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate, useSearchParams } from "react-router";
import Layout from "@/layout/Layout";
// GooglePlacesInput powers the Address field's autocomplete and, via
// matchTimezoneOption, derives the venue's timezone from the picked
// place — mirroring the external /spark-form. This pulls the Google
// Maps loader into the Create Request chunk, which is the intended
// trade for not shipping requests with a guessed (wrong) timezone.
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";
import GooglePlacesInput, {
  matchTimezoneOption,
} from "@/components/inputs/GooglePlacesInput";
import TimeSlotSelect from "@/components/inputs/TimeSlotSelect";
// resolveTimezoneIdByDate maps a picked zone to its DST-correct STD/DST
// sibling for a given date. We dedupe the Time Zone dropdown to one
// option per region (Pacific/Central/…), so we re-expand the picked
// region to the right sibling for the visit date at submit time.
import { resolveTimezoneIdByDate } from "@/utils";
import {
  isEventActivationRequestType,
  isOnPremiseRequestType,
  isTorchRequestForm,
  selectedProductsInclude5mgOr10mg,
  torchActivationFieldsComplete,
  torchActivationGraphqlFields,
  torchActivationNoteLines,
  torchNonActiveGraphqlFields,
  torchNonActiveNoteLines,
} from "@/public/form/torchRequestForm";
import { CreateRequestMutation } from "@/api/mutations/RequestMutation";
import type { RequestMutation } from "@api/mutations/__generated__/RequestMutation.graphql";
import { CreateDistributorMutation } from "@/api/mutations/CreateDistributorMutation";
import type { CreateDistributorMutation as CreateDistributorMutationType } from "@api/mutations/__generated__/CreateDistributorMutation.graphql";
import { RequestTypesQuery } from "@/api/queries/RequestTypesQuery";
import type { RequestTypesQuery as RequestTypesQueryType } from "@api/queries/__generated__/RequestTypesQuery.graphql";
import { TimezonesQuery } from "@/api/queries/TimezonesQuery";
import type { TimezonesQuery as TimezonesQueryType } from "@api/queries/__generated__/TimezonesQuery.graphql";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@api/queries/__generated__/RmmClientsQuery.graphql";
import { ProductsQuery } from "@/api/queries/ProductsQuery";
import type { ProductsQuery as ProductsQueryType } from "@api/queries/__generated__/ProductsQuery.graphql";
import { CreateFormVenueIndexQuery } from "@/api/queries/CreateFormVenueIndexQuery";
import type { CreateFormVenueIndexQuery as CreateFormVenueIndexQueryType } from "@api/queries/__generated__/CreateFormVenueIndexQuery.graphql";
import { DistributorsQuery } from "@/api/queries/DistributorsQuery";
import type { DistributorsQuery as DistributorsQueryType } from "@api/queries/__generated__/DistributorsQuery.graphql";
// Start/End time pickers (TimeSlotSelect) ship inline so the time is
// set at create time rather than deferred to the edit page. They still
// default to 12:00 PM – 4:00 PM via useState init.

/**
 * Spark v2 — minimal "Express" request form.
 * Wireframe: spark-demo/request-form.html Express mode (6 fields).
 *
 * A single-page form that collects only the essentials, synthesizes safe
 * defaults for the rest, and auto-assigns to the first available RMM so
 * the request lands in the right approval queue.
 *
 * The previous comprehensive form is preserved at /requests/create-detailed
 * for cases that need product/distributor/store-manager detail.
 */

const inputStyle: React.CSSProperties = {
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  borderRadius: 12,
  padding: "0.75rem 0.95rem",
  color: "var(--spark-text)",
  fontSize: "0.9rem",
  outline: "none",
  width: "100%",
  fontFamily: "Space Grotesk, sans-serif",
};

// A repeat-venue suggestion built from prior requests.
type VenueEntry = {
  name: string;
  address: string;
  count: number;
  lastDate: string;
  // Carried forward from the most-recent prior request at this venue so
  // picking a repeat venue can auto-fill distributor + activation type.
  distributorId: string | null;
  requestTypeId: string | null;
};

/**
 * Collapse prior requests into a ranked list of distinct venues for the
 * Create form's type-ahead. Pure — the same logic the old inline memo
 * ran, lifted out so the deferred loader can own the fetch.
 */
const buildVenueIndex = (
  edges: CreateFormVenueIndexQueryType["response"]["requests"]["edges"],
): VenueEntry[] => {
  const seen = new Map<string, VenueEntry>();
  for (const e of edges ?? []) {
    const n = e?.node;
    if (!n) continue;
    const name = n.retailer?.name ?? n.name ?? "";
    if (!name) continue;
    const addr = n.address ?? "";
    const key = `${name.toLowerCase()}|${addr.toLowerCase()}`;
    const existing = seen.get(key);
    const date = n.date ?? "";
    const distId = n.distributor?.id ? String(n.distributor.id) : null;
    const typeId = n.requestType?.id ? String(n.requestType.id) : null;
    if (!existing) {
      seen.set(key, {
        name,
        address: addr,
        count: 1,
        lastDate: date,
        distributorId: distId,
        requestTypeId: typeId,
      });
    } else {
      existing.count += 1;
      if (date > existing.lastDate) {
        existing.lastDate = date;
        if (distId) existing.distributorId = distId;
        if (typeId) existing.requestTypeId = typeId;
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.count - a.count);
};

/**
 * Deferred loader for the venue type-ahead index. Rendered inside its own
 * <Suspense fallback={null}> so it fetches in the background and never
 * blocks the form's first paint (the old blocking RequestsQuery did).
 * Reports the built index up via onLoaded and renders nothing.
 */
const VenueIndexLoader: React.FC<{
  tenantId: string | null;
  onLoaded: (index: VenueEntry[]) => void;
}> = ({ tenantId, onLoaded }) => {
  const data = useLazyLoadQuery<CreateFormVenueIndexQueryType>(
    CreateFormVenueIndexQuery,
    {
      // Cap well below the old 500. The index dedupes by venue, so a
      // couple hundred recent rows already surface every repeat venue
      // a requestor would realistically pick.
      first: 200,
      filters: tenantId ? { tenantId } : null,
    },
    { fetchPolicy: "store-or-network" },
  );
  useEffect(() => {
    onLoaded(buildVenueIndex(data?.requests?.edges ?? null));
  }, [data, onLoaded]);
  return null;
};

const SparkRequestInner: React.FC = () => {
  const { user, tenantId, tenantMeta } = useAuthStore();
  const isTorch = isTorchRequestForm(tenantMeta?.requestUrlName);
  const showAlert = useAlertStore((s) => s.showAlert);
  const navigate = useNavigate();
  const { isClient } = useSparkRole();
  // Admin-only: when creating a request on a client's behalf, optionally
  // email them the auto-approved confirmation. Default off — an internal
  // event request is silent unless the admin opts in. Clients never see
  // this (their own submissions always notify them via the backend).
  const [notifyRequestor, setNotifyRequestor] = useState(false);

  const [commit, isCommitting] = useMutation<RequestMutation>(
    CreateRequestMutation,
  );
  const [commitDistributor, isCreatingDistributor] =
    useMutation<CreateDistributorMutationType>(CreateDistributorMutation);

  // Catalog queries — minimal set to satisfy the required mutation fields.
  const requestTypesData = useLazyLoadQuery<RequestTypesQueryType>(
    RequestTypesQuery,
    { filters: { tenantId: tenantId ?? "" } },
    { fetchPolicy: "store-or-network" },
  );
  const timezonesData = useLazyLoadQuery<TimezonesQueryType>(
    TimezonesQuery,
    {},
    { fetchPolicy: "store-or-network" },
  );
  const rmmData = useLazyLoadQuery<RmmClientsQueryType>(
    RmmClientsQuery,
    { tenantId: tenantId ?? "" },
    { fetchPolicy: "store-or-network" },
  );
  const productsData = useLazyLoadQuery<ProductsQueryType>(
    ProductsQuery,
    {
      first: 60,
      filters: { tenantId: tenantId ?? "" },
    },
    { fetchPolicy: "store-or-network" },
  );
  const distributorsData = useLazyLoadQuery<DistributorsQueryType>(
    DistributorsQuery,
    { filters: { tenantId: tenantId ?? "" }, first: 50 },
    { fetchPolicy: "store-or-network" },
  );
  const distributors = useMemo(
    () =>
      (distributorsData?.distributors?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => !!n),
    [distributorsData],
  );

  // Venue type-ahead index for repeat activations. This used to be loaded
  // by a blocking useLazyLoadQuery here (RequestsQuery, first: 500), which
  // pulled the full per-request payload — status, events, recaps,
  // coordinates, the retailer location tree — for hundreds of rows and
  // was the dominant "Loading form…" cost. It's now fetched by a deferred
  // <VenueIndexLoader> in its own Suspense boundary (narrow query, capped
  // rows), so the form's core fields paint immediately and the venue
  // suggestions populate a beat later. Empty until that resolves.
  const [venueIndex, setVenueIndex] = useState<VenueEntry[]>([]);
  // Stable so the loader's effect doesn't re-run every render.
  const handleVenueIndexLoaded = useCallback(
    (index: VenueEntry[]) => setVenueIndex(index),
    [],
  );

  const requestTypes = useMemo(
    () =>
      requestTypesData?.requestTypes?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [],
    [requestTypesData],
  );
  // Full timezone list (every STD + DST row). matchTimezoneOption and
  // resolveTimezoneIdByDate need both siblings of a region to pick the
  // DST-correct one for a date, so we keep them all here and only dedupe
  // for *display* below.
  const timezones = useMemo(
    () =>
      timezonesData?.timezones?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [],
    [timezonesData],
  );

  // Dropdown options — ONE per region. The backend ships two rows per
  // zone (e.g. Pacific-PST and Pacific-PDT), both with the same display
  // `name` ("Pacific"), which made the <select> list every zone twice.
  // Dedupe by display name, keeping the first row as the region's
  // representative <option> value. The DST-correct sibling is resolved
  // from this pick at submit time (see resolveTimezoneIdByDate below), so
  // collapsing to one visible option never loses DST accuracy.
  const timezoneOptions = useMemo(() => {
    const seen = new Set<string>();
    return timezones.filter((tz) => {
      const label = tz.name ?? "";
      if (seen.has(label)) return false;
      seen.add(label);
      return true;
    });
  }, [timezones]);

  // Map any timezone id (either sibling) → the region's representative
  // option id, so the <select> highlights the right row no matter which
  // sibling autofill/duplicate-prefill stored.
  const representativeTimezoneId = useMemo(() => {
    const byName = new Map<string, string>();
    for (const opt of timezoneOptions) byName.set(opt.name ?? "", String(opt.id));
    const map = new Map<string, string>();
    for (const tz of timezones) {
      const rep = byName.get(tz.name ?? "");
      if (rep) map.set(String(tz.id), rep);
    }
    return map;
  }, [timezones, timezoneOptions]);
  const rmms = useMemo(
    () => (rmmData?.rmmClients ?? []).filter(Boolean),
    [rmmData],
  );
  const products = useMemo(
    () =>
      productsData?.products?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [],
    [productsData],
  );

  // Form state. fullName + email come from the logged-in user
  // silently (no more visible fields for them — they're duplicative
  // with auth data and confused users with editable inputs that
  // hint they could be different from the profile).
  const fullName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ");
  const [searchParams] = useSearchParams();
  // Duplicate-from-existing flow: any of these query params pre-fill
  // the form. Used by the "Duplicate" action on SparkRequestView so
  // kyle can clone an approved activation to a new date without
  // retyping everything.
  const qpStart = searchParams.get("startTime") ?? "12:00";
  const qpEnd = searchParams.get("endTime") ?? "16:00";
  const qpNotes = searchParams.get("notes") ?? "";
  const qpBaCount = parseInt(searchParams.get("baCount") ?? "1", 10);
  const qpRequestTypeId = searchParams.get("requestTypeId") ?? "";
  const qpDistributorId = searchParams.get("distributorId") ?? "";
  const qpTimezoneId = searchParams.get("timezoneId") ?? "";
  const qpProducts = (searchParams.get("productIds") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Activation Plan deep-link from Plan detail / Tracker (?plan=<id>).
  const activationPlanId = searchParams.get("plan") || null;

  const email = user?.email ?? "";
  // Date is intentionally NOT pre-filled on duplicate — that's the
  // whole point of cloning (new date for same venue/setup).
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState(qpStart);
  const [endTime, setEndTime] = useState(qpEnd);
  const [venue, setVenue] = useState(searchParams.get("venue") ?? "");
  const [address, setAddress] = useState(searchParams.get("address") ?? "");
  const [storeNumber, setStoreNumber] = useState(
    searchParams.get("storeNumber") ?? "",
  );
  const [requestTypeId, setRequestTypeId] = useState(qpRequestTypeId);
  const [timezoneId, setTimezoneId] = useState(qpTimezoneId);
  // Value the de-duplicated Time Zone <select> renders: normalize
  // whatever sibling is stored (autofill may pick PDT, a duplicate
  // prefill may carry PST) to its region representative option id, so the
  // right single option stays highlighted. Empty when unset/unknown.
  const displayTimezoneId =
    representativeTimezoneId.get(String(timezoneId)) ??
    (timezoneId ? String(timezoneId) : "");
  // Required scheduling choice. "already_scheduled" = the account
  // already has this visit booked; "needs_scheduling" = Ignite still
  // needs to book it. Plain metadata, no approval-flow impact.
  const [schedulingStatus, setSchedulingStatus] = useState(
    searchParams.get("schedulingStatus") ?? "",
  );
  const [nonActiveProductRequired, setNonActiveProductRequired] = useState(
    searchParams.get("isNonActiveProductRequired") ?? "",
  );
  const [casesToBeShipped, setCasesToBeShipped] = useState(
    searchParams.get("casesToBeShipped") ?? "",
  );
  const [accountSpendAmount, setAccountSpendAmount] = useState(
    searchParams.get("accountSpendAmount") ?? "",
  );
  const [eventAssetsNeeded, setEventAssetsNeeded] = useState(
    searchParams.get("eventAssetsNeeded") ?? "",
  );
  const [loadInTime, setLoadInTime] = useState(
    searchParams.get("loadInTime") ?? "",
  );
  const [onsitePoc, setOnsitePoc] = useState(
    searchParams.get("onsitePoc") ?? "",
  );
  const [additionalTeamDetails, setAdditionalTeamDetails] = useState(
    searchParams.get("additionalTeamDetails") ?? "",
  );
  const [rmmId, setRmmId] = useState("");
  // RMM picker state used to drive the inline ROUTING chip that lived
  // alongside the Address/Time block. That block is gone in Express
  // Mode (handled by defaults + Edit Request); leaving rmmId here so
  // the mutation input still includes it when set via URL param.

  // Detect "Retail Sampling" so we can require a Store Number on
  // those activations only. Falls back to false if the type list
  // hasn't loaded or the user hasn't picked yet.
  const isRetailSampling = useMemo(() => {
    const t = requestTypes.find((rt) => String(rt?.id) === requestTypeId);
    return (t?.name ?? "").toLowerCase().includes("retail");
  }, [requestTypes, requestTypeId]);
  const selectedRequestTypeName = useMemo(() => {
    const t = requestTypes.find((rt) => String(rt?.id) === requestTypeId);
    return t?.name ?? "";
  }, [requestTypes, requestTypeId]);
  const torchActivationValues = {
    accountSpendAmount,
    eventAssetsNeeded,
    loadInTime,
    onsitePoc,
    additionalTeamDetails,
  };
  const torchActivationOk =
    !isTorch ||
    torchActivationFieldsComplete(selectedRequestTypeName, torchActivationValues);
  const torchNonActiveValues = {
    nonActiveProductRequired,
    casesToBeShipped,
  };
  const [notes, setNotes] = useState(qpNotes);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set(qpProducts),
  );
  const showTorchNonActiveFields = useMemo(() => {
    if (!isTorch) return false;
    return selectedProductsInclude5mgOr10mg(
      products
        .filter((p) => selectedProducts.has(String(p.id)))
        .map((p) => p.name),
    );
  }, [isTorch, products, selectedProducts]);
  // Form is now always flat (no "Add detail" expander).
  const [venueFocused, setVenueFocused] = useState(false);
  // Bulk mode — add multiple dates at the same venue in one shot.
  const [extraDates, setExtraDates] = useState<string[]>([]);
  // Events at a venue need a BA count; retail samplings usually 1-2.
  const [baCount, setBaCount] = useState<number>(
    Number.isFinite(qpBaCount) && qpBaCount > 0 ? qpBaCount : 1,
  );
  const [distributorId, setDistributorId] = useState(qpDistributorId);
  // Distributor input is an autocomplete: type to filter the existing
  // distributor list; if nothing matches, offer to create-on-the-fly.
  // We keep the typed text + open state separate from distributorId so
  // the user can preview options without committing.
  const [distributorQuery, setDistributorQuery] = useState("");
  const [distributorOpen, setDistributorOpen] = useState(false);

  // ─── Draft autosave ───────────────────────────────────────────
  // Keep a per-user, per-tenant draft of the in-progress form in
  // localStorage. Survives accidental refresh/close. We don't restore
  // automatically when the URL has prefill params (the duplicate
  // flow): the duplicated request takes priority over a stale draft.
  const draftKey = `@spark.requestDraft.v1/${user?.uuid ?? "anon"}/${tenantId ?? "x"}`;
  const cameFromDuplicate =
    searchParams.has("venue") ||
    searchParams.has("notes") ||
    searchParams.has("requestTypeId") ||
    searchParams.has("productIds");
  const [draftRestored, setDraftRestored] = useState(false);

  // Restore once on mount when there's no URL prefill.
  useEffect(() => {
    if (cameFromDuplicate) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Record<string, unknown>;
      // Only restore drafts that have at least one meaningful field.
      const meaningful =
        (typeof draft.venue === "string" && draft.venue.trim().length > 0) ||
        (typeof draft.notes === "string" && draft.notes.trim().length > 0) ||
        (Array.isArray(draft.products) && draft.products.length > 0);
      if (!meaningful) return;
      if (typeof draft.venue === "string") setVenue(draft.venue);
      if (typeof draft.address === "string") setAddress(draft.address);
      if (typeof draft.date === "string") setDate(draft.date);
      if (typeof draft.startTime === "string") setStartTime(draft.startTime);
      if (typeof draft.endTime === "string") setEndTime(draft.endTime);
      if (typeof draft.requestTypeId === "string")
        setRequestTypeId(draft.requestTypeId);
      if (typeof draft.timezoneId === "string")
        setTimezoneId(draft.timezoneId);
      if (typeof draft.schedulingStatus === "string")
        setSchedulingStatus(draft.schedulingStatus);
      if (typeof draft.nonActiveProductRequired === "string")
        setNonActiveProductRequired(draft.nonActiveProductRequired);
      if (typeof draft.casesToBeShipped === "string")
        setCasesToBeShipped(draft.casesToBeShipped);
      if (typeof draft.rmmId === "string") setRmmId(draft.rmmId);
      if (typeof draft.storeNumber === "string")
        setStoreNumber(draft.storeNumber);
      if (typeof draft.distributorId === "string")
        setDistributorId(draft.distributorId);
      if (typeof draft.notes === "string") setNotes(draft.notes);
      if (typeof draft.baCount === "number") setBaCount(draft.baCount);
      if (Array.isArray(draft.products)) {
        setSelectedProducts(new Set(draft.products as string[]));
      }
      if (Array.isArray(draft.extraDates)) {
        setExtraDates(draft.extraDates as string[]);
      }
      setDraftRestored(true);
    } catch {
      /* ignore — bad JSON, quota, etc. */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every meaningful change. 'draftDirty' set just so
  // we don't write before the restore effect has had its chance.
  useEffect(() => {
    if (!tenantId) return;
    try {
      const draft = {
        venue,
        address,
        date,
        startTime,
        endTime,
        requestTypeId,
        timezoneId,
        schedulingStatus,
        nonActiveProductRequired,
        casesToBeShipped,
        rmmId,
        distributorId,
        storeNumber,
        notes,
        baCount,
        products: Array.from(selectedProducts),
        extraDates,
        updatedAt: new Date().toISOString(),
      };
      // Skip writing a draft that's still empty — saves 1 KB and keeps
      // the storage clean if kyle bounces in & out without typing.
      const empty =
        !venue.trim() &&
        !address.trim() &&
        !notes.trim() &&
        selectedProducts.size === 0 &&
        extraDates.length === 0;
      if (empty) {
        localStorage.removeItem(draftKey);
      } else {
        localStorage.setItem(draftKey, JSON.stringify(draft));
      }
    } catch {
      /* ignore quota */
    }
  }, [
    venue,
    address,
    date,
    startTime,
    endTime,
    requestTypeId,
    timezoneId,
    schedulingStatus,
    nonActiveProductRequired,
    casesToBeShipped,
    rmmId,
    distributorId,
    storeNumber,
    notes,
    baCount,
    selectedProducts,
    extraDates,
    tenantId,
    draftKey,
  ]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  };

  const venueMatches = useMemo(() => {
    const q = venue.toLowerCase().trim();
    if (!q || q.length < 2) return [];
    return venueIndex
      .filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.address.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [venue, venueIndex]);

  // Pick sensible defaults once the catalog loads.
  useEffect(() => {
    if (!requestTypeId && requestTypes[0]) {
      setRequestTypeId(String(requestTypes[0].id));
    }
    // NOTE: we intentionally do NOT auto-pick a timezone here anymore.
    // The old "Chicago-or-first" guess silently stamped requests with the
    // wrong zone (it fell through to timezones[0] = Alaska when no Central
    // row matched). Timezone is now derived from the Google Places address
    // (matchTimezoneOption) or chosen explicitly in the Time Zone select.
    if (!rmmId && rmms.length > 0) {
      // If the logged-in user is themselves one of the RMMs (typical
      // client-role flow — Kristyn / Lauren / etc. submit on their
      // own behalf), default routing to them. Otherwise fall back
      // to the first available RMM.
      const meAsRmm = rmms.find(
        (m) => m && String(m.id) === String(user?.id),
      );
      const target = meAsRmm ?? rmms[0];
      if (target) setRmmId(String(target.id));
    }
  }, [requestTypes, timezones, rmms, requestTypeId, timezoneId, rmmId, user?.id]);

  const geocode = async (
    raw: string,
  ): Promise<[number, number] | null> => {
    // Use Google Geocoding API via the same key we use for Maps. Server-
    // side proxying would be cleaner but for v1 we hit it client-side.
    const key = (import.meta as { env?: Record<string, string> }).env
      ?.VITE_GOOGLE_MAPS_API_KEY;
    if (!key || !raw) return null;
    try {
      const resp = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(raw)}&key=${key}`,
      );
      const data = await resp.json();
      const loc = data?.results?.[0]?.geometry?.location;
      if (typeof loc?.lat === "number" && typeof loc?.lng === "number") {
        return [loc.lat, loc.lng];
      }
    } catch {
      /* ignore — fall back to [0,0] */
    }
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !venue || !requestTypeId || !timezoneId) {
      showAlert("Fill in venue, date, time, and type.", "warning");
      return;
    }
    if (!address.trim()) {
      // Catch the case where HTML required got bypassed (autofill,
      // browser extension, etc.). Backend routing relies on this
      // string to pull a state code, so an empty address would silently
      // produce an unroutable request.
      showAlert(
        "Address is required — include the street, city, state, and zip.",
        "warning",
      );
      return;
    }
    if (!/\b\d{5}\b/.test(address)) {
      // A bare street like "1608 Broadway St" (REQ-925) routes nowhere and
      // shows up half-blank in the request view + RMM email. Require the
      // FULL address — easiest path is picking the Google suggestion, which
      // fills street/city/state/ZIP. The 5-digit ZIP is the completeness
      // signal (same gate as the public form).
      showAlert(
        "Enter the full address — street, city, state, and ZIP. Start typing and pick a Google suggestion.",
        "warning",
      );
      return;
    }
    // Store number is optional — it's helpful metadata (prepended to notes)
    // but never blocks submit. Tenants like Borjomi don't track it.
    if (!schedulingStatus) {
      showAlert(
        "Pick a scheduling status — already scheduled, or needs scheduling.",
        "warning",
      );
      return;
    }
    if (isTorch && showTorchNonActiveFields && !nonActiveProductRequired) {
      showAlert("Pick whether non-active product is required — Yes or No.", "warning");
      return;
    }
    if (isTorch && !torchActivationOk) {
      showAlert(
        isOnPremiseRequestType(selectedRequestTypeName)
          ? "Enter the Account Spend Amount."
          : "Fill in the Event Activation details.",
        "warning",
      );
      return;
    }
    const allDates = [date, ...extraDates.filter(Boolean)];
    const geocoded = await geocode(address);
    const coords: ReadonlyArray<number> = geocoded ?? [0, 0];
    // Embed BA count + bulk size + store number in notes so it's
    // visible to the RMM until first-class fields are added to the
    // mutation input. Store number is searchable from the Tracker
    // even though it's not a typed column yet.
    const notesPlus = [
      isRetailSampling && storeNumber.trim()
        ? `Store #: ${storeNumber.trim()}`
        : null,
      notes,
      `BA count: ${baCount}`,
      ...torchNonActiveNoteLines(showTorchNonActiveFields, torchNonActiveValues),
      ...(isTorch
        ? torchActivationNoteLines(selectedRequestTypeName, torchActivationValues)
        : []),
      allDates.length > 1
        ? `Bulk submission — ${allDates.length} visits at this venue.`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    let successes = 0;
    const failures: string[] = [];
    // Keep the actual backend reason(s) so a fully-failed batch shows *why*
    // instead of a generic "try again". First distinct message is enough.
    const failureReasons: string[] = [];

    for (const d of allDates) {
      const composedName =
        allDates.length > 1
          ? `${venue} · ${d} (${allDates.indexOf(d) + 1}/${allDates.length})`
          : `${venue} · ${d}`;
      // The Time Zone dropdown shows one option per region; that option's
      // value is whichever sibling row (STD or DST) happens to be first.
      // Re-resolve to the correct STD/DST sibling FOR THIS DATE so a
      // summer visit stores the DST row and a winter visit the STD row —
      // and a bulk batch straddling the DST boundary gets each row right.
      const resolvedTimezoneId =
        resolveTimezoneIdByDate(timezones, d, timezoneId) ?? timezoneId;
      // We fan out N parallel mutations one after another so the user gets
      // a clean per-date error message if any fails. A batch mutation
      // would be cleaner — tracked in BACKEND-PATCH.md.
      await new Promise<void>((resolve) => {
        commit({
          variables: {
            input: {
              name: composedName,
              // No `address || venue` fallback — the field is required
              // in the UI now. Substituting the venue name (e.g.
              // "Walmart Supercenter 389") here silently corrupted
              // request.address, which is the same string the backend
              // routing path runs through extract_state_code, which
              // is what triggered REQ-925 hitting Lauren instead of
              // the right NY/CA/etc. RMM.
              address,
              coordinates: coords,
              // Backend Request.date / start_time / end_time are all
              // DateTimeField — every one needs an ISO string, not
              // bare YYYY-MM-DD or HH:MM.
              date: `${d}T${(startTime || "12:00").padEnd(5, "0")}:00`,
              startTime: `${d}T${(startTime || "12:00").padEnd(5, "0")}:00`,
              endTime: `${d}T${(endTime || "16:00").padEnd(5, "0")}:00`,
              timezoneId: resolvedTimezoneId,
              requestTypeId,
              schedulingStatus: schedulingStatus || undefined,
              ...torchNonActiveGraphqlFields(
                showTorchNonActiveFields,
                torchNonActiveValues,
              ),
              ...(isTorch
                ? torchActivationGraphqlFields(
                    selectedRequestTypeName,
                    torchActivationValues,
                  )
                : {}),
              rmmAsignedId: rmmId || undefined,
              tenantId: tenantId ?? undefined,
              clientName: fullName || undefined,
              clientEmail: email || undefined,
              requestorEmail: email || undefined,
              distributorId: distributorId || undefined,
              distributorName:
                distributors.find((d) => String(d.id) === distributorId)?.name ?? undefined,
              notes: notesPlus || undefined,
              // Admin opt-in only. notifyRequestor is a defined field on
              // CreateRequestInput (unlike the old `quantity`), so sending it
              // is safe. Omit when off / for clients to keep the payload clean.
              notifyRequestor: !isClient && notifyRequestor ? true : undefined,
              details: [],
              // CreateRequestProductInput only accepts `productId` — sending
              // any extra field (we used to send `quantity: 1`) makes GraphQL
              // reject the whole operation at variable coercion, so every date
              // fell into onError and surfaced as "All submissions failed."
              products: Array.from(selectedProducts).map((productId) => ({
                productId,
              })),
              ...(activationPlanId
                ? { activationPlanId }
                : {}),
            },
          },
          onCompleted: (res) => {
            if (res.createRequest?.success) successes += 1;
            else {
              failures.push(d);
              const msg = res.createRequest?.message;
              if (msg && !failureReasons.includes(msg)) failureReasons.push(msg);
            }
            resolve();
          },
          onError: (err) => {
            failures.push(d);
            const msg = err?.message;
            if (msg && !failureReasons.includes(msg)) failureReasons.push(msg);
            resolve();
          },
        });
      });
    }

    if (failures.length === 0) {
      // Whole batch landed cleanly — the draft is no longer useful.
      clearDraft();
      showAlert(
        successes > 1
          ? `Submitted ${successes} requests · auto-routed to your RMM.`
          : "Request submitted · auto-routed to your RMM.",
        "success",
      );
      navigate(
        activationPlanId
          ? `/requests/list?plan=${encodeURIComponent(activationPlanId)}`
          : "/requests/list",
      );
    } else if (successes > 0) {
      // Partial success — leave the draft alone so kyle can fix the
      // bad rows without re-entering the good ones.
      const why = failureReasons.length ? ` (${failureReasons[0]})` : "";
      showAlert(
        `Submitted ${successes} · ${failures.length} failed: ${failures.join(", ")}${why}`,
        "warning",
      );
    } else {
      const why = failureReasons.length
        ? failureReasons.join(" · ")
        : "Try again.";
      showAlert(`All submissions failed — ${why}`, "error");
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 max-w-3xl mx-auto px-1 sm:px-0"
    >
      {/* Repeat-venue suggestions load in the background — their own
          Suspense boundary keeps the heavy request scan off the critical
          path so the form paints immediately. */}
      <Suspense fallback={null}>
        <VenueIndexLoader
          tenantId={tenantId ?? null}
          onLoaded={handleVenueIndexLoaded}
        />
      </Suspense>

      {/* Header */}
      <div>
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          NEW REQUEST · EXPRESS MODE
        </p>
        <h1
          className="display text-4xl font-bold mt-2"
          style={{ letterSpacing: "-0.04em" }}
        >
          Tell us about the visit.
        </h1>
        <p
          className="mt-2"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          A few fields. We auto-route to your Ignite RMM for approval,
          staffing, and scheduling.
        </p>
        {activationPlanId ? (
          <p
            className="mono text-[10px] mt-3"
            style={{
              letterSpacing: "0.14em",
              color: "var(--spark-lime)",
            }}
          >
            ▸ WILL ATTACH TO PLAN ON SUBMIT
          </p>
        ) : null}
      </div>

      {/* Restored-draft banner. Auto-dismisses when the user starts
          editing (they implicitly accept the restore by typing). */}
      {draftRestored && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-2 rounded-xl"
          style={{
            background: "rgba(95,184,239,0.08)",
            border: "1px solid rgba(95,184,239,0.3)",
          }}
        >
          <span
            className="text-sm"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            ↻ Picked up your unfinished draft.
          </span>
          <button
            type="button"
            onClick={() => {
              setVenue("");
              setAddress("");
              setDate("");
              setStartTime("12:00");
              setEndTime("16:00");
              setNotes("");
              setSelectedProducts(new Set());
              setExtraDates([]);
              setBaCount(1);
              setDistributorId("");
              setStoreNumber("");
              setSchedulingStatus("");
              clearDraft();
              setDraftRestored(false);
            }}
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.14em",
              color: "var(--spark-sky)",
            }}
          >
            CLEAR + START FRESH
          </button>
        </div>
      )}

      {/* Card */}
      <div className="spark-card p-6 lg:p-8 space-y-6" style={{ paddingBottom: "6rem" }}>
        {/* HERO — 3 fields visible by default. Everything else collapses. */}
        <div className="space-y-5">
          <div className="relative">
            <label className="label-mini block mb-1.5">Venue *</label>
            <input
              style={inputStyle}
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              onFocus={() => setVenueFocused(true)}
              onBlur={() =>
                // Delay so click on a suggestion lands first
                setTimeout(() => setVenueFocused(false), 150)
              }
              placeholder="Start typing… we'll suggest repeat venues"
              required
              autoComplete="off"
            />
            {venueFocused && venueMatches.length > 0 && (
              <div
                className="absolute z-10 left-0 right-0 mt-1 rounded-xl overflow-hidden"
                style={{
                  background: "var(--spark-surface)",
                  border: "1px solid var(--spark-border)",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                }}
              >
                {venueMatches.map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setVenue(v.name);
                      if (v.address) setAddress(v.address);
                      // Auto-fill distributor + activation type from
                      // the most-recent prior request at this venue.
                      // Skips when those defaults are already user-set
                      // (don't clobber a deliberate choice).
                      if (v.distributorId && !distributorId)
                        setDistributorId(v.distributorId);
                      if (v.requestTypeId && !requestTypeId)
                        setRequestTypeId(v.requestTypeId);
                      setVenueFocused(false);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition"
                    style={{ background: "transparent" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(197,245,70,0.06)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{v.name}</p>
                      {v.address && (
                        <p
                          className="text-xs truncate"
                          style={{ color: "rgba(255,255,255,0.55)" }}
                        >
                          {v.address}
                        </p>
                      )}
                    </div>
                    <span
                      className="mono shrink-0"
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.14em",
                        color: "var(--spark-lime)",
                      }}
                    >
                      ×{v.count} REQUESTS
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Address — required so backend RMM routing can pull a state
              code out of it (events/routing.py::extract_state_code).
              Pre-fills from the venue autocomplete when the user picks
              a repeat venue; editable in all cases.

              We made this required (not optional) after REQ-925, where
              an address of just "1608 Broadway St" — no city/state/zip
              — caused the routing fallback chain to give up on a
              state, route the request to Ignite-only, and skip the
              client RMM. Forcing a full address at submit time is the
              cheapest way to keep the new routing path warm. */}
          <div>
            <label className="label-mini block mb-1.5">Address *</label>
            <GooglePlacesInput
              value={address}
              onChange={setAddress}
              onResolved={(p) => {
                setAddress(p.formattedAddress);
                // Derive the venue timezone from the picked place — same
                // as the external /spark-form. Replaces the old silent
                // "Chicago-or-first" guess that produced Alaska.
                if (p.timezoneId) {
                  const match = matchTimezoneOption(p.timezoneId, timezones);
                  if (match) setTimezoneId(String(match.id));
                }
              }}
              placeholder="Start typing — Google suggestions appear"
              style={inputStyle}
            />
            <p
              className="text-xs mt-1.5"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Full street, city, state, zip — used to route to the
              right territory manager and to set the venue timezone.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-mini block mb-1.5">Visit date *</label>
              <input
                style={inputStyle}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label-mini block mb-1.5">Start time *</label>
              <TimeSlotSelect
                value={startTime}
                onChange={setStartTime}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="label-mini block mb-1.5">End time *</label>
              <TimeSlotSelect
                value={endTime}
                onChange={setEndTime}
                style={inputStyle}
              />
            </div>
            <div>
              <label className="label-mini block mb-1.5">Time zone *</label>
              <select
                style={inputStyle}
                value={displayTimezoneId}
                onChange={(e) => setTimezoneId(e.target.value)}
                required
              >
                <option value="">Select timezone</option>
                {timezoneOptions.map((tz) => (
                  <option key={tz.id} value={tz.id}>
                    {tz.name}
                  </option>
                ))}
              </select>
              <p
                className="text-xs mt-1.5"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                Auto-fills from the address — venue local time, not your
                browser.
              </p>
            </div>
            <div>
              <label className="label-mini block mb-1.5">Activation type *</label>
              <select
                style={inputStyle}
                value={requestTypeId}
                onChange={(e) => setRequestTypeId(e.target.value)}
                required
              >
                <option value="">Select type</option>
                {requestTypes
                  .filter((t) =>
                    [
                      "retail sampling",
                      "event activation",
                      "on-premise sampling",
                      "on-premise",
                    ].includes((t.name ?? "").toLowerCase()),
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {/* Normalize backend label "On-Premise" → "On-Premise Sampling" */}
                      {(t.name ?? "").toLowerCase() === "on-premise"
                        ? "On-Premise Sampling"
                        : t.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label-mini block mb-1.5">Scheduling *</label>
              {/* Required. Tells the captain whether this visit is
                  already on the account's calendar or Ignite still
                  needs to book it. Plain metadata — doesn't gate
                  approval. */}
              <select
                style={inputStyle}
                value={schedulingStatus}
                onChange={(e) => setSchedulingStatus(e.target.value)}
                required
              >
                <option value="">Select scheduling status</option>
                <option value="already_scheduled">
                  Already scheduled with the account
                </option>
                <option value="needs_scheduling">
                  Needs scheduling by Ignite
                </option>
              </select>
            </div>
            {isTorch && isOnPremiseRequestType(selectedRequestTypeName) && (
              <div>
                <label className="label-mini block mb-1.5">
                  Account Spend Amount *
                </label>
                <input
                  style={inputStyle}
                  value={accountSpendAmount}
                  onChange={(e) => setAccountSpendAmount(e.target.value)}
                  placeholder="$0.00"
                  required
                />
              </div>
            )}
            {isTorch && isEventActivationRequestType(selectedRequestTypeName) && (
              <>
                <div>
                  <label className="label-mini block mb-1.5">
                    What assets are needed at this event? *
                  </label>
                  <textarea
                    style={inputStyle}
                    value={eventAssetsNeeded}
                    onChange={(e) => setEventAssetsNeeded(e.target.value)}
                    rows={3}
                    placeholder="10x10, Barrel Cooler, etc"
                    required
                  />
                </div>
                <div>
                  <label className="label-mini block mb-1.5">
                    What time is Load-In: *
                  </label>
                  <input
                    style={inputStyle}
                    value={loadInTime}
                    onChange={(e) => setLoadInTime(e.target.value)}
                    placeholder="e.g. 8:00 AM"
                    required
                  />
                </div>
                <div>
                  <label className="label-mini block mb-1.5">
                    Who is the onsite POC: *
                  </label>
                  <input
                    style={inputStyle}
                    value={onsitePoc}
                    onChange={(e) => setOnsitePoc(e.target.value)}
                    placeholder="Name and phone or email"
                    required
                  />
                </div>
                <div>
                  <label className="label-mini block mb-1.5">
                    Any additional details for the team to know? *
                  </label>
                  <textarea
                    style={inputStyle}
                    value={additionalTeamDetails}
                    onChange={(e) => setAdditionalTeamDetails(e.target.value)}
                    rows={3}
                    placeholder="Anything the team should know"
                    required
                  />
                </div>
              </>
            )}
            <div className="relative">
              <label className="label-mini block mb-1.5">Distributor</label>
              {/* Autocomplete: typing filters the dropdown; selecting
                  a row sets distributorId. If the typed text doesn't
                  match anything, the last row offers "+ Create new
                  distributor: <text>" which fires CreateDistributor
                  inline and sets distributorId on success. Clicking
                  outside / blur closes the panel. */}
              {(() => {
                const picked = distributors.find(
                  (d) => String(d.id) === distributorId,
                );
                const q = distributorQuery.trim();
                const matches = distributors.filter((d) =>
                  q ? d.name.toLowerCase().includes(q.toLowerCase()) : true,
                );
                const exactMatch =
                  q &&
                  distributors.some(
                    (d) => d.name.toLowerCase() === q.toLowerCase(),
                  );
                const canCreate = q.length > 1 && !exactMatch;
                return (
                  <>
                    <input
                      type="text"
                      style={inputStyle}
                      value={
                        distributorOpen
                          ? distributorQuery
                          : picked?.name ?? distributorQuery
                      }
                      placeholder={
                        picked
                          ? picked.name
                          : "— Optional — type to search or add"
                      }
                      onFocus={() => {
                        setDistributorOpen(true);
                        if (picked) setDistributorQuery(picked.name);
                      }}
                      onBlur={() => {
                        // Defer close so onMouseDown on the option list
                        // gets to fire first.
                        window.setTimeout(() => setDistributorOpen(false), 120);
                      }}
                      onChange={(e) => {
                        setDistributorQuery(e.target.value);
                        // If they're editing, treat the current
                        // selection as stale until they pick again.
                        if (distributorId) setDistributorId("");
                        if (!distributorOpen) setDistributorOpen(true);
                      }}
                    />
                    {distributorOpen &&
                      (matches.length > 0 || canCreate) && (
                        <div
                          className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-20"
                          style={{
                            background: "var(--spark-bg)",
                            border: "1px solid var(--spark-border)",
                            boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
                            maxHeight: 240,
                            overflowY: "auto",
                          }}
                        >
                          {matches.map((d) => (
                            <button
                              type="button"
                              key={d.id}
                              onMouseDown={(e) => {
                                // Use mousedown so it beats the blur.
                                e.preventDefault();
                                setDistributorId(String(d.id));
                                setDistributorQuery(d.name);
                                setDistributorOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm transition"
                              style={{
                                color: "rgba(255,255,255,0.85)",
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background =
                                  "rgba(197,245,70,0.08)";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background =
                                  "transparent";
                              }}
                            >
                              {d.name}
                            </button>
                          ))}
                          {canCreate && (
                            <button
                              type="button"
                              disabled={isCreatingDistributor}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const name = q;
                                if (!tenantId) {
                                  showAlert(
                                    "Pick a tenant before adding a distributor",
                                    "error",
                                  );
                                  return;
                                }
                                commitDistributor({
                                  variables: {
                                    input: {
                                      name,
                                      tenantId: String(tenantId),
                                      email: "",
                                      locationId: "",
                                    },
                                  },
                                  onCompleted: (resp) => {
                                    const payload = resp.createDistributor;
                                    const created =
                                      payload?.distributor ?? null;
                                    if (payload?.success && created?.id) {
                                      setDistributorId(String(created.id));
                                      setDistributorQuery(created.name);
                                      setDistributorOpen(false);
                                      showAlert(
                                        `Added distributor "${created.name}"`,
                                        "success",
                                      );
                                    } else {
                                      showAlert(
                                        payload?.message ??
                                          "Couldn't add distributor",
                                        "error",
                                      );
                                    }
                                  },
                                  onError: (err) =>
                                    showAlert(err.message, "error"),
                                });
                              }}
                              className="w-full text-left px-3 py-2 text-sm transition disabled:opacity-50"
                              style={{
                                color: "var(--spark-lime)",
                                borderTop:
                                  matches.length > 0
                                    ? "1px solid var(--spark-border)"
                                    : undefined,
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background =
                                  "rgba(197,245,70,0.08)";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.background =
                                  "transparent";
                              }}
                            >
                              {isCreatingDistributor
                                ? `Adding "${q}"…`
                                : `+ Add distributor: "${q}"`}
                            </button>
                          )}
                        </div>
                      )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Store Number — required when activation type is Retail
              Sampling so the BA knows which specific store to walk
              into. Submitted via notes (prepended) until a typed
              column ships on the Request model. */}
          {isRetailSampling && (
            <div>
              <label className="label-mini block mb-1.5">
                Store number
              </label>
              <input
                style={inputStyle}
                value={storeNumber}
                onChange={(e) => setStoreNumber(e.target.value)}
                placeholder="e.g. 1247"
                inputMode="numeric"
              />
              <p
                className="text-xs mt-1"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                Optional — the retailer's store number helps the BA find
                the right location.
              </p>
            </div>
          )}

          {/* Bulk dates — add more visits at the same venue */}
          {extraDates.length > 0 && (
            <div
              className="rounded-xl p-3 space-y-2"
              style={{
                background: "rgba(197,245,70,0.06)",
                border: "1px solid rgba(197,245,70,0.25)",
              }}
            >
              <p
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--spark-lime)",
                }}
              >
                + {extraDates.length} ADDITIONAL VISIT{extraDates.length === 1 ? "" : "S"}
              </p>
              {extraDates.map((d, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    style={inputStyle}
                    type="date"
                    value={d}
                    onChange={(e) =>
                      setExtraDates((prev) =>
                        prev.map((x, i) => (i === idx ? e.target.value : x)),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setExtraDates((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="mono text-[10px] px-3"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-orange)",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <p
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                Each becomes its own request (same venue · same staffing).
              </p>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setExtraDates((d) => [...d, ""])}
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.14em",
                color: "var(--spark-lime)",
              }}
            >
              + ANOTHER VISIT AT THIS VENUE
            </button>
            {/* BA count selector */}
            <div className="flex items-center gap-2">
              <span className="label-mini">BAs</span>
              <div
                className="inline-flex items-center rounded-full"
                style={{
                  background: "var(--spark-bg)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setBaCount((n) => Math.max(1, n - 1))}
                  className="w-9 h-9 grid place-items-center"
                  style={{
                    color: "var(--spark-text)",
                  }}
                >
                  −
                </button>
                <span
                  className="tab-num px-3 text-base font-semibold"
                  style={{ minWidth: 28, textAlign: "center" }}
                >
                  {baCount}
                </span>
                <button
                  type="button"
                  onClick={() => setBaCount((n) => Math.min(20, n + 1))}
                  className="w-9 h-9 grid place-items-center"
                  style={{
                    color: "var(--spark-lime)",
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Address / start-end time / time zone / RMM routing used
              to live here as their own visible section. Removed — those
              fields are now sensibly defaulted and only surface on the
              Edit Request page when a power user wants to tweak them.

                - Address: auto-fills when Venue is picked from a
                  Google Places suggestion (handled in the Venue input
                  via onResolved). Empty otherwise — backend tolerates
                  null.
                - Start/end time: shown inline (TimeSlotSelect),
                  default 12:00 PM – 4:00 PM.
                - Time zone: shown inline; auto-set from the Google
                  Places address (matchTimezoneOption) or picked in the
                  Time Zone select. No more silent backend guess.
                - Routing: empty string means "first available RMM" —
                  the Inbox shows which one accepted.

              Keeps Express Mode at 5–6 fields. The values are still
              wired into the mutation input (see distributorId / startTime
              / endTime / timezoneId / rmmId in the submit handler). */}
        </div>

        {/* Products picker */}
        {products.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label-mini">
                Products to sample · {selectedProducts.size} selected
              </label>
              {selectedProducts.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedProducts(new Set())}
                  className="mono text-[10px] transition"
                  style={{
                    letterSpacing: "0.14em",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  × CLEAR
                </button>
              )}
            </div>
            <div
              className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2"
              style={{ maxHeight: 280, overflowY: "auto" }}
            >
              {products.map((p) => {
                const on = selectedProducts.has(String(p.id));
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setSelectedProducts((prev) => {
                        const next = new Set(prev);
                        const id = String(p.id);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      })
                    }
                    className="aspect-square rounded-xl relative overflow-hidden transition"
                    style={{
                      background: on
                        ? "rgba(197,245,70,0.10)"
                        : "rgba(255,255,255,0.025)",
                      border: on
                        ? "2px solid var(--spark-lime)"
                        : "1px solid var(--spark-border)",
                      boxShadow: on
                        ? "0 0 18px rgba(197,245,70,0.25)"
                        : "none",
                    }}
                    title={p.name}
                  >
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-contain p-2"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center">
                        <span
                          className="mono text-[10px]"
                          style={{
                            letterSpacing: "0.14em",
                            color: "rgba(255,255,255,0.55)",
                          }}
                        >
                          {p.name?.slice(0, 14)}
                        </span>
                      </div>
                    )}
                    {on && (
                      <span
                        className="absolute top-1 right-1 w-5 h-5 rounded-full grid place-items-center font-bold"
                        style={{
                          background: "var(--spark-lime)",
                          color: "#0a0d09",
                          fontSize: 12,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showTorchNonActiveFields && (
          <div className="space-y-4">
            <div>
              <label className="label-mini block mb-1.5">
                Is Non-Active Product Required? *
              </label>
              <select
                style={inputStyle}
                value={nonActiveProductRequired}
                onChange={(e) => setNonActiveProductRequired(e.target.value)}
                required
              >
                <option value="">Select Yes or No</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="label-mini block mb-1.5">
                How many cases to be shipped?
              </label>
              <input
                style={inputStyle}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={casesToBeShipped}
                onChange={(e) => setCasesToBeShipped(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        )}

        <div>
          <label className="label-mini block mb-1.5">Notes (optional)</label>
          <textarea
            style={{ ...inputStyle, resize: "vertical", minHeight: 100 }}
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the captain should know. Sampling cadence, store contact, special asks."
          />
        </div>

      </div>

      {/* Routing footer */}
      <div
        className="spark-card p-5"
        style={{
          borderColor: "rgba(197,245,70,0.25)",
          background:
            "linear-gradient(180deg, rgba(197,245,70,0.06), transparent)",
        }}
      >
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.16em",
            color: "var(--spark-lime)",
          }}
        >
          WHAT HAPPENS NEXT
        </p>
        <p
          className="mt-2 text-sm"
          style={{ color: "rgba(255,255,255,0.75)" }}
        >
          {isClient
            ? "Submission lands in the RMM's queue. Once approved, Spark auto-posts a job and emails confirmation to your team."
            : "Internal request — lands on the tracker auto-approved (no RMM routing). The client is only emailed if you tick the box below."}
        </p>
        {!isClient && (
          <label
            className="mt-3 flex items-center gap-2.5 cursor-pointer select-none"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            <input
              type="checkbox"
              checked={notifyRequestor}
              onChange={(e) => setNotifyRequestor(e.target.checked)}
              style={{
                accentColor: "var(--spark-lime)",
                width: 16,
                height: 16,
              }}
            />
            <span className="text-sm">
              Email the client a confirmation
            </span>
          </label>
        )}
      </div>

      {/* Sticky submit bar — always in view */}
      <div
        className="fixed left-0 right-0 z-40"
        style={{
          bottom: 0,
          background: "rgba(10,13,9,0.92)",
          backdropFilter: "blur(14px)",
          borderTop: "1px solid var(--spark-border)",
        }}
      >
        <div className="max-w-3xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigate("/requests/create-detailed")}
            className="mono text-[10px] transition"
            style={{
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            ⛁ DETAILED FORM →
          </button>
          <button
            type="submit"
            disabled={
              isCommitting ||
              !venue ||
              !date ||
              !schedulingStatus ||
              (showTorchNonActiveFields && !nonActiveProductRequired) ||
              (isTorch && !torchActivationOk)
            }
            className="px-6 py-3 rounded-2xl text-sm font-semibold transition"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow:
                !venue ||
                !date ||
                !schedulingStatus ||
                (showTorchNonActiveFields && !nonActiveProductRequired) ||
                (isTorch && !torchActivationOk)
                  ? "none"
                  : "0 0 24px rgba(197,245,70,0.35)",
              opacity:
                isCommitting ||
                !venue ||
                !date ||
                !schedulingStatus ||
                (showTorchNonActiveFields && !nonActiveProductRequired) ||
                (isTorch && !torchActivationOk)
                  ? 0.5
                  : 1,
            }}
          >
            {isCommitting
              ? "Submitting…"
              : isClient
                ? "Submit & route to RMM →"
                : "Create internal request →"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default function SparkRequestCreate() {
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm max-w-3xl"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Loading form…
          </div>
        }
      >
        <SparkRequestInner />
      </Suspense>
    </Layout>
  );
}
