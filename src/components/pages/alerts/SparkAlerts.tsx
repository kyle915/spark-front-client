import Layout from "@/layout/Layout";

/**
 * Spark v2 — Alerts / Notifications.
 * Wireframe: spark-demo/index.html lines 2399-2415 + notifRow helper.
 *
 * Currently static demo data. Real notifications require a backend feed
 * (request submitted / approval / new applicant / recap published / alert).
 */

type NotifKind = "request" | "approval" | "application" | "recap" | "alert";

const KIND_ICON: Record<NotifKind, string> = {
  request: "✉",
  approval: "✓",
  application: "👥",
  recap: "◈",
  alert: "⚠",
};

const KIND_COLOR: Record<NotifKind, string> = {
  request: "var(--spark-sky)",
  approval: "var(--spark-lime)",
  application: "var(--spark-purple)",
  recap: "var(--spark-lime)",
  alert: "var(--spark-orange)",
};

const ROWS: {
  kind: NotifKind;
  title: string;
  body: string;
  when: string;
  unread: boolean;
}[] = [
  { kind: "request", title: "Ross K. submitted a new request", body: "Buckhead Block Party · Atlanta · June 5", when: "12 min ago", unread: true },
  { kind: "approval", title: "You approved 2 requests", body: "Atlanta + Domain Demo", when: "1 h ago", unread: true },
  { kind: "application", title: "3 new applicants for Whole Foods Lamar", body: "Maya R., Jordan T., Sasha P.", when: "2 h ago", unread: true },
  { kind: "recap", title: "Recap auto-published: Mohawk Patio", body: "218 samples · 39% conv · 48 photos", when: "3 h ago", unread: false },
  { kind: "alert", title: "Miami efficiency alert", body: "$/sample +32% vs avg", when: "6 h ago", unread: true },
];

export default function SparkAlerts() {
  const unread = ROWS.filter((r) => r.unread).length;

  return (
    <Layout>
      <div className="space-y-5 max-w-4xl">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            {unread} UNREAD
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            What you missed.
          </h1>
        </div>

        <div className="spark-card overflow-hidden">
          <ul>
            {ROWS.map((r, i) => {
              const color = KIND_COLOR[r.kind];
              return (
                <li
                  key={i}
                  className="px-5 py-4 transition cursor-pointer"
                  style={{
                    borderBottom:
                      i < ROWS.length - 1
                        ? "1px solid var(--spark-border)"
                        : "none",
                    background: r.unread
                      ? "rgba(255,255,255,0.015)"
                      : "transparent",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = r.unread
                      ? "rgba(255,255,255,0.015)"
                      : "transparent")
                  }
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mono"
                      style={{
                        background: `${color}1a`,
                        color,
                        border: `1px solid ${color}40`,
                      }}
                    >
                      {KIND_ICON[r.kind]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <p
                          className="font-semibold text-sm"
                          style={{
                            color: r.unread
                              ? "var(--spark-text)"
                              : "rgba(255,255,255,0.7)",
                          }}
                        >
                          {r.title}
                        </p>
                        <span
                          className="mono text-[10px]"
                          style={{
                            letterSpacing: "0.14em",
                            color: "rgba(255,255,255,0.4)",
                          }}
                        >
                          · {r.when.toUpperCase()}
                        </span>
                      </div>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                      >
                        {r.body}
                      </p>
                    </div>
                    {r.unread && (
                      <span
                        className="spark-dot mt-2"
                        style={{ width: 8, height: 8, background: color, boxShadow: `0 0 8px ${color}` }}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Layout>
  );
}
