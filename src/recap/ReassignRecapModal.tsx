import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { RecapEventOptionsQuery } from "@/api/queries/RecapEventOptionsQuery";
import type { RecapEventOptionsQuery as RecapEventOptionsQueryType } from "@api/queries/__generated__/RecapEventOptionsQuery.graphql";
import { ReassignRecapEventMutation } from "@/api/mutations/ReassignRecapEventMutation";
import type { ReassignRecapEventMutation as ReassignRecapEventMutationType } from "@api/mutations/__generated__/ReassignRecapEventMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";

/**
 * Move a recap to a different Event when it was filed against the
 * wrong shift. Powered by the spark-api `reassignRecapEvent`
 * mutation which enforces a same-tenant guard.
 *
 * Surface:
 *   - Search input filters tenant events
 *   - Click a row → call mutation → close on success
 *   - Current event is shown at top so the admin can verify what
 *     they're moving away from
 *
 * Use case: BA had two shifts on the same day (e.g. morning + evening)
 * and filed the recap against the wrong one. Without this, the only
 * recourse was deleting + re-filing.
 */

type Props = {
  recapId: string;
  currentEventName: string | null;
  currentEventId: string | null;
  onClose: () => void;
  onReassigned?: () => void;
};

const Inner: React.FC<Props> = ({
  recapId,
  currentEventName,
  currentEventId,
  onClose,
  onReassigned,
}) => {
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [search, setSearch] = useState("");

  // Use the tenant-scoped `recapEventOptions` query, NOT the general
  // `events` query. The backend hard-scopes this to the active tenant and
  // returns nothing when no tenant is in scope, so the picker can't leak
  // another client's events even if `tenantId` is somehow empty. The
  // reassign mutation already enforces a same-tenant guard server-side;
  // this keeps the picker itself from ever surfacing cross-tenant events
  // (which the general `events` query did for unrestricted roles).
  const data = useLazyLoadQuery<RecapEventOptionsQueryType>(
    RecapEventOptionsQuery,
    { first: 200, q: search || null, tenantId: tenantId || null },
    { fetchPolicy: "store-or-network" },
  );

  // Exclude the current event so the admin can't move a recap to the
  // same row it's already on — pointless action that just wastes a
  // mutation round-trip.
  const events = useMemo(
    () =>
      (data?.recapEventOptions?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n))
        .filter((n) => String(n.id) !== currentEventId),
    [data, currentEventId],
  );

  const [commitReassign, isReassigning] =
    useMutation<ReassignRecapEventMutationType>(ReassignRecapEventMutation);

  const reassign = (eventId: string, label: string) => {
    if (isReassigning) return;
    commitReassign({
      variables: { input: { recapId, eventId } },
      onCompleted: (res) => {
        const r = res.reassignRecapEvent;
        if (r?.success) {
          showAlert(`Recap moved to "${label}".`, "success");
          onReassigned?.();
          onClose();
        } else {
          showAlert(r?.message ?? "Reassign failed.", "error");
        }
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[8vh]"
      style={{
        background: "rgba(10,11,13,0.7)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg spark-card overflow-hidden"
        style={{
          borderRadius: 20,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="p-5" style={{ borderBottom: "1px solid var(--spark-border)" }}>
          <p
            className="mono text-[10px] mb-1"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-text-meta)",
            }}
          >
            REASSIGN RECAP
          </p>
          <h2 className="display text-xl font-bold">Move this recap to a different event</h2>
          {currentEventName && (
            <p
              className="text-xs mt-2"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Currently linked to:{" "}
              <span style={{ color: "var(--spark-text)" }}>
                {currentEventName}
              </span>
            </p>
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events by name…"
            autoFocus
            className="w-full mt-3 rounded-xl text-sm"
            style={{
              padding: "0.6rem 0.85rem",
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              outline: "none",
            }}
          />
        </div>

        <div className="overflow-y-auto" style={{ flex: 1 }}>
          {events.length === 0 && (
            <p
              className="p-6 text-center text-sm"
              style={{ color: "var(--spark-text-meta)" }}
            >
              {search
                ? "No events match that search."
                : "No other events available."}
            </p>
          )}
          {events.map((ev) => {
            const label =
              ev.request?.retailer?.name ??
              ev.name ??
              ev.address ??
              `Event ${ev.uuid?.slice(-4)}`;
            return (
              <button
                type="button"
                key={ev.id}
                onClick={() => reassign(String(ev.id), label)}
                disabled={isReassigning}
                className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left disabled:opacity-50"
                style={{
                  borderBottom: "1px solid var(--spark-border)",
                  cursor: "pointer",
                  background: "transparent",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(242,243,238,0.06)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "transparent";
                }}
              >
                <div className="flex-1 min-w-0">
                  {/* Client/brand label so it's always clear which client
                      an event belongs to before reassigning to it.
                      Consistent with the recap-create picker. */}
                  {ev.tenant?.name && (
                    <span
                      className="chip chip-muted mb-1"
                      style={{ display: "inline-flex" }}
                    >
                      {ev.tenant.name}
                    </span>
                  )}
                  <p className="text-sm font-medium truncate">{label}</p>
                  {ev.address && (
                    <p
                      className="mono text-[10px] truncate"
                      style={{
                        letterSpacing: "0.14em",
                        color: "var(--spark-text-meta)",
                      }}
                    >
                      {ev.address}
                    </p>
                  )}
                </div>
                <span
                  className="mono text-[10px] shrink-0"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-lime)",
                  }}
                >
                  MOVE →
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="p-4 flex justify-end"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ReassignRecapModal(props: Props) {
  return (
    <Suspense
      fallback={
        <div
          onClick={props.onClose}
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{
            background: "rgba(10,11,13,0.7)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="spark-card p-6"
            style={{ color: "var(--spark-text-meta)" }}
          >
            Loading events…
          </div>
        </div>
      }
    >
      <Inner {...props} />
    </Suspense>
  );
}
