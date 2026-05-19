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
  const [pendingId, setPendingId] = useState<string | null>(null);
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

  const invite = (row: Row) => {
    if (isInviting || row.alreadyInvited) return;
    setPendingId(row.id);
    commitInvite({
      variables: { input: { ambassadorId: row.id, eventId } },
      onCompleted: (resp) => {
        setPendingId(null);
        const r = resp.inviteAmbassadorToShift;
        if (r?.success) {
          showAlert(
            r.message || `Invite sent to ${row.name}.`,
            "success",
          );
          setOptimisticDone((prev) => {
            const next = new Set(prev);
            next.add(row.id);
            return next;
          });
          if (r.ambassadorEventUuid) {
            onInvited?.(String(r.ambassadorEventUuid));
          }
        } else {
          showAlert(r?.message || "Couldn't invite this BA.", "error");
        }
      },
      onError: (err) => {
        setPendingId(null);
        showAlert(err.message, "error");
      },
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
            const busy = pendingId === row.id;
            return (
              <div
                key={row.id}
                className="flex items-center gap-3 px-5 py-3"
                style={{ borderBottom: "1px solid var(--spark-border)" }}
              >
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
                {row.alreadyInvited ? (
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
                ) : (
                  <button
                    onClick={() => invite(row)}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{
                      background: "var(--spark-lime)",
                      color: "#0a0d09",
                      opacity: busy ? 0.5 : 1,
                    }}
                  >
                    {busy ? "Sending…" : "Invite"}
                  </button>
                )}
              </div>
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
            Done
          </button>
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
