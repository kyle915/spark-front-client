import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";

/**
 * BA activation panel — every ambassador booked on this workspace's events
 * with their sign-in state. Built after Feel Free week one, where 5 of 8
 * booked BAs had never signed in (and one signed into an Apple relay
 * duplicate) and the only way to know was running ad-hoc scripts.
 *
 * "Resend welcome" resets the BA onto admin-created rails: new temp
 * password, verified + active account, welcome email with the app-store
 * buttons. Backed by the Spark schema (tenantBaActivation /
 * resendBaWelcome, both admin-gated server-side).
 *
 * Uses the raw postGql pattern (same as NotificationBell) — no Relay
 * codegen.
 */

async function postGql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(
      json.errors.map((e: { message: string }) => e.message).join("; "),
    );
  }
  return json.data as T;
}

type ActivationRow = {
  ambassadorUuid: string;
  name: string;
  email: string;
  phone: string | null;
  lastLogin: string | null;
  signedIn: boolean;
  bookings: number;
  nextShift: string | null;
};

const ACTIVATION_Q = `query Activation($tenantId: ID!) {
  tenantBaActivation(tenantId: $tenantId) {
    ambassadorUuid name email phone lastLogin signedIn bookings nextShift
  }
}`;

const RESEND_M = `mutation Resend($email: String!) {
  resendBaWelcome(email: $email) { success message }
}`;

const fmtDate = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
};

const BaActivationPanel: React.FC = () => {
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);

  const [rows, setRows] = useState<ActivationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Two-step resend: first click arms the row, second click fires.
  const [armed, setArmed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setError(null);
    try {
      const data = await postGql<{ tenantBaActivation: ActivationRow[] }>(
        ACTIVATION_Q,
        { tenantId },
      );
      setRows(data.tenantBaActivation ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRows([]);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resend = async (row: ActivationRow) => {
    setArmed(null);
    setBusy(row.email);
    try {
      const data = await postGql<{
        resendBaWelcome: { success: boolean; message: string };
      }>(RESEND_M, { email: row.email });
      const r = data.resendBaWelcome;
      showAlert(
        r?.message ||
          (r?.success ? `Welcome email re-sent to ${row.email}.` : "Failed."),
        r?.success ? "success" : "error",
      );
    } catch (err) {
      showAlert(
        `Resend failed: ${err instanceof Error ? err.message : String(err)}`,
        "error",
      );
    } finally {
      setBusy(null);
    }
  };

  // Nothing booked (or non-admin, which the server answers with []) and no
  // error: stay out of the way entirely.
  if (rows !== null && rows.length === 0 && !error) return null;

  const notSignedIn = (rows ?? []).filter((r) => !r.signedIn).length;

  return (
    <div>
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3 mt-8">
        <div className="flex items-baseline gap-3">
          <h2
            className="display text-xl font-bold"
            style={{ letterSpacing: "-0.02em" }}
          >
            BA activation
          </h2>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
            Booked ambassadors and whether they've actually signed in.
          </span>
        </div>
        {rows !== null && notSignedIn > 0 && (
          <span className="chip chip-gold">
            {notSignedIn} not signed in
          </span>
        )}
      </div>

      <div className="spark-card overflow-hidden" style={{ borderRadius: 20 }}>
        {rows === null ? (
          <div
            className="p-6 text-sm"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Loading activation status…
          </div>
        ) : error ? (
          <div className="p-6 text-sm" style={{ color: "var(--spark-gold)" }}>
            Couldn't load activation status: {error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 800 }}>
              <thead
                style={{
                  background: "var(--spark-surface-2)",
                  borderBottom: "1px solid var(--spark-border)",
                }}
              >
                <tr
                  className="text-left mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  <th className="px-4 py-3">AMBASSADOR</th>
                  <th className="px-4 py-3">STATUS</th>
                  <th className="px-4 py-3">BOOKINGS</th>
                  <th className="px-4 py-3">NEXT SHIFT</th>
                  <th className="px-4 py-3">LAST SIGN-IN</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.ambassadorUuid}
                    style={{ borderBottom: "1px solid var(--spark-border)" }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold">{r.name}</div>
                      <div
                        className="text-xs mt-0.5"
                        style={{ color: "rgba(255,255,255,0.5)" }}
                      >
                        {r.email}
                        {r.phone ? ` · ${r.phone}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.signedIn ? (
                        <span className="chip chip-lime">Signed in</span>
                      ) : (
                        <span className="chip chip-gold">Never signed in</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{r.bookings}</td>
                    <td className="px-4 py-3">{fmtDate(r.nextShift)}</td>
                    <td className="px-4 py-3">{fmtDate(r.lastLogin)}</td>
                    <td className="px-4 py-3 text-right">
                      {armed === r.email ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="text-xs"
                            style={{ color: "rgba(255,255,255,0.55)" }}
                          >
                            New temp password + welcome email.
                          </span>
                          <button
                            onClick={() => void resend(r)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{
                              background: "var(--spark-lime)",
                              color: "#0a0d09",
                            }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setArmed(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{
                              background: "transparent",
                              color: "rgba(255,255,255,0.6)",
                              border: "1px solid var(--spark-border)",
                            }}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setArmed(r.email)}
                          disabled={busy === r.email}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                          style={{
                            background: "transparent",
                            color: busy === r.email
                              ? "rgba(255,255,255,0.35)"
                              : "var(--spark-lime)",
                            border: "1px solid rgba(196,216,46,0.35)",
                          }}
                        >
                          {busy === r.email ? "Sending…" : "Resend welcome"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BaActivationPanel;
