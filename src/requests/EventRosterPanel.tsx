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

import React, { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { AmbassadorEventsForEventQuery } from "@/api/queries/AmbassadorEventsForEventQuery";
import type { AmbassadorEventsForEventQuery as AmbassadorEventsForEventQueryType } from "@api/queries/__generated__/AmbassadorEventsForEventQuery.graphql";
import { CancelShiftInviteMutation } from "@/api/mutations/CancelShiftInviteMutation";
import type { CancelShiftInviteMutation as CancelShiftInviteMutationType } from "@api/mutations/__generated__/CancelShiftInviteMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

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
  const showAlert = useAlertStore((s) => s.showAlert);
  const data = useLazyLoadQuery<AmbassadorEventsForEventQueryType>(
    AmbassadorEventsForEventQuery,
    { eventId },
    { fetchPolicy: "store-or-network" },
  );

  const [commitCancel, isCancelling] =
    useMutation<CancelShiftInviteMutationType>(CancelShiftInviteMutation);
  const [optimisticCancelled, setOptimisticCancelled] = useState<Set<string>>(
    new Set(),
  );

  const allRows = (data.ambassadorEvents?.edges ?? [])
    .map((e) => e?.node)
    .filter((n): n is AmbassadorEventNode => Boolean(n));
  const rows = allRows.filter((r) => !optimisticCancelled.has(r.uuid));

  const accepted = rows.filter((r) => r.isApproved);
  const pending = rows.filter((r) => !r.isApproved);

  const handleCancel = (row: AmbassadorEventNode) => {
    const baName = displayName(row.ambassador);
    const verb = row.isApproved ? "remove" : "cancel";
    const message = row.isApproved
      ? `Remove ${baName} from this shift? They'll be unscheduled.`
      : `Cancel the invite to ${baName}?`;
    if (!window.confirm(message)) return;
    commitCancel({
      variables: { input: { ambassadorEventUuid: row.uuid } },
      onCompleted: (resp) => {
        const r = resp.cancelShiftInvite;
        if (r?.success) {
          showAlert(
            row.isApproved
              ? `${baName} removed from shift.`
              : `Invite to ${baName} cancelled.`,
            "success",
          );
          setOptimisticCancelled((prev) => {
            const next = new Set(prev);
            next.add(row.uuid);
            return next;
          });
        } else {
          showAlert(
            r?.message || `Could not ${verb} this invite.`,
            "error",
          );
        }
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

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
    return (
      <div
        key={row.uuid}
        className="flex items-center justify-between py-2 gap-2"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
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
          className="mono text-[10px]"
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
        <button
          disabled={isCancelling}
          onClick={() => handleCancel(row)}
          className="text-[10px] mono transition"
          style={{
            letterSpacing: "0.14em",
            color: "rgba(255,90,42,0.85)",
            border: "1px solid rgba(255,90,42,0.35)",
            background: "transparent",
            padding: "2px 8px",
            borderRadius: 999,
            opacity: isCancelling ? 0.5 : 1,
            cursor: isCancelling ? "wait" : "pointer",
          }}
          title={
            row.isApproved
              ? "Remove this BA from the shift"
              : "Cancel this invite"
          }
        >
          {row.isApproved ? "REMOVE" : "CANCEL"}
        </button>
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
