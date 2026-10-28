import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { DuplicateEventClustersQuery } from "@/api/queries/DuplicateEventClustersQuery";
import type { DuplicateEventClustersQuery as DuplicateEventClustersQueryType } from "@api/queries/__generated__/DuplicateEventClustersQuery.graphql";
import { MergeEventsMutation } from "@/api/mutations/MergeEventsMutation";
import type { MergeEventsMutation as MergeEventsMutationType } from "@api/mutations/__generated__/MergeEventsMutation.graphql";
import useSparkRole from "@/hooks/useSparkRole";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";

/**
 * Duplicate-event finder & merge — the "five identical Albertsons"
 * cleanup tool. Admin-gated drop-in for the tracker toolbar.
 *
 * Clusters come from the server (same normalized name, dates within a
 * day). Pick the keeper — defaulted to the row with the most recaps,
 * then the biggest roster — and Merge folds the rest into it:
 * rosters de-duped, recaps/attendance/jobs repointed, duplicates (and
 * their orphaned requests) deleted, all in one transaction.
 */

type Entry = {
  id: string;
  uuid: string;
  name: string;
  date: string | null | undefined;
  address: string;
  recapsFiled: number;
  rosterCount: number;
};
type Cluster = { key: string; events: Entry[] };

const Inner: React.FC<{ tenantId: string; onClose: () => void }> = ({
  tenantId,
  onClose,
}) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const data = useLazyLoadQuery<DuplicateEventClustersQueryType>(
    DuplicateEventClustersQuery,
    { tenantId },
    { fetchPolicy: "network-only" },
  );

  const initial = useMemo<Cluster[]>(
    () =>
      (data.duplicateEventClusters ?? []).map((c) => ({
        key: c.key,
        events: c.events.map((e) => ({ ...e })),
      })),
    [data],
  );
  const [clusters, setClusters] = useState<Cluster[]>(initial);
  // keeper choice per cluster index; default = most recaps, then roster.
  const [keepers, setKeepers] = useState<Record<number, string>>(() => {
    const k: Record<number, string> = {};
    initial.forEach((c, i) => {
      const best = [...c.events].sort(
        (a, b) =>
          b.recapsFiled - a.recapsFiled || b.rosterCount - a.rosterCount,
      )[0];
      k[i] = best?.id ?? "";
    });
    return k;
  });
  const [mergingIdx, setMergingIdx] = useState<number | null>(null);

  const [commit] = useMutation<MergeEventsMutationType>(MergeEventsMutation);

  const merge = (idx: number) => {
    const cluster = clusters[idx];
    const keepId = keepers[idx];
    if (!cluster || !keepId) return;
    const mergeIds = cluster.events
      .map((e) => e.id)
      .filter((id) => id !== keepId);
    if (
      !window.confirm(
        `Merge ${mergeIds.length} duplicate(s) of “${cluster.events[0]?.name}” into the selected keeper?\n\nRecaps, rosters, attendance, and jobs move to the keeper; the duplicates are deleted. This can't be undone.`,
      )
    ) {
      return;
    }
    setMergingIdx(idx);
    commit({
      variables: {
        input: { tenantId, keepEventId: keepId, mergeEventIds: mergeIds },
      },
      onCompleted: (res) => {
        setMergingIdx(null);
        const r = res.mergeEvents;
        if (!r?.success) {
          showAlert(r?.message ?? "Merge failed.", "error");
          return;
        }
        showAlert(r.message, "success");
        (r.warnings ?? []).forEach((w) => showAlert(w, "warning"));
        setClusters((cs) => cs.filter((_, i) => i !== idx));
      },
      onError: (err) => {
        setMergingIdx(null);
        showAlert(err.message, "error");
      },
    });
  };

  return (
    <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: "62vh" }}>
      {clusters.length === 0 ? (
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
          No duplicate clusters found for this brand — the tracker is
          clean. 🎉
        </p>
      ) : (
        clusters.map((c, idx) => (
          <div
            key={`${c.key}-${idx}`}
            className="rounded-xl p-3"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <p
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.16em",
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "uppercase",
                }}
              >
                {c.events.length} × {c.key}
              </p>
              <button
                type="button"
                disabled={mergingIdx === idx}
                onClick={() => merge(idx)}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
                style={{
                  background: "var(--spark-lime, #f2f3ee)",
                  color: "#0a0d09",
                }}
              >
                {mergingIdx === idx
                  ? "Merging…"
                  : `Merge ${c.events.length - 1} into keeper`}
              </button>
            </div>
            {c.events.map((e) => (
              <label
                key={e.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <input
                  type="radio"
                  name={`keeper-${idx}`}
                  checked={keepers[idx] === e.id}
                  onChange={() =>
                    setKeepers((k) => ({ ...k, [idx]: e.id }))
                  }
                />
                <span className="text-sm flex-1 min-w-0 truncate">
                  {e.name}
                  <span
                    className="mono text-[10px] ml-2"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                  >
                    {[e.date, e.address].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span
                  className="mono text-[10px] shrink-0"
                  style={{
                    color:
                      e.recapsFiled > 0
                        ? "var(--spark-lime, #f2f3ee)"
                        : "rgba(255,255,255,0.4)",
                  }}
                >
                  {e.recapsFiled} recap{e.recapsFiled === 1 ? "" : "s"} ·{" "}
                  {e.rosterCount} BA{e.rosterCount === 1 ? "" : "s"}
                  {keepers[idx] === e.id ? "  ← keeper" : ""}
                </span>
              </label>
            ))}
          </div>
        ))
      )}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm"
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "rgba(255,255,255,0.8)",
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
};

const DuplicateEventsButton: React.FC = () => {
  const { isAdmin } = useSparkRole();
  const { tenantId } = useAuthStore();
  const [open, setOpen] = useState(false);

  if (!isAdmin) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!tenantId) return;
          setOpen(true);
        }}
        className="pill-btn"
        title="Find & merge duplicate events"
      >
        ⧉ Duplicates
      </button>
      {open && tenantId && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
          style={{
            background: "rgba(10,11,13,0.7)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl spark-card overflow-hidden"
            style={{ borderRadius: 20 }}
          >
            <div
              className="p-4 border-b"
              style={{ borderColor: "var(--spark-border, #1f2418)" }}
            >
              <h2 className="text-lg font-semibold">Duplicate events</h2>
              <p
                className="text-xs mt-1"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                Same name, same/adjacent dates. Pick the keeper (the one
                with the recaps usually) and merge — everything repoints,
                the copies are deleted.
              </p>
            </div>
            <Suspense
              fallback={
                <div
                  className="p-6 text-sm"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  Scanning for duplicates…
                </div>
              }
            >
              <Inner tenantId={tenantId} onClose={() => setOpen(false)} />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
};

export default DuplicateEventsButton;
