import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useParams } from "react-router";
import { isExpenseReceiptBucket } from "./photoBuckets";
import { advisoryFromPhotoCheck, requestPhotoCheck, sha256Hex } from "./photoCheck";
import { applyVoiceFills, type VoiceFill } from "./voiceDraft";
import { VoiceRecapCard } from "./VoiceRecapCard";
import { matchingStores, storeNameForPicker, type StoreSuggestion } from "./storeSuggestions";
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
            width: 44,
            height: 44,
            minWidth: 44,
            minHeight: 44,
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
                  <span style={{ color: "#44403c", fontSize: 12.5, opacity: 1 }}>{r.note}</span>
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
  // One silent resume per page life; Start over suppresses it so the BA who
  // just asked for a fresh form isn't bounced straight back.
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

  // No live session but this phone remembers who they are: ask the server
  // whether that number is on the clock today and, if so, put them straight
  // back on the shift (any standing code — FF / LD / TH / BD / …). The API's
  // resumeOnly never starts a new check-in, so a miss just leaves identify.
  useEffect(() => {
    if (!ctx) return;
    if (resumeAttempted.current) return;

    const who = readIdentity(code);
    if (
      !canAttemptOpenPunchResume({
        mode: ctx.mode,
        recapOnly: ctx.recapOnly,
        hasLiveSession: Boolean(token && ctx.session),
        phone: who.phone,
      })
    ) {
      return;
    }

    resumeAttempted.current = true;
    let cancelled = false;
    void (async () => {
      const today = todayISO();
      const { openShift } = await lookupShiftsByPhone({
        origin: apiOrigin(),
        code,
        phone: who.phone,
        firstName: who.firstName,
        lastName: who.lastName,
        eventDate: today,
      });
      if (cancelled || !openShift) return;
      const json = await resumeOpenShift({
        origin: apiOrigin(),
        code,
        phone: who.phone,
        firstName: who.firstName,
        lastName: who.lastName,
        email: who.email,
        eventDate: openShift.eventDate || today,
      });
      if (cancelled || !json) return;
      const chosen = readChosenShiftDate(code);
      if (
        chosen &&
        chosen.chosenOn === today &&
        eventCalendarDate(chosen.date) !== today
      ) {
        return;
      }
      try {
        window.localStorage.setItem(storeKey, json.sessionToken);
      } catch {
        /* private mode */
      }
      writeIdentity(code, {
        ...who,
        ...(openShift.address.trim() ? { lastPlace: openShift.address.trim() } : {}),
      });
      setToken(json.sessionToken);
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
    resumeAttempted.current = true;
    try {
      window.localStorage.removeItem(storeKey);
      clearChosenShiftDate(code);
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
  const priorDaySession =
    identified &&
    ctx?.mode === "tenant" &&
    showNewDayGate({
      eventDate: ctx?.event?.date,
      today: todayISO(),
      chosen: readChosenShiftDate(code),
    });
  // True only while they chose to file the prior day's recap. Until then the
  // new-day gate is the page, so yesterday's event title stays off screen.
  const [priorRecapOpen, setPriorRecapOpen] = useState(false);
  useEffect(() => {
    if (!priorDaySession) setPriorRecapOpen(false);
  }, [priorDaySession]);

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

  const hidePriorEvent = Boolean(priorDaySession && !priorRecapOpen);

  return (
    <Shell brand={ctx.brand}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        {hidePriorEvent ? null : <Header ctx={ctx} />}
        {/* Sits directly under the header so it's present on the landing
            screen AND after clock-in — the BA asks "how do I pitch this?"
            at the table, not before they leave the house, and the
            photo-release QR is only ever needed with a consumer
            standing in front of them. On a new-day gate the clock-in
            button leads; guides sit under it. */}
        {hidePriorEvent ? null : (
          <ResourceButtons resources={checkinResources(ctx)} accent={accent} />
        )}
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
            programPickerTitle={ctx.programPickerTitle || ""}
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
            onPriorRecapOpen={setPriorRecapOpen}
          />
        )}
        {hidePriorEvent ? (
          <ResourceButtons resources={checkinResources(ctx)} accent={accent} />
        ) : null}
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
          <div style={{ color: "#44403c", fontSize: 13, opacity: 1 }}>
            {recapOnlyIntro({ hasPrograms: (ctx.eventTypes?.length ?? 0) > 1 })}
          </div>
        </div>
      );
    }
    return (
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 2px", lineHeight: 1.15 }}>Start your shift</h1>
        <div style={{ color: "#44403c", fontSize: 13, opacity: 1 }}>Clock in, work, then file your recap — all from this page.</div>
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
      <div style={{ color: "#44403c", fontSize: 13, opacity: 1 }}>
        {when}
        {when && window_ ? " · " : ""}
        {window_}
      </div>
      {ev.address ? <div style={{ color: "#44403c", fontSize: 13, opacity: 1, marginTop: 2 }}>{ev.address}</div> : null}
    </div>
  );
}

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
  const chooseStore = (hit: StoreSuggestion) => {
    setAddress(hit.address);
    const label = storeNameForPicker(hit);
    if (label) setStoreName(label);
    setStoreSuggestField(null);
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
              : { storeName, address: addr }),
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
  onPriorRecapOpen,
}: {
  code: string;
  token: string;
  ctx: Context;
  accent: string;
  clockState: Clock["state"];
  onStartAnother: () => void;
  hasRecap: boolean;
  onRefresh: () => Promise<void>;
  onPriorRecapOpen: (open: boolean) => void;
}) {
  const today = todayISO();
  // Prior calendar day restored from an earlier visit: the gate is the page
  // until they open that recap. A date picked on this visit is not leftover.
  const leftover =
    ctx.mode === "tenant" &&
    showNewDayGate({
      eventDate: ctx.event?.date,
      today,
      chosen: readChosenShiftDate(code),
    });
  const pastDay = isPastDayWalkupSession(ctx.event?.date, ctx.event?.startTime);
  // Second shift is Feel Free + same calendar day only. A prior-day session
  // never presents as a second shift, including while they finish that recap.
  const secondShiftOk = supportsStandingSecondShift({
    mode: ctx.mode,
    brand: ctx.brand,
    recapOnly: ctx.recapOnly,
    eventDate: ctx.event?.date,
    today,
  });
  const [busy, setBusy] = useState<"" | "in" | "out">("");
  const [inPhase, setInPhase] = useState<ActionPhase>("idle");
  // Recap-only first landing must still go through payable mileage when enabled
  // — jumping straight to RecapForm used to 400 with needs_payable_mileage.
  const bootRecapOnly = Boolean(ctx.recapOnly) && !hasRecap && !leftover;
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
  const [clearing, setClearing] = useState(false);
  const [queuedClock, setQueuedClock] = useState<PendingClockIn | null>(() =>
    readPendingClock(code),
  );
  const [queuedClockOut, setQueuedClockOut] = useState<PendingClockOut | null>(
    () => readPendingClockOut(code),
  );
  const [queuedRecap, setQueuedRecap] = useState<PendingRecap | null>(() =>
    readPendingRecap(code),
  );
  const [queuedMileage, setQueuedMileage] = useState<PendingMileage | null>(() =>
    readPendingMileage(code),
  );
  // Local draft (typed answers) — same phone, same session token. Lets the
  // clocked-in CTA say Continue instead of File when they already started.
  const [draftWaiting, setDraftWaiting] = useState(
    () => hasRecapDraft(code, token) || draftHasAnswers(ctx.session?.recapDraft),
  );
  useEffect(() => {
    setDraftWaiting(
      hasRecapDraft(code, token) || draftHasAnswers(ctx.session?.recapDraft),
    );
  }, [code, token, showRecap, ctx.session?.recapDraft]);
  // The phone reloaded the page while the recap was open (usually the camera
  // — see photoDraft.ts): put the BA back in it, photos and all. A "File
  // another" form isn't reopened as an edit of the filed recap; it waits
  // behind its button, draft intact.
  useEffect(() => {
    if (showRecap || showMileageStep) return;
    // A restored prior-day shift must not reopen yesterday's report. The gate leads.
    // A date picked this visit is not that case — its recap should reopen.
    if (leftover) return;
    const open = readOpenRecap(code, token);
    if (open === "existing" || (open === "new" && ctx.recapOnly)) openRecap(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    onPriorRecapOpen(showRecap || showMileageStep);
  }, [onPriorRecapOpen, showMileageStep, showRecap]);
  useEffect(() => {
    writeOpenRecap(code, token, showRecap ? (recapAsNew ? "new" : "existing") : null);
  }, [code, token, showRecap, recapAsNew]);
  // A queued clock-in is the shift they already started. Treat it as on the
  // clock so they can fill the recap offline instead of staring at Clock in.
  const effectiveClock: Clock["state"] =
    queuedClock && clockState === "not_started"
      ? "clocked_in"
      : queuedClockOut && clockState === "clocked_in"
        ? "clocked_out"
        : clockState;
  const clockInAt = queuedClock?.clockedInAt ?? ctx.session?.clock.clockInAt ?? null;

  const shiftActionsRef = useRef<HTMLDivElement | null>(null);
  const [shiftActionsAway, setShiftActionsAway] = useState(false);
  useEffect(() => {
    const node = shiftActionsRef.current;
    if (!node) {
      setShiftActionsAway(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setShiftActionsAway(entry ? !entry.isIntersecting : false),
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [showRecap, showMileageStep, leftover, effectiveClock, hasRecap, pastDay, secondShiftOk]);

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

  const queueOfflineOut = (
    coords: { latitude?: number; longitude?: number },
    tappedAt: string,
  ) => {
    const row = enqueueClockOut({
      code,
      token,
      clockedOutAt: tappedAt,
      ...coords,
    });
    setQueuedClockOut(row);
    setMsg(offlineClockOutBanner(row.clockedOutAt));
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

  const tryFlushClockOut = useCallback(async () => {
    const result = await flushPendingClockOut({
      code,
      postClock: async (body) => {
        const res = await post("clock", body);
        let alreadyOut = false;
        try {
          const json = (await res.clone().json()) as {
            alreadyOut?: boolean;
            clock?: Clock;
          };
          alreadyOut = Boolean(json.alreadyOut);
        } catch {
          /* body may be empty on a gateway error */
        }
        return { ok: res.ok, status: res.status, alreadyOut };
      },
    });
    if (result === "flushed" || result === "already") {
      setQueuedClockOut(readPendingClockOut(code));
      await onRefresh();
    }
    return result;
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
    if (!queuedClock && !queuedClockOut && !queuedRecap && !queuedMileage) return;
    const run = () => {
      void (async () => {
        if (queuedClock) await tryFlushPending();
        if (queuedClockOut) await tryFlushClockOut();
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
    queuedClockOut,
    queuedRecap,
    queuedMileage,
    tryFlushPending,
    tryFlushClockOut,
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
    if (kind === "in" && queuedClockOut) {
      clearPendingClockOut(code);
      setQueuedClockOut(null);
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
        const useQueuedOut = kind === "out" && queuedClockOut;
        const res = await post("clock", {
          kind,
          ...coords,
          ...(kind === "in"
            ? {
                clockedInAt: useQueued ? queuedClock.clockedInAt : tappedAt,
                ...(useQueued ? { idempotencyKey: queuedClock.id } : {}),
              }
            : {
                clockedOutAt: useQueuedOut ? queuedClockOut.clockedOutAt : tappedAt,
                occurredAt: useQueuedOut ? queuedClockOut.clockedOutAt : tappedAt,
                ...(useQueuedOut ? { idempotencyKey: queuedClockOut.id } : {}),
              }),
        });
        let json: { message?: string; alreadyIn?: boolean; alreadyOut?: boolean; clock?: Clock } = {};
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
          if (kind === "out" && isOfflineClockFailure({ status: res.status })) {
            queueOfflineOut(coords, tappedAt);
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
        if (kind === "out") {
          clearPendingClockOut(code);
          setQueuedClockOut(null);
        }
        await onRefresh();
      } catch (error) {
        if (kind === "in" && isOfflineClockFailure({ error })) {
          setInPhase("success");
          await holdActionSuccess();
          queueOfflineIn(coords, tappedAt);
          return;
        }
        if (kind === "out" && isOfflineClockFailure({ error })) {
          queueOfflineOut(coords, tappedAt);
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
        onBack={() => {
          setShowMileageStep(false);
          if (leftover) setShowRecap(false);
        }}
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
        coBrands={ctx.coBrands ?? null}
        photoBuckets={ctx.photoBuckets}
        storeIdentity={ctx.storeIdentity ?? null}
        accent={accent}
        brandName={ctx.brand.name || ""}
        eventDate={ctx.event?.date}
        forceNew={(recapAsNew || Boolean(ctx.recapOnly && hasRecap)) && ctx.mode === "tenant"}
        serverDraft={
          (recapAsNew || Boolean(ctx.recapOnly && hasRecap)) && ctx.mode === "tenant"
            ? (ctx.session?.additionalRecapDraft ?? null)
            : (ctx.session?.recapDraft ?? null)
        }
        payableMiles={
          confirmedPayableMiles ??
          (recapAsNew ? null : activePayable?.claim?.payableMiles) ??
          null
        }
        onCancel={() => {
          if (leftover) {
            setShowMileageStep(false);
            setShowRecap(false);
            return;
          }
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

  if (leftover) {
    const offerFinish = offerFinishPriorRecap({
      hasRecap,
      clockState: effectiveClock,
      recapOnly: ctx.recapOnly,
      hasUnsubmittedWork: draftWaiting || Boolean(queuedRecap),
    });
    const finishLabel = finishPriorRecapLabel(ctx.event?.date);
    return (
      <div style={card}>
        <div
          style={{
            color: "#44403c",
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            opacity: 1,
          }}
        >
          Today
        </div>
        <button
          type="button"
          style={{
            ...primaryBtn(accent),
            width: "100%",
            flex: "none",
            marginTop: 14,
            minHeight: 56,
            padding: "16px 18px",
            fontSize: 18,
          }}
          disabled={clearing || busy !== ""}
          onClick={() => void clearClockIn()}
        >
          {clearing ? LEFTOVER_PRIMARY_BUSY : newDayPrimaryLabel(today, ctx.recapOnly)}
        </button>
        {offerFinish ? (
          <button
            type="button"
            style={{
              ...secondaryBtn,
              width: "100%",
              flex: "none",
              marginTop: 10,
              minHeight: 40,
              padding: "8px 12px",
              fontSize: 14,
            }}
            disabled={clearing}
            onClick={() => openRecap(false)}
          >
            {finishLabel}
          </button>
        ) : null}
        {msg ? <p style={errText}>{msg}</p> : null}
      </div>
    );
  }

  if (hasRecap && clockState !== "clocked_in" && !leftover) {
    return (
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 6 }}>✓</div>
        <h2 style={{ ...h2, marginBottom: 6 }}>You're all set</h2>
        <p style={{ color: "#44403c", fontSize: 14, opacity: 1 }}>
          Your recap is in{pending ? " and is pending your lead's confirmation" : ""}. Thanks for the great work!
        </p>
        {ctx.event?.date ? (
          <p style={{ color: "#44403c", fontSize: 13, opacity: 1, marginTop: 8 }}>
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
                <p style={{ color: "#44403c", fontSize: 13, opacity: 1, margin: "0 0 12px" }}>
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
                {!ctx.recapOnly && !pastDay ? (
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
                    ...(ctx.recapOnly || pastDay ? primaryBtn(accent) : secondaryBtn),
                    marginTop: ctx.recapOnly || pastDay ? 18 : 10,
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

  const renderShiftActions = (compact: boolean) => {
    const fit = (base: CSSProperties): CSSProperties =>
      compact
        ? { ...base, flex: 1, minHeight: 44, padding: "10px 12px", fontSize: 14 }
        : base;
    return (
      <>
          {effectiveClock === "not_started" && !leftover && pastDay ? (
            <button style={fit(primaryBtn(accent))} onClick={() => openRecap(false)}>
              {queuedRecap
                ? "Edit saved recap"
                : draftWaiting
                  ? "Continue your recap"
                  : "File recap"}
            </button>
          ) : null}
          {effectiveClock === "not_started" && !leftover && !pastDay ? (
            <ActionMorphButton
              style={fit(primaryBtn(accent))}
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
              <button style={fit(primaryBtn(accent))} onClick={() => openRecap(false)}>
                {queuedRecap
                  ? "Edit saved recap"
                  : draftWaiting
                    ? "Continue your recap"
                    : "File recap"}
              </button>
              <button style={fit(secondaryBtn)} disabled={busy !== ""} onClick={() => clock("out")}>
                {busy === "out" ? "Clocking out…" : "Clock out"}
              </button>
            </>
          ) : null}

          {effectiveClock === "clocked_in" && hasRecap ? (
            <>
              <button style={fit(primaryBtn(accent))} disabled={busy !== ""} onClick={() => clock("out")}>
                {busy === "out" ? "Clocking out…" : "Clock out"}
              </button>
              <button style={fit(secondaryBtn)} onClick={() => openRecap(false)}>
                Edit recap
              </button>
              {secondShiftOk ? (
                <button style={fit(secondaryBtn)} onClick={() => openRecap(true)}>
                  File {SECOND_SHIFT_LABEL.toLowerCase()}
                </button>
              ) : ctx.mode === "tenant" ? (
                <button style={fit(secondaryBtn)} onClick={() => openRecap(true)}>
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
              {ctx.mode === "tenant" && !ctx.recapOnly && !leftover && !pastDay ? (
                <button style={fit(primaryBtn(accent))} disabled={busy !== ""} onClick={() => clock("in")}>
                  {busy === "in" ? "Clocking in…" : "Clock in"}
                </button>
              ) : null}
              <button style={fit(secondaryBtn)} onClick={() => openRecap(false)}>
                {draftWaiting ? "Continue your recap" : "File recap"}
              </button>
            </>
          ) : null}
      </>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        paddingBottom: shiftActionsAway
          ? "calc(72px + env(safe-area-inset-bottom, 0px))"
          : 0,
      }}
    >
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ color: "#44403c", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 1 }}>
              Time clock
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
              {effectiveClock === "clocked_in"
                ? hasRecap
                  ? "On the clock · ready to clock out"
                  : "On the clock · recap still open"
                : effectiveClock === "clocked_out"
                  ? "Clocked out"
                  : "Not started"}
            </div>
            {ctx.event?.date ? (
              <div style={{ color: "#44403c", fontSize: 12, opacity: 1, marginTop: 2 }}>
                {fmtDay(ctx.event.date)}
                {ctx.event.address ? ` · ${ctx.event.address}` : ""}
              </div>
            ) : null}
            {clockInAt ? (
              <div style={{ color: "#44403c", fontSize: 12, opacity: 1, marginTop: 2 }}>
                In {fmtTime(clockInAt)}
                {ctx.session?.clock.clockOutAt ? ` · Out ${fmtTime(ctx.session.clock.clockOutAt)}` : ""}
                {queuedClock ? " · saved on this device" : ""}
                {queuedClockOut && !ctx.session?.clock.clockOutAt
                  ? ` · Out ${fmtTime(queuedClockOut.clockedOutAt)} saved on this device`
                  : ""}
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
        <div ref={shiftActionsRef} style={{ display: "flex", gap: 10, marginTop: 14 }}>
          {renderShiftActions(false)}
        </div>
        {queuedClock ? (
          <p style={{ ...errText, color: "#92400e" }}>
            {offlineClockBanner(queuedClock.clockedInAt)}
          </p>
        ) : null}
        {queuedClockOut ? (
          <p style={{ ...errText, color: "#92400e" }}>
            {offlineClockOutBanner(queuedClockOut.clockedOutAt)}
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
        {msg && !queuedClock && !queuedClockOut && !queuedMileage && !queuedRecap ? (
          <p style={errText}>{msg}</p>
        ) : null}
      </div>

      {/* Another gig — deliberately outside the Time Clock card so it cannot
          be mistaken for an action on this shift. Same start-another flow as
          before; Clock in / File recap above stay with the current shift. */}
      {effectiveClock === "clocked_out" && !hasRecap && ctx.mode === "tenant" && !leftover ? (
        <div>
          <p style={{ color: "#44403c", fontSize: 13, opacity: 1, margin: "0 0 8px", textAlign: "center" }}>
            {CHECK_IN_ANOTHER_GIG_HINT}
          </p>
          <button
            style={{
              ...secondaryBtn,
              width: "100%",
              flex: "none",
              minHeight: 56,
              padding: "16px 18px",
              fontSize: 16,
              fontWeight: 700,
              background: "#fff",
            }}
            onClick={() => onStartAnother()}
          >
            {CHECK_IN_SOMEWHERE_ELSE}
          </button>
        </div>
      ) : null}

      {/* Same-day wrong store / new shift. A new calendar day uses the gate
          above instead of this link. */}
      {ctx.mode === "tenant" && !leftover && (clockState === "clocked_in" || clockState === "not_started") ? (
        <button
          onClick={() => onStartAnother()}
          style={{
            background: "none",
            border: "none",
            padding: "8px 4px",
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.35,
            color: accent,
            textDecoration: "underline",
            textUnderlineOffset: 3,
            cursor: "pointer",
            alignSelf: "center",
            textAlign: "center",
            maxWidth: "100%",
          }}
        >
          {START_OVER_LINK}
        </button>
      ) : null}

      {/* Where they sampled. Roaming / market crews only (Feel Free). Torch
          stays on the store they clocked into — no second stop card. */}
      {showStopCard ? (
        <div style={card}>
          <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
            Log your stop
          </p>
          <p style={{ color: "#44403c", fontSize: 12, opacity: 1, margin: "4px 0 10px" }}>
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

          <p style={{ color: "#44403c", fontSize: 12, opacity: 1, marginTop: 8 }}>
            {mileage.active
              ? "Tap Stop when you park. We measure the driving distance between where you started and where you stopped."
              : "Tap Start before you pull away, Stop when you park. Log each leg separately."}
          </p>
        </div>
      ) : null}

      {effectiveClock === "not_started" ? (
        <p style={{ color: "#44403c", fontSize: 13, opacity: 1, textAlign: "center" }}>
          {pastDay ? PAST_DAY_NO_CLOCK : "Clock in when you arrive to start your shift."}
        </p>
      ) : null}
      {effectiveClock === "clocked_in" && !hasRecap ? (
        <p style={{ color: "#44403c", fontSize: 13, opacity: 1, textAlign: "center" }}>
          {draftWaiting
            ? "Next: continue your recap. Answers stay on this phone — reopen this check-in link if you leave."
            : "Next: file your recap while you're still on site. If it won't go through, clock out anyway — you can come back and file it after."}
        </p>
      ) : null}
      {effectiveClock === "clocked_in" && hasRecap ? (
        <p style={{ color: "#44403c", fontSize: 13, opacity: 1, textAlign: "center" }}>
          Next: clock out to finish your shift.
        </p>
      ) : null}
      {shiftActionsAway ? (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            padding: "10px 20px calc(10px + env(safe-area-inset-bottom, 0px))",
            background: "linear-gradient(180deg, rgba(250,247,241,0), #faf7f1 36%)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 560,
              display: "flex",
              gap: 8,
              pointerEvents: "auto",
            }}
          >
            {renderShiftActions(true)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Recap form (renders the full custom template) ───────────────────────────
function RecapForm({
  code,
  token,
  template,
  coBrands = null,
  photoBuckets,
  storeIdentity = null,
  accent,
  brandName,
  eventDate,
  forceNew = false,
  shiftLabel,
  payableMiles = null,
  serverDraft = null,
  onCancel,
  onSubmitted,
  onQueued,
}: {
  code: string;
  token: string;
  template: Template | null;
  coBrands?: CoBrandOptions | null;
  photoBuckets?: PhotoBucket[];
  storeIdentity?: StoreIdentity | null;
  accent: string;
  brandName: string;
  eventDate?: string | null;
  forceNew?: boolean;
  shiftLabel?: string;
  /** When set, pre-fills the Mileage field from the itinerary (editable for detours). */
  payableMiles?: number | null;
  /** Server copy for this scope. A cleared browser restores from here. */
  serverDraft?: RecapDraft | null;
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
  const draftScope: DraftScope = forceNew ? "additional" : "shift";
  const restored = useRef<RecapDraft | null>(
    pickRestoredDraft(readDraft(code, token, draftScope), asRecapDraft(serverDraft)),
  );

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
  const [usedCorpoCard, setUsedCorpoCard] = useState<boolean | null>(
    () =>
      restored.current?.usedCorpoCard === true ||
      restored.current?.usedCorpoCard === false
        ? restored.current.usedCorpoCard
        : null,
  );
  const [store, setStore] = useState<StoreIdentityDraft>(
    () =>
      restored.current?.store ?? {
        name: storeIdentity?.name ?? "",
        number: storeIdentity?.number ?? "",
        noNumber: false,
      },
  );
  const [savedAt, setSavedAt] = useState<number | null>(
    () => restored.current?.savedAt ?? null,
  );
  const coBrand = useCoBrandRecap(coBrands, restored.current?.coBrands ?? null);
  const perBrandSections = useMemo(
    () => new Set((template?.coBrandSections ?? []).map((n) => n.trim().toLowerCase())),
    [template],
  );
  const [busy, setBusy] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<ActionPhase>("idle");
  const [err, setErr] = useState<string | null>(null);
  const libraryRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const photoSeq = useRef(0);
  const photosRestored = useRef(false);
  const [photoWarnings, setPhotoWarnings] = useState<
    Record<string, PhotoQualityWarning & { name: string }>
  >({});
  const photoHashes = useRef(new Map<string, string>());
  // Deferred (post-upload) SHA-256 digests, keyed by photo id. The digest
  // used to be awaited before the PUT could start; now it lands when it
  // lands and submit merges it from this ref.
  const shaByPhotoId = useRef(new Map<string, string>());
  const shaPending = useRef(new Map<string, Promise<void>>());
  const shaOf = (p: Photo): string | undefined =>
    p.sha256 ?? shaByPhotoId.current.get(p.id);

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
  const uploadProgress = computeUploadProgress(photos);
  const failedCount = photos.filter((p) => p.state === "failed").length;
  const doneCount = photos.filter((p) => p.state === "done").length;
  // Store Wi-Fi / one bar keeps navigator.onLine true while every request
  // stalls, so all-photos-timed-out counts as offline and queues the recap.
  const allFailedOffline =
    failedCount > 0 &&
    photos.every((p) => p.state === "failed" && p.failedOffline);

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

  // Set once the recap is filed, so a late upload can't write a fresh draft
  // for a recap that's already in.
  const submittedRef = useRef(false);
  const leaveBehindArmed = useRef(false);

  const persistDraft = useCallback(
    (keepalive = false) => {
      if (submittedRef.current) return;
      const snapshot: Omit<RecapDraft, "v" | "savedAt"> = {
        values,
        samples,
        engagements,
        usedCorpoCard,
        ...(storeIdentity ? { store } : {}),
        ...(coBrands
          ? {
              coBrands: {
                enabled: coBrand.enabled,
                selected: coBrand.selected,
                values: coBrand.values,
                samples: coBrand.samples,
              },
            }
          : {}),
      };
      if (photosRestored.current) {
        snapshot.photos = photosRef.current
          .filter((p) => !p.unrecoverable)
          .map(draftPhotoOf);
      }
      const at = writeDraft(code, token, snapshot, draftScope);
      if (at) setSavedAt(at);
      const saved = readDraft(code, token, draftScope);
      if (!saved) return;
      const req = buildRecapDraftRequest({
        code,
        session: token,
        scope: draftScope,
        draft: photosRestored.current ? saved : { ...saved, photos: undefined },
      });
      if (!photosRestored.current) {
        delete (req.body.draft as { photos?: unknown }).photos;
      }
      void fetch(`${apiOrigin()}${req.path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
        keepalive,
      }).catch(() => {
        /* the device copy already landed */
      });
    },
    [
      code,
      token,
      draftScope,
      values,
      samples,
      engagements,
      usedCorpoCard,
      storeIdentity,
      store,
      coBrands,
      coBrand.enabled,
      coBrand.selected,
      coBrand.values,
      coBrand.samples,
      photos,
    ],
  );

  useEffect(() => {
    const t = window.setTimeout(() => persistDraft(false), 500);
    return () => window.clearTimeout(t);
  }, [persistDraft]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") persistDraft(true);
    };
    const onHide = () => persistDraft(true);
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", onHide);
    };
  }, [persistDraft]);
  const retryTimers = useRef(new Map<string, number>());
  const autoRetriesUsed = useRef(new Map<string, number>());
  useEffect(() => {
    const timers = retryTimers.current;
    return () => {
      for (const t of timers.values()) window.clearTimeout(t);
    };
  }, []);
  const cancelAutoRetry = (id: string) => {
    const t = retryTimers.current.get(id);
    if (t) window.clearTimeout(t);
    retryTimers.current.delete(id);
  };

  const patchPhoto = (id: string, patch: Partial<Photo>) =>
    setPhotos((p) => p.map((ph) => (ph.id === id ? { ...ph, ...patch } : ph)));

  const keepPhotoCheck = (id: string) => {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === id && photo.check ? { ...photo, check: { ...photo.check, dismissed: true } } : photo,
      ),
    );
  };

  // Classify after the compressed copy exists. The upload is not waiting on this.
  const runPhotoCheck = (id: string, file: File) => {
    if (!token || !file.type.startsWith("image/")) return;
    const category = photosRef.current.find((photo) => photo.id === id)?.category ?? null;
    const bucketName = (photoBuckets ?? []).find((bucket) => bucket.id === category)?.name ?? null;
    void requestPhotoCheck({
      origin: apiOrigin(),
      code,
      session: token,
      file,
      contentType: file.type || "image/jpeg",
      category,
    }).then((result) => {
      if (!photosRef.current.some((photo) => photo.id === id)) return;
      const advisory = advisoryFromPhotoCheck(result, bucketName);
      patchPhoto(id, {
        check: {
          kind: advisory.kind,
          message: advisory.message,
          dismissed: false,
        },
      });
    });
  };

  // Advisory work that must never delay the PUT: SHA-256 (full-file digest),
  // the tile thumbnail, and the server photo check. All of it runs after the
  // upload has landed and patches the photo when it finishes — warnings and
  // digests merge in whenever they arrive, and nothing here can reject.
  const runDeferredPhotoChecks = (id: string, file: File) => {
    if (!file.type.startsWith("image/") || submittedRef.current) return;
    if (!photosRef.current.some((ph) => ph.id === id)) return;
    const shaTask = (async () => {
      const digest = await sha256Hex(file).catch(() => "");
      if (!digest) return;
      shaByPhotoId.current.set(id, digest);
      patchPhoto(id, { sha256: digest });
    })();
    shaPending.current.set(id, shaTask);
    void shaTask.finally(() => {
      if (shaPending.current.get(id) === shaTask) shaPending.current.delete(id);
    });
    void (async () => {
      const thumb = await makeThumbnail(file).catch(() => null);
      if (!thumb || thumb === file) return;
      if (!photosRef.current.some((ph) => ph.id === id)) return;
      setPhotos((p) =>
        p.map((ph) => {
          if (ph.id !== id) return ph;
          if (ph.previewUrl) URL.revokeObjectURL(ph.previewUrl);
          return { ...ph, previewUrl: URL.createObjectURL(thumb) };
        }),
      );
      if (!submittedRef.current) void saveDraftPhotoFile(code, token, id, thumb);
    })();
    runPhotoCheck(id, file);
  };

  // Compress once — a raw iPhone shot is 3-5MB and a BA may file dozens from a
  // parking lot on LTE. The compressed copy becomes the photo's file (retries
  // reuse it) and is what's kept on the device for a reload; the original
  // never goes to IndexedDB, it's the big write a killed tab leaves half-done.
  // Only compression stays on the critical path (the PUT needs those bytes);
  // digest / thumbnail / photo-check moved to runDeferredPhotoChecks.
  const prepareOne = (id: string, original: File) =>
    photoPrep(async () => {
      const file = await compressImage(original);
      setPhotos((p) =>
        p.map((ph) => (ph.id === id ? { ...ph, file, prepared: true } : ph)),
      );
      if (file.type.startsWith("image/") && !submittedRef.current) {
        void saveDraftPhotoFile(code, token, id, file);
      }
      return { file };
    });

  // Upload one photo, keyed by its stable id.
  const uploadOne = async (id: string, original: File, alreadyPrepared = false) => {
    try {
      if (!(await fileIsReadable(original))) {
        cancelAutoRetry(id);
        patchPhoto(id, {
          state: "failed",
          failReason: UNREADABLE_PHOTO_MESSAGE,
          failedOffline: false,
          unrecoverable: true,
          autoRetry: false,
        });
        void deleteDraftPhotoFiles(code, token, [id]);
        return;
      }
      const { file } = alreadyPrepared
        ? { file: original }
        : await prepareOne(id, original);
      const uploaded = await photoUploads(async () =>
        // Removed while it waited for a slot — don't spend the upload.
        photosRef.current.some((ph) => ph.id === id)
          ? putCheckinPhoto({ code, token, file, apiOrigin: apiOrigin() })
          : null,
      );
      if (!uploaded) return;
      autoRetriesUsed.current.delete(id);
      patchPhoto(id, {
        file,
        blobName: uploaded.blobName,
        state: "done",
        failReason: null,
        failedOffline: false,
        autoRetry: false,
      });
      // Uploaded: a reload only needs the blob name and a preview now.
      // Digest / thumbnail / advisory check run from here, off the upload
      // path — the tile is already "done" before any of them start.
      if (photosRef.current.some((ph) => ph.id === id) && !submittedRef.current) {
        if (file.type.startsWith("image/")) runDeferredPhotoChecks(id, file);
        else void deleteDraftPhotoFiles(code, token, [id]);
      }
    } catch (error) {
      const failedOffline = isOfflineClockFailure({ error });
      const failReason = failedOffline
        ? NO_SIGNAL_PHOTO_MESSAGE
        : error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Upload failed — tap Retry.";
      const autoRetry =
        retryableUploadFailure(failedOffline, failReason) && scheduleAutoRetry(id);
      patchPhoto(id, { state: "failed", failReason, failedOffline, autoRetry });
    }
  };

  const scheduleAutoRetry = (id: string): boolean => {
    if (submittedRef.current) return false;
    const used = autoRetriesUsed.current.get(id) ?? 0;
    if (used >= AUTO_RETRY_DELAYS_MS.length) return false;
    autoRetriesUsed.current.set(id, used + 1);
    cancelAutoRetry(id);
    const timer = window.setTimeout(() => {
      retryTimers.current.delete(id);
      const ph = photosRef.current.find((p) => p.id === id);
      if (!ph || ph.state !== "failed" || ph.unrecoverable || submittedRef.current) return;
      patchPhoto(id, { state: "uploading", autoRetry: false });
      void uploadOne(id, ph.file, Boolean(ph.prepared));
    }, AUTO_RETRY_DELAYS_MS[used]);
    retryTimers.current.set(id, timer);
    return true;
  };

  // Advisory only: warn while the BA is still on site, never block the upload.
  // Runs concurrently per photo (it used to walk the batch one photo at a
  // time) and is launched after the uploads, so its CPU never delays a PUT.
  // Duplicate resolution stays deterministic: hashes may land in any order,
  // but the earliest photo in pick order keeps the hash and later copies warn.
  const assessPhotos = async (batch: Photo[]) => {
    const targets = batch.filter(
      (ph) => !ph.file.type.startsWith("video/") && ph.file.size > 0,
    );
    const hashed = await Promise.all(
      targets.map(async (ph) => {
        try {
          return { ph, hash: await quickPhotoHash(ph.file) };
        } catch {
          return { ph, hash: null as string | null };
        }
      }),
    );
    const duplicates = new Set<string>();
    for (const { ph, hash } of hashed) {
      if (!hash) continue;
      const prior = photoHashes.current.get(hash);
      if (prior && prior !== ph.id) {
        duplicates.add(ph.id);
        if (photosRef.current.some((p) => p.id === ph.id)) {
          setPhotoWarnings((prev) => ({
            ...prev,
            [ph.id]: {
              photoId: ph.id,
              kind: "duplicate" as const,
              message: qualityMessage("duplicate"),
              name: ph.file.name,
            },
          }));
        }
      } else {
        photoHashes.current.set(hash, ph.id);
      }
    }
    await Promise.all(
      targets
        .filter((ph) => !duplicates.has(ph.id))
        .map(async (ph) => {
          try {
            const stats = await analyzePhotoFile(ph.file);
            const kind = stats ? classifyPhotoQuality(stats) : null;
            if (kind && photosRef.current.some((p) => p.id === ph.id)) {
              setPhotoWarnings((prev) => ({
                ...prev,
                [ph.id]: {
                  photoId: ph.id,
                  kind,
                  message: qualityMessage(kind),
                  name: ph.file.name,
                },
              }));
            }
          } catch {
            /* advisory only — a failed check is no warning, never an error */
          }
        }),
    );
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
    // Uploads start first; quality/duplicate assessment runs alongside and
    // merges its warnings in as they land.
    const uploads = batch.map((ph) => uploadOne(ph.id, ph.file));
    void assessPhotos(batch);
    await Promise.all(uploads);
  };

  // Put back what the last page life had — "Take photo" often costs the page
  // (see photoDraft.ts). Unfinished uploads resume from the saved bytes.
  // Blob names already on the server draft come back too, without replacing
  // the on-device bytes.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await loadDraftPhotos(code, token);
      if (cancelled) return;
      photosRestored.current = true;
      const have = new Set(photosRef.current.map((p) => p.id));
      const fromDevice: Photo[] = saved
        .filter(({ photo }) => !have.has(photo.id))
        .map(({ photo, file }): Photo => ({
          id: photo.id,
          file: file ?? new File([], photo.name || "photo.jpg", { type: photo.type || "image/jpeg" }),
          blobName: photo.blobName,
          previewUrl: file ? URL.createObjectURL(file) : "",
          state: photo.blobName ? "done" : "uploading",
          category: photo.category,
          ...(photo.sha256 ? { sha256: photo.sha256 } : {}),
        }));
      const seen = new Set([...have, ...fromDevice.map((p) => p.id)]);
      const fromServer: Photo[] = (restored.current?.photos ?? [])
        .filter((photo) => photo.blobName && !seen.has(photo.id))
        .map((photo): Photo => ({
          id: photo.id,
          file: new File([], photo.name || "photo.jpg", { type: photo.type || "image/jpeg" }),
          blobName: photo.blobName,
          previewUrl: "",
          state: "done",
          category: photo.category,
          ...(photo.sha256 ? { sha256: photo.sha256 } : {}),
        }));
      const back = [...fromDevice, ...fromServer];
      photosRef.current = [...back, ...photosRef.current];
      setPhotos(photosRef.current);
      writeDraftPhotos(code, token, photosRef.current.filter((p) => !p.unrecoverable).map(draftPhotoOf));
      await Promise.all(
        back.filter((p) => p.state === "uploading").map((ph) => uploadOne(ph.id, ph.file)),
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, token]);

  useEffect(() => {
    if (!photosRestored.current || submittedRef.current) return;
    writeDraftPhotos(code, token, photos.filter((p) => !p.unrecoverable).map(draftPhotoOf));
  }, [code, token, photos]);

  const retryFailed = async () => {
    const stuck = photosRef.current.filter((p) => p.state === "failed" && !p.unrecoverable);
    if (!stuck.length) return;
    setErr(null);
    const ids = new Set(stuck.map((p) => p.id));
    for (const id of ids) {
      cancelAutoRetry(id);
      autoRetriesUsed.current.delete(id);
    }
    setPhotos((p) =>
      p.map((ph) => (ids.has(ph.id) ? { ...ph, state: "uploading", autoRetry: false } : ph)),
    );
    await Promise.all(stuck.map((ph) => uploadOne(ph.id, ph.file, Boolean(ph.prepared))));
  };

  const removeFailed = () => {
    const failed = photosRef.current.filter((p) => p.state === "failed");
    if (!failed.length) return;
    for (const ph of failed) cancelAutoRetry(ph.id);
    const next = photosRef.current.filter((p) => p.state !== "failed");
    photosRef.current = next;
    setPhotos(next);
    void deleteDraftPhotoFiles(code, token, failed.map((p) => p.id));
  };

  // Keyed by id, never by index. Each bucket renders its OWN filtered slice, so
  // position 0 of a bucket is some arbitrary position in `photos` — the same
  // index-vs-id confusion that once wrote every upload result into one slot.
  const removePhoto = (id: string) => {
    const next = photosRef.current.filter((ph) => ph.id !== id);
    photosRef.current = next;
    setPhotos(next);
    cancelAutoRetry(id);
    setPhotoWarnings((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    for (const [hash, owner] of photoHashes.current) {
      if (owner === id) photoHashes.current.delete(hash);
    }
    shaByPhotoId.current.delete(id);
    shaPending.current.delete(id);
    void deleteDraftPhotoFiles(code, token, [id]);
  };

  const submit = async () => {
    setErr(null);
    const storeName = store.name.trim();
    const storeNumber = store.noNumber ? "" : store.number.trim().replace(/^#\s*/, "");
    if (storeIdentity) {
      if (!storeName) return setErr("Enter the store name.");
      if (!storeNumber && !store.noNumber) {
        return setErr("Enter the store number, or tick \"No store number\".");
      }
    }
    const storeFields = storeIdentity ? { storeName, storeNumber } : {};
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
        if (!f.required || isPhotoType(f.type) || !isFieldShown(f, valuesForSubmit)) continue;
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
    // Dollar spend fields: 2489 (no period) is rejected, not treated as
    // two thousand. 24.89 / 24.8 / 2489.00 store as a numeric dollar string.
    for (const s of template?.sections ?? []) {
      for (const f of s.fields) {
        if (isPhotoType(f.type) || !isSpendAmountField(f)) continue;
        const v = valuesForSubmit[f.id];
        const raw = Array.isArray(v) ? "" : String(v ?? "");
        const spendErr = spendAmountError(raw);
        if (spendErr) return setErr(`${f.name}: ${spendErr}`);
        const stored = spendAmountStored(raw);
        if (stored != null) valuesForSubmit[f.id] = stored;
      }
    }
    const coBrandErr = coBrand.validate();
    if (coBrandErr) return setErr(coBrandErr);
    if (usedCorpoCard == null) {
      return setErr("Please say whether a corporate card was used.");
    }
    // Digests are computed after upload now; give any still-running one a
    // moment so the recap carries it, but never let one block filing.
    if (shaPending.current.size > 0) {
      await Promise.allSettled([...shaPending.current.values()]);
    }
    const donePhotos = photos.filter((p) => p.state === "done" && p.blobName);
    // Photos that FAILED must never block: a BA standing in a parking lot on
    // one bar has to be able to finish and clock out. The button label tells
    // them exactly how many they're leaving behind, and Retry is right there.
    // Uploads still in flight get one warning; a second tap sends what landed.
    if (uploadingCount > 0) {
      const many = `${uploadingCount} photo${uploadingCount === 1 ? "" : "s"}`;
      const progress = ` (${uploadProgress.percent}% done)`;
      if (donePhotos.length === 0)
        return setErr(`Still uploading ${many}${progress} — one moment.`);
      if (!leaveBehindArmed.current) {
        leaveBehindArmed.current = true;
        return setErr(
          `Still uploading ${many}${progress}. Wait for ${uploadingCount === 1 ? "it" : "them"}, or tap Submit again to send the ${donePhotos.length} that finished.`,
        );
      }
    }
    leaveBehindArmed.current = false;
    const offlineNow =
      (typeof navigator !== "undefined" && navigator.onLine === false) || allFailedOffline;
    if (donePhotos.length === 0) {
      if (!(failedCount > 0 && offlineNow)) {
        return setErr(
          failedCount > 0
            ? "No photos uploaded yet. Tap Retry, or check your signal."
            : "Add at least one photo of your event.",
        );
      }
    }

    const fieldValues = Object.entries(withoutHiddenValues(templateFields, valuesForSubmit))
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
    const coBrandsBody = coBrand.payload();

    const queueThisSubmit = async () => {
      const photoFiles: Record<string, File> = {};
      const files = photos
        .filter((p) => p.state !== "uploading" && !p.unrecoverable)
        .map((p) => {
          if (!p.blobName) photoFiles[p.id] = p.file;
          return {
            id: p.id,
            blobName: p.blobName,
            category: p.category,
            ...(shaOf(p) ? { sha256: shaOf(p) } : {}),
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
        usedCorpoCard,
        ...storeFields,
        coBrands: coBrandsBody,
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
        files: donePhotos.map((p) => ({
          blobName: p.blobName,
          category: p.category,
          ...(shaOf(p) ? { sha256: shaOf(p) } : {}),
        })),
        productSamples,
        totalEngagements,
        usedCorpoCard,
        ...storeFields,
        ...(coBrandsBody ? { coBrands: coBrandsBody } : {}),
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
      submittedRef.current = true;
      for (const id of [...retryTimers.current.keys()]) cancelAutoRetry(id);
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
  const completenessValues = { ...values };
  if (payableMiles != null && Number.isFinite(payableMiles)) {
    for (const f of templateFields) {
      if (!isMileageCustomFieldName(f.name) || isPhotoType(f.type)) continue;
      const cur = completenessValues[f.id];
      if (cur == null || (Array.isArray(cur) ? cur.length === 0 : String(cur).trim() === "")) {
        completenessValues[f.id] = String(payableMiles);
      }
    }
  }
  const completenessItems = buildCompletenessItems({
    fields: templateFields,
    values: completenessValues,
    buckets,
    photos: photos.map((p) => ({ category: p.category, state: p.state })),
    hasPhotoField,
    usedCorpoCard,
    storeIdentity: Boolean(storeIdentity),
    store,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {eventDate ? (
        <p style={{ color: "#44403c", fontSize: 13, opacity: 1, margin: 0 }}>
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
      {storeIdentity ? (
        <div style={card} data-completeness-target="store">
          <h2 style={h2}>Store</h2>
          <label style={label}>
            Store name <span style={{ color: "#EF5A2A" }}>*</span>
          </label>
          <input
            style={input}
            placeholder="e.g. Total Wine & More"
            autoComplete="off"
            value={store.name}
            onChange={(e) => setStore((s) => ({ ...s, name: e.target.value }))}
          />
          <label style={{ ...label, marginTop: 10 }}>
            Store # <span style={{ color: "#EF5A2A" }}>*</span>
          </label>
          <input
            style={{ ...input, opacity: store.noNumber ? 0.45 : 1 }}
            placeholder="e.g. 1234"
            autoComplete="off"
            disabled={store.noNumber}
            value={store.noNumber ? "" : store.number}
            onChange={(e) => setStore((s) => ({ ...s, number: e.target.value }))}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={store.noNumber}
              onChange={(e) => setStore((s) => ({ ...s, noNumber: e.target.checked }))}
            />
            No store number (independent store)
          </label>
        </div>
      ) : null}
      <CoBrandToggleCard
        state={coBrand}
        hostName={brandName}
        accent={accent}
        cardStyle={card}
        headingStyle={h2}
      />
      {token ? (
        <div style={card}>
          <VoiceRecapCard
            origin={apiOrigin()}
            code={code}
            session={token}
            fields={templateFields}
            accent={accent}
            onApply={(fills: VoiceFill[]) =>
              setValues((current) => applyVoiceFills(current, fills, templateFields))
            }
          />
        </div>
      ) : null}
      {template.sections.map((section) => {
        // Mileage moves to the end of the recap (after photos). Skip empty
        // sections that only held mileage fields.
        const fields = section.fields.filter(
          (f) => !isMileageCustomFieldName(f.name) && isFieldShown(f, values),
        );
        if (fields.length === 0) return null;
        const labelBrand =
          coBrand.active.length > 0 &&
          perBrandSections.has(section.name.trim().toLowerCase());
        return (
        <div key={section.id} style={card}>
          <h2 style={h2}>{labelBrand ? `${brandName} · ${section.name}` : section.name}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            {fields.map((f) => (
              <div key={f.id} data-completeness-target={f.id}>
              <FieldInput
                field={f}
                value={values[f.id]}
                accent={accent}
                onChange={(v) => setVal(f.id, v)}
                onAddPhotos={uploadFiles}
                photos={loosePhotos}
                onRemovePhoto={removePhoto}
                onKeepPhoto={keepPhotoCheck}
                products={template.products}
                sampleQtys={samples}
                onSampleQtyChange={(productId, qty) =>
                  setSamples((s) => ({ ...s, [productId]: qty }))
                }
                qtyContextName={template.name}
                qtyLabel={template.sampleQtyLabel}
                qtyTotalLabel={template.sampleQtyTotalLabel}
              />
              </div>
            ))}
          </div>
        </div>
        );
      })}

      <CoBrandSections
        state={coBrand}
        cardStyle={card}
        headingStyle={h2}
        renderField={({ brand, field, value, onChange, sampleQtys, onSampleQtyChange }) => (
          <FieldInput
            field={field}
            value={value}
            accent={brand.primaryColor || accent}
            onChange={onChange}
            onAddPhotos={uploadFiles}
            photos={[]}
            onRemovePhoto={removePhoto}
            products={brand.products}
            sampleQtys={sampleQtys}
            onSampleQtyChange={onSampleQtyChange}
            qtyContextName={brand.name}
            qtyLabel={template.sampleQtyLabel}
            qtyTotalLabel={template.sampleQtyTotalLabel}
          />
        )}
      />

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
            <div data-completeness-target="photos">
              <PhotoGrid
                photos={loosePhotos}
                onAdd={() => libraryRef.current?.click()}
                onTake={() => cameraRef.current?.click()}
                onRemove={removePhoto}
                onKeep={keepPhotoCheck}
                onRetake={(id) => {
                  removePhoto(id);
                  cameraRef.current?.click();
                }}
                accent={accent}
              />
            </div>
            <PhotoFileInputs
              libraryRef={libraryRef}
              cameraRef={cameraRef}
              onFiles={(files) => void uploadFiles(files)}
            />
          </>
        ) : null}
      </div>
      ) : null}

      {buckets.length === 0 ? (
        <div style={card}>
          <CorpoCardYesNo
            value={usedCorpoCard}
            accent={accent}
            onChange={setUsedCorpoCard}
          />
        </div>
      ) : null}

      {buckets.length > 0 ? (
        <div style={card}>
          <h2 style={h2}>Photos</h2>
          <p style={{ color: "#44403c", fontSize: 13, opacity: 1, margin: "6px 0 0" }}>
            Put each shot in its own group so they land in the right place on
            the client report.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 14 }}>
            {buckets.length > 0 &&
            !buckets.some((b) => isExpenseReceiptBucket(b.name)) ? (
              <CorpoCardYesNo
                value={usedCorpoCard}
                accent={accent}
                onChange={setUsedCorpoCard}
              />
            ) : null}
            {buckets.map((b) => (
              <Fragment key={b.id}>
                {isExpenseReceiptBucket(b.name) &&
                buckets.find((row) => isExpenseReceiptBucket(row.name))?.id ===
                  b.id ? (
                  <CorpoCardYesNo
                    value={usedCorpoCard}
                    accent={accent}
                    onChange={setUsedCorpoCard}
                  />
                ) : null}
                <PhotoBucketZone
                  bucket={b}
                  photos={photos.filter((p) => p.category === b.id)}
                  onAdd={uploadFiles}
                  onRemove={removePhoto}
                  onKeep={keepPhotoCheck}
                  accent={accent}
                />
              </Fragment>
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
                    qtyLabel={template.sampleQtyLabel}
                    qtyTotalLabel={template.sampleQtyTotalLabel}
                  />
                ),
              )}
            </div>
          </div>
        );
      })()}

      {uploadingCount > 0 ? (
        <p style={{ color: "#44403c", textAlign: "center", fontSize: 13, opacity: 1 }} aria-live="polite">
          {formatUploadProgress(uploadProgress)}
        </p>
      ) : null}

      {failedCount > 0 ? (
        <div style={{ ...card, borderColor: "#EF5A2A", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 13 }}>
              {failedCount} photo{failedCount === 1 ? "" : "s"} didn't upload.
              {(() => {
                const reasons = [
                  ...new Set(
                    photos
                      .filter((p) => p.state === "failed" && p.failReason)
                      .map((p) => p.failReason as string),
                  ),
                ];
                if (reasons.length === 1) return ` ${reasons[0]}`;
                if (reasons.includes(UNREADABLE_PHOTO_MESSAGE)) {
                  return " Some didn't stay saved on your phone — tap Remove failed, then take or pick those again.";
                }
                if (reasons.some((r) => /too many|wait a minute/i.test(r))) {
                  return " Too many uploads at once — wait a minute, then tap Retry.";
                }
                return " Tap Retry — or re-pick from your library (JPEG works best if HEIC keeps failing).";
              })()}
              {photos.some((p) => p.state === "failed" && p.autoRetry)
                ? " Retrying automatically…"
                : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {photos.some((p) => p.state === "failed" && !p.unrecoverable) ? (
              <button style={{ ...secondaryBtn, flex: 1, padding: "8px 14px", margin: 0 }} onClick={retryFailed}>
                Retry
              </button>
            ) : null}
            <button style={{ ...secondaryBtn, flex: 1, padding: "8px 14px", margin: 0 }} onClick={removeFailed}>
              Remove failed
            </button>
          </div>
        </div>
      ) : null}

      <PhotoQualityWarnings
        warnings={Object.values(photoWarnings)}
        onKeep={(photoId) =>
          setPhotoWarnings((prev) => {
            const copy = { ...prev };
            delete copy[photoId];
            return copy;
          })
        }
        onRetake={removePhoto}
      />

      <RecapCompletenessChecklist items={completenessItems} />

      {err ? <p style={{ ...errText, textAlign: "center" }}>{err}</p> : null}

      <div
        style={{
          position: "sticky",
          bottom: 0,
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: 4,
          paddingTop: 10,
          paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
          background: "#faf7f1",
          borderTop: "1px solid rgba(28, 25, 23, 0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 18 }}>
          {savedAt ? (
            <p
              aria-live="polite"
              style={{
                color: "#44403c",
                fontSize: 12,
                opacity: 1,
                textAlign: "center",
                margin: 0,
              }}
            >
              {draftSavedLabel(savedAt)}
            </p>
          ) : (
            <span style={{ color: "#78716c", fontSize: 12 }}>
              Photos: library or camera · multiple OK
            </span>
          )}
          <button
            type="button"
            onClick={() => persistDraft(false)}
            disabled={busy}
            style={{
              border: "none",
              background: "transparent",
              color: "#1c1917",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "underline",
              cursor: "pointer",
              padding: "4px 2px",
            }}
          >
            Save
          </button>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={secondaryBtn} onClick={onCancel} disabled={busy}>
            Back
          </button>
          <ActionMorphButton
            style={primaryBtn(accent)}
            onClick={submit}
            disabled={busy || (uploadingCount > 0 && doneCount === 0)}
            phase={submitPhase}
            pendingLabel="Submitting…"
            successLabel="Submitted"
          >
            {allFailedOffline
              ? "Save & send when back online"
              : failedCount + uploadingCount > 0 && doneCount > 0
                ? `Submit without ${failedCount + uploadingCount} photo${failedCount + uploadingCount === 1 ? "" : "s"}`
                : "Submit recap"}
          </ActionMorphButton>
        </div>
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
  qtyLabel,
  qtyTotalLabel,
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
  qtyLabel?: string | null;
  qtyTotalLabel?: string | null;
}) {
  const [skuFilter, setSkuFilter] = useState("");
  const arr = Array.isArray(value) ? value : [];
  const qtyMode =
    isProductsSampledMultiselect(field) &&
    Boolean(onSampleQtyChange) &&
    products.length > 0;
  const qtyUnit = productSampleQtyUnit(qtyContextName ?? field.name, qtyLabel);
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
  const qtyTotal = selectedWithProduct.reduce((sum, { product }) => {
    const n = parseInt(sampleQtys[product.id] ?? "", 10);
    return Number.isFinite(n) && n > 0 ? sum + n : sum;
  }, 0);

  return (
    <div>
      <label style={labelStyle}>
        {field.name}
        {req}
      </label>
      {qtyMode ? (
        <p style={{ color: "#44403c", fontSize: 13, opacity: 1, margin: "4px 0 0" }}>
          {productSampleQtyHelper(qtyContextName ?? field.name, qtyLabel)}
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
        <p style={{ color: "#44403c", fontSize: 13, opacity: 1, marginTop: 8 }}>
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
          {qtyLabel ? (
            <div
              style={{
                color: "#44403c",
                display: "flex",
                justifyContent: "flex-end",
                fontSize: 12,
                fontWeight: 600,
                opacity: 1,
              }}
            >
              <span style={{ width: 88, textAlign: "center" }}>{qtyLabel}</span>
            </div>
          ) : null}
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
                aria-label={`${qtyLabel || (qtyUnit === "cases" ? "Cases" : "Cans")} — ${product.name}`}
                value={sampleQtys[product.id] ?? ""}
                onChange={(e) => onSampleQtyChange?.(product.id, e.target.value)}
              />
            </div>
          ))}
          {qtyTotalLabel ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid rgba(0,0,0,0.1)",
                paddingTop: 8,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              <span>{qtyTotalLabel}</span>
              <span style={{ width: 88, textAlign: "center" }}>
                {qtyTotal.toLocaleString()}
              </span>
            </div>
          ) : null}
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
  onKeepPhoto,
  products = [],
  sampleQtys = {},
  onSampleQtyChange,
  qtyContextName,
  qtyLabel,
  qtyTotalLabel,
}: {
  field: TemplateField;
  value: string | string[] | undefined;
  accent: string;
  onChange: (v: string | string[]) => void;
  onAddPhotos: (files: FileList | null) => void;
  photos: Photo[];
  onRemovePhoto: (id: string) => void;
  onKeepPhoto?: (id: string) => void;
  products?: TemplateProduct[];
  sampleQtys?: Record<string, string>;
  onSampleQtyChange?: (productId: string, qty: string) => void;
  qtyContextName?: string | null;
  qtyLabel?: string | null;
  qtyTotalLabel?: string | null;
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
      <div data-completeness-target={field.id}>
        <label style={label}>
          {field.name}
          {req}
        </label>
        <PhotoGrid
          photos={photos}
          onAdd={() => libraryRef.current?.click()}
          onTake={() => cameraRef.current?.click()}
          onRemove={onRemovePhoto}
          onKeep={onKeepPhoto}
          onRetake={(id) => {
            onRemovePhoto(id);
            cameraRef.current?.click();
          }}
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
        qtyLabel={qtyLabel}
        qtyTotalLabel={qtyTotalLabel}
      />
    );
  }

  const isLong = field.type.includes("long") || field.type.includes("area") || field.type.includes("paragraph");
  const isNumber = field.type.includes("number") || field.type.includes("int") || field.type.includes("decimal");
  const example = (field.placeholder || "").trim();
  if (!isLong && isSpendAmountField(field)) {
    return (
      <div>
        <label style={label}>
          {field.name}
          {req}
        </label>
        <SpendAmountInput
          value={typeof value === "string" ? value : ""}
          onChange={(v) => onChange(v)}
          inputStyle={input}
          ariaLabel={field.name}
        />
      </div>
    );
  }
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
  children: ReactNode;
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

