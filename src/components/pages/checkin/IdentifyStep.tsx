import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useParams } from "react-router";
import { isExpenseReceiptBucket } from "./photoBuckets";
import { advisoryFromPhotoCheck, requestPhotoCheck, sha256Hex } from "./photoCheck";
import { applyVoiceFills, type VoiceFill } from "./voiceDraft";
import { VoiceRecapCard } from "./VoiceRecapCard";
import { matchingStores, storeNameForPicker, type StoreSuggestion } from "./storeSuggestions";
import {
  decideStoreProximity,
  geocodeStoreAddress,
  haversineMiles,
  isFiniteLatLng,
  proximityConfirmCopy,
  proximityIdentifyFields,
  type LatLng,
} from "./storeProximity";
import { PHOTO_CAP } from "./photoCap";
import {
  AUTO_RETRY_DELAYS_MS,
  CHECKIN_MAX_FUTURE_DAYS,
  CHECKIN_MAX_PAST_DAYS,
  FALLBACK_ACCENT,
  UNREADABLE_PHOTO_MESSAGE,
  apiOrigin,
  checkinResources,
  choiceKind,
  compressImage,
  draftPhotoOf,
  fetchWithTimeout,
  fileIsReadable,
  flushQueuedRecap,
  fmtDay,
  fmtTime,
  isPhotoType,
  normalizePlace,
  photoPrep,
  photoUploads,
  postCheckinClock,
  postCheckinPayableMileage,
  postCheckinRecap,
  readIdentity,
  retryableUploadFailure,
  shiftedISO,
  telHref,
  todayISO,
  writeIdentity,
} from "./checkinHelpers";
import {
  stalledUploadingCount,
  uploadStallMessage,
} from "./uploadStall";
import type {
  CheckinResource,
  Clock,
  Context,
  EventTypeOption,
  Photo,
  PhotoBucket,
  StoreIdentity,
  StoreOption,
  Template,
  TemplateField,
  TemplateProduct,
  UnfiledShift,
} from "./checkinTypes";
import { card, errText, h2, input, label, primaryBtn, resourceCard, secondaryBtn, wrap } from "./checkinStyles";
import { CorpoCardYesNo, PhotoBucketZone, PhotoFileInputs, PhotoGrid } from "./RecapPhotoStep";
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
import { SpendAmountInput } from "@/recap/SpendAmountInput";
import {
  isSpendAmountField,
  spendAmountError,
  spendAmountStored,
} from "@/recap/spendAmount";
import { makeThumbnail } from "@/utils/compressImageForUpload";
import {
  deleteDraftPhotoFiles,
  loadDraftPhotos,
  readOpenRecap,
  saveDraftPhotoFile,
  writeDraftPhotos,
  writeOpenRecap,
} from "./photoDraft";
import {
  asRecapDraft,
  clearDraft,
  draftHasAnswers,
  draftSavedLabel,
  hasRecapDraft,
  pickRestoredDraft,
  readDraft,
  writeDraft,
  type DraftScope,
  type RecapDraft,
  type StoreIdentityDraft,
} from "./recapDraft";
import { buildRecapDraftRequest } from "./recapServerDraft";
import { buildCompletenessItems } from "./checkinCompleteness";
import { PhotoQualityWarnings, RecapCompletenessChecklist } from "./RecapCompleteness";
import {
  analyzePhotoFile,
  classifyPhotoQuality,
  qualityMessage,
  quickPhotoHash,
  type PhotoQualityWarning,
} from "./photoQuality";
import { browserPlayableContentType } from "@/utils/recapFileUrl";
import {
  computeUploadProgress,
  formatUploadProgress,
} from "./uploadProgress";
import {
  CLOCK_FETCH_TIMEOUT_MS,
  clearCachedContext,
  clearPendingClock,
  clearPendingClockOut,
  enqueueClockIn,
  enqueueClockOut,
  flushPendingClock,
  flushPendingClockOut,
  isOfflineClockFailure,
  offlineClockBanner,
  offlineClockOutBanner,
  readCachedContext,
  readPendingClock,
  readPendingClockOut,
  writeCachedContext,
  type PendingClockIn,
  type PendingClockOut,
} from "./offlineClock";
import {
  IDENTIFY_OFFLINE_NO_CACHE,
  IDENTIFY_OFFLINE_QUEUED,
  flushPendingIdentify,
  writePendingIdentify,
} from "./offlineIdentify";
import {
  clearPendingRecap,
  enqueueRecap,
  offlineRecapBanner,
  putCheckinPhoto,
  NO_SIGNAL_PHOTO_MESSAGE,
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
  CHECK_IN_ANOTHER_GIG_HINT,
  CHECK_IN_SOMEWHERE_ELSE,
  CLEAR_LEFTOVER_ERROR,
  clearChosenShiftDate,
  eventCalendarDate,
  finishPriorRecapLabel,
  isLeftoverCheckinSession,
  isPastDayWalkupSession,
  LEFTOVER_PRIMARY_BUSY,
  newDayPrimaryLabel,
  offerFinishPriorRecap,
  PAST_DAY_NO_CLOCK,
  readChosenShiftDate,
  shiftDateForFindOrCreate,
  showNewDayGate,
  START_OVER_LINK,
  writeChosenShiftDate,
} from "./leftoverCheckin";
import {
  canAttemptOpenPunchResume,
  hasLookupPhone,
  lookupShiftsByPhone,
  resumeOpenShift,
  shouldDropSessionToken,
  shouldKeepCachedSession,
  type OpenShift,
} from "./checkinSession";
import { ActionMorphButton } from "@/motion/ActionMorphButton";
import { holdActionSuccess, type ActionPhase } from "@/motion/opsMotion";
import { useCoBrandRecap, type CoBrandOptions } from "./coBrandRecap";
import { CoBrandSections, CoBrandToggleCard } from "./CoBrandRecapCards";
import { TenantLogo } from "@/layout/TenantLogo.tsx";
import { shouldShowSamplingStopCard } from "./samplingStops";
import { isFieldShown, withoutHiddenValues } from "./fieldConditions";
import PayableMileageStep from "./PayableMileageStep";
import PlanGigPicker from "./PlanGigPicker";
import {
  PLAN_GIG_MISSING_ERROR,
  PLAN_GIG_NONE,
  fetchPlanGigs,
  keepPlanGigAnswer,
  pickedPlanGig,
  planGigUnanswered,
  type PlanGig,
} from "./planGigs";
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
  eventTypeSkipsIdentifyLocation,
  eventTypesUseDescriptorPicker,
  programDescription,
  programLabel,
} from "./eventTypeDescriptor";
import {
  PROGRAM_MISSING_ERROR,
  PROGRAM_STEP_TITLE,
  identifyPlaceKind,
  identifySubmitLabel,
  prefersReducedMotion,
  programPickerPrompt,
  programRequiredHint,
  recapOnlyIntro,
  revealProgramPicker,
} from "./programPickerGate";


