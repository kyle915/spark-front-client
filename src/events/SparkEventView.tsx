/**
 * Spark v2 — Event detail view.
 *
 * Replaces the legacy EventCard (DaisyUI, duplicate Notes panel,
 * stacked daisy badges) with a focused Spark-chrome detail page.
 *
 * Layout principles:
 *   - One header with the event name + status / type / scope chips
 *   - One summary chip-row (date, time, account, address)
 *   - Notes shown ONCE in a single panel (legacy had it in 3 places)
 *   - Details + products grouped into one structured grid
 *   - Roster panel (admin-only) appears below details, surfacing
 *     invited + accepted BAs for this event
 *   - Shift Replay panel — GPS trail if any pings exist
 *   - Back link respects history state, falls back to the Master Tracker
 */

import React, { Suspense, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import Layout from "@/layout/Layout";
import useSparkRole from "@/hooks/useSparkRole";

import { EventUuidQuery } from "@/api/queries/EventUuidQuery";
import type { EventUuidQuery as EventUuidQueryType } from "@api/queries/__generated__/EventUuidQuery.graphql";
import ShiftReplayPanel from "@/requests/ShiftReplayPanel";
import EventAttendanceTable from "@/requests/EventAttendanceTable";
import EventMileagePanel from "@/requests/EventMileagePanel";
import InviteBAModal from "@/requests/InviteBAModal";
import { pickHeroImage } from "@/utils/recapFileUrl";

// Element id the header recap chip scrolls to when an event has >1 recap.
const RECAPS_SECTION_ID = "event-recaps";

type Event = NonNullable<EventUuidQueryType["response"]["event"]>;

const STATUS_CHIP: Record<string, string> = {
  pending: "chip chip-orange",
  queue: "chip chip-gold",
  approved: "chip chip-lime",
  scheduled: "chip chip-sky",
  done: "chip chip-lime",
  declined: "chip chip-muted",
  cancelled: "chip chip-muted",
  canceled: "chip chip-muted",
};

const fmtDate = (raw: string | null | undefined) => {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

const fmtTime = (raw: string | null | undefined) => {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return raw;
  }
};

const initials = (label: string) => {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// A recap can be a legacy `Recap` or a custom-template `CustomRecap`. The
// two share a chip on the Master Tracker but differ in shape, so we
// normalize each into this one card model and render a single grid below.
type RecapCard = {
  uuid: string;
  // Detail route — legacy and custom recaps live on different pages.
  viewPath: string;
  name: string | null;
  approved: boolean;
  createdAt: string | null;
  baName: string | null;
  totalEngagements: number | null;
  productsSold: number | null;
  hero: string | null;
  fileCount: number;
};

type LegacyRecap = NonNullable<NonNullable<Event["recaps"]>[number]>;
type CustomRecap = NonNullable<NonNullable<Event["customRecaps"]>[number]>;

const baNameFrom = (
  user: { firstName?: string | null; lastName?: string | null } | null | undefined,
): string | null =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;

const normalizeLegacyRecap = (recap: LegacyRecap): RecapCard => ({
  uuid: String(recap.uuid),
  viewPath: `/recap/view/${recap.uuid}`,
  name: recap.name ?? null,
  approved: Boolean(recap.approved),
  createdAt: recap.createdAt ?? null,
  baName: baNameFrom(recap.ambassador?.user),
  totalEngagements: recap.totalEngagements ?? null,
  productsSold: recap.productsSold ?? null,
  hero: pickHeroImage(recap.recapFiles ?? []),
  fileCount: (recap.recapFiles ?? []).filter(
    (f) => f && (f.file?.toString() || "").length > 0,
  ).length,
});

const normalizeCustomRecap = (recap: CustomRecap): RecapCard => ({
  uuid: String(recap.uuid),
  // Custom recaps render on their own detail page (RecapCustomView).
  viewPath: `/recap/view-custom/${recap.uuid}`,
  name: recap.name ?? null,
  approved: Boolean(recap.approved),
  createdAt: recap.createdAt ?? null,
  baName: baNameFrom(recap.ambassador?.user),
  totalEngagements: recap.totalEngagements ?? null,
  // CustomRecap exposes a single soldUnits count rather than productsSold.
  productsSold: recap.soldUnits ?? null,
  // CustomRecap precomputes a browser-renderable hero URL server-side; the
  // file list isn't fetched here, just its count.
  hero: recap.heroImageUrl ?? null,
  fileCount: recap.customRecapFilesCount ?? 0,
});

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div>
    <p
      className="mono text-[10px] mb-1"
      style={{
        letterSpacing: "0.18em",
        color: "rgba(255,255,255,0.45)",
      }}
    >
      {label}
    </p>
    <div
      className="text-sm"
      style={{ color: "rgba(255,255,255,0.85)" }}
    >
      {children}
    </div>
  </div>
);

const SummaryPill: React.FC<{
  icon: string;
  children: React.ReactNode;
}> = ({ icon, children }) => (
  <span
    className="flex items-center gap-2 text-sm"
    style={{ color: "rgba(255,255,255,0.75)" }}
  >
    <span
      aria-hidden
      style={{
        color: "rgba(255,255,255,0.45)",
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      {icon}
    </span>
    <span>{children}</span>
  </span>
);

const Inner: React.FC<{ uuid: string; backTo: string }> = ({
  uuid,
  backTo,
}) => {
  const role = useSparkRole();
  const navigate = useNavigate();
  const location = useLocation();
  // Bumped after an invite so the Roster panel refetches and shows the
  // newly-invited BA immediately (otherwise the page looked like "nothing
  // happened" until a manual reload).
  const [refreshKey, setRefreshKey] = useState(0);
  const data = useLazyLoadQuery<EventUuidQueryType>(
    EventUuidQuery,
    { uuid },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );
  const event = data.event as Event | null;
  // Admin "Assign BA" modal (same InviteBAModal the Master Tracker row
  // action uses). The event detail view previously had no way to staff,
  // even though the tracker row offered it — this closes that gap.
  const [showAssign, setShowAssign] = useState(false);

  if (!event) {
    return (
      <div
        className="spark-card p-10 text-center max-w-3xl"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        Event not found.
      </div>
    );
  }

  const slug = (event.status?.name ?? "").toLowerCase();
  const chipClass = STATUS_CHIP[slug] ?? "chip chip-muted";
  const venue =
    event.request?.retailer?.name ?? event.retailer?.name ?? "—";
  const distributor =
    event.request?.distributor?.name ?? event.distributor?.name ?? "—";
  const products = event.request?.products ?? [];
  const requestUuid = event.request?.uuid;
  const requestName = event.request?.name;
  const eventTypeName = event.eventType?.name ?? "—";
  const scope = event.isNational ? "National" : "Local";
  const hasNotes = Boolean(event.notes?.trim());
  const ambassadors = event.ambassadors ?? [];
  const confirmedCount = ambassadors.filter((a) => a.isApproved).length;
  // Recaps filed against this event. The Master Tracker surfaces these as a
  // green "● n RECAP" chip but clicking the event used to dead-end here —
  // we now mirror SparkRequestView's recap cards + /recap/view route.
  //
  // BOTH legacy recaps and custom-template recaps count toward the chip
  // (and toward /recaps/missing), so we render both here. The two backend
  // types have different shapes (Recap: recapFiles/productsSold; CustomRecap:
  // heroImageUrl/soldUnits), so we normalize each into one RecapCard model
  // and render a single card grid — no duplicated card markup, and the chip
  // count matches the list.
  const recaps: RecapCard[] = [
    ...(event.recaps ?? [])
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => normalizeLegacyRecap(r)),
    ...(event.customRecaps ?? [])
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => normalizeCustomRecap(r)),
  ];
  // Header chip behavior: a single recap jumps straight to its detail; many
  // recaps smooth-scroll to the bottom Recaps section so the user can pick.
  const onRecapChip = () => {
    if (recaps.length === 1) {
      navigate(recaps[0].viewPath);
      return;
    }
    document
      .getElementById(RECAPS_SECTION_ID)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <Link
        to={backTo}
        className="mono text-[11px] inline-flex items-center gap-2 transition"
        style={{
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.55)",
          textDecoration: "none",
        }}
      >
        ← BACK
      </Link>

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div className="min-w-0 flex-1">
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            EVENT
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            {event.name ?? "Untitled event"}
          </h1>
          <p
            className="mt-2 text-sm"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Scheduled for{" "}
            <span style={{ color: "rgba(255,255,255,0.85)" }}>{venue}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={chipClass}>● {event.status?.name ?? "—"}</span>
          {event.eventType?.name && (
            <span className="chip chip-sky">{eventTypeName}</span>
          )}
          <span className="chip chip-muted">
            {scope === "National" ? "◉ NATIONAL" : "⌖ LOCAL"}
          </span>
          {recaps.length > 0 && (
            <button
              type="button"
              onClick={onRecapChip}
              className="chip chip-lime"
              style={{ cursor: "pointer", border: "none" }}
              title={
                recaps.length === 1
                  ? "View recap"
                  : `View ${recaps.length} recaps`
              }
            >
              ● {recaps.length} RECAP{recaps.length === 1 ? "" : "S"}
            </button>
          )}
          {recaps.length === 0 &&
            (event.request?.recapsFiledCount ?? 0) > 0 &&
            event.request?.recapEventUuid &&
            event.request.recapEventUuid !== event.uuid && (
              <button
                type="button"
                onClick={() =>
                  navigate(`/event/view/${event.request!.recapEventUuid}`, {
                    state: { from: location.pathname },
                  })
                }
                className="chip chip-lime"
                style={{ cursor: "pointer", border: "none" }}
                title="Recap filed on a linked shift for this request"
              >
                ● {event.request.recapsFiledCount} RECAP
                {(event.request.recapsFiledCount ?? 0) === 1 ? "" : "S"} ON
                LINKED SHIFT
              </button>
            )}
          {role.isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setShowAssign(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition"
                style={{
                  background: "var(--spark-lime)",
                  color: "#0a0d09",
                  border: "1px solid var(--spark-lime)",
                }}
              >
                ✚ Assign BA
              </button>
              <Link
                to={`/event/edit/${event.uuid}`}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition"
                style={{
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                  textDecoration: "none",
                }}
              >
                ✎ Edit
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Summary chips */}
      <div
        className="spark-card flex items-center gap-6 flex-wrap"
        style={{
          padding: "1rem 1.25rem",
        }}
      >
        <SummaryPill icon="▣">
          {fmtDate(event.date ?? event.startTime)}
        </SummaryPill>
        <SummaryPill icon="◷">
          {fmtTime(event.startTime)} – {fmtTime(event.endTime)}
        </SummaryPill>
        <SummaryPill icon="◐">{venue}</SummaryPill>
        <SummaryPill icon="⌖">{event.address ?? "—"}</SummaryPill>
      </div>

      {/* Details grid */}
      <div className="spark-card p-6">
        <p
          className="mono text-[10px] mb-4"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-lime)",
          }}
        >
          DETAILS
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <Field label="ACCOUNT">{venue}</Field>
          <Field label="DISTRIBUTOR">{distributor}</Field>
          <Field label="TYPE">{eventTypeName}</Field>
          <Field label="SCOPE">{scope}</Field>
          <Field label="STATUS">{event.status?.name ?? "—"}</Field>
          {event.timezone?.name && (
            <Field label="TIMEZONE">
              {event.timezone.name}
              {event.timezone.code ? ` · ${event.timezone.code}` : ""}
            </Field>
          )}
          {requestUuid && (
            <Field label="ASSOCIATED REQUEST">
              <Link
                to={`/request/view/${requestUuid}`}
                style={{
                  color: "var(--spark-sky)",
                  textDecoration: "none",
                }}
              >
                {requestName ?? "View request →"}
              </Link>
            </Field>
          )}
          {event.rmmAsigned && (
            <Field label="RMM">
              {[event.rmmAsigned.firstName, event.rmmAsigned.lastName]
                .filter(Boolean)
                .join(" ") || "—"}
            </Field>
          )}
        </div>
      </div>

      {/* Notes (single source of truth) */}
      {hasNotes && (
        <div className="spark-card p-6">
          <p
            className="mono text-[10px] mb-3"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            NOTES
          </p>
          <p
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            {event.notes}
          </p>
        </div>
      )}

      {/* Products */}
      {products.length > 0 && (
        <div className="spark-card p-6">
          <p
            className="mono text-[10px] mb-4"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            PRODUCTS · {products.length}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.map((p) =>
              p ? (
                <div
                  key={p.id}
                  className="flex items-center gap-3"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--spark-border)",
                    borderRadius: 12,
                    padding: "0.75rem",
                  }}
                >
                  {p.image ? (
                    <img
                      src={p.image}
                      alt=""
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: "rgba(197,245,70,0.10)",
                        color: "var(--spark-lime)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                      }}
                    >
                      ◇
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {p.name}
                    </p>
                    {p.productType?.name && (
                      <p
                        className="text-xs truncate"
                        style={{ color: "rgba(255,255,255,0.45)" }}
                      >
                        {p.productType.name}
                      </p>
                    )}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Roster — invited + confirmed BAs staffed on this event */}
      <div className="spark-card p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            ROSTER · {ambassadors.length}
          </p>
          {ambassadors.length > 0 && (
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              {confirmedCount} CONFIRMED · {ambassadors.length - confirmedCount}{" "}
              INVITED
            </p>
          )}
        </div>
        {ambassadors.length === 0 ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p
              className="text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              No brand ambassadors assigned yet.
            </p>
            {role.isAdmin && (
              <button
                type="button"
                onClick={() => setShowAssign(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition"
                style={{
                  background: "var(--spark-lime)",
                  color: "#0a0d09",
                  border: "1px solid var(--spark-lime)",
                }}
              >
                ✚ Assign BA
              </button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ambassadors.map((a) => (
              <div
                key={a.uuid}
                className="flex items-center gap-3"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--spark-border)",
                  borderRadius: 12,
                  padding: "0.75rem",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: a.isApproved
                      ? "rgba(197,245,70,0.14)"
                      : "rgba(255,255,255,0.06)",
                    color: a.isApproved
                      ? "var(--spark-lime)"
                      : "rgba(255,255,255,0.55)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {initials(a.name || a.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {a.name || a.email || "Unnamed BA"}
                  </p>
                  {role.isAdmin && a.email && (
                    <p
                      className="text-xs truncate"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      {a.email}
                    </p>
                  )}
                </div>
                <span
                  className={
                    a.isApproved ? "chip chip-lime" : "chip chip-muted"
                  }
                >
                  {a.isApproved ? "✓ Confirmed" : "◷ Invited"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recaps — field reports filed against this event. Mirrors the
          recap cards on SparkRequestView; the header chip scrolls here. */}
      <div id={RECAPS_SECTION_ID} className="spark-card p-6">
        <p
          className="mono text-[10px] mb-4"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-lime)",
          }}
        >
          RECAPS · {recaps.length}
        </p>
        {recaps.length === 0 ? (
          <div
            className="spark-card overflow-hidden"
            style={{ borderStyle: "dashed", opacity: 0.7 }}
          >
            <div
              className="h-32 relative overflow-hidden grid place-items-center"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="text-center px-4">
                <p
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-orange)",
                  }}
                >
                  AWAITING RECAP
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  No recap filed on this event yet.
                </p>
                {(() => {
                  const filed = event.request?.recapsFiledCount ?? 0;
                  const sibling = event.request?.recapEventUuid;
                  if (filed > 0 && sibling && sibling !== event.uuid) {
                    return (
                      <button
                        type="button"
                        className="mt-3 mono text-[10px] px-3 py-1.5 rounded-lg"
                        style={{
                          letterSpacing: "0.12em",
                          color: "var(--spark-lime)",
                          border: "1px solid rgba(197,245,70,0.35)",
                          background: "rgba(197,245,70,0.08)",
                        }}
                        onClick={() =>
                          navigate(`/event/view/${sibling}`, {
                            state: { from: location.pathname },
                          })
                        }
                      >
                        ● {filed} RECAP{filed === 1 ? "" : "S"} ON LINKED SHIFT →
                      </button>
                    );
                  }
                  if (requestUuid) {
                    return (
                      <button
                        type="button"
                        className="mt-3 mono text-[10px] px-3 py-1.5 rounded-lg"
                        style={{
                          letterSpacing: "0.12em",
                          color: "rgba(255,255,255,0.7)",
                          border: "1px solid var(--spark-border)",
                          background: "transparent",
                        }}
                        onClick={() =>
                          navigate(`/request/view/${requestUuid}`, {
                            state: { from: location.pathname },
                          })
                        }
                      >
                        OPEN REQUEST FIELD REPORTS →
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recaps.map((recap) => {
              const { hero, baName, fileCount } = recap;
              return (
                <div
                  key={recap.uuid}
                  onClick={() => navigate(recap.viewPath)}
                  className="spark-card hov overflow-hidden cursor-pointer"
                >
                  <div
                    className="h-32 relative overflow-hidden"
                    style={{
                      background:
                        "radial-gradient(circle at 50% 50%, rgba(197,245,70,0.10), transparent 70%)",
                    }}
                  >
                    {hero ? (
                      <img
                        src={hero}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center">
                        <span className="text-3xl" aria-hidden>
                          ◈
                        </span>
                      </div>
                    )}
                    <span
                      className={`absolute top-2 right-2 chip ${recap.approved ? "chip-lime" : "chip-orange"}`}
                    >
                      ● {recap.approved ? "APPROVED" : "DRAFT"}
                    </span>
                    {fileCount > 0 && (
                      <span
                        className="absolute bottom-2 left-2 mono"
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.14em",
                          padding: "2px 6px",
                          borderRadius: 999,
                          background: "rgba(197,245,70,0.15)",
                          color: "var(--spark-lime)",
                          border: "1px solid rgba(197,245,70,0.35)",
                        }}
                      >
                        ◉ {fileCount} FILE{fileCount === 1 ? "" : "S"}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p
                      className="font-bold text-sm truncate"
                      title={recap.name ?? event.name ?? "Recap"}
                    >
                      {recap.name ?? event.name ?? "Recap"}
                    </p>
                    <p
                      className="mono text-[10px] uppercase mt-1 truncate"
                      style={{
                        letterSpacing: "0.14em",
                        color: "rgba(255,255,255,0.45)",
                      }}
                    >
                      {baName ? `BY ${baName} · ` : ""}
                      {fmtDate(recap.createdAt ?? event.date)}
                    </p>
                    <div
                      className="mt-3 pt-3 grid grid-cols-2 gap-2 text-center"
                      style={{ borderTop: "1px solid var(--spark-border)" }}
                    >
                      <div>
                        <p
                          className="tab-num text-base font-bold"
                          style={{ color: "var(--spark-lime)" }}
                        >
                          {recap.totalEngagements != null
                            ? recap.totalEngagements.toLocaleString()
                            : "—"}
                        </p>
                        <p className="label-mini">ENG</p>
                      </div>
                      <div>
                        <p className="tab-num text-base font-bold">
                          {recap.productsSold != null
                            ? recap.productsSold.toLocaleString()
                            : "—"}
                        </p>
                        <p className="label-mini">SOLD</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* GPS trail */}
      <ShiftReplayPanel eventUuid={String(event.uuid)} />
      <EventAttendanceTable eventUuid={String(event.uuid)} />
      {role.isAdmin && <EventMileagePanel eventUuid={String(event.uuid)} />}

      {/* Audit footer */}
      <div className="spark-card p-5">
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              EVENT UUID
            </p>
            <p
              className="mono text-xs"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              {event.uuid}
            </p>
          </div>
          {event.coordinates && event.coordinates.length === 2 && (
            <div>
              <p
                className="mono text-[10px] mb-1"
                style={{
                  letterSpacing: "0.18em",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                COORDINATES
              </p>
              <a
                href={`https://www.google.com/maps?q=${event.coordinates[0]},${event.coordinates[1]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mono text-xs"
                style={{
                  color: "var(--spark-sky)",
                  textDecoration: "none",
                }}
              >
                {event.coordinates[0].toFixed(4)},{" "}
                {event.coordinates[1].toFixed(4)} ↗
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Assign-BA modal — same component the Master Tracker row uses.
          InviteBAModal suspends (loads the BA list), so wrap in Suspense. */}
      {showAssign && (
        <Suspense fallback={null}>
          <InviteBAModal
            eventId={String(event.id)}
            eventDate={event.date ?? event.startTime ?? null}
            eventAddress={event.address ?? null}
            onClose={() => setShowAssign(false)}
            onInvited={() => {
              setShowAssign(false);
              // Refetch so the Roster panel shows the newly-invited BA.
              setRefreshKey((k) => k + 1);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default function SparkEventView() {
  const { uuid } = useParams<{ uuid: string }>();
  const location = useLocation();
  // Honor an explicit origin (e.g. Master Tracker stamps
  // from: "/requests/list"); otherwise fall back to the Master Tracker — NOT
  // the legacy "/events/list" all-events view, which is dead v1 surface.
  const backTo =
    (location.state as { from?: string } | null)?.from ?? "/requests/list";

  if (!uuid) {
    return (
      <Layout>
        <div
          className="spark-card p-10 text-center max-w-3xl"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          Event not found.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="text-xs py-12"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Loading event…
          </div>
        }
      >
        <Inner uuid={uuid} backTo={backTo} />
      </Suspense>
    </Layout>
  );
}
