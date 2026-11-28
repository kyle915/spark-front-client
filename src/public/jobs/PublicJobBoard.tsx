/**
 * Public BA job board (`/jobs/:token`) and signed self-serve shift release
 * (`/jobs/:token?release=<sig>` or `/jobs/release/:releaseToken`).
 *
 * BAs tick the gigs they can work, leave name / cell / email, and are booked
 * on the spot. Public listings never expose street addresses or other BAs'
 * details; once booked, the confirmation panel offers instant `.ics` download,
 * Google / Apple Calendar links (with `CLIENT_ORIGIN` check-in + training
 * links), and signed self-serve shift release (`>36h` instant release; `<=36h`
 * guardrail + urgent staffing ops escalation).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useParams, useSearchParams } from "react-router";
import { TenantLogo } from "@/layout/TenantLogo.tsx";
import {
  buildAppleCalendarHref,
  buildGoogleCalendarUrl,
  downloadShiftsIcs,
  resolveShiftCheckinUrl,
  resolveShiftTrainingUrl,
  suggestIcsFilename,
} from "./shiftCalendar";
import type { BookedShiftCalendarData } from "./shiftCalendar";

const IGNITE_HOME = "https://igniteproductions.co";
const FALLBACK_ACCENT = "#C4D82E";
const ORANGE = "#EF5A2A";

type Brand = {
  name: string;
  label: string;
  primaryColor: string | null;
  image: string | null;
  logoUrl: string | null;
  requestUrlName: string | null;
};

type Gig = {
  id: string;
  startsAt: string;
  dateLabel: string;
  timeLabel: string;
  market: string;
  venue: string;
  typeLabel: string;
  sampling: string;
  skus: string[];
  brief: string;
  openShifts: number;
  spotsLeft: number;
  full: boolean;
};

type BoardPayload = {
  brand: Brand;
  gigs: Gig[];
  markets: string[];
  contactEmail: string;
};

type ResultStatus = "booked" | "already" | "full" | "conflict" | "unavailable";

export type ApplyResult = {
  id: string;
  status: ResultStatus;
  message: string;
  label?: string;
  shift?: BookedShiftCalendarData;
};

export type ShiftReleaseStatus =
  | "can_release"
  | "urgent_window"
  | "already_released"
  | "already_started"
  | "released"
  | "escalated";

export type ShiftReleasePayload = {
  brandLabel: string;
  typeLabel: string;
  venue: string;
  dateLabel: string;
  timeLabel: string;
  startsAt: string;
  hoursUntilStart: number;
  minLeadHours: number;
  baFirstName: string;
  status: ShiftReleaseStatus;
  canSelfRelease: boolean;
  contactEmail: string;
  supportPhone: string;
  supportPhoneHref: string;
  boardToken: string | null;
  spotReopened?: boolean;
  message?: string;
};

function apiOrigin(): string {
  const graphql = import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined;
  if (!graphql) return "";
  try {
    return new URL(graphql).origin;
  } catch {
    return "";
  }
}

function inkOn(hex: string): string {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return "#0a0d09";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0a0d09" : "#ffffff";
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^1(?=\d{10})/, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function validPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "").replace(/^1(?=\d{10})/, "");
  return digits.length === 10 && !/^[01]/.test(digits) && !/^[01]/.test(digits.slice(3));
}

function spotsCopy(gig: Gig): string {
  if (gig.full) return "Full";
  return `${gig.spotsLeft} of ${gig.openShifts} open`;
}

function resultStatusLabel(status: ResultStatus): string {
  switch (status) {
    case "booked":
      return "Booked";
    case "already":
      return "Already booked";
    case "full":
      return "Full";
    case "conflict":
      return "Time conflict";
    case "unavailable":
      return "No longer open";
    default: {
      const never: never = status;
      return never;
    }
  }
}

function releaseStatusHeading(info: ShiftReleasePayload): {
  eyebrowText: string;
  headline: string;
  tone: "neutral" | "urgent" | "success";
} {
  switch (info.status) {
    case "can_release":
      return {
        eyebrowText: `${info.brandLabel.toUpperCase()} · SHIFT RELEASE`,
        headline: `Can't make ${info.venue}?`,
        tone: "neutral",
      };
    case "released":
      return {
        eyebrowText: "SHIFT RELEASED",
        headline: "Your spot has been re-opened.",
        tone: "success",
      };
    case "urgent_window":
      return {
        eyebrowText: `WITHIN ${info.minLeadHours} HOURS · STAFFING APPROVAL REQUIRED`,
        headline: `This shift starts in ${Math.max(0, Math.round(info.hoursUntilStart))}h — auto-drop is locked.`,
        tone: "urgent",
      };
    case "escalated":
      return {
        eyebrowText: "URGENT ALERT SENT TO STAFFING",
        headline: "Stay reachable — staffing has been paged.",
        tone: "urgent",
      };
    case "already_released":
      return {
        eyebrowText: "SHIFT RELEASED",
        headline: "This shift has already been released.",
        tone: "neutral",
      };
    case "already_started":
      return {
        eyebrowText: "SHIFT IN PROGRESS",
        headline: "This shift has already started.",
        tone: "urgent",
      };
    default: {
      const never: never = info.status;
      return never;
    }
  }
}

function smsHrefFromTel(telHref: string, fallbackPhone: string): string {
  const digits = (telHref || fallbackPhone).replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `sms:+1${digits}` : `sms:+${digits}`;
}

export function BookedShiftActionsCard({
  shift,
  accent = FALLBACK_ACCENT,
  onOpenRelease,
}: {
  shift: BookedShiftCalendarData;
  accent?: string;
  onOpenRelease?: (releaseToken: string) => void;
}) {
  const checkin = resolveShiftCheckinUrl(shift);
  const training = resolveShiftTrainingUrl(shift);
  const googleUrl = buildGoogleCalendarUrl(shift);
  const appleHref = buildAppleCalendarHref([shift]);
  const icsName = suggestIcsFilename([shift]);

  return (
    <div style={bookedCard}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1c1917" }}>
            {shift.venue}
          </div>
          <div style={{ fontSize: 13, color: "#57534e", marginTop: 2 }}>
            {[shift.dateLabel, shift.timeLabel].filter(Boolean).join(" · ")}
          </div>
          {shift.address ? (
            <div style={{ fontSize: 13, color: "#44403c", marginTop: 3 }}>
              {shift.address}
            </div>
          ) : null}
        </div>
        {shift.releaseToken && onOpenRelease ? (
          <button
            type="button"
            onClick={() => onOpenRelease(shift.releaseToken as string)}
            style={releaseLinkBtn}
          >
            Can&apos;t make this shift?
          </button>
        ) : shift.releaseUrl ? (
          <a href={shift.releaseUrl} style={releaseLinkBtn}>
            Can&apos;t make this shift?
          </a>
        ) : null}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          onClick={() => downloadShiftsIcs([shift])}
          style={{
            ...calBtn,
            background: "#1c1917",
            color: "#ffffff",
            borderColor: "#1c1917",
          }}
        >
          Download .ics
        </button>
        <a
          href={googleUrl}
          target="_blank"
          rel="noreferrer"
          style={calBtn}
        >
          Google Calendar
        </a>
        <a
          href={appleHref}
          download={icsName}
          style={calBtn}
        >
          Apple Calendar
        </a>
      </div>

      {checkin || training ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10, fontSize: 13 }}>
          {checkin ? (
            <a
              href={checkin}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#1c1917", fontWeight: 600, textDecoration: "underline", textDecorationColor: accent }}
            >
              Check-in &amp; recap link
            </a>
          ) : null}
          {training ? (
            <a
              href={training}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#57534e", fontWeight: 600, textDecoration: "underline" }}
            >
              BA training guide
            </a>
          ) : null}
        </div>
      ) : null}

      <BookedShiftPrepKitBlock shift={shift} />
    </div>
  );
}

function BookedShiftPrepKitBlock({ shift }: { shift: BookedShiftCalendarData }) {
  const kit = shift.storePrepKit;
  const skus = (kit?.skus?.length ? kit.skus : shift.skus) || [];
  const notes = (kit?.logisticsNotes || "").trim();
  const risk = kit?.stockRisk;
  const last = kit?.lastShelfVisit;
  const hasRisk = risk && (risk.level === "high" || risk.level === "watch") && risk.reason;
  if (!notes && !skus.length && !hasRisk && !last) return null;

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 12,
        borderTop: "1px solid #e7e5e4",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
      aria-label="Store prep kit"
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1917" }}>Store Prep Kit</div>
      {hasRisk ? (
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.4,
            color: "#78350f",
            background: "#fffbeb",
            border: "1px solid #b45309",
            borderRadius: 10,
            padding: "8px 10px",
            fontWeight: 600,
          }}
        >
          {risk.reason}
        </div>
      ) : null}
      {notes ? (
        <div style={{ fontSize: 13, color: "#44403c", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
          {notes}
        </div>
      ) : null}
      {last?.productOnShelf ? (
        <div style={{ fontSize: 13, color: "#44403c" }}>
          Last shelf:{" "}
          {last.productOnShelf === "yes"
            ? "on shelf"
            : last.productOnShelf === "no"
              ? "not found"
              : "unclear"}
          {last.eventDate ? ` · ${last.eventDate}` : ""}
        </div>
      ) : null}
      {skus.length ? (
        <div style={{ fontSize: 13, color: "#1c1917" }}>
          <span style={{ fontWeight: 700 }}>SKUs: </span>
          {skus.join(" · ")}
        </div>
      ) : null}
    </div>
  );
}

export function ShiftReleaseCard({
  info,
  reason,
  onReasonChange,
  onSubmit,
  submitting,
  error,
  onDismiss,
  accent = FALLBACK_ACCENT,
}: {
  info: ShiftReleasePayload;
  reason: string;
  onReasonChange: (next: string) => void;
  onSubmit: (e: FormEvent) => void;
  submitting: boolean;
  error: string;
  onDismiss?: () => void;
  accent?: string;
}) {
  const { eyebrowText, headline, tone } = releaseStatusHeading(info);
  const ink = inkOn(accent);
  const smsHref = smsHrefFromTel(info.supportPhoneHref, info.supportPhone);
  const telHref = info.supportPhoneHref ? `tel:${info.supportPhoneHref}` : "";

  const borderTone =
    tone === "urgent" ? ORANGE : tone === "success" ? "#16a34a" : "#e7e5e4";

  return (
    <section
      style={{
        ...panel,
        marginBottom: 20,
        borderColor: borderTone,
        borderWidth: tone === "neutral" ? 1 : 2,
      }}
      aria-live="polite"
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <p
          style={{
            ...eyebrow,
            color: tone === "urgent" ? ORANGE : tone === "success" ? "#15803d" : eyebrow.color,
          }}
        >
          {eyebrowText}
        </p>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} style={dismissBtn}>
            Back to board
          </button>
        ) : null}
      </div>

      <h1 style={{ ...title, fontSize: 23, marginBottom: 8 }}>{headline}</h1>

      <div style={releaseMetaBox}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>
          {info.brandLabel} · {info.venue}
        </div>
        <div style={{ fontSize: 14, color: "#44403c", marginTop: 2 }}>
          {[info.dateLabel, info.timeLabel, info.typeLabel].filter(Boolean).join(" · ")}
        </div>
      </div>

      {info.status === "can_release" ? (
        <form onSubmit={onSubmit} style={{ marginTop: 14 }} noValidate>
          <p style={support}>
            Because this shift is more than {info.minLeadHours} hours out, you can release your spot right here.
            We&apos;ll immediately re-open the shift and alert local ambassadors + Ignite staffing.
          </p>
          <label style={fieldLabel}>
            Why can&apos;t you make this shift?
            <textarea
              style={{ ...input, minHeight: 80, resize: "vertical" }}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value.slice(0, 500))}
              placeholder="Quick note for Ignite staffing (required)"
              required
            />
          </label>
          {error ? (
            <p role="alert" style={{ color: ORANGE, fontSize: 14, margin: "10px 0 0" }}>
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            style={{
              ...primaryBtn,
              background: "#1c1917",
              color: "#ffffff",
              marginTop: 14,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Releasing shift…" : "Release my shift"}
          </button>
        </form>
      ) : null}

      {info.status === "urgent_window" ? (
        <form onSubmit={onSubmit} style={{ marginTop: 14 }} noValidate>
          <div style={urgentCalloutBox}>
            <strong>Silent drops are disabled within {info.minLeadHours} hours of shift start.</strong>{" "}
            Your assignment stays active until Ignite staffing confirms coverage so the event isn&apos;t left
            short-handed. Send an urgent alert below and text or call staffing right away.
          </div>
          <label style={fieldLabel}>
            What happened?
            <textarea
              style={{ ...input, minHeight: 80, resize: "vertical" }}
              value={reason}
              onChange={(e) => onReasonChange(e.target.value.slice(0, 500))}
              placeholder="Let staffing know what came up so we can arrange emergency coverage"
              required
            />
          </label>
          {error ? (
            <p role="alert" style={{ color: ORANGE, fontSize: 14, margin: "10px 0 0" }}>
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            style={{
              ...primaryBtn,
              background: ORANGE,
              color: "#ffffff",
              marginTop: 14,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Paging staffing…" : "Send urgent alert to staffing"}
          </button>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {smsHref ? (
              <a href={smsHref} style={calBtn}>
                Text {info.supportPhone}
              </a>
            ) : null}
            {telHref ? (
              <a href={telHref} style={calBtn}>
                Call {info.supportPhone}
              </a>
            ) : null}
            <a href={`mailto:${info.contactEmail}`} style={calBtn}>
              Email {info.contactEmail}
            </a>
          </div>
        </form>
      ) : null}

      {info.status === "released" ? (
        <div style={{ marginTop: 12 }}>
          <p style={support}>
            {info.message ||
              "Your shift has been released and re-opened for another ambassador. Thanks for giving us a heads-up!"}
          </p>
          {info.boardToken && !onDismiss ? (
            <a
              href={`/jobs/${encodeURIComponent(info.boardToken)}`}
              style={{
                ...primaryBtn,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                background: accent,
                color: ink,
                marginTop: 14,
              }}
            >
              Browse other open shifts
            </a>
          ) : null}
        </div>
      ) : null}

      {info.status === "escalated" ? (
        <div style={{ marginTop: 12 }}>
          <div style={urgentCalloutBox}>
            {info.message ||
              `We paged Ignite staffing with your urgent note. You are still on the roster until our team confirms coverage — please also text or call ${info.supportPhone} right now.`}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {smsHref ? (
              <a
                href={smsHref}
                style={{ ...calBtn, background: "#1c1917", color: "#fff", borderColor: "#1c1917" }}
              >
                Text {info.supportPhone}
              </a>
            ) : null}
            {telHref ? (
              <a href={telHref} style={calBtn}>
                Call {info.supportPhone}
              </a>
            ) : null}
            <a href={`mailto:${info.contactEmail}`} style={calBtn}>
              Email {info.contactEmail}
            </a>
          </div>
        </div>
      ) : null}

      {info.status === "already_released" ? (
        <p style={{ ...support, marginTop: 12 }}>
          {info.message || "This shift was already released — no further action needed."}
        </p>
      ) : null}

      {info.status === "already_started" ? (
        <div style={{ marginTop: 12 }}>
          <p style={support}>
            Shifts that have already started can&apos;t be released online. Please reach Ignite staffing directly:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {smsHref ? (
              <a href={smsHref} style={calBtn}>
                Text {info.supportPhone}
              </a>
            ) : null}
            {telHref ? (
              <a href={telHref} style={calBtn}>
                Call {info.supportPhone}
              </a>
            ) : null}
            <a href={`mailto:${info.contactEmail}`} style={calBtn}>
              Email {info.contactEmail}
            </a>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function PublicJobBoard() {
  const { token = "", releaseToken: routeReleaseToken = "" } = useParams<{
    token?: string;
    releaseToken?: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryReleaseToken = searchParams.get("release") ?? "";
  const [inlineReleaseToken, setInlineReleaseToken] = useState("");
  const activeReleaseToken = inlineReleaseToken || routeReleaseToken || queryReleaseToken;

  const origin = useMemo(apiOrigin, []);
  const [board, setBoard] = useState<BoardPayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(Boolean(token));
  const [market, setMarket] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ApplyResult[] | null>(null);
  const [bookedEmail, setBookedEmail] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);

  const [releaseInfo, setReleaseInfo] = useState<ShiftReleasePayload | null>(null);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseLoadError, setReleaseLoadError] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [releaseError, setReleaseError] = useState("");
  const [releaseSubmitting, setReleaseSubmitting] = useState(false);

  const effectiveBoardToken = token || releaseInfo?.boardToken || "";

  const load = useCallback(async () => {
    if (!effectiveBoardToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`${origin}/api/public/jobs/${encodeURIComponent(effectiveBoardToken)}`);
      if (res.status === 404) {
        if (token) {
          setLoadError("This job board link isn't active. Ask Ignite for a current one.");
        }
        return;
      }
      if (!res.ok) {
        if (token) {
          setLoadError("Couldn't load open gigs. Refresh to try again.");
        }
        return;
      }
      const data = (await res.json()) as BoardPayload;
      setBoard(data);
      setSelected((prev) => new Set([...prev].filter((id) => data.gigs.some((g) => g.id === id && !g.full))));
    } catch {
      if (token) {
        setLoadError("Couldn't reach Spark. Check your connection and refresh.");
      }
    } finally {
      setLoading(false);
    }
  }, [effectiveBoardToken, origin, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeReleaseToken) {
      setReleaseInfo(null);
      setReleaseLoadError("");
      setReleaseLoading(false);
      return;
    }
    let cancelled = false;
    setReleaseLoading(true);
    setReleaseLoadError("");
    setReleaseError("");
    void (async () => {
      try {
        const res = await fetch(
          `${origin}/api/public/jobs/release/${encodeURIComponent(activeReleaseToken)}`,
        );
        const data = (await res.json().catch(() => ({}))) as Partial<ShiftReleasePayload> & {
          message?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.status) {
          setReleaseLoadError(data.message || "This shift release link is invalid or expired.");
          setReleaseInfo(null);
          return;
        }
        setReleaseInfo(data as ShiftReleasePayload);
      } catch {
        if (!cancelled) {
          setReleaseLoadError("Couldn't reach Spark. Check your connection and try again.");
        }
      } finally {
        if (!cancelled) {
          setReleaseLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeReleaseToken, origin]);

  const dismissRelease = useCallback(() => {
    setInlineReleaseToken("");
    setReleaseInfo(null);
    setReleaseLoadError("");
    setReleaseReason("");
    setReleaseError("");
    if (queryReleaseToken) {
      const next = new URLSearchParams(searchParams);
      next.delete("release");
      setSearchParams(next, { replace: true });
    }
  }, [queryReleaseToken, searchParams, setSearchParams]);

  const submitRelease = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeReleaseToken) return;
    setReleaseError("");
    if (releaseReason.trim().length < 3) {
      setReleaseError("Please add a quick note on why you can't make this shift.");
      return;
    }
    setReleaseSubmitting(true);
    try {
      const res = await fetch(
        `${origin}/api/public/jobs/release/${encodeURIComponent(activeReleaseToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: releaseReason.trim() }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as Partial<ShiftReleasePayload> & {
        message?: string;
      };
      if (!res.ok || !data.status) {
        setReleaseError(data.message || "Couldn't update this shift. Please try again.");
        return;
      }
      setReleaseInfo(data as ShiftReleasePayload);
      if (data.status === "released") {
        void load();
      }
    } catch {
      setReleaseError("Couldn't reach Spark. Check your connection and try again.");
    } finally {
      setReleaseSubmitting(false);
    }
  };

  const brand = board?.brand ?? null;
  const accent = brand?.primaryColor || FALLBACK_ACCENT;
  const ink = inkOn(accent);
  const brandLabel = brand?.label || brand?.name || releaseInfo?.brandLabel || "";

  useEffect(() => {
    if (brandLabel) {
      document.title = activeReleaseToken
        ? `${brandLabel} shift release · Ignite`
        : `${brandLabel} open shifts · Ignite`;
    }
  }, [activeReleaseToken, brandLabel]);

  const gigs = useMemo(
    () => (board?.gigs ?? []).filter((g) => !market || g.market === market),
    [board, market],
  );
  const selectedGigs = (board?.gigs ?? []).filter((g) => selected.has(g.id));

  const toggle = (gig: Gig) => {
    if (gig.full) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(gig.id)) next.delete(gig.id);
      else next.add(gig.id);
      return next;
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!effectiveBoardToken) return;
    setFormError("");
    if (selected.size === 0) {
      setFormError("Pick at least one gig above.");
      return;
    }
    if (name.trim().split(/\s+/).length < 2) {
      setFormError("Enter your first and last name.");
      return;
    }
    if (!validPhone(phone)) {
      setFormError("Enter a 10-digit US cell number.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFormError("Enter a valid email. Your booking details are sent there.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${origin}/api/public/jobs/${encodeURIComponent(effectiveBoardToken)}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          email: email.trim(),
          note: note.trim(),
          website,
          gigIds: [...selected],
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        results?: ApplyResult[];
        email?: string;
        message?: string;
      };
      if (!res.ok) {
        setFormError(data.message || "Couldn't book that. Try again.");
        return;
      }
      setResults(data.results ?? []);
      setBookedEmail(data.email || email.trim());
      setSelected(new Set());
      window.scrollTo({ top: 0, behavior: "smooth" });
      void load();
    } catch {
      setFormError("Couldn't reach Spark. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const bookedCount = results?.filter((r) => r.status === "booked").length ?? 0;
  const calendarShifts = useMemo(
    () =>
      (results ?? [])
        .filter((r): r is ApplyResult & { shift: BookedShiftCalendarData } => Boolean(r.shift))
        .map((r) => ({ ...r.shift, id: r.shift.id || r.id })),
    [results],
  );

  const openInlineRelease = (nextReleaseToken: string) => {
    setReleaseReason("");
    setReleaseError("");
    setInlineReleaseToken(nextReleaseToken);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div style={wrap}>
      <div style={{ width: "100%", maxWidth: 640 }}>
        <header style={headerRow}>
          <a href={IGNITE_HOME} style={{ display: "inline-flex", alignItems: "center" }}>
            <img src="/legal/spark-logo.png" alt="Spark by Ignite" style={{ height: 38, width: "auto" }} />
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

        {activeReleaseToken ? (
          releaseLoading && !releaseInfo ? (
            <div style={{ ...panel, marginBottom: 20 }}>
              <p style={{ margin: 0, color: "#78716c" }}>Loading your shift…</p>
            </div>
          ) : releaseLoadError ? (
            <div style={{ ...panel, marginBottom: 20 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{releaseLoadError}</p>
              {token ? (
                <button type="button" style={{ ...secondaryBtn, marginTop: 12 }} onClick={dismissRelease}>
                  View open gigs
                </button>
              ) : null}
            </div>
          ) : releaseInfo ? (
            <ShiftReleaseCard
              info={releaseInfo}
              reason={releaseReason}
              onReasonChange={setReleaseReason}
              onSubmit={submitRelease}
              submitting={releaseSubmitting}
              error={releaseError}
              onDismiss={token ? dismissRelease : undefined}
              accent={accent}
            />
          ) : null
        ) : null}

        {!effectiveBoardToken && !activeReleaseToken ? (
          <div style={panel}>
            <p style={{ margin: 0, fontWeight: 600 }}>
              This job board link isn&apos;t active. Ask Ignite for a current one.
            </p>
          </div>
        ) : loading && !board && effectiveBoardToken ? (
          <div style={panel}>
            <p style={{ margin: 0, color: "#78716c" }}>Loading open gigs…</p>
          </div>
        ) : loadError ? (
          <div style={panel}>
            <p style={{ margin: 0, fontWeight: 600 }}>{loadError}</p>
          </div>
        ) : board ? (
          <>
            {results ? (
              <section style={{ ...panel, marginBottom: 20 }} aria-live="polite">
                <p style={eyebrow}>{bookedCount ? "YOU'RE BOOKED" : "NOT BOOKED"}</p>
                <h1 style={{ ...title, marginBottom: 8 }}>
                  {bookedCount
                    ? `You're on ${bookedCount} gig${bookedCount === 1 ? "" : "s"}.`
                    : "Those gigs couldn't be booked."}
                </h1>
                {bookedCount ? (
                  <p style={support}>
                    Save your shift to your calendar now so you have the venue address, check-in link, and
                    training guide handy offline. We also emailed everything to <strong>{bookedEmail}</strong>.
                  </p>
                ) : null}

                {calendarShifts.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => downloadShiftsIcs(calendarShifts)}
                    style={{
                      ...primaryBtn,
                      background: accent,
                      color: ink,
                      marginTop: 14,
                    }}
                  >
                    Download all {calendarShifts.length} shifts (.ics)
                  </button>
                ) : null}

                <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
                  {results.map((r) => (
                    <li key={r.id} style={resultRow}>
                      <span style={{ fontWeight: 600 }}>{r.label || "Gig"}</span>
                      <span
                        style={{
                          ...pill,
                          background: r.status === "booked" ? accent : "#fdeee8",
                          color: r.status === "booked" ? ink : "#9a3412",
                        }}
                      >
                        {resultStatusLabel(r.status)}
                      </span>
                      {r.status !== "booked" ? (
                        <span style={{ flexBasis: "100%", fontSize: 13, color: "#78716c" }}>{r.message}</span>
                      ) : null}
                      {r.shift ? (
                        <div style={{ flexBasis: "100%", marginTop: 8 }}>
                          <BookedShiftActionsCard
                            shift={{ ...r.shift, id: r.shift.id || r.id }}
                            accent={accent}
                            onOpenRelease={openInlineRelease}
                          />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <button type="button" style={{ ...secondaryBtn, marginTop: 16 }} onClick={() => setResults(null)}>
                  Pick more gigs
                </button>
              </section>
            ) : null}

            <section style={{ ...panel, marginBottom: 16 }}>
              <p style={eyebrow}>{brandLabel.toUpperCase()} · OPEN SHIFTS</p>
              <h1 style={title}>Pick the gigs you can work.</h1>
              <p style={support}>
                Tap every gig you can cover, add your info at the bottom, and you&apos;re booked. Spots are
                first come, first served.
              </p>
              {board.markets.length > 1 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }} role="group" aria-label="Filter by market">
                  {["", ...board.markets].map((m) => {
                    const active = market === m;
                    return (
                      <button
                        key={m || "all"}
                        type="button"
                        onClick={() => setMarket(m)}
                        aria-pressed={active}
                        style={{
                          ...chip,
                          background: active ? "#1c1917" : "#fff",
                          color: active ? "#fff" : "#1c1917",
                          borderColor: active ? "#1c1917" : "#e7e5e4",
                        }}
                      >
                        {m || "All markets"}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </section>

            {gigs.length === 0 ? (
              <div style={panel}>
                <p style={{ margin: 0, fontWeight: 600 }}>No open gigs right now.</p>
                <p style={{ ...support, marginTop: 6 }}>
                  New {brandLabel} gigs show up here as they&apos;re booked. Check back soon.
                </p>
              </div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                {gigs.map((gig) => {
                  const on = selected.has(gig.id);
                  return (
                    <li key={gig.id}>
                      <button
                        type="button"
                        onClick={() => toggle(gig)}
                        disabled={gig.full}
                        aria-pressed={on}
                        style={{
                          ...gigCard,
                          borderColor: on ? accent : "#e7e5e4",
                          boxShadow: on ? `0 0 0 2px ${accent}` : gigCard.boxShadow,
                          opacity: gig.full ? 0.55 : 1,
                          cursor: gig.full ? "not-allowed" : "pointer",
                        }}
                      >
                        <span style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <span
                            aria-hidden
                            style={{
                              ...check,
                              background: on ? accent : "#fff",
                              borderColor: on ? accent : "#d6d3d1",
                              color: ink,
                            }}
                          >
                            {on ? "✓" : ""}
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                              <span style={{ fontSize: 16, fontWeight: 700 }}>{gig.dateLabel}</span>
                              <span
                                style={{
                                  ...pill,
                                  background: gig.full ? "#f5f5f4" : "#f0fdf4",
                                  color: gig.full ? "#78716c" : "#166534",
                                }}
                              >
                                {spotsCopy(gig)}
                              </span>
                            </span>
                            <span style={{ display: "block", fontSize: 14, color: "#44403c", marginTop: 2 }}>
                              {gig.timeLabel}
                            </span>
                            <span style={{ display: "block", fontSize: 15, fontWeight: 600, marginTop: 8 }}>
                              {gig.venue}
                            </span>
                            <span style={{ display: "block", fontSize: 13, color: "#78716c", marginTop: 2 }}>
                              {[gig.market, gig.typeLabel, gig.sampling ? `${gig.sampling} samples` : ""]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                            {gig.skus.length ? (
                              <span style={{ display: "block", fontSize: 13, color: "#57534e", marginTop: 6 }}>
                                {gig.skus.join(", ")}
                              </span>
                            ) : null}
                            {gig.brief ? (
                              <span style={brief}>{gig.brief}</span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {board.gigs.some((g) => !g.full) ? (
              <form ref={formRef} onSubmit={submit} style={{ ...panel, marginTop: 20 }} noValidate>
                <p style={eyebrow}>YOUR INFO</p>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>
                  {selectedGigs.length
                    ? `Book ${selectedGigs.length} gig${selectedGigs.length === 1 ? "" : "s"}`
                    : "Pick gigs above, then book"}
                </h2>
                {selectedGigs.length ? (
                  <p style={{ ...support, marginBottom: 4 }}>
                    {selectedGigs.map((g) => `${g.dateLabel} · ${g.venue}`).join(" / ")}
                  </p>
                ) : null}
                <label style={fieldLabel}>
                  Full name
                  <input style={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="First and last name" required />
                </label>
                <label style={fieldLabel}>
                  Cell
                  <input
                    style={input}
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="(305) 555-0142"
                    required
                  />
                </label>
                <label style={fieldLabel}>
                  Email
                  <input
                    style={input}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@email.com"
                    required
                  />
                  <span style={hint}>Your booking email (address, times, clock-in link, BA materials) goes here.</span>
                </label>
                <label style={fieldLabel}>
                  Note <span style={{ fontWeight: 400, color: "#a8a29e" }}>(optional)</span>
                  <textarea
                    style={{ ...input, minHeight: 72, resize: "vertical" }}
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 500))}
                    placeholder="Anything Ignite should know"
                  />
                </label>
                <div aria-hidden style={{ position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" }}>
                  <label>
                    Website
                    <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                  </label>
                </div>
                {formError ? (
                  <p role="alert" style={{ color: ORANGE, fontSize: 14, margin: "12px 0 0" }}>
                    {formError}
                  </p>
                ) : null}
                <p style={{ fontSize: 12, lineHeight: 1.45, color: "#57534e", margin: "14px 0 0" }}>
                  By booking, you agree to the{" "}
                  <a href="/terms-of-service" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="/privacy-policy" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                    Privacy Policy
                  </a>
                  , and Ignite may text you about your gigs. Msg &amp; data rates may apply. Reply STOP to opt out.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ ...primaryBtn, background: accent, color: ink, marginTop: 16, opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting
                    ? "Booking…"
                    : selectedGigs.length
                      ? `Book ${selectedGigs.length} gig${selectedGigs.length === 1 ? "" : "s"}`
                      : "Book"}
                </button>
              </form>
            ) : null}

            {selectedGigs.length && !results ? (
              <div style={stickyBar}>
                <button
                  type="button"
                  style={{ ...primaryBtn, background: accent, color: ink, maxWidth: 600 }}
                  onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  {selectedGigs.length} selected · Add your info
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        <p style={footer}>
          Questions?{" "}
          <a
            href={`mailto:${board?.contactEmail || releaseInfo?.contactEmail || "staffing@igniteproductions.co"}`}
            style={{ color: "#78716c" }}
          >
            {board?.contactEmail || releaseInfo?.contactEmail || "staffing@igniteproductions.co"}
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

const wrap: CSSProperties = {
  minHeight: "100dvh",
  background: "#faf7f1",
  color: "#1c1917",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "40px 16px 120px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};
const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 24,
};
const panel: CSSProperties = {
  background: "#fff",
  border: "1px solid #e7e5e4",
  borderRadius: 24,
  padding: "24px 20px",
  boxShadow: "0 1px 2px rgba(28, 25, 23, 0.04)",
  position: "relative",
};
const eyebrow: CSSProperties = {
  margin: "0 0 6px",
  fontSize: 11,
  letterSpacing: "0.16em",
  fontWeight: 700,
  color: "#78716c",
};
const title: CSSProperties = { fontSize: 26, lineHeight: 1.15, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" };
const support: CSSProperties = { fontSize: 15, lineHeight: 1.5, color: "#57534e", margin: "8px 0 0" };
const chip: CSSProperties = {
  border: "1px solid",
  borderRadius: 999,
  padding: "8px 14px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  minHeight: 36,
};
const gigCard: CSSProperties = {
  width: "100%",
  textAlign: "left",
  background: "#fff",
  border: "1px solid #e7e5e4",
  borderRadius: 18,
  padding: 16,
  color: "#1c1917",
  font: "inherit",
  boxShadow: "0 1px 2px rgba(28, 25, 23, 0.04)",
  transition: "box-shadow 120ms ease, border-color 120ms ease",
};
const check: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 8,
  border: "2px solid",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  fontWeight: 800,
  flexShrink: 0,
  marginTop: 1,
};
const pill: CSSProperties = {
  display: "inline-block",
  borderRadius: 999,
  padding: "3px 10px",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};
const brief: CSSProperties = {
  display: "block",
  fontSize: 13,
  lineHeight: 1.45,
  color: "#57534e",
  marginTop: 8,
  padding: "8px 10px",
  background: "#faf7f1",
  borderRadius: 10,
  whiteSpace: "pre-line",
};
const fieldLabel: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 14, color: "#44403c" };
const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 12px",
  fontSize: 16,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "#fff",
  color: "#14181a",
  marginTop: 6,
  outline: "none",
  fontFamily: "inherit",
};
const hint: CSSProperties = { display: "block", fontSize: 12, fontWeight: 400, color: "#78716c", marginTop: 6 };
const primaryBtn: CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  minHeight: 48,
  borderRadius: 12,
  border: "none",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};
const secondaryBtn: CSSProperties = {
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
const resultRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "10px 0",
  borderTop: "1px solid #f5f5f4",
};
const bookedCard: CSSProperties = {
  background: "#faf7f1",
  border: "1px solid #e7e5e4",
  borderRadius: 14,
  padding: "14px 14px",
};
const calBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  minHeight: 38,
  borderRadius: 10,
  border: "1px solid #d6d3d1",
  background: "#ffffff",
  color: "#1c1917",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
};
const releaseLinkBtn: CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  fontSize: 12,
  fontWeight: 600,
  color: "#78716c",
  textDecoration: "underline",
  cursor: "pointer",
};
const dismissBtn: CSSProperties = {
  background: "transparent",
  border: "1px solid #e7e5e4",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 600,
  color: "#57534e",
  cursor: "pointer",
};
const releaseMetaBox: CSSProperties = {
  background: "#faf7f1",
  border: "1px solid #e7e5e4",
  borderRadius: 12,
  padding: "10px 12px",
  marginTop: 10,
};
const urgentCalloutBox: CSSProperties = {
  background: "#fdeee8",
  border: `1px solid ${ORANGE}`,
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 14,
  lineHeight: 1.5,
  color: "#7c2d12",
};
const stickyBar: CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
  background: "rgba(250, 247, 241, 0.94)",
  borderTop: "1px solid #e7e5e4",
  display: "flex",
  justifyContent: "center",
  backdropFilter: "blur(8px)",
};
const footer: CSSProperties = { marginTop: 24, textAlign: "center", fontSize: 12, color: "#a8a29e" };
