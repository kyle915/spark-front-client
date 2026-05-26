/**
 * Per-event "Roster" panel for /request/view. Lists invited BAs +
 * their accept state and clock-in / recap progress for the shift.
 *
 * What it surfaces:
 *   - ACCEPTED — invite is_approved=True. BA is committed.
 *   - PENDING — invite is_approved=False. Push has been sent; no
 *     response yet.
 *
 * Declined invites delete the AmbassadorEvent row, so they don't
 * appear here. Cancelled invites work the same way.
 *
 * Loads lazily — the parent gates rendering behind a Suspense
 * boundary so the Request View paints first.
 */

import React, { Suspense } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { AmbassadorEventsForEventQuery } from "@/api/queries/AmbassadorEventsForEventQuery";
import type { AmbassadorEventsForEventQuery as AmbassadorEventsForEventQueryType } from "@api/queries/__generated__/AmbassadorEventsForEventQuery.graphql";
import RateBaControl from "@/components/RateBaControl";

type AmbassadorEventNode = NonNullable<
  NonNullable<
    NonNullable<
      AmbassadorEventsForEventQueryType["response"]["ambassadorEvents"]
    >["edges"][number]
  >["node"]
>;

const displayName = (
  ambassador: AmbassadorEventNode["ambassador"],
): string => {
  const user = ambassador?.user;
  const full = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  if (full) return full;
  if (user?.email) return user.email;
  return "(unnamed BA)";
};

const Inner: React.FC<{ eventId: string; eventLabel: string }> = ({
  eventId,
  eventLabel,
}) => {
  const data = useLazyLoadQuery<AmbassadorEventsForEventQueryType>(
    AmbassadorEventsForEventQuery,
    { eventId },
    { fetchPolicy: "store-or-network" },
  );

  const rows = (data.ambassadorEvents?.edges ?? [])
    .map((e) => e?.node)
    .filter((n): n is AmbassadorEventNode => Boolean(n));

  const accepted = rows.filter((r) => r.isApproved);
  const pending = rows.filter((r) => !r.isApproved);

  if (rows.length === 0) {
    return (
      <div
        className="spark-card p-5"
        style={{ borderColor: "var(--spark-border)" }}
      >
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            ROSTER · {eventLabel.toUpperCase()}
          </p>
        </div>
        <p
          className="text-xs"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          No BAs invited to this shift yet. Use the ✦ INVITE BA button
          above to send a push.
        </p>
      </div>
    );
  }

  const Row: React.FC<{
    row: AmbassadorEventNode;
    tone: "lime" | "gold";
  }> = ({ row, tone }) => {
    const color =
      tone === "lime" ? "var(--spark-lime)" : "var(--spark-gold)";
    const baId = row.ambassador?.id ?? "";
    return (
      <div
        key={row.uuid}
        className="py-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {displayName(row.ambassador)}
            </p>
            {row.ambassador?.address ? (
              <p
                className="text-xs truncate"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                {row.ambassador.address}
              </p>
            ) : null}
          </div>
          <span
            className="mono text-[10px] ml-2"
            style={{
              letterSpacing: "0.16em",
              color,
              border: `1px solid ${color}55`,
              padding: "2px 8px",
              borderRadius: 999,
            }}
          >
            {tone === "lime" ? "ACCEPTED" : "PENDING"}
          </span>
        </div>
        {/* Rate accepted BAs inline — click a star to save. The dense
            roster keeps it comment-free; the recap view + BA page offer
            the full control with an optional note. */}
        {tone === "lime" && baId && (
          <div className="mt-2 flex items-center gap-2">
            <span
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              RATE
            </span>
            <RateBaControl
              ambassadorId={baId}
              eventId={eventId}
              ambassadorName={displayName(row.ambassador)}
              compact
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="spark-card p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          ROSTER · {eventLabel.toUpperCase()}
        </p>
        <div className="flex items-center gap-2">
          <span
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.16em",
              color: "var(--spark-lime)",
            }}
          >
            ● {accepted.length} ACCEPTED
          </span>
          {pending.length > 0 && (
            <span
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.16em",
                color: "var(--spark-gold)",
              }}
            >
              ● {pending.length} PENDING
            </span>
          )}
        </div>
      </div>
      {accepted.length > 0 && (
        <div className="mb-3">
          {accepted.map((r) => (
            <Row key={r.uuid} row={r} tone="lime" />
          ))}
        </div>
      )}
      {pending.length > 0 && (
        <div>
          {pending.map((r) => (
            <Row key={r.uuid} row={r} tone="gold" />
          ))}
        </div>
      )}
    </div>
  );
};

const EventRosterPanel: React.FC<{
  eventId: string;
  eventLabel: string;
}> = ({ eventId, eventLabel }) => {
  return (
    <Suspense
      fallback={
        <div
          className="spark-card p-5 text-xs"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          Loading roster…
        </div>
      }
    >
      <Inner eventId={eventId} eventLabel={eventLabel} />
    </Suspense>
  );
};

export default EventRosterPanel;
