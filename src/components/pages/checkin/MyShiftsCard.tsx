import { useCallback, useState } from "react";
import { card } from "./checkinStyles";
import { apiOrigin, fetchWithTimeout, fmtDay, fmtTime } from "./checkinHelpers";
import {
  formatHours,
  parseShiftHistory,
  shiftStatusView,
  type ShiftHistory,
} from "./shiftHistory";

const TONE: Record<"wait" | "ok" | "done", { bg: string; fg: string }> = {
  wait: { bg: "#fef3c7", fg: "#78350f" },
  ok: { bg: "#e0f2fe", fg: "#0c4a6e" },
  done: { bg: "#dcfce7", fg: "#14532d" },
};

/**
 * "My hours & shifts" — collapsed by default so it never gets in the way of
 * clocking in or filing a recap. Opening it loads the BA's recent shifts for
 * this brand: hours worked and whether each one is waiting on review,
 * confirmed, approved for payroll, or paid.
 */
export const MyShiftsCard: React.FC<{
  code: string;
  token: string | null;
}> = ({ code, token }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ShiftHistory | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(
        `${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/my-shifts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: token }),
        },
        15000,
      );
      if (!res.ok) {
        setError(
          res.status === 401
            ? "Your session expired. Reload the link to see your shifts."
            : "Couldn't load your shifts. Check your signal and try again.",
        );
        return;
      }
      setHistory(parseShiftHistory(await res.json()));
    } catch {
      setError("Couldn't load your shifts. Check your signal and try again.");
    } finally {
      setLoading(false);
    }
  }, [code, token]);

  if (!token) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !history && !loading) void load();
  };

  return (
    <div style={card}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
          color: "#1c1917",
          minHeight: 44,
        }}
      >
        <span>
          <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>
            My hours &amp; shifts
          </span>
          <span style={{ display: "block", fontSize: 13, color: "#44403c", marginTop: 2 }}>
            See your recent shifts and whether your hours are approved.
          </span>
        </span>
        <span aria-hidden style={{ fontSize: 18, color: "#44403c" }}>
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div style={{ marginTop: 14 }}>
          {loading ? (
            <p style={{ fontSize: 14, color: "#44403c", margin: 0 }}>Loading your shifts…</p>
          ) : error ? (
            <div>
              <p role="alert" style={{ fontSize: 14, color: "#7f1d1d", margin: 0 }}>
                {error}
              </p>
              <button
                type="button"
                onClick={() => void load()}
                style={{
                  marginTop: 10,
                  minHeight: 44,
                  padding: "0 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.2)",
                  background: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#1c1917",
                }}
              >
                Try again
              </button>
            </div>
          ) : history && history.shifts.length === 0 ? (
            <p style={{ fontSize: 14, color: "#44403c", margin: 0 }}>
              No clocked shifts in the last {history.windowDays} days yet.
            </p>
          ) : history ? (
            <>
              <p style={{ fontSize: 14, color: "#1c1917", margin: "0 0 10px" }}>
                <strong>{formatHours(history.totalHours) || "0 min"}</strong> worked in the
                last {history.windowDays} days
              </p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                {history.shifts.map((s, i) => {
                  const view = shiftStatusView(s);
                  const tone = TONE[view.tone];
                  return (
                    <li
                      key={`${s.eventDate}-${s.clockInAt}-${i}`}
                      style={{
                        border: "1px solid rgba(0,0,0,0.08)",
                        borderRadius: 14,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 8,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>
                            {fmtDay(s.eventDate) || "Shift"}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "#44403c",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {s.address || s.name}
                          </div>
                        </div>
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: tone.bg,
                            color: tone.fg,
                          }}
                        >
                          {view.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "#1c1917", marginTop: 6 }}>
                        {s.clockInAt ? `In ${fmtTime(s.clockInAt)}` : ""}
                        {s.clockOutAt ? ` · Out ${fmtTime(s.clockOutAt)}` : ""}
                        {formatHours(s.hours) ? (
                          <strong>
                            {" "}
                            · {formatHours(s.hours)}
                          </strong>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 13, color: "#44403c", marginTop: 4 }}>
                        {view.detail}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p style={{ fontSize: 12, color: "#44403c", margin: "10px 0 0" }}>
                Questions about pay? Reply to your Ignite staffing contact.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default MyShiftsCard;
