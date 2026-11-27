import { useState, type ReactNode } from "react";

export interface ChartTableRow {
  label: string;
  value: string | number;
  secondary?: string | number | null;
}

/**
 * One small titled chart with an optional `Chart ⇄ Table` studio toggle
 * and 1-click TSV copy for spreadsheet workflows.
 */
export default function ChartBlock({
  title,
  height,
  headerAction,
  tableRows,
  categoryHeader = "Item",
  valueHeader = "Value",
  secondaryHeader,
  children,
}: {
  title: string;
  /** Height of the plot in px. Chart.js needs a sized, positioned box. */
  height: number;
  headerAction?: ReactNode;
  tableRows?: ReadonlyArray<ChartTableRow>;
  categoryHeader?: string;
  valueHeader?: string;
  secondaryHeader?: string;
  children: ReactNode;
}) {
  const [mode, setMode] = useState<"chart" | "table">("chart");
  const [copied, setCopied] = useState(false);
  const hasTable = Boolean(tableRows && tableRows.length > 0);
  const hasSecondary = Boolean(
    secondaryHeader && tableRows?.some((r) => r.secondary != null && r.secondary !== ""),
  );

  const copyTable = async () => {
    if (!tableRows?.length) return;
    const header = [
      categoryHeader,
      valueHeader,
      ...(hasSecondary ? [secondaryHeader!] : []),
    ].join("\t");
    const body = tableRows.map((r) =>
      [
        r.label,
        typeof r.value === "number" ? r.value : r.value,
        ...(hasSecondary ? [r.secondary ?? ""] : []),
      ]
        .map((c) => String(c).replace(/\t|\r|\n/g, " "))
        .join("\t"),
    );
    try {
      await navigator.clipboard.writeText([header, ...body].join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <figure className="m-0">
      <div className="mb-1.5 flex items-center justify-between gap-2 flex-wrap">
        <figcaption
          className="text-[13px] font-medium"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          {title}
        </figcaption>
        {headerAction || hasTable ? (
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            {mode === "chart" ? headerAction : null}
            {hasTable && mode === "table" ? (
              <button
                type="button"
                onClick={() => void copyTable()}
                className="px-2 py-1 rounded-md text-xs font-medium transition"
                style={{
                  border: "1px solid var(--spark-border)",
                  color: "var(--spark-text-secondary)",
                  background: "transparent",
                }}
              >
                {copied ? "✓ Copied" : "Copy rows"}
              </button>
            ) : null}
            {hasTable ? (
              <div className="pill-group" role="group" aria-label={`${title} view`}>
                <button
                  type="button"
                  onClick={() => setMode("chart")}
                  className={`pill-btn ${mode === "chart" ? "on" : ""}`}
                >
                  Chart
                </button>
                <button
                  type="button"
                  onClick={() => setMode("table")}
                  className={`pill-btn ${mode === "table" ? "on" : ""}`}
                >
                  Table
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {hasTable && mode === "table" ? (
        <div
          className="overflow-y-auto rounded-lg"
          style={{
            maxHeight: Math.max(height, 200),
            border: "1px solid var(--spark-hairline, var(--spark-border))",
          }}
        >
          <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--spark-border)",
                  background: "rgba(var(--spark-ink-rgb),0.025)",
                }}
              >
                <th
                  className="text-left font-medium py-2 px-3"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  {categoryHeader}
                </th>
                <th
                  className="text-right font-medium py-2 px-3 whitespace-nowrap"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  {valueHeader}
                </th>
                {hasSecondary ? (
                  <th
                    className="text-right font-medium py-2 px-3 whitespace-nowrap"
                    style={{ color: "var(--spark-text-meta)" }}
                  >
                    {secondaryHeader}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {tableRows!.map((r, idx) => (
                <tr
                  key={`${idx}-${r.label}`}
                  style={
                    idx > 0
                      ? { borderTop: "1px solid var(--spark-hairline)" }
                      : undefined
                  }
                >
                  <td
                    className="py-1.5 px-3 font-medium truncate max-w-[240px]"
                    style={{ color: "var(--spark-text)" }}
                    title={r.label}
                  >
                    {r.label}
                  </td>
                  <td
                    className="py-1.5 px-3 text-right tabular-nums font-semibold whitespace-nowrap"
                    style={{ color: "var(--spark-text)" }}
                  >
                    {typeof r.value === "number"
                      ? r.value.toLocaleString("en-US")
                      : r.value}
                  </td>
                  {hasSecondary ? (
                    <td
                      className="py-1.5 px-3 text-right tabular-nums whitespace-nowrap"
                      style={{ color: "var(--spark-text-meta)" }}
                    >
                      {typeof r.secondary === "number"
                        ? r.secondary.toLocaleString("en-US")
                        : (r.secondary ?? "—")}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative w-full" style={{ height }}>
          {children}
        </div>
      )}
    </figure>
  );
}
