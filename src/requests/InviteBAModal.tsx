import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { AmbassadorsListQuery } from "@/api/queries/AmbassadorsListQuery";
import type { AmbassadorsListQuery as AmbassadorsListQueryType } from "@api/queries/__generated__/AmbassadorsListQuery.graphql";
import { InviteAmbassadorToShiftMutation } from "@/api/mutations/InviteAmbassadorToShiftMutation";
import type { InviteAmbassadorToShiftMutation as InviteAmbassadorToShiftMutationType } from "@api/mutations/__generated__/InviteAmbassadorToShiftMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";

/**
 * Admin modal that lists active BAs and lets the admin invite one
 * to a specific Event. The mutation creates an AmbassadorEvent
 * (is_approved=False) which fires the existing post_save signal —
 * "New shift offered" push lands on the BA's phone in seconds.
 *
 * Filters out BAs already invited (parent passes the existing
 * AmbassadorEvent uuids), shows their email + market, and the
 * invite button toasts on success.
 */

type Props = {
  /** Event ID (Relay base64) the BA is being invited to. */
  eventId: string;
  /** Optional: ambassador ids (Relay base64) already invited so we
   *  can render them as "Invited" and disable the button. */
  alreadyInvitedAmbassadorIds?: string[];
  onClose: () => void;
  /** Optional callback after a successful invite — parent can re-
   *  fetch its events/recaps prefetch chain to pick up the new row. */
  onInvited?: (ambassadorEventUuid: string) => void;
};

type Row = {
  id: string;
  uuid: string;
  name: string;
  email: string;
  address: string;
  alreadyInvited: boolean;
};

