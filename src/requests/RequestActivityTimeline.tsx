import { Suspense, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { RequestActivityQuery } from "@/api/queries/RequestActivityQuery";
import type { RequestActivityQuery as QueryType } from "@api/queries/__generated__/RequestActivityQuery.graphql";
import { activityActor, activityKindLabel, activityWhen } from "./activityLabels";

const SHOW_FIRST = 8;

const Body: React.FC<{ requestUuid: string }> = ({ requestUuid }) => {
  const data = useLazyLoadQuery<QueryType>(
    RequestActivityQuery,
    { uuid: requestUuid },
    { fetchPolicy: "store-and-network" },
  );
  const entries = data.request?.activityLog ?? [];
  const [showAll, setShowAll] = useState(false);
  if (entries.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
        Nothing recorded yet. Approvals, ambassador invites, reminders and clock
        edits will appear here as they happen.
      </p>
    );
  }
  const shown = showAll ? entries : entries.slice(0, SHOW_FIRST);
  return (
    <>
      <ol className="space-y-3">
        {shown.map((e) => (
          <li key={e.uuid} className="flex gap-3">
            <span
              aria-hidden
              className="mt-1.5 w-2 h-2 rounded-full shrink-0"
              style={{ background: "var(--spark-text-meta)" }}
            />
            <div className="min-w-0">
              <p className="text-sm">
                <span className="font-semibold">{activityKindLabel(e.kind)}</span>
                {e.summary ? (
                  <span style={{ color: "var(--spark-text-secondary)" }}> · {e.summary}</span>
                ) : null}
              </p>
              <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
                {activityActor(e.actorName, e.actorEmail)} · {activityWhen(e.createdAt)}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {entries.length > SHOW_FIRST ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-sm underline"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          {showAll ? "Show fewer" : `Show all ${entries.length}`}
        </button>
      ) : null}
    </>
  );
};

/**
 * Activity history for a request: who approved, invited, nudged or edited,
 * and when. Staff-only — it names people. Reads the server's existing
 * RequestActivityLog; nothing is written here.
 */
export const RequestActivityTimeline: React.FC<{ requestUuid: string }> = ({
  requestUuid,
}) => (
  <section className="spark-card p-5" aria-label="Activity history">
    <h3 className="font-semibold mb-3" style={{ letterSpacing: "-0.01em" }}>
      Activity history
    </h3>
    <Suspense
      fallback={
        <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
          Loading history…
        </p>
      }
    >
      <Body requestUuid={requestUuid} />
    </Suspense>
  </section>
);

export default RequestActivityTimeline;
