import { useMemo } from "react";
import { SparkSheet } from "@/shared/SparkSheet";
import {
  formatEditedAt,
  groupRecapEdits,
  originalValues,
  type RecapMetricEdit,
} from "@/recap/recapEditHistory";

const muted = { color: "rgba(255,255,255,0.6)" };

export function RecapEditHistorySheet({
  open,
  onOpenChange,
  edits,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  edits: ReadonlyArray<RecapMetricEdit>;
}) {
  const batches = useMemo(() => groupRecapEdits(edits), [edits]);
  const originals = useMemo(() => originalValues(edits), [edits]);

  return (
    <SparkSheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="RECAP · EDIT HISTORY · ADMIN ONLY"
      title="Staff corrections"
    >
      <div className="max-w-3xl mx-auto space-y-3">
        <p className="text-sm" style={muted}>
          Every change Ignite staff made after the BA submitted. Totals in
          Insights, Recaps, exports and client views use the current values;
          the BA's originals stay here.
        </p>
        {batches.map((batch) => (
          <section
            key={batch.batch}
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <header className="flex items-baseline justify-between gap-3 flex-wrap">
              <span className="font-semibold">{batch.editedByName}</span>
              <span className="mono text-[11px]" style={muted}>
                {formatEditedAt(batch.editedAt)}
              </span>
            </header>
            {batch.reason ? (
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                Reason: {batch.reason}
              </p>
            ) : null}
            <ul className="space-y-2">
              {batch.changes.map((change) => {
                const original = originals.get(change.fieldKey);
                return (
                  <li key={change.id} className="text-sm">
                    <div style={muted}>{change.fieldLabel}</div>
                    <div className="mono">
                      <span style={{ color: "rgba(255,255,255,0.55)" }}>
                        {change.oldValue ?? "—"}
                      </span>
                      {" → "}
                      <span style={{ color: "var(--spark-lime, #f2f3ee)" }}>
                        {change.newValue ?? "—"}
                      </span>
                    </div>
                    {original !== undefined && original !== change.oldValue ? (
                      <div className="text-[11px]" style={muted}>
                        Originally submitted: {original ?? "—"}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </SparkSheet>
  );
}

export default RecapEditHistorySheet;