function CheckinStoreSuggestions({
  hits,
  onPick,
}: {
  hits: StoreSuggestion[];
  onPick: (store: StoreSuggestion) => void;
}) {
  if (hits.length === 0) return null;
  return (
    <div
      role="listbox"
      style={{
        marginTop: 6,
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 12,
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
      }}
    >
      {hits.map((store) => {
        const label = storeNameForPicker(store) || store.address;
        return (
          <button
            key={`${store.name}-${store.address}`}
            type="button"
            role="option"
            onPointerDown={(e) => {
              e.preventDefault();
              onPick(store);
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 12px",
              background: "#fff",
              border: 0,
              borderTop: "1px solid rgba(0,0,0,0.06)",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "#14181a" }}>{label}</div>
            {label !== store.address ? (
              <div style={{ color: "#44403c", fontSize: 12, opacity: 1, marginTop: 2 }}>{store.address}</div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ── Step 1: identify ────────────────────────────────────────────────────────
export default function IdentifyStep({
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
  programPickerTitle = "",
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
  programPickerTitle?: string;
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
  const pickerAriaLabel = programPickerTitle || "Event type";
  // Deliberately NOT pre-selected. The default would be right most of the time
  // and silently wrong the rest, and a BA scanning a form they've filled twenty
  // times won't re-read a field that already has an answer.
  const [eventTypeId, setEventTypeId] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const [pickerMissing, setPickerMissing] = useState(false);
  const pickProgram = (id: string) => {
    setEventTypeId(id);
    if (!id) return;
    setPickerMissing(false);
    setErr((e) => (e === PROGRAM_MISSING_ERROR ? null : e));
  };
  const selectedEventType = eventTypes.find((t) => t.id === eventTypeId);
  const skipWorkLocation = eventTypeSkipsIdentifyLocation(
    selectedEventType?.name,
  );
  const placeKind = identifyPlaceKind({
    recapOnly,
    programName: selectedEventType?.name,
  });
  const atVenue = placeKind === "venue";
  const typedStore = placeKind === "typedStore";
  // An Event Activation is one venue, so a roaming brand types or GPS-picks
  // it like a store instead of choosing a market.
  const marketPicker = isMarket && !atVenue;

  const saved = readIdentity(code);
  const [firstName, setFirstName] = useState(saved.firstName);
  const [lastName, setLastName] = useState(saved.lastName);
  const [phone, setPhone] = useState(saved.phone);
  const [email, setEmail] = useState(saved.email);
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [storeSuggestField, setStoreSuggestField] = useState<"address" | "name" | null>(null);
  // Default to today — the overwhelmingly common case is a BA checking in for
  // the shift they're standing in. A past day already picked on this visit
  // (the form remounted) stays that day instead of snapping back to today.
  const [eventDate, setEventDate] = useState(() => {
    const today = todayISO();
    const chosen = readChosenShiftDate(code);
    if (chosen && chosen.chosenOn === today && chosen.date !== today) return chosen.date;
    return today;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  /** GPS from "Use my current location" — required for proximity confirm. */
  const [gpsFix, setGpsFix] = useState<LatLng | null>(null);
  /** Normalized address accepted unchanged from that GPS snap (never nags). */
  const [gpsTrustedKey, setGpsTrustedKey] = useState<string | null>(null);
  /** Store the BA already said "continue anyway" for this GPS session. */
  const [proximityConfirmedKey, setProximityConfirmedKey] = useState<string | null>(null);
  const [proximityMiles, setProximityMiles] = useState<number | null>(null);
  const [proximityChecking, setProximityChecking] = useState(false);
  const [pendingProximity, setPendingProximity] = useState<{
    hit: StoreSuggestion;
    miles: number;
    label: string;
  } | null>(null);
  const [unfiled, setUnfiled] = useState<UnfiledShift[]>([]);
  const [openShift, setOpenShift] = useState<OpenShift | null>(null);
  const [planGigs, setPlanGigs] = useState<PlanGig[]>([]);
  const [planGigAnswer, setPlanGigAnswer] = useState("");
  const [planGigMissing, setPlanGigMissing] = useState(false);
  const planGigRef = useRef<HTMLDivElement>(null);
  const pickedGig = pickedPlanGig(planGigs, planGigAnswer);
  // Gigs list per program, so a multi-program link waits for Step 1.
  const planGigProgram = hasPrograms ? eventTypeId : "";
  const planGigReady =
    needsEventDetails && Boolean(eventDate) && (!hasPrograms || Boolean(eventTypeId));
  useEffect(() => {
    if (!planGigReady) {
      setPlanGigs([]);
      return;
    }
    let cancelled = false;
    void fetchPlanGigs({
      origin: apiOrigin(),
      code,
      eventDate,
      eventTypeId: planGigProgram,
    }).then((gigs) => {
      if (cancelled) return;
      setPlanGigs(gigs);
      setPlanGigAnswer((answer) => keepPlanGigAnswer(gigs, answer));
    });
    return () => {
      cancelled = true;
    };
  }, [code, eventDate, planGigProgram, planGigReady]);
  const pickPlanGig = (value: string) => {
    setPlanGigAnswer(value);
    setPlanGigMissing(false);
    setErr((e) => (e === PLAN_GIG_MISSING_ERROR ? null : e));
  };

  // Picking a known store fills BOTH fields, so the address matches an existing
  // event's exactly and this BA joins it rather than forking a near-duplicate.
  //
  // `l.name` is sometimes the walk-in event TITLE — "8/2/2026 - 1155 E State St".
  // Copying one of those into the store-name box got it appended in parentheses.
  // Only carry a name that actually names a store.
  const applyStoreSelection = (hit: StoreSuggestion) => {
    setAddress(hit.address);
    const label = storeNameForPicker(hit);
    if (label) setStoreName(label);
    setStoreSuggestField(null);
    setPendingProximity(null);
  };
  const storeCoordsOf = (hit: StoreSuggestion): LatLng | null => {
    const point = { lat: Number(hit.lat), lng: Number(hit.lng) };
    return isFiniteLatLng(point) ? point : null;
  };
  const storeLabelOf = (hit: StoreSuggestion): string =>
    storeNameForPicker(hit) || hit.name.trim() || hit.address.trim() || "this store";

  /**
   * GPS + store coords + farther than ~0.75 mi → ask before accepting.
   * Missing GPS/coords, the GPS-trusted nearest match, or a prior
   * continue-anyway for this store all pass through quietly.
   */
  const gateStoreProximity = async (hit: StoreSuggestion): Promise<"allow" | "confirm"> => {
    const key = normalizePlace(hit.address);
    let storePoint = storeCoordsOf(hit);
    if (!storePoint && gpsFix) {
      storePoint = await geocodeStoreAddress(hit.address);
    }
    const decision = decideStoreProximity({
      gps: gpsFix,
      store: storePoint,
      storeKey: key,
      trustedKey: gpsTrustedKey,
      confirmedKey: proximityConfirmedKey,
    });
    if (decision.action === "allow") {
      if (
        (decision.reason === "nearby" || decision.reason === "trusted") &&
        storePoint &&
        gpsFix
      ) {
        setProximityMiles(haversineMiles(gpsFix, storePoint));
      }
      return "allow";
    }
    setProximityMiles(decision.miles);
    setPendingProximity({
      hit,
      miles: decision.miles,
      label: storeLabelOf(hit),
    });
    return "confirm";
  };
  const chooseStore = (hit: StoreSuggestion) => {
    void (async () => {
      setErr(null);
      setProximityChecking(true);
      try {
        const gate = await gateStoreProximity(hit);
        if (gate === "allow") applyStoreSelection(hit);
      } finally {
        setProximityChecking(false);
      }
    })();
  };
  const confirmPendingStore = () => {
    if (!pendingProximity) return;
    const key = normalizePlace(pendingProximity.hit.address);
    setProximityConfirmedKey(key);
    setProximityMiles(pendingProximity.miles);
    applyStoreSelection(pendingProximity.hit);
  };
  const dismissPendingStore = () => {
    setPendingProximity(null);
    setStoreSuggestField("name");
  };
  const pickStore = (value: string) => {
    setAddress(value);
    const hit = recentLocations.find((l) => l.address === value);
    const label = hit ? storeNameForPicker(hit) : "";
    if (label && !storeName.trim()) setStoreName(label);
  };
  const addressHits = matchingStores(recentLocations, address);
  const nameHits = matchingStores(recentLocations, storeName);

  // "Use my current location" — the phone knows where it is, so the BA
  // shouldn't have to type a street address one-handed in a parking lot.
  //
  // If the resolved address is within a hair of a store we already know, snap
  // to the KNOWN one instead. The backend keys find-or-create on the
  // normalized address, so a GPS-derived string that differs by a word from
  // the spelling the first BA used would fork a second event for the same
  // activation — the exact thing this flow exists to prevent.
  //
  // That snap (or the reverse-geocoded address) is the trusted nearest match:
  // we remember GPS + that key so a later wrong-store tap can confirm, without
  // nagging when they leave the GPS pick alone.
  const useMyLocation = () => {
    setErr(null);
    if (!navigator.geolocation) {
      setErr("This phone won't share its location. Type the address instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setGpsFix(isFiniteLatLng(fix) ? fix : null);
        setProximityConfirmedKey(null);
        setPendingProximity(null);
        setProximityMiles(null);
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
            const trustedAddress = known?.address || String(json.address);
            setGpsTrustedKey(normalizePlace(trustedAddress));
            if (known) pickStore(known.address);
            else setAddress(json.address);
          } else {
            setGpsTrustedKey(null);
            setErr("Couldn't name that spot — type the address instead.");
          }
        } catch {
          setGpsTrustedKey(null);
          setErr("Couldn't look that up. Type the address instead.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setGpsFix(null);
        setGpsTrustedKey(null);
        setErr("Location is off for this site. Type the address instead.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  // Keyed on the phone only: retyping a name must not re-ask the server.
  useEffect(() => {
    if (recapOnly || !needsEventDetails || !hasLookupPhone(phone)) {
      setUnfiled([]);
      setOpenShift(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void lookupShiftsByPhone<UnfiledShift>({
        origin: apiOrigin(),
        code,
        phone,
        eventDate: todayISO(),
      }).then(({ shifts, openShift: open }) => {
        if (cancelled) return;
        setUnfiled(shifts);
        setOpenShift(open);
      });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code, needsEventDetails, phone, recapOnly]);

  const continueShift = async () => {
    if (!openShift) return;
    setErr(null);
    setBusy(true);
    const json = await resumeOpenShift({
      origin: apiOrigin(),
      code,
      phone,
      firstName,
      lastName,
      email,
      eventDate: openShift.eventDate || todayISO(),
    });
    if (!json) {
      setErr("Couldn't reach your shift. Check your bars and tap again.");
      setBusy(false);
      return;
    }
    try {
      window.localStorage.setItem(storeKey, json.sessionToken);
    } catch {
      /* private mode — token still held in memory for this session */
    }
    writeIdentity(code, {
      firstName,
      lastName,
      phone,
      email,
      ...(openShift.address.trim() ? { lastPlace: openShift.address.trim() } : {}),
    });
    onDone(json.sessionToken);
  };

  const submit = async (overrides?: { eventDate?: string; address?: string; market?: string }) => {
    setErr(null);
    if (!firstName.trim()) return setErr("Enter your name.");
    if (!recapOnly && !phone.trim()) return setErr("Enter a phone number.");
    const today = todayISO();
    const date = shiftDateForFindOrCreate({
      picked: overrides?.eventDate ?? eventDate,
      today,
    });
    const addr = overrides?.address ?? address;
    const mkt = overrides?.market ?? market;
    // Unfiled-shift taps supply an address even when Product Seeding is selected.
    const omitPlace = skipWorkLocation && !overrides?.address && !overrides?.market;
    const onGig = overrides ? null : pickedGig;
    if (needsEventDetails) {
      // Required, and asked BEFORE the store, because it decides which form the
      // BA gets. The backend falls back to the brand's default rather than
      // rejecting a request with no program, so this check is the only thing
      // standing between a distracted BA and the wrong recap.
      // A tapped "Still need a recap" shift already has its event and program.
      if (hasPrograms && !eventTypeId && !overrides) {
        setPickerMissing(true);
        revealProgramPicker(pickerRef.current, { reduceMotion: prefersReducedMotion() });
        return setErr(PROGRAM_MISSING_ERROR);
      }
      if (!overrides && planGigUnanswered(planGigs, planGigAnswer)) {
        setPlanGigMissing(true);
        planGigRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        return setErr(PLAN_GIG_MISSING_ERROR);
      }
      if (!omitPlace && !onGig) {
        if (marketPicker) {
          if (!mkt) return setErr("Pick your market.");
        } else if (typedStore) {
          if (!storeName.trim()) return setErr("Enter the store name.");
          if (!addr.trim()) return setErr("Enter the store address.");
        } else if (!addr.trim()) {
          return setErr(atVenue ? "Enter the event or venue address." : "Enter the store address.");
        }
      }
      if (!date) return setErr("Pick the date you're working.");
      if (eventCalendarDate(date) !== today) {
        writeChosenShiftDate(code, { date, chosenOn: today });
      } else {
        clearChosenShiftDate(code);
      }
    }
    // Far-from-GPS store pick (suggestion or typed after location) must confirm
    // before identify — same gate as tapping a suggestion.
    if (
      needsEventDetails &&
      !omitPlace &&
      !onGig &&
      !marketPicker &&
      !overrides &&
      gpsFix &&
      addr.trim()
    ) {
      const known =
        recentLocations.find((l) => normalizePlace(l.address) === normalizePlace(addr)) ?? null;
      const hit: StoreSuggestion = known ?? {
        name: storeName,
        address: addr,
      };
      const key = normalizePlace(hit.address);
      if (
        key !== gpsTrustedKey &&
        key !== proximityConfirmedKey &&
        !pendingProximity
      ) {
        setBusy(false);
        setProximityChecking(true);
        const gate = await gateStoreProximity(hit);
        setProximityChecking(false);
        if (gate === "confirm") {
          setErr(null);
          return;
        }
      }
      if (pendingProximity) {
        setErr("Confirm the store below, or pick again.");
        return;
      }
    }

    const confirmedDespite =
      Boolean(proximityConfirmedKey) &&
      normalizePlace(addr) === proximityConfirmedKey;
    const identifyBody: Record<string, unknown> = needsEventDetails
      ? {
          firstName,
          lastName,
          phone,
          email,
          eventDate: date,
          ...(hasPrograms ? { eventTypeId } : {}),
          ...(onGig
            ? { planEventId: onGig.id }
            : !overrides && planGigAnswer === PLAN_GIG_NONE
              ? { planEventId: PLAN_GIG_NONE }
              : {}),
          ...(omitPlace
            ? {}
            : marketPicker
              ? { market: mkt }
              : {
                  storeName,
                  address: addr,
                  ...proximityIdentifyFields({
                    miles: proximityMiles,
                    confirmedDespiteDistance: confirmedDespite,
                  }),
                }),
        }
      : { firstName, lastName, phone, email };
    setBusy(true);
    try {
      const res = await fetch(`${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(identifyBody),
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
      const place = omitPlace || onGig
        ? String(json.event?.address || "").trim()
        : marketPicker
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
      if (readCachedContext(code)) {
        writePendingIdentify(code, identifyBody);
        setErr(IDENTIFY_OFFLINE_QUEUED);
      } else {
        setErr(IDENTIFY_OFFLINE_NO_CACHE);
      }
      setBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let inflight = false;
    const flush = () => {
      if (inflight) return;
      inflight = true;
      void flushPendingIdentify({ code, origin: apiOrigin() })
        .then((result) => {
          if (cancelled) return;
          if (result.status === "flushed" && result.sessionToken) {
            onDone(result.sessionToken);
          } else if (result.status === "rejected" && result.message) {
            setErr(result.message);
          }
        })
        .finally(() => {
          inflight = false;
        });
    };
    window.addEventListener("online", flush);
    flush();
    return () => {
      cancelled = true;
      window.removeEventListener("online", flush);
    };
  }, [code, onDone]);

  return (
    <div style={card}>
      <h2 style={h2}>{recapOnly ? "Your name" : "Who's working?"}</h2>
      <p style={{ color: "#44403c", fontSize: 13, opacity: 1, margin: "0 0 14px" }}>
        {recapOnly
          ? "Your name on this recap. Phone is optional."
          : "Tell us who you are so your lead can confirm your hours. Already clocked in? Use the same phone number to pick up your shift."}
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input style={{ ...input, flex: "1 1 140px" }} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input style={{ ...input, flex: "1 1 140px" }} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <input style={input} placeholder={recapOnly ? "Mobile phone (optional)" : "Mobile phone"} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input style={input} placeholder="Email (optional)" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />

      {openShift ? (
        <div
          role="status"
          style={{
            marginTop: 14,
            padding: "14px 16px",
            borderRadius: 14,
            border: `2px solid ${accent}`,
            background: "rgba(255,255,255,0.95)",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              margin: "0 0 4px",
              color: "#57534e",
            }}
          >
            You're on the clock
          </p>
          <p style={{ fontSize: 17, fontWeight: 800, margin: "0 0 2px", color: "#1c1917" }}>
            {openShift.clockInAt
              ? `Clocked in at ${fmtTime(openShift.clockInAt)}`
              : "Clocked in today"}
          </p>
          {openShift.address || openShift.name ? (
            <p style={{ fontSize: 13, margin: "0 0 12px", color: "#57534e" }}>
              {openShift.address || openShift.name}
            </p>
          ) : null}
          <button
            type="button"
            style={{ ...primaryBtn(accent), width: "100%" }}
            disabled={busy}
            onClick={() => void continueShift()}
          >
            {busy ? "Opening your shift…" : "Continue my shift"}
          </button>
          <p style={{ fontSize: 12, margin: "8px 0 0", color: "#78716c" }}>
            Your hours are saved. No need to clock in again.
          </p>
        </div>
      ) : null}

      {!openShift && needsEventDetails && hasPrograms ? (
        <>
          {/* Asked before the store, because this is the answer that picks the
              BA's recap form and their photo buckets — a retail demo and an
              activation want different fields and different shots. Same control
              as the market picker below so the page reads as one form. */}
          <div
            ref={pickerRef}
            tabIndex={-1}
            role="group"
            aria-labelledby="spark-checkin-program-title"
            aria-describedby={pickerMissing ? "spark-checkin-program-missing" : undefined}
            style={{
              margin: "22px -12px 0",
              padding: 10,
              borderRadius: 16,
              border: `2px solid ${pickerMissing ? "#EF5A2A" : "transparent"}`,
              background: pickerMissing ? "rgba(239,90,42,0.06)" : "transparent",
              outline: "none",
              transition: "border-color 160ms ease, background-color 160ms ease",
            }}
          >
          <h2 id="spark-checkin-program-title" style={h2}>{PROGRAM_STEP_TITLE}</h2>
          <p style={{ fontSize: 13, margin: "2px 0 14px", color: "#57534e" }}>
            <strong style={{ color: "#1c1917" }}>{programRequiredHint({ recapOnly })}</strong>{" "}
            This sets up the right recap for your shift.
          </p>
          {pickerMissing ? (
            <p
              id="spark-checkin-program-missing"
              role="alert"
              style={{ ...errText, fontWeight: 700, margin: "-6px 0 12px" }}
            >
              {programPickerPrompt(eventTypes, { recapOnly })}
            </p>
          ) : null}
          {eventTypesUseDescriptorPicker(eventTypes) ? (
            <div
              role="radiogroup"
              aria-label={pickerAriaLabel}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              {eventTypes.map((t) => {
                const selected = eventTypeId === t.id;
                const description = programDescription(t, { roaming: isMarket });
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => pickProgram(t.id)}
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
                      {programLabel(t)}
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
              aria-label={pickerAriaLabel}
              onChange={(e) => pickProgram(e.target.value)}
            >
              <option value="">Select your event type…</option>
              {eventTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {programLabel(t)}
                </option>
              ))}
            </select>
          )}
          </div>
        </>
      ) : null}

      {!openShift && needsEventDetails ? (
        <>
          <PlanGigPicker
            gigs={planGigs}
            value={planGigAnswer}
            onChange={pickPlanGig}
            accent={accent}
            missing={planGigMissing}
            eventDate={eventDate}
            today={todayISO()}
            pickerRef={planGigRef}
          />
          {pickedGig ? null : !skipWorkLocation ? (
            <>
          <h2 style={{ ...h2, marginTop: 22 }}>
            {hasPrograms ? "Step 2 · " : ""}
            {typedStore ? "Which store?" : atVenue ? "Where's the event?" : "Where are you working?"}
          </h2>

          {/* ROAMING crews pick a market. Their whole day lands on ONE event
              per market, and the individual spots get logged as stops while
              they work — far better data than a store address they'd have to
              pick before they know where they'll end up. */}
          {marketPicker ? (
            <>
              <p style={{ color: "#44403c", fontSize: 13, opacity: 1, margin: "0 0 14px" }}>
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
          ) : typedStore ? (
            <>
          <p style={{ color: "#44403c", fontSize: 13, opacity: 1, margin: "0 0 14px" }}>
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
          <p style={{ color: "#44403c", fontSize: 13, opacity: 1, margin: "0 0 14px" }}>
            {atVenue
              ? "Use the venue's address — anyone else working this event today lands on the same one."
              : "Type the store name or address. Picking it from the list keeps you on the same event as anyone else working there today."}
          </p>
          <input
            style={input}
            placeholder={atVenue ? "Event / venue name or address" : "Store name or address"}
            autoComplete="off"
            value={address}
            onChange={(e) => pickStore(e.target.value)}
            onFocus={() => setStoreSuggestField("address")}
            onBlur={() => {
              window.setTimeout(() => {
                setStoreSuggestField((cur) => (cur === "address" ? null : cur));
              }, 180);
            }}
          />
          {storeSuggestField === "address" ? (
            <CheckinStoreSuggestions hits={addressHits} onPick={chooseStore} />
          ) : null}
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
          <input
            style={input}
            placeholder={atVenue ? "Event or venue name (optional)" : "Store name (optional)"}
            autoComplete="off"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            onFocus={() => setStoreSuggestField("name")}
            onBlur={() => {
              window.setTimeout(() => {
                setStoreSuggestField((cur) => (cur === "name" ? null : cur));
              }, 180);
            }}
          />
          {storeSuggestField === "name" ? (
            <CheckinStoreSuggestions hits={nameHits} onPick={chooseStore} />
          ) : null}
          {proximityChecking ? (
            <p style={{ color: "#44403c", fontSize: 12, margin: "8px 0 0" }}>
              Checking how far that store is…
            </p>
          ) : null}
          {pendingProximity ? (
            <div
              role="alertdialog"
              aria-labelledby="store-proximity-title"
              style={{
                marginTop: 12,
                padding: "14px 14px 12px",
                borderRadius: 12,
                border: "1px solid rgba(239,90,42,0.45)",
                background: "rgba(239,90,42,0.06)",
              }}
            >
              <p
                id="store-proximity-title"
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#1c1917",
                  lineHeight: 1.4,
                }}
              >
                {proximityConfirmCopy({
                  miles: pendingProximity.miles,
                  storeLabel: pendingProximity.label,
                })}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#44403c", lineHeight: 1.4 }}>
                GPS put you somewhere else. Continue only if this is the right stop.
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={confirmPendingStore}
                  style={{
                    ...secondaryBtn,
                    borderColor: "rgba(239,90,42,0.55)",
                    color: "#c2410c",
                  }}
                >
                  Continue anyway
                </button>
                <button type="button" onClick={dismissPendingStore} style={secondaryBtn}>
                  Pick again
                </button>
              </div>
            </div>
          ) : null}
            </>
          )}
            </>
          ) : (
            <p style={{ color: "#44403c", fontSize: 13, opacity: 1, margin: "14px 0 0" }}>
              Drop-off location and mileage are on the Product Seeding recap —
              no store step here.
            </p>
          )}

          {unfiled.length > 0 && !recapOnly ? (
            <div style={{ margin: "14px 0 8px" }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 6px" }}>
                Still need a recap
              </p>
              <p style={{ color: "#44403c", fontSize: 12, opacity: 1, margin: "0 0 8px" }}>
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

          <label style={{ color: "#44403c", fontSize: 12, opacity: 1, display: "block", margin: "10px 0 4px" }}>
            {recapOnly ? "Date of this recap" : "Date you're working"}
          </label>
          <p style={{ color: "#44403c", fontSize: 12, opacity: 1, margin: "0 0 6px" }}>
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
            onChange={(e) => {
              const next = e.target.value;
              setEventDate(next);
              const today = todayISO();
              const cal = eventCalendarDate(next);
              if (cal && cal !== today) writeChosenShiftDate(code, { date: cal, chosenOn: today });
              else if (cal === today) clearChosenShiftDate(code);
            }}
          />
        </>
      ) : null}

      {err ? <p style={errText}>{err}</p> : null}
      {openShift ? null : (
        <button style={{ ...primaryBtn(accent), marginTop: 6 }} disabled={busy} onClick={() => void submit()}>
          {identifySubmitLabel({
            busy,
            recapOnly,
            needsProgram: needsEventDetails && hasPrograms && !eventTypeId,
          })}
        </button>
      )}
    </div>
  );
}
