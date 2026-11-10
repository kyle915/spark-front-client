import React from "react";

export const WingspanNotConnected: React.FC<{ message: string }> = ({
  message,
}) => (
  <div
    className="spark-card p-8"
    style={{
      borderColor: "rgba(255,196,0,0.35)",
      background: "rgba(255,196,0,0.04)",
    }}
  >
    <div className="flex items-start gap-4 flex-wrap">
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "rgba(255,196,0,0.10)",
          color: "var(--spark-gold)",
          display: "grid",
          placeItems: "center",
          fontSize: 22,
        }}
      >
        🪶
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-gold)",
          }}
        >
          WINGSPAN · NOT CONNECTED
        </p>
        <h2
          className="display text-2xl font-bold mt-1"
          style={{ letterSpacing: "-0.02em" }}
        >
          Connect Wingspan to see live data.
        </h2>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: "rgba(255,255,255,0.75)" }}
        >
          Pay cycles and payments show here once Wingspan is connected for
          this workspace. Until then, approve hours and mark pay periods
          paid on the Timesheet.
        </p>
        <details className="mt-3">
          <summary
            className="text-xs cursor-pointer"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Setup details for your developer
          </summary>
          <p
            className="mt-2 text-xs leading-relaxed"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {message}
          </p>
        </details>
      </div>
    </div>
  </div>
);