const Inner: React.FC<{
  eventId: string;
  alreadyInvited: Set<string>;
  onClose: () => void;
  onInvited?: (ambassadorEventUuid: string) => void;
}> = ({ eventId, alreadyInvited, onClose, onInvited }) => {
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [search, setSearch] = useState("");
  // Track which BAs the admin has ticked. Click a row (or its
  // checkbox) to toggle. A sticky footer fires the invite mutation
  // for each selected BA in parallel — N invites = N round-trips
  // but each one is fast (one INSERT + one push enqueue) and the
  // typical batch is 2–5 BAs.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Track which selected rows are still in-flight so the row label
  // can show "Sending…" while the global "Invite N" button is busy.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [optimisticDone, setOptimisticDone] = useState<Set<string>>(new Set());

  const data = useLazyLoadQuery<AmbassadorsListQueryType>(
    AmbassadorsListQuery,
    {
      filters: tenantId ? { tenantId, isActive: true } : { isActive: true },
      first: 500,
    },
    { fetchPolicy: "store-or-network" },
  );

  const [commitInvite, isInviting] =
    useMutation<InviteAmbassadorToShiftMutationType>(
      InviteAmbassadorToShiftMutation,
    );

  const rows: Row[] = useMemo(() => {
    return (
      data?.ambassadors?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          const name =
            [n.user?.firstName, n.user?.lastName].filter(Boolean).join(" ") ||
            n.user?.email ||
            "(unnamed)";
          return {
            id: String(n.id),
            uuid: String(n.uuid),
            name,
            email: n.user?.email ?? "",
            address: n.address ?? "",
            alreadyInvited:
              alreadyInvited.has(String(n.id)) ||
              optimisticDone.has(String(n.id)),
          };
        }) ?? []
    );
  }, [data, alreadyInvited, optimisticDone]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.address.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Fires one invite mutation per selected BA. Sequential rather than
  // Promise.all so we get well-ordered toasts + can show "X of N"
  // progress in the footer button. For a typical 2–5 BA batch the
  // total wall-clock is well under a second.
  const inviteSelected = async () => {
    if (selectedIds.size === 0) return;
    const targets = filtered.filter(
      (r) => selectedIds.has(r.id) && !r.alreadyInvited,
    );
    if (targets.length === 0) {
      showAlert("Nothing new to invite — already on the shift.", "info");
      return;
    }
    setPendingIds(new Set(targets.map((t) => t.id)));
    let okCount = 0;
    let failCount = 0;
    for (const row of targets) {
      // Each iteration awaits the mutation so the in-flight set
      // shrinks one row at a time — gives the user real progress.
      await new Promise<void>((resolve) => {
        commitInvite({
          variables: { input: { ambassadorId: row.id, eventId } },
          onCompleted: (resp) => {
            const r = resp.inviteAmbassadorToShift;
            if (r?.success) {
              okCount += 1;
              setOptimisticDone((prev) => {
                const next = new Set(prev);
                next.add(row.id);
                return next;
              });
              if (r.ambassadorEventUuid) {
                onInvited?.(String(r.ambassadorEventUuid));
              }
            } else {
              failCount += 1;
              showAlert(
                r?.message || `Couldn't invite ${row.name}.`,
                "error",
              );
            }
            setPendingIds((prev) => {
              const next = new Set(prev);
              next.delete(row.id);
              return next;
            });
            resolve();
          },
          onError: (err) => {
            failCount += 1;
            showAlert(`${row.name}: ${err.message}`, "error");
            setPendingIds((prev) => {
              const next = new Set(prev);
              next.delete(row.id);
              return next;
            });
            resolve();
          },
        });
      });
    }
    // Single rollup toast on completion so the user doesn't see N
    // individual success toasts.
    if (okCount > 0) {
      showAlert(
        failCount > 0
          ? `Invited ${okCount} BA${okCount === 1 ? "" : "s"} (${failCount} failed).`
          : `Invited ${okCount} BA${okCount === 1 ? "" : "s"}.`,
        failCount > 0 ? "warning" : "success",
      );
    }
    // Clear selection once the batch is done so the modal is ready
    // for a follow-up round (rare but cheap).
    setSelectedIds(new Set());
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
        style={{ borderRadius: 20, maxHeight: "80vh", display: "flex", flexDirection: "column" }}
      >
        <div
          className="p-5"
          style={{ borderBottom: "1px solid var(--spark-border)" }}
        >
          <p
            className="mono text-[10px] mb-1"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            INVITE A BRAND AMBASSADOR
          </p>
          <h2 className="display text-xl font-bold">Who do you want on this shift?</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or market…"
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
          {filtered.length === 0 && (
            <p
              className="p-6 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              No active BAs match.
            </p>
          )}
          {filtered.map((row) => {
            const checked = selectedIds.has(row.id);
            const busy = pendingIds.has(row.id);
            // Tap anywhere on the row toggles selection — easier on
            // mobile than aiming for the checkbox.
            const onRowClick = () => {
              if (row.alreadyInvited || busy) return;
              toggleSelected(row.id);
            };
            return (
              <div
                key={row.id}
                onClick={onRowClick}
                className="flex items-center gap-3 px-5 py-3"
                style={{
                  borderBottom: "1px solid var(--spark-border)",
                  cursor: row.alreadyInvited || busy ? "default" : "pointer",
                  background: checked
                    ? "rgba(197,245,70,0.06)"
                    : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSelected(row.id)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={row.alreadyInvited || busy}
                  className="shrink-0 cursor-pointer"
                  style={{
                    accentColor: "var(--spark-lime)",
                    width: 16,
                    height: 16,
                  }}
                />
                <div
                  className="rounded-full grid place-items-center font-bold shrink-0"
                  style={{
                    width: 32,
                    height: 32,
                    background: "rgba(197,245,70,0.10)",
                    color: "var(--spark-lime)",
                    fontSize: 12,
                  }}
                >
                  {row.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{row.name}</p>
                  <p
                    className="mono text-[10px] truncate"
                    style={{
                      letterSpacing: "0.14em",
                      color: "rgba(255,255,255,0.45)",
                    }}
                  >
                    {row.email}
                  </p>
                </div>
                {row.alreadyInvited && (
                  <span
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.18em",
                      color: "var(--spark-lime)",
                      paddingRight: 4,
                    }}
                  >
                    ✓ INVITED
                  </span>
                )}
                {busy && !row.alreadyInvited && (
                  <span
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.18em",
                      color: "rgba(255,255,255,0.55)",
                      paddingRight: 4,
                    }}
                  >
                    Sending…
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="p-4 flex items-center justify-between gap-3"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          {/* Left side: live count of what'll get sent. Hidden when
              nothing's ticked so the empty modal doesn't shout at you. */}
          <span
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color:
                selectedIds.size > 0
                  ? "var(--spark-lime)"
                  : "rgba(255,255,255,0.35)",
            }}
          >
            {selectedIds.size === 0
              ? "TAP ROWS TO SELECT"
              : `${selectedIds.size} SELECTED`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isInviting}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              {isInviting ? "Wait…" : "Done"}
            </button>
            <button
              onClick={inviteSelected}
              disabled={isInviting || selectedIds.size === 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                boxShadow:
                  selectedIds.size > 0
                    ? "0 0 16px rgba(197,245,70,0.35)"
                    : "none",
              }}
            >
              {isInviting
                ? `Inviting ${pendingIds.size}…`
                : selectedIds.size === 1
                  ? "Invite 1 BA"
                  : `Invite ${selectedIds.size} BAs`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function InviteBAModal({
  eventId,
  alreadyInvitedAmbassadorIds = [],
  onClose,
  onInvited,
}: Props) {
  const alreadyInvited = useMemo(
    () => new Set(alreadyInvitedAmbassadorIds.map(String)),
    [alreadyInvitedAmbassadorIds],
  );
  return (
    <Suspense
      fallback={
        <div
          onClick={onClose}
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{
            background: "rgba(10,11,13,0.7)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="spark-card p-6"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Loading BAs…
          </div>
        </div>
      }
    >
      <Inner
        eventId={eventId}
        alreadyInvited={alreadyInvited}
        onClose={onClose}
        onInvited={onInvited}
      />
    </Suspense>
  );
}
