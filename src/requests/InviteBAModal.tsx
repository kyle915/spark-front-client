import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { AmbassadorsListQuery } from "@/api/queries/AmbassadorsListQuery";
import type { AmbassadorsListQuery as AmbassadorsListQueryType } from "@api/queries/__generated__/AmbassadorsListQuery.graphql";
import { AmbassadorsBookedOnDateQuery } from "@/api/queries/AmbassadorsBookedOnDateQuery";
import type { AmbassadorsBookedOnDateQuery as AmbassadorsBookedOnDateQueryType } from "@api/queries/__generated__/AmbassadorsBookedOnDateQuery.graphql";
import { InviteAmbassadorToShiftMutation } from "@/api/mutations/InviteAmbassadorToShiftMutation";
import type { InviteAmbassadorToShiftMutation as InviteAmbassadorToShiftMutationType } from "@api/mutations/__generated__/InviteAmbassadorToShiftMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { loadFavorites } from "@/lib/favorites";

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
  /** Event date in ISO format — drives the "already on another shift
   *  that day" conflict-detection chip. Optional; if absent the modal
   *  skips the conflict query. */
  eventDate?: string | null;
  /** Event address — used as a coarse string-match signal when
   *  ranking BAs ("BA whose address contains the event state goes
   *  higher"). Optional. */
  eventAddress?: string | null;
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
  // Computed signals for smart-ranking. The Inner component fills
  // these on each render so they react to favorites / conflict-query
  // changes without reshuffling the source list.
  isFavorited: boolean;
  hasConflict: boolean;
  // Locality match score — higher is closer (cheap proxy until we
  // have lat/lng on both sides). 2 = state code match, 1 = city
  // substring match, 0 = neither.
  localityScore: number;
};

