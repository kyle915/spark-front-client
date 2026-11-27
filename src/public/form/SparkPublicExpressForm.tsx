import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import SparkFormLayout from "./layout/FormLayout";
import { PublicFormTenantContext } from "./layout/publicFormTenantContext";
import {
  usePublicProducts,
  usePublicProductTypes,
  usePublicRequestTypes,
  usePublicTimeZones,
  usePublicDistributors,
} from "./hooks";
import { useCreateRequest } from "./hooks/useCreateRequest";
import {
  usePublicRetailerMix,
  usePublicStoreAccountSearch,
} from "./hooks/usePublicRetailer";
import { retailerOptionLabel } from "@/utils/retailerOptionLabel";
import SharedTimeSlotSelect from "@/components/inputs/TimeSlotSelect";
import CoBrandPicker from "./components/CoBrandPicker";
import {
  coBrandBlocker,
  coBrandsPayload,
  type CoBrandSelection,
} from "./components/coBrandPayload";
import type { CreateRequestInput } from "./types/CreateRequestByUrl";
import GooglePlacesInput, {
  matchTimezoneOption,
  resolveAddressPlace,
} from "@/components/inputs/GooglePlacesInput";
import { buildRequestDateTimes } from "./utils/buildPayload";
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
} from "./torchRequestForm";
import EventActivationSchedule from "./components/EventActivationSchedule";
import {
  clearPublicFormDraft,
  hasPublicFormDraftContent,
  readPublicFormDraft,
  writePublicFormDraft,
  type PublicFormDraft,
} from "./publicFormDraft";
import {
  showsBaCountSelector,
  showsEventActivationSchedule,
  showsLegacyBulkDates,
  visitSlotIssues,
  visitSlotsAfterPartialSuccess,
  visitSlotsForSubmit,
  type VisitSlot,
} from "./eventActivationSchedule";

/**
 * Spark v2 — public Express request form.
 *
 * Mobile-first, single-screen mirror of the internal `/requests/create`
 * Express form. Supports product image picker, multi-date bulk submit,
 * BA count selector, and deep-link prefill of venue/address. Auth-gated
 * bits (RMM/internal notes) are stripped — clients submitting via the
 * public link only see what's relevant to them.
 */
// Per-tenant page titles. The default is "<Brand> BA Request Form"; a brand
// whose form covers something more specific gets its exact wording here rather
// than changing the heading for every other client's live public form.
const FORM_TITLE_OVERRIDES: Record<string, string> = {
  "keee-torch-thc": "TORCH THC Retail Sampling + BA Request Form",
};

