import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";

/**
 * Public, no-login client-live page. The signed token in the URL is the auth;
 * it fetches the branded live JSON from the backend public endpoint and shows
 * the client "who's working my campaign right now." Auto-refreshes every 60s.
 * No Relay/JWT — a plain fetch, so it works for a logged-out client.
 */
type BA = { name: string; status: string; clockInAt: string | null };
type Shift = {
  venue: string;
  startTime: string | null;
  endTime: string | null;
  assigned: BA[];
};
type Payload = {
  brand: { name: string; primaryColor: string | null };
  date: string;
  onClock: number;
  noShows: number;
  shiftsToday: number;
  shiftsThisMonth: number;
  shifts: Shift[];
  error?: string;
  message?: string;
};

const STATUS_LABEL: Record<string, string> = {
  clocked_in: "On the clock",
  clocked_out: "Done",
  no_show: "Not arrived",
  missed: "No-show",
  awaiting: "Arriving",
  upcoming: "Upcoming",
};

const fmtTime = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).replace(":00", "");
};

function apiOrigin(): string {
  try {
    return new URL(import.meta.env.VITE_GRAPHQL_ENDPOINT as string).origin;
  } catch {
    return "";
  }
}

export default function SparkClientLive() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiOrigin()}/api/public/client-live/${token}`);
        const json = (await res.json()) as Payload;
        if (cancelled) return;
        if (!res.ok || json.error) {
          setErr(json.message || "This link isn't valid.");
          setData(null);
        } else {
          setData(json);
          setErr(null);
        }
      } catch {
        if (!cancelled) setErr("Couldn't load the live view.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, tick]);

  const accent = data?.brand.primaryColor || "#C4D82E";
  const today = useMemo(
    () =>
      data?.date
        ? new Date(`${data.date}T00:00:00`).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })
        : "",
    [data?.date],
  );

  if (err) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: "center", maxWidth: 420 }}>
          <p style={{ fontSize: 15, opacity: 0.8 }}>{err}</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={wrap}>
        <p style={{ opacity: 0.6 }}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ width: "100%", maxWidth: 720 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{data.brand.name}</h1>
          <span style={{ fontSize: 13, opacity: 0.6 }}>Live · {today}</span>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "16px 0 22px" }}>
          <Stat label="On the clock" value={data.onClock} accent={accent} big />
          <Stat label="Shifts today" value={data.shiftsToday} accent={accent} />
          <Stat label="This month" value={data.shiftsThisMonth} accent={accent} />
          {data.noShows > 0 ? <Stat label="Not arrived" value={data.noShows} accent="#EF5A2A" /> : null}
        </div>

        {data.shifts.length === 0 ? (
          <div style={{ ...card, textAlign: "center" }}>
            <p style={{ opacity: 0.7 }}>No shifts scheduled today.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.shifts.map((s, i) => (
              <div key={i} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <strong style={{ fontSize: 15 }}>{s.venue}</strong>
                  <span style={{ fontSize: 12, opacity: 0.55 }}>
                    {fmtTime(s.startTime)}
                    {s.endTime ? `–${fmtTime(s.endTime)}` : ""}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {s.assigned.map((ba, j) => {
                    const on = ba.status === "clocked_in";
                    const bad = ba.status === "no_show" || ba.status === "missed";
                    return (
                      <span
                        key={j}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: on ? accent : bad ? "rgba(239,90,42,0.14)" : "rgba(0,0,0,0.05)",
                          color: on ? "#0a0d09" : bad ? "#EF5A2A" : "inherit",
                          border: on ? "none" : "1px solid rgba(0,0,0,0.12)",
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: 999, background: on ? "#0a0d09" : bad ? "#EF5A2A" : "#999", opacity: 0.8 }} />
                        {ba.name}
                        <span style={{ opacity: 0.7, fontSize: 11 }}>· {STATUS_LABEL[ba.status] ?? ba.status}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: 11, opacity: 0.4, marginTop: 20, textAlign: "center" }}>
          Live field view · powered by Spark by Ignite · refreshes automatically
        </p>
      </div>
    </div>
  );
}

const Stat: React.FC<{ label: string; value: number; accent: string; big?: boolean }> = ({
  label,
  value,
  accent,
  big,
}) => (
  <div
    style={{
      flex: big ? "1 1 140px" : "1 1 100px",
      padding: "14px 16px",
      borderRadius: 16,
      background: "rgba(0,0,0,0.03)",
      border: "1px solid rgba(0,0,0,0.08)",
    }}
  >
    <div style={{ fontSize: big ? 34 : 24, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.55, marginTop: 4 }}>
      {label}
    </div>
  </div>
);

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#fafafa",
  color: "#14181a",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "40px 20px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 18,
  padding: 16,
};
