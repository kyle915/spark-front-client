import React, { Suspense, useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { RequestActivityLogQuery } from "@/api/queries/RequestActivityLogQuery";
import type { RequestActivityLogQuery as RequestActivityLogQueryType } from "@api/queries/__generated__/RequestActivityLogQuery.graphql";

/**
 * Audit trail timeline for a single request. Mounts inside Suspense
 * so the rest of the request detail page renders unblocked.
 *
 * Reads from the new RequestActivityLog backend (see PR #499). Each
 * entry's metadata ships as a JSON-encoded string so we parse on read
 * — keeps the schema portable without a JSON scalar dependency.
 *
 * Entries are server-ordered newest-first, capped at 200 (more than
 * enough for the "what happened on this request" question; older
 * entries are reachable via the DB if we ever need them).
 */

type Props = { requestUuid: string };

// Per-kind icon + tone. Kept tight so the panel scans like a feed
// not a wall of text. Falls back to a neutral chip for unknown kinds
// so a backend ahead of the front-end doesn't break the timeline.
const KIND_META: Record<string, { icon: string; color: string; label: string }> = {
  created: { icon: "✦", color: "var(--spark-lime)", label: "CREATED" },
  updated: { icon: "✎", color: "var(--spark-sky)", label: "UPDATED" },
  status_changed: { icon: "↻", color: "var(--spark-purple)", label: "STATUS" },
  ba_invited: { icon: "→", color: "var(--spark-sky)", label: "BA INVITED" },
  ba_accepted: { icon: "✓", color: "var(--spark-lime)", label: "BA ACCEPTED" },
  ba_declined: { icon: "×", color: "var(--spark-orange)", label: "BA DECLINED" },
  ba_removed: { icon: "−", color: "var(--spark-orange)", label: "BA REMOVED" },
  recap_filed: { icon: "▣", color: "var(--spark-lime)", label: "RECAP FILED" },
  cloned_from: { icon: "⎘", color: "var(--spark-gold)", label: "CLONED" },
  note_added: { icon: "✎", color: "var(--spark-sky)", label: "NOTE" },
  nudge_sent: { icon: "✉", color: "var(--spark-gold)", label: "NUDGE" },
};

const KIND_FALLBACK = {
  icon: "•",
  color: "rgba(255,255,255,0.55)",
  label: "EVENT",
};

const formatWhen = (iso: string): string => {
  if (!iso) return "—";
  try {
    const dt = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - dt.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return dt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const Inner: React.FC<Props> = ({ requestUuid }) => {
  const data = useLazyLoadQuery<RequestActivityLogQueryType>(
    RequestActivityLogQuery,
    { uuid: requestUuid },
    { fetchPolicy: "store-or-network" },
  );

  const entries = useMemo(() => {
    return (data?.request?.activityLog ?? []).map((e) => {
      let meta: Record<string, unknown> = {};
      try {
        meta = e.metadataJson ? JSON.parse(e.metadataJson) : {};
      } catch {
        meta = {};
      }
      return { ...e, meta };
    });
  }, [data]);

  if (entries.length === 0) {
    return (
      <div
        className="text-sm py-8 text-center"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        No activity recorded yet.
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {entries.map((e) => {
        const meta = KIND_META[e.kind] ?? KIND_FALLBACK;
        const actorLabel =
          e.actorName?.trim() || e.actorEmail || "System";
        return (
          <li
            key={e.uuid}
            className="flex items-start gap-3 rounded-xl px-3 py-2.5"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--spark-border)",
            }}
          >
            <span
              className="mono text-sm shrink-0"
              style={{
                color: meta.color,
                minWidth: 18,
                lineHeight: 1.4,
              }}
              aria-hidden
            >
              {meta.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span
                  className="mono text-[10px]"
                  style={{ letterSpacing: "0.14em", color: meta.color }}
                >
                  {meta.label}
                </span>
                <span
                  className="text-sm"
                  style={{ color: "var(--spark-text)" }}
                >
                  {e.summary || meta.label.toLowerCase()}
                </span>
              </div>
              <div
                className="mono text-[10px] mt-1"
                style={{
                  letterSpacing: "0.12em",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                {actorLabel.toUpperCase()} · {formatWhen(e.createdAt)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

const RequestActivityLogPanel: React.FC<Props> = ({ requestUuid }) => (
  <div className="spark-card p-5" style={{ borderRadius: 20 }}>
    <div className="flex items-baseline justify-between mb-3">
      <h3 className="display text-lg font-bold">Activity</h3>
      <span
        className="mono text-[10px]"
        style={{
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        AUDIT TRAIL
      </span>
    </div>
    <Suspense
      fallback={
        <div
          className="text-sm py-8 text-center"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          Loading activity…
        </div>
      }
    >
      <Inner requestUuid={requestUuid} />
    </Suspense>
  </div>
);

export default RequestActivityLogPanel;