function ExpressFormBody() {
  const { tenantSlug } = useParams();
  const slug = tenantSlug ?? "";
  const [searchParams] = useSearchParams();
  // Real brand name from tenantPublic — never parse the URL slug. A 4-char
  // slug token ("girl" in girl-beer, "keee" in keee-torch-thc) is not a
  // brand name, and stripping it left Girl Beer titled "Beer".
  const tenant = useContext(PublicFormTenantContext);
  const brandName = tenant?.name?.trim() || "Brand";
  const isTorch = isTorchRequestForm(slug);

  const [selectedProductTypeId, setSelectedProductTypeId] = useState<string | null>(null);
  const { products, loading: productsLoading, hasMore, loadMore } = usePublicProducts(
    slug,
    selectedProductTypeId,
  );
  const { productTypes } = usePublicProductTypes(slug);
  const { requestTypes } = usePublicRequestTypes(slug);
  const { timeZones } = usePublicTimeZones();
  const { distributors } = usePublicDistributors(slug);
  const { submit, loading: submitting } = useCreateRequest({ slug });

  // Form state
  const [venue, setVenue] = useState(searchParams.get("venue") ?? "");
  const [address, setAddress] = useState(searchParams.get("address") ?? "");
  // Real lat/lng captured when the requestor picks a Google place for the
  // venue or address. Null until a place resolves — we never fabricate a
  // coordinate. Mirrors the wizard form's `latitude`/`longitude` form
  // values (set by FormAddressSearch.onSelect in Step1Basic), which
  // `buildPayload` turns into `coordinates`. Without this the Event lands
  // at [0,0] and the "new gig nearby" distance push fails its haversine
  // gate.
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  // Brand's saved store accounts (preloaded roster). Picking one fills the
  // venue + address and links the request to that account for as long as
  // the address is left as-is; any other venue is still typed below.
  const storeMix = usePublicRetailerMix(slug);
  const hasStoreAccounts = (storeMix?.regional ?? 0) > 0;
  const [storeQ, setStoreQ] = useState("");
  const [pickedStore, setPickedStore] = useState<{
    id: string;
    address: string;
  } | null>(null);
  const pickedStoreRef = useRef<string | null>(null);
  const { matches: storeMatches, searching: storeSearching } = usePublicStoreAccountSearch(
    slug,
    storeQ,
    hasStoreAccounts && !pickedStore,
  );
  const retailerId =
    pickedStore && address.trim() === pickedStore.address.trim() ? pickedStore.id : "";
  const [date, setDate] = useState("");
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [visitSlots, setVisitSlots] = useState<VisitSlot[]>([
    { date: "", startTime: "12:00", endTime: "16:00" },
  ]);
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("16:00");
  const [timezoneId, setTimezoneId] = useState("");
  const [requestTypeId, setRequestTypeId] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [brokenProductImages, setBrokenProductImages] = useState<string[]>([]);
  const coBrandSiblings = useMemo(
    () => (tenant?.brandGroup?.brands ?? []).filter((b) => !b.isSelf),
    [tenant],
  );
  // null until answered — only asked when this brand has a brand group.
  const [multiBrand, setMultiBrand] = useState<boolean | null>(null);
  const [coBrandSelection, setCoBrandSelection] = useState<CoBrandSelection>({});
  const coBrandMissing =
    coBrandSiblings.length > 0 ? coBrandBlocker(multiBrand, coBrandSelection) : "";
  const [requestorEmail, setRequestorEmail] = useState("");
  const [requestorName, setRequestorName] = useState("");
  const [storeContact, setStoreContact] = useState("");
  const [storeManagerName, setStoreManagerName] = useState("");
  const [storeManagerPhone, setStoreManagerPhone] = useState("");
  const [baCount, setBaCount] = useState(1);
  const [distributorQ, setDistributorQ] = useState("");
  const [distributorId, setDistributorId] = useState("");
  const [distributorName, setDistributorName] = useState("");
  // Filter the public distributor list by typed query (case-insensitive
  // prefix match). Cap to 8 visible suggestions so the field doesn't
  // dominate the form on a long list.
  const distributorMatches = useMemo(() => {
    const q = distributorQ.toLowerCase().trim();
    if (!q || q.length < 2) return [];
    return (distributors ?? [])
      .filter((d): d is NonNullable<typeof d> => !!d?.name)
      .filter((d) => d.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [distributorQ, distributors]);
  const [notes, setNotes] = useState("");
  // Required scheduling choice — whether the visit is already on the
  // account's books or Ignite still needs to book it. Plain metadata,
  // no approval-flow impact. "" until the requestor picks one.
  const [schedulingStatus, setSchedulingStatus] = useState<string>("");
  // Torch-only: "Is Non-Active Product Required?" Yes/No. "" until picked.
  // Shown when any selected SKU is 5MG or 10MG (not both families required).
  const [nonActiveProductRequired, setNonActiveProductRequired] = useState<string>("");
  const [casesToBeShipped, setCasesToBeShipped] = useState("");
  // Names for selected product IDs survive product-type filters / pagination.
  const [productNameById, setProductNameById] = useState<Record<string, string>>({});
  // Torch-only extras gated by the existing Request Type picker.
  const [accountSpendAmount, setAccountSpendAmount] = useState("");
  const [eventAssetsNeeded, setEventAssetsNeeded] = useState("");
  const [loadInTime, setLoadInTime] = useState("");
  const [onsitePoc, setOnsitePoc] = useState("");
  const [additionalTeamDetails, setAdditionalTeamDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Modal-popup payload shown on successful submit (per Kyle's spec,
  // external form only). Surfaces the RMM the request was routed to so
  // the requestor knows who's approving.
  const [confirmation, setConfirmation] = useState<{
    count: number;
    routedTo: string | null;
    requestorName: string;
    approved: boolean;
  } | null>(null);

  // On-device draft (localStorage, keyed by tenant slug). A saved draft is
  // offered, never silently applied; autosave only starts once the visitor
  // has resumed/discarded it or there was none to offer.
  const [pendingDraft, setPendingDraft] = useState<PublicFormDraft | null>(null);
  const [draftGateOpen, setDraftGateOpen] = useState(false);
  useEffect(() => {
    const saved = slug ? readPublicFormDraft(slug) : null;
    if (saved) setPendingDraft(saved);
    else setDraftGateOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draftSnapshot = (): Omit<PublicFormDraft, "v" | "slug" | "savedAt"> => ({
    venue,
    address,
    latitude,
    longitude,
    storeQ,
    pickedStore,
    date,
    extraDates,
    visitSlots,
    startTime,
    endTime,
    timezoneId,
    requestTypeId,
    productIds,
    productNameById,
    selectedProductTypeId,
    requestorEmail,
    requestorName,
    storeContact,
    storeManagerName,
    storeManagerPhone,
    baCount,
    distributorQ,
    distributorId,
    distributorName,
    notes,
    schedulingStatus,
    nonActiveProductRequired,
    casesToBeShipped,
    accountSpendAmount,
    eventAssetsNeeded,
    loadInTime,
    onsitePoc,
    additionalTeamDetails,
    multiBrand,
    coBrandSelection,
  });

  useEffect(() => {
    if (!slug || !draftGateOpen) return;
    const timer = window.setTimeout(() => {
      const snapshot = draftSnapshot();
      if (hasPublicFormDraftContent(snapshot)) writePublicFormDraft(slug, snapshot);
      else clearPublicFormDraft(slug);
    }, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    slug,
    draftGateOpen,
    venue,
    address,
    latitude,
    longitude,
    storeQ,
    pickedStore,
    date,
    extraDates,
    visitSlots,
    startTime,
    endTime,
    timezoneId,
    requestTypeId,
    productIds,
    productNameById,
    selectedProductTypeId,
    requestorEmail,
    requestorName,
    storeContact,
    storeManagerName,
    storeManagerPhone,
    baCount,
    distributorQ,
    distributorId,
    distributorName,
    notes,
    schedulingStatus,
    nonActiveProductRequired,
    casesToBeShipped,
    accountSpendAmount,
    eventAssetsNeeded,
    loadInTime,
    onsitePoc,
    additionalTeamDetails,
    multiBrand,
    coBrandSelection,
  ]);

  const resumeDraft = () => {
    if (!pendingDraft) return;
    const d = pendingDraft;
    setVenue(d.venue);
    setAddress(d.address);
    setLatitude(d.latitude);
    setLongitude(d.longitude);
    setStoreQ(d.storeQ);
    pickedStoreRef.current = d.pickedStore?.id ?? null;
    setPickedStore(d.pickedStore);
    setDate(d.date);
    setExtraDates(d.extraDates);
    setVisitSlots(d.visitSlots);
    setStartTime(d.startTime);
    setEndTime(d.endTime);
    setTimezoneId(d.timezoneId);
    setRequestTypeId(d.requestTypeId);
    setProductIds(d.productIds);
    setProductNameById(d.productNameById);
    setSelectedProductTypeId(d.selectedProductTypeId);
    setRequestorEmail(d.requestorEmail);
    setRequestorName(d.requestorName);
    setStoreContact(d.storeContact);
    setStoreManagerName(d.storeManagerName);
    setStoreManagerPhone(d.storeManagerPhone);
    setBaCount(d.baCount);
    setDistributorQ(d.distributorQ);
    setDistributorId(d.distributorId);
    setDistributorName(d.distributorName);
    setNotes(d.notes);
    setSchedulingStatus(d.schedulingStatus);
    setNonActiveProductRequired(d.nonActiveProductRequired);
    setCasesToBeShipped(d.casesToBeShipped);
    setAccountSpendAmount(d.accountSpendAmount);
    setEventAssetsNeeded(d.eventAssetsNeeded);
    setLoadInTime(d.loadInTime);
    setOnsitePoc(d.onsitePoc);
    setAdditionalTeamDetails(d.additionalTeamDetails);
    setMultiBrand(d.multiBrand);
    setCoBrandSelection(d.coBrandSelection);
    setPendingDraft(null);
    setDraftGateOpen(true);
  };

  const discardDraft = () => {
    if (slug) clearPublicFormDraft(slug);
    setPendingDraft(null);
    setDraftGateOpen(true);
  };

  const pickStoreAccount = (store: { id: string; name: string; address?: string | null }) => {
    const storeAddress = store.address ?? "";
    pickedStoreRef.current = store.id;
    setPickedStore({ id: store.id, address: storeAddress });
    setStoreQ(retailerOptionLabel(store));
    setVenue(store.name);
    setAddress(storeAddress);
    setLatitude(null);
    setLongitude(null);
    void resolveAddressPlace(storeAddress).then((place) => {
      if (!place || pickedStoreRef.current !== store.id) return;
      setLatitude(place.lat);
      setLongitude(place.lng);
      const tz = place.timezoneId ? matchTimezoneOption(place.timezoneId, timeZones) : null;
      if (tz) setTimezoneId(String(tz.id));
    });
  };

  const clearStoreAccount = () => {
    pickedStoreRef.current = null;
    setPickedStore(null);
    setStoreQ("");
  };

  const toggleProduct = (id: string) => {
    const product = products.find((p) => p.id === id);
    if (product?.name) {
      setProductNameById((prev) =>
        prev[id] === product.name ? prev : { ...prev, [id]: product.name },
      );
    }
    setProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  useEffect(() => {
    if (products.length === 0) return;
    setProductNameById((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const p of products) {
        if (p.id && p.name && next[p.id] !== p.name) {
          next[p.id] = p.name;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [products]);

  const allDates = useMemo(
    () => [date, ...extraDates].filter(Boolean),
    [date, extraDates],
  );

  const selectedRequestTypeName = useMemo(
    () => requestTypes.find((rt) => rt.id === requestTypeId)?.name ?? "",
    [requestTypes, requestTypeId],
  );
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
  const multiDateEvent = showsEventActivationSchedule(
    selectedRequestTypeName,
    slug,
  );
  const legacyBulkDates = showsLegacyBulkDates(slug);
  const showBaCount = showsBaCountSelector(selectedRequestTypeName, slug);
  const listedVisits = multiDateEvent
    ? visitSlots.filter((slot) => slot.date.trim()).length
    : allDates.length;
  const scheduleIssue = multiDateEvent ? visitSlotIssues(visitSlots) : null;
  const wasMultiDateEvent = useRef(false);
  const visitSlotsRef = useRef(visitSlots);
  visitSlotsRef.current = visitSlots;
  useEffect(() => {
    if (multiDateEvent && !wasMultiDateEvent.current) {
      setVisitSlots((prev) => {
        if (prev[0]?.date.trim()) return prev;
        return [
          {
            date,
            startTime: startTime || "12:00",
            endTime: endTime || "16:00",
          },
          ...prev.slice(1),
        ];
      });
    } else if (!multiDateEvent && wasMultiDateEvent.current) {
      const first = visitSlotsRef.current[0];
      if (first) {
        setDate(first.date);
        setStartTime(first.startTime || "12:00");
        setEndTime(first.endTime || "16:00");
      }
    }
    wasMultiDateEvent.current = multiDateEvent;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiDateEvent]);
  const torchNonActiveValues = {
    nonActiveProductRequired,
    casesToBeShipped,
  };
  const showTorchNonActiveFields = useMemo(() => {
    if (!isTorch) return false;
    return selectedProductsInclude5mgOr10mg(
      productIds.map((id) => productNameById[id]),
    );
  }, [isTorch, productIds, productNameById]);

  // Require a FULL address — street, city, state, ZIP — not just a street
  // line. Google Places' formattedAddress always carries a 5-digit ZIP; a
  // free-typed "1608 Broadway St" (REQ-925) doesn't. Requiring a ZIP is a
  // cheap, robust "is this the full address?" gate so the request + the RMM
  // approval email carry the complete address instead of a bare street.
  const addressComplete = /\b\d{5}\b/.test(address || "");

  const scheduleReady = multiDateEvent
    ? !scheduleIssue
    : !!date && !!startTime && !!endTime;

  const canSubmit =
    !!venue &&
    !!address &&
    addressComplete &&
    scheduleReady &&
    !!timezoneId &&
    !!requestTypeId &&
    productIds.length > 0 &&
    !!requestorName.trim() &&
    !!requestorEmail.trim() &&
    !!schedulingStatus &&
    (!showTorchNonActiveFields || !!nonActiveProductRequired) &&
    torchActivationOk &&
    !coBrandMissing &&
    !submitting;

  const submitBlocker =
    !venue || !address || !addressComplete || !scheduleReady || !timezoneId
      ? "Venue"
      : productIds.length === 0
        ? "Products"
        : !requestorName.trim() || !requestorEmail.trim() || !requestTypeId || !schedulingStatus
          ? "Client"
          : showTorchNonActiveFields && !nonActiveProductRequired
            ? "Products"
            : isTorch && !torchActivationOk
              ? "Request"
              : coBrandMissing || null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError("Please fill in all required fields and pick at least one product.");
      return;
    }

    const submitSlots: VisitSlot[] = multiDateEvent
      ? visitSlotsForSubmit(visitSlots)
      : [date, ...(legacyBulkDates ? extraDates : [])]
          .filter(Boolean)
          .map((d) => ({ date: d, startTime, endTime }));
    if (multiDateEvent && scheduleIssue) {
      setError(scheduleIssue);
      return;
    }

    const notesPlus = [
      notes,
      showBaCount ? `BA count: ${baCount}` : null,
      ...torchNonActiveNoteLines(showTorchNonActiveFields, torchNonActiveValues),
      ...(isTorch
        ? torchActivationNoteLines(selectedRequestTypeName, torchActivationValues)
        : []),
      submitSlots.length > 1
        ? `Bulk submission — ${submitSlots.length} visits at this venue.`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    // Build the request coordinates from the geocode captured when the
    // requestor picked a venue/address (see the GooglePlacesInput
    // onResolved handlers). Mirrors the wizard form's buildPayload, which
    // emits `[Number(values.latitude), Number(values.longitude)]`.
    //
    // GUARD: only send real coordinates. If no place ever resolved
    // (latitude/longitude null), or the captured pair is non-finite, or it
    // degenerates to the [0,0] null-island, fall back to [0, 0] — the
    // sentinel the backend already accepts for an unknown geocode (it's
    // what this form sent unconditionally before). The win: when the
    // requestor picked an address (the common case) the real coordinates
    // now flow through instead of being overwritten with [0,0], so the
    // Event geocodes correctly and the "new gig nearby" haversine push
    // works.
    const hasRealGeocode =
      latitude != null &&
      longitude != null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      !(latitude === 0 && longitude === 0);
    const coordinates: [number, number] = hasRealGeocode
      ? [Number(latitude), Number(longitude)]
      : [0, 0];

    let successes = 0;
    let allApproved = true;
    let lastRouted: string | null = null;
    const failures: string[] = [];
    const succeededSlots: VisitSlot[] = [];

    for (const slot of submitSlots) {
      const d = slot.date;
      // Backend Request.date, start_time, and end_time are ALL
      // DateTimeFields on the Django model — they each need to be ISO
      // strings, not bare YYYY-MM-DD or HH:MM. Combine date + time on
      // every field before posting so Django's validator accepts.
      //
      // CRITICAL: bake the selected timezone's DST-aware offset (for
      // THIS date) into each timestamp — otherwise a naive `...T11:00:00`
      // gets stored as 11:00 UTC and reads back shifted (the B4 bug).
      // We resolve per-date inside the loop so a bulk submission that
      // straddles the DST boundary gets the right offset on each row.
      // `buildRequestDateTimes` is the same helper the wizard form's
      // `buildPayload` uses, so both forms emit the identical UTC instant.
      const dateTimes = buildRequestDateTimes(
        timeZones,
        timezoneId,
        d,
        normalizeHourMinute(slot.startTime),
        normalizeHourMinute(slot.endTime),
      );
      const input: CreateRequestInput = {
        name:
          multiDateEvent && submitSlots.length > 1 ? `${venue} · ${d}` : venue,
        date: dateTimes.date,
        startTime: dateTimes.startTime,
        endTime: dateTimes.endTime,
        address,
        coordinates,
        requestorEmail,
        clientName: requestorName || requestorEmail,
        clientEmail: requestorEmail,
        distributorId: distributorId || null,
        distributorName: distributorName,
        distributorEmail: "",
        retailerId: retailerId || null,
        retailerName: venue,
        retailerAddress: address,
        retailerStoreContact: storeContact,
        storeManagerName,
        storeManagerPhone,
        requestTypeId,
        timezoneId,
        schedulingStatus,
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
        products: productIds.map((productId) => ({ productId })),
        ...(coBrandSiblings.length > 0
          ? { coBrands: coBrandsPayload(!!multiBrand, coBrandSelection) }
          : {}),
        details: [{ isTableNeeded: false, tableSize: null }],
        notes: notesPlus,
        ...(multiDateEvent ? { baCount } : {}),
      };
      try {
        const result = await submit(input);
        successes += 1;
        succeededSlots.push(slot);
        if (result?.status?.slug !== "approved") allApproved = false;
        // Grab the RMM the *first* successful submission was routed
        // to. With bulk dates the routing is identical for every row
        // since it's keyed on tenant + product, so one is enough.
        if (!lastRouted && result?.rmmAsigned) {
          const first = (result.rmmAsigned.firstName || "").trim();
          const last = (result.rmmAsigned.lastName || "").trim();
          lastRouted =
            [first, last].filter(Boolean).join(" ") ||
            result.rmmAsigned.email ||
            null;
        }
      } catch (err) {
        failures.push(`${d}: ${(err as Error).message}`);
      }
    }

    if (failures.length === 0) {
      // Filed — the on-device draft has served its purpose. Close the gate
      // so the partial reset below doesn't immediately re-save one.
      if (slug) clearPublicFormDraft(slug);
      setDraftGateOpen(false);
      setConfirmation({
        count: successes,
        routedTo: lastRouted,
        requestorName: requestorName || requestorEmail.split("@")[0],
        approved: successes > 0 && allApproved,
      });
      setVenue("");
      setAddress("");
      setLatitude(null);
      setLongitude(null);
      setDate("");
      setExtraDates([]);
      setVisitSlots([{ date: "", startTime: "12:00", endTime: "16:00" }]);
      setBaCount(1);
      setProductIds([]);
      setMultiBrand(null);
      setCoBrandSelection({});
      setNotes("");
      setSchedulingStatus("");
      setNonActiveProductRequired("");
      setCasesToBeShipped("");
    } else {
      const remaining = visitSlotsAfterPartialSuccess(
        multiDateEvent ? visitSlots : submitSlots,
        succeededSlots,
      );
      if (multiDateEvent) {
        setVisitSlots(
          remaining.length > 0
            ? remaining
            : [{ date: "", startTime: "12:00", endTime: "16:00" }],
        );
      } else if (remaining.length > 0) {
        setDate(remaining[0].date);
        setStartTime(remaining[0].startTime);
        setEndTime(remaining[0].endTime);
        setExtraDates(remaining.slice(1).map((slot) => slot.date));
      }
      setError(
        `Submitted ${successes} of ${submitSlots.length}. Failed: ${failures.join("; ")}`,
      );
    }
  };

  const selectedTimezoneName = useMemo(
    () =>
      timeZones.find((tz) => String(tz.id) === String(timezoneId))?.name ?? "",
    [timeZones, timezoneId],
  );
  const selectedProductLabels = useMemo(
    () =>
      productIds.map(
        (id) =>
          productNameById[id] ||
          products.find((p) => p.id === id)?.name ||
          "Selected SKU",
      ),
    [productIds, productNameById, products],
  );

  return (
    <>
      <div className="w-full max-w-5xl mx-auto px-1 sm:px-0 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6 lg:items-start">
      <form
        onSubmit={onSubmit}
        className="w-full min-w-0 space-y-3.5"
      >
        {/* Header */}
        <div className="py-2">
          <p
            className="mono text-[10px] font-semibold"
            style={{
              letterSpacing: "0.2em",
              color: "var(--spark-text-meta, rgba(20, 22, 15, 0.62))",
            }}
          >
            REQUEST A TEAM
          </p>
          <h1
            className="display text-2xl sm:text-3xl font-bold mt-1"
            style={{
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              color: "var(--spark-text, #14160f)",
            }}
          >
            {FORM_TITLE_OVERRIDES[slug] ?? `${brandName} BA Request Form`}
          </h1>
          <p
            className="text-[13px] mt-2 leading-relaxed"
            style={{ color: "var(--spark-text-secondary, rgba(20, 22, 15, 0.74))" }}
          >
            Tell us where you'd like a sample team.{" "}
            {tenant?.autoApproveRequests
              ? "Submissions are approved automatically and confirmed by email."
              : `Submissions are routed to the applicable ${brandName} RMM for approval.`}
          </p>
        </div>

        {pendingDraft && (
          <div
            className="rounded-xl p-4 flex flex-wrap items-center gap-3"
            style={{
              background: "#ffffff",
              border: "1px solid var(--spark-border, #dcddd5)",
              boxShadow: "0 6px 20px rgba(20, 22, 15, 0.06)",
            }}
            role="status"
          >
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-semibold" style={{ color: "var(--spark-text, #14160f)" }}>
                Resume your request?
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--spark-text-secondary, rgba(20, 22, 15, 0.7))" }}>
                We saved your progress on this device
                {pendingDraft.savedAt
                  ? ` on ${new Date(pendingDraft.savedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}`
                  : ""}
                . Nothing has been submitted yet.
              </p>
            </div>
            <button
              type="button"
              onClick={resumeDraft}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{
                background: "var(--spark-lime, #14160f)",
                color: "var(--spark-on-accent, #ffffff)",
              }}
            >
              Resume
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{
                background: "#ffffff",
                color: "var(--spark-text, #14160f)",
                border: "1px solid var(--spark-border, #dcddd5)",
              }}
            >
              Discard
            </button>
          </div>
        )}

        {/* Venue + Address */}
        <Card title="VENUE">
          {hasStoreAccounts && (
            <Field label={`Your ${brandName} stores`}>
              <div className="relative">
                <input
                  value={storeQ}
                  onChange={(e) => {
                    setStoreQ(e.target.value);
                    pickedStoreRef.current = null;
                    setPickedStore(null);
                  }}
                  className={inputCls}
                  placeholder="Search by store, street or city"
                  autoComplete="off"
                  aria-label={`Search ${brandName} stores`}
                />
                {storeMatches.length > 0 && !pickedStore && (
                  <div
                    className="absolute left-0 right-0 z-30 mt-1 rounded-xl overflow-hidden"
                    style={{
                      background: "#ffffff",
                      border: "1px solid var(--spark-border, #dcddd5)",
                      boxShadow: "0 12px 28px rgba(20, 22, 15, 0.12)",
                    }}
                  >
                    {storeMatches.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickStoreAccount(s);
                        }}
                        className="block w-full text-left px-3 py-2.5 hover:bg-black/[0.03]"
                        style={{
                          color: "var(--spark-text, #14160f)",
                          borderTop: "1px solid var(--spark-hairline, rgba(20, 22, 15, 0.08))",
                        }}
                      >
                        <div className="text-sm font-semibold">{s.name}</div>
                        {s.address && (
                          <div
                            className="text-[12px] mt-0.5"
                            style={{ color: "var(--spark-text-secondary, rgba(20, 22, 15, 0.68))" }}
                          >
                            {s.address}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <p
                  className="mono text-[10px] mt-1"
                  style={{
                    letterSpacing: "0.14em",
                    color: retailerId
                      ? "var(--spark-ok-ink, #2b4c08)"
                      : "var(--spark-text-meta, rgba(20, 22, 15, 0.58))",
                  }}
                >
                  {retailerId
                    ? "STORE ON FILE — VENUE AND ADDRESS FILLED IN BELOW."
                    : storeSearching
                      ? "SEARCHING YOUR STORES…"
                      : storeQ.trim().length >= 2 && storeMatches.length === 0 && !pickedStore
                        ? "NOT ON FILE — ADD THE NEW STORE BELOW."
                        : "PICK A SAVED STORE, OR ADD A NEW ONE BELOW."}
                </p>
              </div>
            </Field>
          )}
          <Field label="Account / Venue Name *">
            <GooglePlacesInput
              value={venue}
              onChange={setVenue}
              bias="establishment"
              suggestionTheme="light"
              onResolved={(p) => {
                // Set the venue to the canonical retailer name (no
                // location suffix) so metrics aggregate by chain.
                // The full address goes into the Address field.
                setVenue(p.retailerName || p.placeName || "");
                if (!address) setAddress(p.formattedAddress);
                // Capture the resolved establishment's coordinates so the
                // request carries a real geocode even if the requestor
                // never touches the Address field. The Address picker (the
                // more precise locator) overwrites these if used after.
                if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
                  setLatitude(p.lat);
                  setLongitude(p.lng);
                }
                if (p.timezoneId) {
                  const match = matchTimezoneOption(p.timezoneId, timeZones);
                  if (match) setTimezoneId(String(match.id));
                }
              }}
              placeholder="e.g., Whole Foods - Brentwood"
              className={inputCls}
            />
          </Field>
          <Field label="Full Address *">
            <GooglePlacesInput
              value={address}
              onChange={setAddress}
              suggestionTheme="light"
              onResolved={(p) => {
                setAddress(p.formattedAddress);
                // The address is the precise visit location — prefer its
                // geocode for the request's coordinates.
                if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
                  setLatitude(p.lat);
                  setLongitude(p.lng);
                }
                if (p.timezoneId) {
                  const match = matchTimezoneOption(p.timezoneId, timeZones);
                  if (match) setTimezoneId(String(match.id));
                }
              }}
              placeholder="Start typing — Google suggestions appear"
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Store Contact (optional)">
              <input value={storeContact} onChange={(e) => setStoreContact(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Store Manager (optional)">
              <input value={storeManagerName} onChange={(e) => setStoreManagerName(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Store Manager Phone (optional)">
            <input value={storeManagerPhone} onChange={(e) => setStoreManagerPhone(e.target.value)} className={inputCls} />
          </Field>
        </Card>

        {/* Dates */}
        <Card title="DATES & TIMES">
          {multiDateEvent ? (
            <EventActivationSchedule
              slots={visitSlots}
              onChange={setVisitSlots}
              baCount={baCount}
              onBaCount={setBaCount}
              inputClassName={inputCls}
            />
          ) : (
            <>
          <Field label="Primary Date *">
            {/* Quick-pick chips for common BA scheduling windows.
                Saves clicks on mobile vs. spinning the calendar wheel.
                Selected chip glows lime. */}
            <div className="flex flex-wrap gap-2 mb-2">
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const fmt = (d: Date) =>
                  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                const addDays = (n: number) => {
                  const d = new Date(today);
                  d.setDate(d.getDate() + n);
                  return d;
                };
                const nextDow = (target: number) => {
                  // 0 = Sun ... 6 = Sat. Picks the *next* one, not today.
                  const d = new Date(today);
                  const diff = (target - d.getDay() + 7) % 7 || 7;
                  d.setDate(d.getDate() + diff);
                  return d;
                };
                const fmtChip = (d: Date) =>
                  d.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                const presets = [
                  { label: "TODAY", d: today },
                  { label: "TOMORROW", d: addDays(1) },
                  { label: `FRI · ${fmtChip(nextDow(5))}`, d: nextDow(5) },
                  { label: `SAT · ${fmtChip(nextDow(6))}`, d: nextDow(6) },
                  { label: `+7D · ${fmtChip(addDays(7))}`, d: addDays(7) },
                ];
                return presets.map((p) => {
                  const iso = fmt(p.d);
                  const selected = date === iso;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setDate(iso)}
                      className="mono text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition"
                      style={{
                        letterSpacing: "0.14em",
                        background: selected
                          ? "var(--spark-lime, #14160f)"
                          : "var(--spark-surface-2, #f1f1ec)",
                        color: selected
                          ? "var(--spark-on-accent, #ffffff)"
                          : "var(--spark-text-secondary, rgba(20, 22, 15, 0.8))",
                        border: selected
                          ? "1px solid var(--spark-lime, #14160f)"
                          : "1px solid var(--spark-border, #dcddd5)",
                      }}
                    >
                      {p.label}
                    </button>
                  );
                });
              })()}
            </div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
          {legacyBulkDates && extraDates.map((d, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="date"
                value={d}
                onChange={(e) => {
                  const next = [...extraDates];
                  next[i] = e.target.value;
                  setExtraDates(next);
                }}
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setExtraDates(extraDates.filter((_, j) => j !== i))}
                className="px-3 rounded-lg text-sm font-medium"
                style={{
                  background: "rgba(210, 72, 27, 0.08)",
                  color: "var(--spark-flag-ink, #a8340f)",
                  border: "1px solid rgba(210, 72, 27, 0.28)",
                }}
              >
                Remove
              </button>
            </div>
          ))}
          {legacyBulkDates && (
          <button
            type="button"
            onClick={() => setExtraDates([...extraDates, ""])}
            className="mono text-[11px] font-semibold px-3 py-2 rounded-lg"
            style={{
              letterSpacing: "0.14em",
              background: "var(--spark-surface-2, #f1f1ec)",
              color: "var(--spark-text, #14160f)",
              border: "1px dashed var(--spark-border, #c8cac0)",
            }}
          >
            + ANOTHER VISIT AT THIS VENUE
          </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Time *">
              <TimeSlotSelect value={startTime} onChange={setStartTime} />
            </Field>
            <Field label="End Time *">
              <TimeSlotSelect value={endTime} onChange={setEndTime} />
            </Field>
          </div>
            </>
          )}
          <Field label="Time Zone *">
            <select value={timezoneId} onChange={(e) => setTimezoneId(e.target.value)} className={inputCls}>
              <option value="">— Select —</option>
              {timeZones.map((tz) => (
                <option key={tz.id} value={tz.id}>{tz.name}</option>
              ))}
            </select>
          </Field>
        </Card>

        {/* Scheduling — required choice. Tells the Ignite team whether
            this visit is already on the account's calendar or still
            needs to be booked. Pure metadata; doesn't change approval. */}
        <Card title="SCHEDULING *">
          <Field label="Is this already scheduled with the account? *">
            <div className="grid grid-cols-1 gap-2">
              {[
                {
                  value: "already_scheduled",
                  label: "Already scheduled with the account",
                },
                {
                  value: "needs_scheduling",
                  label: "Schedule it for me",
                },
              ].map((opt) => {
                const selected = schedulingStatus === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSchedulingStatus(opt.value)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition"
                    style={{
                      background: selected
                        ? "rgba(20, 22, 15, 0.04)"
                        : "#ffffff",
                      border: selected
                        ? "2px solid var(--spark-lime, #14160f)"
                        : "1px solid var(--spark-border, #dcddd5)",
                    }}
                  >
                    <span
                      className="shrink-0 rounded-full"
                      style={{
                        width: 16,
                        height: 16,
                        border: selected
                          ? "5px solid var(--spark-lime, #14160f)"
                          : "2px solid rgba(20, 22, 15, 0.28)",
                        background: selected ? "#ffffff" : "transparent",
                      }}
                    />
                    <span
                      className="text-sm font-medium"
                      style={{
                        color: selected
                          ? "var(--spark-text, #14160f)"
                          : "var(--spark-text-secondary, rgba(20, 22, 15, 0.82))",
                      }}
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>
        </Card>

        {/* Request Type + BA count */}
        <Card title="REQUEST">
          <Field label="Request Type *">
            <select value={requestTypeId} onChange={(e) => setRequestTypeId(e.target.value)} className={inputCls}>
              <option value="">— Select —</option>
              {requestTypes
                .filter((rt) =>
                  [
                    "retail sampling",
                    "event activation",
                    "on-premise sampling",
                    "on-premise",
                  ].includes((rt.name ?? "").toLowerCase()),
                )
                .map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {(rt.name ?? "").toLowerCase() === "on-premise"
                      ? "On-Premise Sampling"
                      : rt.name}
                  </option>
                ))}
            </select>
          </Field>
          {isTorch && isOnPremiseRequestType(selectedRequestTypeName) && (
            <Field label="Account Spend Amount *">
              <input
                value={accountSpendAmount}
                onChange={(e) => setAccountSpendAmount(e.target.value)}
                className={inputCls}
                placeholder="$0.00"
                required
              />
            </Field>
          )}
          {isTorch && isEventActivationRequestType(selectedRequestTypeName) && (
            <>
              <Field label="What assets are needed at this event? *">
                <textarea
                  value={eventAssetsNeeded}
                  onChange={(e) => setEventAssetsNeeded(e.target.value)}
                  className={inputCls}
                  rows={3}
                  placeholder="10x10, Barrel Cooler, etc"
                  required
                />
              </Field>
              <Field label="What time is Load-In: *">
                <input
                  value={loadInTime}
                  onChange={(e) => setLoadInTime(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. 8:00 AM"
                  required
                />
              </Field>
              <Field label="Who is the onsite POC: *">
                <input
                  value={onsitePoc}
                  onChange={(e) => setOnsitePoc(e.target.value)}
                  className={inputCls}
                  placeholder="Name and phone or email"
                  required
                />
              </Field>
              <Field label="Any additional details for the team to know? *">
                <textarea
                  value={additionalTeamDetails}
                  onChange={(e) => setAdditionalTeamDetails(e.target.value)}
                  className={inputCls}
                  rows={3}
                  placeholder="Anything the team should know"
                  required
                />
              </Field>
            </>
          )}
          {showBaCount && !multiDateEvent && (
          <Field label="Brand Ambassadors Needed">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setBaCount(Math.max(1, baCount - 1))} className="w-10 h-10 rounded-lg text-lg font-medium" style={{ background: "var(--spark-surface-2, #f1f1ec)", border: "1px solid var(--spark-border, #dcddd5)", color: "var(--spark-text, #14160f)" }}>−</button>
              <span className="display text-2xl font-bold tab-num" style={{ minWidth: 40, textAlign: "center", color: "var(--spark-text, #14160f)" }}>{baCount}</span>
              <button type="button" onClick={() => setBaCount(Math.min(20, baCount + 1))} className="w-10 h-10 rounded-lg text-lg font-medium" style={{ background: "var(--spark-surface-2, #f1f1ec)", border: "1px solid var(--spark-border, #dcddd5)", color: "var(--spark-text, #14160f)" }}>+</button>
              <span className="mono text-[10px]" style={{ letterSpacing: "0.18em", color: "var(--spark-text-meta, rgba(20, 22, 15, 0.6))" }}>BAs</span>
            </div>
          </Field>
          )}
        </Card>

        {/* Products */}
        <Card title="PRODUCTS *">
          {productTypes.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mb-2">
              <button
                type="button"
                onClick={() => setSelectedProductTypeId(null)}
                className="mono text-[10px] font-semibold px-2.5 py-1.5 rounded-md transition"
                style={{
                  letterSpacing: "0.16em",
                  background: selectedProductTypeId === null ? "var(--spark-lime, #14160f)" : "var(--spark-surface-2, #f1f1ec)",
                  color: selectedProductTypeId === null ? "var(--spark-on-accent, #ffffff)" : "var(--spark-text-secondary, rgba(20, 22, 15, 0.78))",
                  border: selectedProductTypeId === null ? "1px solid var(--spark-lime, #14160f)" : "1px solid var(--spark-border, #dcddd5)",
                }}
              >
                ALL
              </button>
              {productTypes.map((pt) => (
                <button
                  key={pt.id}
                  type="button"
                  onClick={() => setSelectedProductTypeId(pt.id)}
                  className="mono text-[10px] font-semibold px-2.5 py-1.5 rounded-md transition"
                  style={{
                    letterSpacing: "0.16em",
                    background: selectedProductTypeId === pt.id ? "var(--spark-lime, #14160f)" : "var(--spark-surface-2, #f1f1ec)",
                    color: selectedProductTypeId === pt.id ? "var(--spark-on-accent, #ffffff)" : "var(--spark-text-secondary, rgba(20, 22, 15, 0.78))",
                    border: selectedProductTypeId === pt.id ? "1px solid var(--spark-lime, #14160f)" : "1px solid var(--spark-border, #dcddd5)",
                  }}
                >
                  {pt.name.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.map((p) => {
              const selected = productIds.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggleProduct(p.id)}
                  className="rounded-xl overflow-hidden text-left transition"
                  style={{
                    background: "#ffffff",
                    border: selected ? "2px solid var(--spark-lime, #14160f)" : "1px solid var(--spark-border, #dcddd5)",
                  }}
                >
                  <div className="relative w-full aspect-square" style={{ background: "#f6f6f2" }}>
                    {selected ? (
                      <span
                        aria-hidden
                        className="absolute top-2 right-2 z-10 w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold"
                        style={{
                          background: "var(--spark-lime, #14160f)",
                          color: "var(--spark-on-accent, #ffffff)",
                        }}
                      >
                        ✓
                      </span>
                    ) : null}
                    {p.image && !brokenProductImages.includes(p.id) ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="absolute inset-0 w-full h-full object-contain p-1.5"
                        onError={() => setBrokenProductImages((cur) => [...cur, p.id])}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="mono text-[10px]" style={{ color: "var(--spark-text-meta, rgba(20, 22, 15, 0.52))" }}>NO IMAGE</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold leading-tight" style={{ color: "var(--spark-text, #14160f)" }}>{p.name}</p>
                    <p className="mono text-[9px] mt-1" style={{ letterSpacing: "0.16em", color: "var(--spark-text-meta, rgba(20, 22, 15, 0.58))" }}>
                      {p.productType?.name?.toUpperCase()}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          {productsLoading && (
            <p className="mono text-[10px] mt-2" style={{ letterSpacing: "0.18em", color: "var(--spark-text-meta, rgba(20, 22, 15, 0.58))" }}>LOADING…</p>
          )}
          {hasMore && !productsLoading && (
            <button
              type="button"
              onClick={loadMore}
              className="mono text-[10px] font-semibold px-3 py-2 rounded-lg mt-2"
              style={{ letterSpacing: "0.16em", background: "var(--spark-surface-2, #f1f1ec)", color: "var(--spark-text, #14160f)", border: "1px solid var(--spark-border, #dcddd5)" }}
            >
              LOAD MORE
            </button>
          )}
        </Card>

        {coBrandSiblings.length > 0 && (
          <Card title="MULTI-BRAND ACTIVATION *">
            <CoBrandPicker
              hostName={brandName}
              siblings={coBrandSiblings}
              enabled={multiBrand}
              onEnabledChange={(next) => {
                setMultiBrand(next);
                if (!next) setCoBrandSelection({});
              }}
              selection={coBrandSelection}
              onSelectionChange={setCoBrandSelection}
            />
          </Card>
        )}

        {showTorchNonActiveFields && (
          <Card title="NON-ACTIVE PRODUCT *">
            <Field label="Is Non-Active Product Required? *">
              <div className="grid grid-cols-1 gap-2">
                {[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ].map((opt) => {
                  const selected = nonActiveProductRequired === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNonActiveProductRequired(opt.value)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition"
                      style={{
                        background: selected
                          ? "rgba(20, 22, 15, 0.04)"
                          : "#ffffff",
                        border: selected
                          ? "2px solid var(--spark-lime, #14160f)"
                          : "1px solid var(--spark-border, #dcddd5)",
                      }}
                    >
                      <span
                        className="shrink-0 rounded-full"
                        style={{
                          width: 16,
                          height: 16,
                          border: selected
                            ? "5px solid var(--spark-lime, #14160f)"
                            : "2px solid rgba(20, 22, 15, 0.28)",
                          background: selected ? "#ffffff" : "transparent",
                        }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{
                          color: selected
                            ? "var(--spark-text, #14160f)"
                            : "var(--spark-text-secondary, rgba(20, 22, 15, 0.82))",
                        }}
                      >
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="How many cases to be shipped?">
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={casesToBeShipped}
                onChange={(e) => setCasesToBeShipped(e.target.value)}
                className={inputCls}
                placeholder="Optional"
              />
            </Field>
          </Card>
        )}

        {/* Requestor */}
        <Card title="YOUR INFO">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Your Name *">
              <input
                value={requestorName}
                onChange={(e) => setRequestorName(e.target.value)}
                className={inputCls}
                placeholder="Full name"
                required
              />
            </Field>
            <Field label="Your Email *">
              <input
                type="email"
                value={requestorEmail}
                onChange={(e) => setRequestorEmail(e.target.value)}
                className={inputCls}
                placeholder="you@distributor.com"
                required
              />
            </Field>
          </div>
          <Field label="Distributor (optional)">
            <div className="relative">
              <input
                value={distributorQ}
                onChange={(e) => {
                  setDistributorQ(e.target.value);
                  // Treat any typed text as a free-form name so we still
                  // capture independents — backend dedupes by id where
                  // it matches.
                  setDistributorName(e.target.value);
                  setDistributorId("");
                }}
                className={inputCls}
                placeholder="Start typing — RNDC, Southern Glazer's, Breakthru…"
                autoComplete="off"
              />
              {distributorMatches.length > 0 && distributorQ && !distributorId && (
                <div
                  className="absolute left-0 right-0 z-30 mt-1 rounded-xl overflow-hidden"
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--spark-border, #dcddd5)",
                    boxShadow: "0 12px 28px rgba(20, 22, 15, 0.12)",
                  }}
                >
                  {distributorMatches.map((d) => (
                    <button
                      type="button"
                      key={d.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setDistributorId(String(d.id));
                        setDistributorName(d.name);
                        setDistributorQ(d.name);
                      }}
                      className="block w-full text-left px-3 py-2.5 hover:bg-black/[0.03]"
                      style={{
                        color: "var(--spark-text, #14160f)",
                        borderTop: "1px solid var(--spark-hairline, rgba(20, 22, 15, 0.08))",
                      }}
                    >
                      <div className="text-sm font-semibold">{d.name}</div>
                      {d.location?.state?.name && (
                        <div
                          className="mono text-[10px] mt-0.5"
                          style={{
                            letterSpacing: "0.12em",
                            color: "var(--spark-text-meta, rgba(20, 22, 15, 0.58))",
                          }}
                        >
                          {d.location.state.name.toUpperCase()}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {distributorQ &&
                distributorMatches.length === 0 &&
                !distributorId && (
                  <p
                    className="mono text-[10px] mt-1"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-text-meta, rgba(20, 22, 15, 0.6))",
                    }}
                  >
                    NO MATCH — we'll save "{distributorQ}" as typed.
                  </p>
                )}
            </div>
          </Field>
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} rows={3} placeholder="Anything our team should know?" />
          </Field>
        </Card>

        {error && (
          <div
            className="rounded-xl p-3 text-sm font-medium"
            style={{
              background: "rgba(210, 72, 27, 0.08)",
              border: "1px solid rgba(210, 72, 27, 0.3)",
              color: "var(--spark-flag-ink, #a8340f)",
            }}
          >
            {error}
          </div>
        )}
        {/* Sticky submit */}
        <div
          className="sticky bottom-0 -mx-1 sm:mx-0 px-3 pt-3 flex items-center justify-between gap-3 flex-wrap"
          style={{
            background: "rgba(246, 246, 242, 0.92)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderTop: "1px solid var(--spark-border, #dcddd5)",
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div
            className="mono text-[10px] font-medium"
            style={{
              letterSpacing: "0.16em",
              color: "var(--spark-text-meta, rgba(20, 22, 15, 0.66))",
            }}
          >
            {listedVisits > 1 ? `${listedVisits} VISITS · ` : ""}
            {`${productIds.length} PRODUCTS`}
            {showBaCount ? ` · ${baCount} BAs` : ""}
            {submitBlocker ? ` · Needs ${submitBlocker}` : ""}
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold transition"
            style={{
              background: "var(--spark-lime, #14160f)",
              color: "var(--spark-on-accent, #ffffff)",
              opacity: canSubmit ? 1 : 0.42,
            }}
          >
            {submitting ? "Submitting…" : listedVisits > 1 ? `Submit ${listedVisits} Requests` : "Submit Request"}
          </button>
        </div>
      </form>

      {/* Desktop sticky live activation summary rail */}
      <aside
        aria-label="Live activation summary"
        className="hidden lg:block sticky top-24 rounded-xl p-5 space-y-4"
        style={{
          background: "#ffffff",
          border: "1px solid var(--spark-border, #dcddd5)",
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <p
            className="mono text-[10px] font-semibold"
            style={{
              letterSpacing: "0.16em",
              color: "var(--spark-text-meta, rgba(20, 22, 15, 0.64))",
            }}
          >
            LIVE ACTIVATION SUMMARY
          </p>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
            style={{
              background: canSubmit
                ? "var(--spark-ok-bg, rgba(63, 92, 18, 0.11))"
                : "var(--spark-surface-2, #f1f1ec)",
              color: canSubmit
                ? "var(--spark-ok-ink, #2b4c08)"
                : "var(--spark-text-secondary, rgba(20, 22, 15, 0.76))",
              border: canSubmit
                ? "1px solid var(--spark-ok-border, rgba(63, 92, 18, 0.28))"
                : "1px solid var(--spark-border, #dcddd5)",
            }}
          >
            {canSubmit ? "Ready" : submitBlocker ? `Needs ${submitBlocker}` : "Draft"}
          </span>
        </div>

        <div className="space-y-3 text-xs">
          <div
            className="pb-3 space-y-1"
            style={{ borderBottom: "1px solid var(--spark-hairline, rgba(20, 22, 15, 0.09))" }}
          >
            <p className="text-[11px]" style={{ color: "var(--spark-text-meta, rgba(20, 22, 15, 0.58))" }}>
              Venue & address
            </p>
            <p className="font-semibold text-sm" style={{ color: "var(--spark-text, #14160f)" }}>
              {venue.trim() || "Select or enter a venue"}
            </p>
            <p className="leading-snug" style={{ color: "var(--spark-text-secondary, rgba(20, 22, 15, 0.72))" }}>
              {address.trim() || "Full street, city, state & 5-digit ZIP"}
            </p>
            {address.trim() ? (
              <p
                className="text-[11px] font-medium pt-0.5"
                style={{
                  color: addressComplete
                    ? "var(--spark-ok-ink, #2b4c08)"
                    : "var(--spark-flag-ink, #a8340f)",
                }}
              >
                {addressComplete
                  ? "✓ 5-digit ZIP verified"
                  : "Include 5-digit ZIP code"}
              </p>
            ) : null}
          </div>

          <div
            className="pb-3 space-y-1"
            style={{ borderBottom: "1px solid var(--spark-hairline, rgba(20, 22, 15, 0.09))" }}
          >
            <p className="text-[11px]" style={{ color: "var(--spark-text-meta, rgba(20, 22, 15, 0.58))" }}>
              Schedule & timezone
            </p>
            <p className="font-semibold tab-num" style={{ color: "var(--spark-text, #14160f)" }}>
              {multiDateEvent
                ? listedVisits > 0
                  ? `${listedVisits} activation date${listedVisits === 1 ? "" : "s"}`
                  : "Add activation date(s)"
                : allDates.length > 1
                  ? `${allDates.length} dates (${allDates[0]} +${allDates.length - 1})`
                  : date || "Pick visit date"}
            </p>
            {!multiDateEvent && startTime && endTime ? (
              <p className="tab-num" style={{ color: "var(--spark-text-secondary, rgba(20, 22, 15, 0.72))" }}>
                {startTime} – {endTime}
              </p>
            ) : null}
            <p className="text-[11px]" style={{ color: "var(--spark-text-meta, rgba(20, 22, 15, 0.6))" }}>
              {selectedTimezoneName || "Timezone auto-detects from address"}
            </p>
          </div>

          <div
            className="pb-3 space-y-1"
            style={{ borderBottom: "1px solid var(--spark-hairline, rgba(20, 22, 15, 0.09))" }}
          >
            <p className="text-[11px]" style={{ color: "var(--spark-text-meta, rgba(20, 22, 15, 0.58))" }}>
              Format & staffing
            </p>
            <p className="font-semibold" style={{ color: "var(--spark-text, #14160f)" }}>
              {selectedRequestTypeName || "Choose request format"}
            </p>
            <p className="tab-num" style={{ color: "var(--spark-text-secondary, rgba(20, 22, 15, 0.72))" }}>
              {showBaCount ? `${baCount} brand ambassador${baCount === 1 ? "" : "s"}` : "Standard team"}
              {schedulingStatus
                ? schedulingStatus === "already_scheduled"
                  ? " · Booked with store"
                  : " · Ignite books store"
                : ""}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px]" style={{ color: "var(--spark-text-meta, rgba(20, 22, 15, 0.58))" }}>
                Selected SKUs
              </p>
              <span className="tab-num font-semibold" style={{ color: "var(--spark-text, #14160f)" }}>
                {productIds.length}
              </span>
            </div>
            {selectedProductLabels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {selectedProductLabels.slice(0, 6).map((name, idx) => (
                  <span
                    key={`${name}-${idx}`}
                    className="px-2 py-0.5 rounded-md text-[11px] font-medium truncate max-w-full"
                    style={{
                      background: "var(--spark-surface-2, #f1f1ec)",
                      border: "1px solid var(--spark-border, #dcddd5)",
                      color: "var(--spark-text, #14160f)",
                    }}
                  >
                    {name}
                  </span>
                ))}
                {selectedProductLabels.length > 6 ? (
                  <span className="text-[11px] tab-num" style={{ color: "var(--spark-text-meta, rgba(20, 22, 15, 0.6))" }}>
                    +{selectedProductLabels.length - 6} more
                  </span>
                ) : null}
              </div>
            ) : (
              <p style={{ color: "var(--spark-text-meta, rgba(20, 22, 15, 0.6))" }}>
                Pick at least 1 product to sample
              </p>
            )}
          </div>
        </div>
      </aside>
      </div>

      {/* Submission-success modal. Routed-to RMM name pulled from the
          createRequestByUrl response. */}
      {confirmation && (
        <div
          onClick={() => setConfirmation(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{
            background: "rgba(20, 22, 15, 0.45)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl overflow-hidden"
            style={{
              background: "#ffffff",
              border: "1px solid var(--spark-border, #dcddd5)",
              boxShadow: "0 24px 64px rgba(20, 22, 15, 0.18)",
            }}
          >
            {/* Status band */}
            <div
              style={{
                padding: "14px 22px",
                background: "var(--spark-ok-bg, rgba(63, 92, 18, 0.1))",
                borderBottom: "1px solid var(--spark-ok-border, rgba(63, 92, 18, 0.24))",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: "var(--spark-ok-ink, #2b4c08)",
                }}
              />
              <span
                className="mono text-[10px] font-semibold"
                style={{
                  letterSpacing: "0.2em",
                  color: "var(--spark-ok-ink, #2b4c08)",
                }}
              >
                {confirmation.approved
                  ? "REQUEST RECEIVED · APPROVED"
                  : "REQUEST RECEIVED · PENDING APPROVAL"}
              </span>
            </div>

            <div className="p-6">
              <h2
                className="display text-2xl font-bold"
                style={{
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                  color: "var(--spark-text, #14160f)",
                }}
              >
                Thanks, {confirmation.requestorName}.
              </h2>
              <p
                className="text-sm mt-3"
                style={{
                  color: "var(--spark-text-secondary, rgba(20, 22, 15, 0.78))",
                  lineHeight: 1.55,
                }}
              >
                {confirmation.approved ? (
                  confirmation.count === 1 ? (
                    "Your request is approved. A confirmation email is on its way."
                  ) : (
                    `${confirmation.count} requests are approved. Confirmation emails are on their way.`
                  )
                ) : (
                  <>
                    {confirmation.count === 1
                      ? "Your request has been submitted."
                      : `${confirmation.count} requests have been submitted.`}{" "}
                    {confirmation.routedTo ? (
                      <>
                        They've been routed to{" "}
                        <strong style={{ color: "var(--spark-text, #14160f)" }}>
                          {confirmation.routedTo}
                        </strong>{" "}
                        for review.
                      </>
                    ) : (
                      <>It's been routed to the {brandName} RMM for review.</>
                    )}
                  </>
                )}
              </p>

              <div
                className="mt-5 rounded-xl p-4 space-y-1.5"
                style={{
                  background: "var(--spark-surface-2, #f6f6f2)",
                  border: "1px solid var(--spark-border, #dcddd5)",
                }}
              >
                <p
                  className="mono text-[10px] font-semibold"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-text-meta, rgba(20, 22, 15, 0.62))",
                  }}
                >
                  WHAT HAPPENS NEXT
                </p>
                <ol
                  className="text-sm space-y-1.5 mt-2"
                  style={{
                    paddingLeft: 18,
                    color: "var(--spark-text-secondary, rgba(20, 22, 15, 0.84))",
                    lineHeight: 1.55,
                  }}
                >
                  {confirmation.approved ? (
                    <>
                      <li>Ignite staffs a brand ambassador for the activation.</li>
                      <li>A calendar invite goes to you and the brand POC.</li>
                    </>
                  ) : (
                    <>
                      <li>The brand reviews and approves or declines.</li>
                      <li>You'll get an email the moment a decision is made.</li>
                      <li>
                        If approved, a calendar invite goes to you and the brand
                        POC automatically.
                      </li>
                    </>
                  )}
                </ol>
              </div>

              {!confirmation.approved && (
                <p
                  className="mono text-[10px] mt-4 text-center"
                  style={{
                    letterSpacing: "0.16em",
                    color: "var(--spark-text-meta, rgba(20, 22, 15, 0.58))",
                  }}
                >
                  MOST APPROVALS COME THROUGH WITHIN 24–48 HOURS
                </p>
              )}

              {/* Two clear next-step paths. Submitting more from the
                  public link is a common pattern — distributor reps
                  often have 5–10 venues to schedule in one sitting. */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setDate("");
                    setExtraDates([]);
                    setConfirmation(null);
                  }}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                  style={{
                    background: "#ffffff",
                    color: "var(--spark-text, #14160f)",
                    border: "1px solid var(--spark-border, #dcddd5)",
                  }}
                >
                  + Add another visit (same venue)
                </button>
                <button
                  onClick={() => {
                    setVenue("");
                    setAddress("");
                    clearStoreAccount();
                    setLatitude(null);
                    setLongitude(null);
                    setDate("");
                    setExtraDates([]);
                    setStoreContact("");
                    setStoreManagerName("");
                    setStoreManagerPhone("");
                    setProductIds([]);
                    setSelectedProductTypeId(null);
                    setBaCount(1);
                    setNotes("");
                    setSchedulingStatus("");
                    setNonActiveProductRequired("");
                    setCasesToBeShipped("");
                    setConfirmation(null);
                  }}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                  style={{
                    background: "#ffffff",
                    color: "var(--spark-text, #14160f)",
                    border: "1px solid var(--spark-border, #dcddd5)",
                  }}
                >
                  + Schedule a different venue
                </button>
              </div>
              <button
                onClick={() => setConfirmation(null)}
                className="mt-2 w-full px-5 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: "var(--spark-lime, #14160f)",
                  color: "var(--spark-on-accent, #ffffff)",
                }}
              >
                Done — close this
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function SparkPublicExpressForm() {
  const { tenantSlug } = useParams();
  return (
    <SparkFormLayout slug={tenantSlug ?? ""}>
      <ExpressFormBody />
    </SparkFormLayout>
  );
}

const inputCls =
  "w-full rounded-lg px-3 py-2 text-[15px] focus:outline-none focus:ring-2 spark-input";

/**
 * Normalize a "H:MM"/"HH:MM" time to a zero-padded "HH:MM".
 *
 * Replaces the old `(hhmm || "12:00").padEnd(5, "0")`, which padded the
 * wrong end: a single-digit-hour value like "9:30" became "9:300"
 * (length 4 → 5 by appending a trailing "0") — a corrupt time. Padding
 * the HOUR keeps "9:30" → "09:30" and leaves "11:00" untouched. Falls
 * back to noon for blank/garbage so a missing slot can't poison the
 * timestamp.
 */
const normalizeHourMinute = (hhmm: string): string => {
  const match = (hhmm || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "12:00";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
};

// Time-slot picker moved to a shared component used here + on the
// internal /requests/create form. Local thin wrapper keeps the
// inputCls binding so the visual styling stays in sync with the rest
// of this form.
const TimeSlotSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => (
  <SharedTimeSlotSelect
    value={value}
    onChange={onChange}
    className={inputCls}
  />
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span
      className="mono text-[11px] font-semibold block mb-1"
      style={{
        letterSpacing: "0.14em",
        color: "var(--spark-text-secondary, rgba(20, 22, 15, 0.78))",
      }}
    >
      {label.toUpperCase()}
    </span>
    {children}
  </label>
);

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div
    className="rounded-xl px-4 py-4 space-y-2.5"
    style={{
      background: "var(--spark-surface, #ffffff)",
      border: "1px solid var(--spark-border, #dcddd5)",
    }}
  >
    <p
      className="mono text-[10px] font-semibold"
      style={{
        letterSpacing: "0.18em",
        color: "var(--spark-text-meta, rgba(20, 22, 15, 0.62))",
      }}
    >
      {title}
    </p>
    {children}
  </div>
);
