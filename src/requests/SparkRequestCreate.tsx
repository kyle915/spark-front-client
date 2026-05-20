import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate, useSearchParams } from "react-router";
import Layout from "@/layout/Layout";
// GooglePlacesInput / matchTimezoneOption were used by the (now-removed)
// inline Address field. Express Mode infers address from Venue + lets
// the Edit Request page handle adjustments, so they no longer ship in
// this bundle. Keep them out of the import list to stop the lazy chunk
// from pulling Google Maps loader on every Create Request open.
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
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
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import { DistributorsQuery } from "@/api/queries/DistributorsQuery";
import type { DistributorsQuery as DistributorsQueryType } from "@api/queries/__generated__/DistributorsQuery.graphql";
// TimeSlotSelect was used by the (now-removed) inline start/end-time
// fields. Defaults to 12:00 PM – 4:00 PM via useState init; edit on
// the request view when needed.

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

const SparkRequestInner: React.FC = () => {
  const { user, tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const navigate = useNavigate();

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

  // Pull existing requests so we can offer type-ahead venue suggestions
  // for the 80%+ of activations that repeat at known addresses.
  const recentRequestsData = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    {
      first: 500,
      filters: tenantId ? { tenantId } : null,
    },
    { fetchPolicy: "store-or-network" },
  );

  const venueIndex = useMemo(() => {
    type VenueEntry = {
      name: string;
      address: string;
      count: number;
      lastDate: string;
      // Carried forward from the most-recent prior request at this
      // venue so picking a repeat venue can auto-fill distributor +
      // activation type on the new request.
      distributorId: string | null;
      requestTypeId: string | null;
    };
    const seen = new Map<string, VenueEntry>();
    const edges = recentRequestsData?.requests?.edges ?? [];
    for (const e of edges) {
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
          // Prefer the FK ids from the most-recent prior request.
          if (distId) existing.distributorId = distId;
          if (typeId) existing.requestTypeId = typeId;
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) => b.count - a.count);
  }, [recentRequestsData]);

  const requestTypes = useMemo(
    () =>
      requestTypesData?.requestTypes?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [],
    [requestTypesData],
  );
  const timezones = useMemo(
    () =>
      timezonesData?.timezones?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [],
    [timezonesData],
  );
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
  const [notes, setNotes] = useState(qpNotes);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set(qpProducts),
  );
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
    if (!timezoneId && timezones[0]) {
      // Default to America/Chicago if present, else first.
      const chicago = timezones.find((t) =>
        (t?.name ?? "").includes("Chicago"),
      );
      setTimezoneId(String((chicago ?? timezones[0])?.id));
    }
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
    if (isRetailSampling && !storeNumber.trim()) {
      showAlert(
        "Store number is required for Retail Sampling activations.",
        "warning",
      );
      return;
    }
    const allDates = [date, ...extraDates.filter(Boolean)];
    const geocoded = await geocode(address || venue);
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
      allDates.length > 1
        ? `Bulk submission — ${allDates.length} visits at this venue.`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    let successes = 0;
    const failures: string[] = [];

    for (const d of allDates) {
      const composedName =
        allDates.length > 1
          ? `${venue} · ${d} (${allDates.indexOf(d) + 1}/${allDates.length})`
          : `${venue} · ${d}`;
      // We fan out N parallel mutations one after another so the user gets
      // a clean per-date error message if any fails. A batch mutation
      // would be cleaner — tracked in BACKEND-PATCH.md.
      await new Promise<void>((resolve) => {
        commit({
          variables: {
            input: {
              name: composedName,
              address: address || venue,
              coordinates: coords,
              // Backend Request.date / start_time / end_time are all
              // DateTimeField — every one needs an ISO string, not
              // bare YYYY-MM-DD or HH:MM.
              date: `${d}T${(startTime || "12:00").padEnd(5, "0")}:00`,
              startTime: `${d}T${(startTime || "12:00").padEnd(5, "0")}:00`,
              endTime: `${d}T${(endTime || "16:00").padEnd(5, "0")}:00`,
              timezoneId,
              requestTypeId,
              rmmAsignedId: rmmId || undefined,
              tenantId: tenantId ?? undefined,
              clientName: fullName || undefined,
              clientEmail: email || undefined,
              requestorEmail: email || undefined,
              distributorId: distributorId || undefined,
              distributorName:
                distributors.find((d) => String(d.id) === distributorId)?.name ?? undefined,
              notes: notesPlus || undefined,
              details: [],
              products: Array.from(selectedProducts).map((productId) => ({
                productId,
                quantity: 1,
              })),
            },
          },
          onCompleted: (res) => {
            if (res.createRequest?.success) successes += 1;
            else failures.push(d);
            resolve();
          },
          onError: () => {
            failures.push(d);
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
      navigate("/requests/list");
    } else if (successes > 0) {
      // Partial success — leave the draft alone so kyle can fix the
      // bad rows without re-entering the good ones.
      showAlert(
        `Submitted ${successes} · ${failures.length} failed: ${failures.join(", ")}`,
        "warning",
      );
    } else {
      showAlert(`All submissions failed. Try again.`, "error");
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 max-w-3xl mx-auto px-1 sm:px-0"
    >
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
          Six fields. We auto-route to your Ignite RMM for approval,
          staffing, and scheduling.
        </p>
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
                Store number *
              </label>
              <input
                style={inputStyle}
                value={storeNumber}
                onChange={(e) => setStoreNumber(e.target.value)}
                placeholder="e.g. 1247"
                required
                inputMode="numeric"
              />
              <p
                className="text-xs mt-1"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                The retailer's store number identifies which location
                the BA reports to.
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
                - Start/end time: default 12:00 PM – 4:00 PM (set by
                  qpStart / qpEnd useState init).
                - Time zone: derived from the address geocode on the
                  backend if not set.
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
          Submission lands in the RMM's queue. Once approved, Spark auto-posts
          a job and emails confirmation to your team.
        </p>
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
            disabled={isCommitting || !venue || !date}
            className="px-6 py-3 rounded-2xl text-sm font-semibold transition"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow:
                !venue || !date
                  ? "none"
                  : "0 0 24px rgba(197,245,70,0.35)",
              opacity: isCommitting || !venue || !date ? 0.5 : 1,
            }}
          >
            {isCommitting ? "Submitting…" : "Submit & route to RMM →"}
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
