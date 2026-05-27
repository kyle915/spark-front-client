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
 *   - Back link respects history state, falls back to /events/list
 */

import React, { Suspense, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Link, useLocation, useParams } from "react-router";
import Layout from "@/layout/Layout";
import useSparkRole from "@/hooks/useSparkRole";

import { EventUuidQuery } from "@/api/queries/EventUuidQuery";
import type { EventUuidQuery as EventUuidQueryType } from "@api/queries/__generated__/EventUuidQuery.graphql";
import ShiftReplayPanel from "@/requests/ShiftReplayPanel";
import InviteBAModal from "@/requests/InviteBAModal";

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
  const data = useLazyLoadQuery<EventUuidQueryType>(
    EventUuidQuery,
    { uuid },
    { fetchPolicy: "store-and-network" },
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

      {/* GPS trail */}
      <ShiftReplayPanel eventUuid={String(event.uuid)} />

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
            onInvited={() => setShowAssign(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default function SparkEventView() {
  const { uuid } = useParams<{ uuid: string }>();
  const location = useLocation();
  const backTo =
    (location.state as { from?: string } | null)?.from ?? "/events/list";

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
