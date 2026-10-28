/**
 * PINATA-style Planned → Approved → Staffed → Executed → Verified strip.
 * Counts come from ActivationPlan.pipeline (filed/verified recaps exclude archived).
 */

export type PlanPipelineCounts = {
  planned: number;
  approved: number;
  staffed: number;
  executed: number;
  verified: number;
};

const STAGES: Array<{
  key: keyof PlanPipelineCounts;
  label: string;
}> = [
  { key: "planned", label: "Planned" },
  { key: "approved", label: "Approved" },
  { key: "staffed", label: "Staffed" },
  { key: "executed", label: "Executed" },
  { key: "verified", label: "Verified" },
];

export default function ActivationPlanPipelineStrip({
  pipeline,
  compact = false,
}: {
  pipeline: PlanPipelineCounts;
  compact?: boolean;
}) {
  const max = Math.max(1, ...STAGES.map((s) => pipeline[s.key] ?? 0));

  return (
    <div
      className={compact ? "grid grid-cols-5 gap-1.5" : "grid grid-cols-5 gap-2"}
      role="group"
      aria-label="Plan pipeline"
    >
      {STAGES.map((stage, i) => {
        const value = pipeline[stage.key] ?? 0;
        const fill = Math.max(0.08, value / max);
        return (
          <div key={stage.key} className="min-w-0">
            <div
              className="rounded-md overflow-hidden"
              style={{
                height: compact ? 6 : 8,
                background: "rgba(255,255,255,0.06)",
              }}
              title={`${stage.label}: ${value}`}
            >
              <div
                style={{
                  width: `${fill * 100}%`,
                  height: "100%",
                  background:
                    i >= 3 ? "var(--spark-lime)" : "rgba(242,243,238,0.55)",
                }}
              />
            </div>
            <p
              className="tab-num font-bold mt-1.5"
              style={{
                fontSize: compact ? 14 : 18,
                color: value > 0 ? "var(--spark-text)" : "rgba(255,255,255,0.35)",
              }}
            >
              {value}
            </p>
            <p
              className="truncate"
              style={{
                fontSize: compact ? 10 : 11,
                color: "rgba(255,255,255,0.45)",
              }}
            >
              {stage.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
