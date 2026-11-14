import { timedFetch } from "./timedFetch";
import { reportFieldIssue } from "./fieldIssues";
import CheckinStepBar from "./CheckinStepBar";
import { checkinSteps } from "./checkinSteps";
import MyShiftsCard from "./MyShiftsCard";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useParams } from "react-router";
import {
  FALLBACK_ACCENT,
  apiOrigin,
  checkinResources,
  fetchWithTimeout,
  flushQueuedRecap,
  fmtDay,
  fmtTime,
  postCheckinClock,
  postCheckinPayableMileage,
  readIdentity,
  telHref,
  todayISO,
  writeIdentity,
} from "./checkinHelpers";
import type {
  CheckinResource,
  Clock,
  Context,
} from "./checkinTypes";
import {
  card,
  errText,
  h2,
  input,
  primaryBtn,
  resourceCard,
  secondaryBtn,
  wrap,
} from "./checkinStyles";
import {
  readOpenRecap,
  writeOpenRecap,
} from "./photoDraft";
import {
  clearDraft,
  draftHasAnswers,
  hasRecapDraft,
} from "./recapDraft";
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
  readLostPunch,
  clearLostPunch,
  formatSavedClockTime,
  type LostPunch,
  writeCachedContext,
  type PendingClockIn,
  type PendingClockOut,
} from "./offlineClock";
import {
  clearPendingRecap,
  offlineRecapBanner,
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
  FORGOT_PAST_RECAP_CTA,
  FORGOT_PAST_RECAP_HINT,
  isLeftoverCheckinSession,
  isPastDayWalkupSession,
  LEFTOVER_PRIMARY_BUSY,
  newDayPrimaryLabel,
  offerFinishPriorRecap,
  PAST_DAY_NO_CLOCK,
  readChosenShiftDate,
  showNewDayGate,
  START_OVER_LINK,
  writePastRecapIntent,
} from "./leftoverCheckin";
import {
  canAttemptOpenPunchResume,
  lookupShiftsByPhone,
  resumeOpenShift,
  shouldDropSessionToken,
  shouldKeepCachedSession,
} from "./checkinSession";
import { ActionMorphButton } from "@/motion/ActionMorphButton";
import { holdActionSuccess, type ActionPhase } from "@/motion/opsMotion";
import { TenantLogo } from "@/layout/TenantLogo.tsx";
import { shouldShowSamplingStopCard } from "./samplingStops";
import PayableMileageStep from "./PayableMileageStep";
import IdentifyStep from "./IdentifyStep";
import RecapForm from "./RecapForm";
import {
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
  recapOnlyIntro,
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
      const res = await timedFetch(`${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}`, {
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
        {hidePriorEvent ? null : (
          <CheckinStepBar
            accent={accent}
            steps={checkinSteps({
              identified,
              clockState: ctx.session?.clock.state,
              hasRecap,
              recapOnly: Boolean(ctx.recapOnly),
            })}
          />
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
  // Past-day sessions also skip the clock UI and open the recap directly.
  const bootRecapOnly = Boolean(ctx.recapOnly) && !hasRecap && !leftover;
  const bootPastRecap = pastDay && !hasRecap && !leftover;
  const bootNeedMiles =
    (bootRecapOnly || bootPastRecap) &&
    shouldCollectPayableMileage({
      brand: ctx.brand,
      payableMileage: ctx.session?.payableMileage,
    }) &&
    !payableMileageComplete(ctx.session?.payableMileage) &&
    !readPendingMileage(code);
  const [showRecap, setShowRecap] = useState(
    () => (bootRecapOnly || bootPastRecap) && !bootNeedMiles,
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
  // A queued punch the server refused for good (see offlineClock.ts). Shown
  // until dismissed so the hours get fixed by a lead instead of vanishing.
  const [lostPunch, setLostPunch] = useState<LostPunch | null>(() =>
    readLostPunch(code),
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
    if (result === "rejected") {
      reportFieldIssue({
        origin: apiOrigin(),
        code,
        kind: "punch_not_saved",
        detail: "queued clock-in refused",
        session: token,
      });
      setQueuedClock(readPendingClock(code));
      setLostPunch(readLostPunch(code));
      await onRefresh();
    }
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
    if (result === "rejected") {
      reportFieldIssue({
        origin: apiOrigin(),
        code,
        kind: "punch_not_saved",
        detail: "queued clock-out refused",
        session: token,
      });
      setQueuedClockOut(readPendingClockOut(code));
      setLostPunch(readLostPunch(code));
    }
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
    // Evidence that the button was pressed, sent before anything can fail.
    // If the punch itself never lands, staff can still see the attempt.
    reportFieldIssue({
      origin: apiOrigin(),
      code,
      kind: "punch_tapped",
      detail: `clock ${kind} ${tappedAt}`,
      session: token,
    });
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
        (geoErr) => {
          reportFieldIssue({
            origin: apiOrigin(),
            code,
            kind: geoErr?.code === 1 ? "gps_denied" : "gps_timeout",
            detail: `clock ${kind}`,
            session: token,
          });
          void withCoords({});
        },
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
        <p
          style={{
            color: "#44403c",
            fontSize: 13,
            opacity: 1,
            margin: "16px 0 8px",
            textAlign: "center",
          }}
        >
          {FORGOT_PAST_RECAP_HINT}
        </p>
        <button
          type="button"
          style={{
            ...secondaryBtn,
            width: "100%",
            flex: "none",
            minHeight: 56,
            padding: "14px 16px",
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.35,
            background: "#fff",
            whiteSpace: "normal",
          }}
          disabled={clearing || busy !== ""}
          onClick={() => {
            writePastRecapIntent(code);
            void clearClockIn();
          }}
        >
          {FORGOT_PAST_RECAP_CTA}
        </button>
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
            <button
              type="button"
              onClick={() => {
                writePastRecapIntent(code);
                onStartAnother();
              }}
              style={{
                ...secondaryBtn,
                marginTop: 10,
                width: "100%",
                minHeight: 56,
                padding: "14px 16px",
                fontSize: 15,
                fontWeight: 700,
                lineHeight: 1.35,
                background: "#fff",
                whiteSpace: "normal",
              }}
            >
              {FORGOT_PAST_RECAP_CTA}
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
            {/* The one line an ambassador must never misread: whether the
                clock-in was saved, and at what time. */}
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginTop: 2,
                color:
                  effectiveClock === "not_started" && !pastDay ? "#a8340f" : "#1c1917",
              }}
            >
              {effectiveClock === "clocked_in"
                ? clockInAt
                  ? `Clocked in at ${fmtTime(clockInAt)}`
                  : "Clocked in"
                : effectiveClock === "clocked_out"
                  ? "Clocked out"
                  : pastDay
                    ? "Not started"
                    : "You are not clocked in yet"}
            </div>
            {effectiveClock === "clocked_in" ? (
              <div style={{ color: "#44403c", fontSize: 13, marginTop: 2 }}>
                {queuedClock
                  ? "Saved on this phone. It will send when you're back online."
                  : hasRecap
                    ? "Your hours are running. Clock out when you finish."
                    : "Your hours are running. Your recap is still open."}
              </div>
            ) : null}
            {effectiveClock === "not_started" && !pastDay ? (
              <div style={{ color: "#44403c", fontSize: 13, marginTop: 2 }}>
                Tap Clock in when you arrive. Your hours start then.
              </div>
            ) : null}
            {ctx.event?.date ? (
              <div style={{ color: "#44403c", fontSize: 12, opacity: 1, marginTop: 2 }}>
                {fmtDay(ctx.event.date)}
                {ctx.event.address ? ` · ${ctx.event.address}` : ""}
              </div>
            ) : null}
            {clockInAt && effectiveClock !== "clocked_in" ? (
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
          {effectiveClock === "clocked_in" ? (
            <span
              style={{
                flexShrink: 0,
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                background: accent,
                color: "#0a0d09",
              }}
            >
              On the clock
            </span>
          ) : null}
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
        {lostPunch ? (
          <div
            role="alert"
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #b91c1c",
              background: "#fef2f2",
              color: "#7f1d1d",
              fontSize: 14,
              lineHeight: 1.4,
            }}
          >
            <strong>
              Your {formatSavedClockTime(lostPunch.at) || "saved"} clock-
              {lostPunch.kind === "in" ? "in" : "out"} didn't save.
            </strong>{" "}
            It was held while you had no service and couldn't be recorded
            afterwards. Tell your lead the time so your hours can be fixed.
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => {
                  clearLostPunch(code);
                  setLostPunch(null);
                }}
                style={{
                  background: "transparent",
                  border: "1px solid #b91c1c",
                  color: "#7f1d1d",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 13,
                }}
              >
                Got it
              </button>
            </div>
          </div>
        ) : null}
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

      {/* The BA's own recent shifts: hours + review / approved / paid. */}
      <MyShiftsCard code={code} token={token} />

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

