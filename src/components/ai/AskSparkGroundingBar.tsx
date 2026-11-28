import React, { useEffect, useState } from "react";
import { ChevronDown, Database } from "lucide-react";
import { SparkThinkingDots } from "./AskSparkPopoverFrame";
import {
  askSparkPendingStage,
  formatGroundingSummary,
} from "./askSparkGrounding";

/**
 * Progressive step-status indicator while Ask Spark queries program data.
 */
export const AskSparkPendingStatus: React.FC<{
  isClient?: boolean;
}> = ({ isClient = false }) => {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 600);
    return () => window.clearInterval(id);
  }, []);

  return <SparkThinkingDots label={askSparkPendingStage(elapsedMs, isClient)} />;
};

/**
 * BoardUI-inspired compact collapsible grounding/evidence disclosure bar
 * rendered on Ask Spark answers.
 */
export const AskSparkEvidenceBar: React.FC<{
  sourceCount?: number;
  scopeLabel?: string;
  thoughtSeconds?: number | null;
  hasChart?: boolean;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}> = ({
  sourceCount = 0,
  scopeLabel,
  thoughtSeconds,
  hasChart = false,
  defaultOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const summary = formatGroundingSummary({
    sourceCount,
    scopeLabel,
    thoughtSeconds,
    hasChart,
  });
  const expandable = Boolean(children);

  return (
    <div className="mb-2">
      {expandable ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition hover:opacity-85 cursor-pointer"
          style={{
            background: "var(--spark-surface-2)",
            border: "1px solid var(--spark-hairline, var(--spark-border))",
            color: "var(--spark-text-meta)",
          }}
        >
          <Database
            size={10.5}
            strokeWidth={2}
            style={{ color: "var(--spark-ok-ink, var(--spark-lime))" }}
          />
          <span>{summary}</span>
          <ChevronDown
            size={11}
            strokeWidth={2}
            style={{
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 180ms ease",
            }}
          />
        </button>
      ) : (
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
          style={{
            background: "var(--spark-surface-2)",
            border: "1px solid var(--spark-hairline, var(--spark-border))",
            color: "var(--spark-text-meta)",
          }}
        >
          <Database
            size={10.5}
            strokeWidth={2}
            style={{ color: "var(--spark-ok-ink, var(--spark-lime))" }}
          />
          <span>{summary}</span>
        </span>
      )}
      {expandable && open ? <div className="mt-2">{children}</div> : null}
    </div>
  );
};