const Inner: React.FC<{
  eventId: string;
  alreadyInvited: Set<string>;
  eventDate: string | null;
  eventAddress: string | null;
  onClose: () => void;
  onInvited?: (ambassadorEventUuid: string) => void;
}> = ({ eventId, alreadyInvited, eventDate, eventAddress, onClose, onInvited }) => {
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [search, setSearch] = useState("");
  // Favorites set from localStorage (PR #226). Read once on render —
  // localStorage is sync; rebuilding the Set per render is cheap and
  // keeps the modal honest if kyle stars/unstars from another tab.
  const favoritesSet = useMemo(
    () => loadFavorites(tenantId ?? null),
    [tenantId],
  );

  // Cross-reference: BAs already booked on the same date (any
  // AmbassadorEvent, approved or pending). If we don't have a date
  // we skip the query and treat conflict as "unknown" (no chip).
  const bookedData = useLazyLoadQuery<AmbassadorsBookedOnDateQueryType>(
    AmbassadorsBookedOnDateQuery,
    eventDate
      ? { onDate: eventDate, tenantId: tenantId ?? null }
      : // Query is non-nullable but we still want to gate via a
        // sentinel value so Suspense doesn't tear. Pass yesterday
        // when there's no date — returns empty, costs nothing.
        { onDate: new Date(0).toISOString(), tenantId: tenantId ?? null },
    { fetchPolicy: "store-or-network" },
  );
  const conflictSet = useMemo(
    () => new Set<string>((bookedData?.ambassadorsBookedOnDate ?? []).map(String)),
    [bookedData],
  );

  // Pre-extract a state code / city token from the event address so
  // the per-BA locality score can run in O(N) without re-parsing on
  // every row.
  const localityTokens = useMemo(() => {
    const addr = (eventAddress ?? "").toLowerCase();
    if (!addr) return { stateCode: "", city: "" };
    // Crude US-state-code extractor: look for ", XX " or ", XX,"
    // anywhere in the address. Falls back to empty.
    const stateMatch = addr.match(/,\s*([a-z]{2})[\s,]/);
    const stateCode = stateMatch ? stateMatch[1] : "";
    // Crude city extractor: first chunk before the first comma.
    const city = addr.split(",")[0]?.trim() ?? "";
    return { stateCode, city };
  }, [eventAddress]);
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
    const list =
      data?.ambassadors?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          const name =
            [n.user?.firstName, n.user?.lastName].filter(Boolean).join(" ") ||
            n.user?.email ||
            "(unnamed)";
          const id = String(n.id);
          const baAddress = (n.address ?? "").toLowerCase();
          // Crude locality: 2 pts for state code match, 1 pt for
          // city substring match. Good enough until we have lat/lng
          // on both sides (BA.address is a free-text field today).
          let localityScore = 0;
          if (localityTokens.stateCode && baAddress.includes(
            `, ${localityTokens.stateCode} `,
          )) {
            localityScore = 2;
          } else if (
            localityTokens.city &&
            baAddress.includes(localityTokens.city)
          ) {
            localityScore = 1;
          }
          // Favorites are keyed by Ambassador.id (relay-encoded) per
          // PR #226. Match against the same id we render in the row.
          return {
            id,
            uuid: String(n.uuid),
            name,
            email: n.user?.email ?? "",
            address: n.address ?? "",
            alreadyInvited:
              alreadyInvited.has(id) || optimisticDone.has(id),
            isFavorited: favoritesSet.has(id),
            hasConflict: conflictSet.has(id),
            localityScore,
          };
        }) ?? [];

    // Smart-rank order (highest priority first):
    //   1. Favorites (lime-tier — kyle's go-to BAs)
    //   2. Locality match (state > city > none)
    //   3. Alphabetical (stable fallback)
    // Already-invited BAs sink to the bottom so they don't clutter
    // the top of the list. Conflicts DO NOT sink — we want them
    // visible so the admin can decide; the red chip flags them.
    return [...list].sort((a, b) => {
      if (a.alreadyInvited !== b.alreadyInvited) {
        return a.alreadyInvited ? 1 : -1;
      }
      if (a.isFavorited !== b.isFavorited) {
        return a.isFavorited ? -1 : 1;
      }
      if (a.localityScore !== b.localityScore) {
        return b.localityScore - a.localityScore;
      }
      return a.name.localeCompare(b.name);
    });
  }, [
    data,
    alreadyInvited,
    optimisticDone,
    favoritesSet,
    conflictSet,
    localityTokens,
  ]);

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
                  <p className="text-sm font-medium truncate flex items-center gap-1.5">
                    {row.isFavorited && (
                      <span
                        style={{
                          color: "var(--spark-lime)",
                          fontSize: 12,
                        }}
                        title="Favorited BA"
                        aria-label="Favorited"
                      >
                        ★
                      </span>
                    )}
                    <span className="truncate">{row.name}</span>
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span
                      className="mono text-[10px] truncate"
                      style={{
                        letterSpacing: "0.14em",
                        color: "rgba(255,255,255,0.45)",
                        maxWidth: "100%",
                      }}
                    >
                      {row.email}
                    </span>
                    {row.hasConflict && !row.alreadyInvited && (
                      <span
                        className="mono text-[9px] shrink-0"
                        style={{
                          letterSpacing: "0.16em",
                          color: "var(--spark-orange)",
                          background: "rgba(239,90,42,0.12)",
                          border: "1px solid rgba(239,90,42,0.35)",
                          padding: "1px 6px",
                          borderRadius: 999,
                        }}
                        title="This BA is already on another shift that day."
                      >
                        ⚠ DOUBLE-BOOK
                      </span>
                    )}
                    {row.localityScore === 2 && !row.hasConflict && (
                      <span
                        className="mono text-[9px] shrink-0"
                        style={{
                          letterSpacing: "0.16em",
                          color: "var(--spark-lime)",
                          background: "rgba(197,245,70,0.10)",
                          border: "1px solid rgba(197,245,70,0.30)",
                          padding: "1px 6px",
                          borderRadius: 999,
                        }}
                        title="State match — likely closer to the event"
                      >
                        ✓ LOCAL
                      </span>
                    )}
                  </div>
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
  eventDate = null,
  eventAddress = null,
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
        eventDate={eventDate}
        eventAddress={eventAddress}
        onClose={onClose}
        onInvited={onInvited}
      />
    </Suspense>
  );
}
