import { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { Link, useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import SparkConfirm from "@/shared/SparkConfirm";
import { useAlertStore } from "@/store/alertStore";
import { PendingAmbassadorsQuery } from "@/api/queries/PendingAmbassadorsQuery";
import type { PendingAmbassadorsQuery as PendingAmbassadorsQueryType } from "@api/queries/__generated__/PendingAmbassadorsQuery.graphql";
import { ApproveAmbassadorMutation } from "@/api/mutations/ApproveAmbassadorMutation";
import type { ApproveAmbassadorMutation as ApproveAmbassadorMutationType } from "@api/mutations/__generated__/ApproveAmbassadorMutation.graphql";
import { DisableAmbassadorMutation } from "@/api/mutations/DisableAmbassadorMutation";
import type { DisableAmbassadorMutation as DisableAmbassadorMutationType } from "@api/mutations/__generated__/DisableAmbassadorMutation.graphql";

/**
 * Spark v2 — Pending Ambassadors queue.
 *
 * Lists every Ambassador profile with is_active=False whose user
 * is still active — i.e. signed up (Apple / Google / email) but
 * not yet approved by an admin. The companion spark-api PR fires
 * an email to NEW_AMBASSADOR_ALERT_EMAILS the moment one of these
 * lands, so this screen is what the email CTA deep-links to.
 *
 * Each row has a one-click Approve (flips is_active=True via the
 * existing approveAmbassador mutation) and a Disable (rejects the
 * signup via disableAmbassador).
 */

const initialsOf = (first: string | null, last: string | null, email: string) => {
  const name = [first, last].filter(Boolean).join(" ");
  if (name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return (email[0] ?? "?").toUpperCase();
};

const fmtDate = (raw: string | null | undefined) => {
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

const Inner: React.FC = () => {
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [refreshKey, setRefreshKey] = useState(0);
  const data = useLazyLoadQuery<PendingAmbassadorsQueryType>(
    PendingAmbassadorsQuery,
    { first: 100 },
    { fetchPolicy: "network-only", fetchKey: refreshKey },
  );

  const [commitApprove, isApproving] =
    useMutation<ApproveAmbassadorMutationType>(ApproveAmbassadorMutation);
  const [commitDisable, isDisabling] =
    useMutation<DisableAmbassadorMutationType>(DisableAmbassadorMutation);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const rows = (data?.pendingAmbassadors?.edges ?? [])
    .map((e) => e?.node)
    .filter((n): n is NonNullable<typeof n> => Boolean(n));

  const refresh = () => setRefreshKey((k) => k + 1);

  const approve = (ambassadorId: string) => {
    if (isApproving || isDisabling) return;
    setPendingId(ambassadorId);
    commitApprove({
      variables: { input: { ambassadorId } },
      onCompleted: (resp) => {
        setPendingId(null);
        const r = resp.approveAmbassador;
        if (r?.success) {
          showAlert(r.message || "Ambassador approved.", "success");
          refresh();
        } else {
          showAlert(
            r?.message || "Could not approve ambassador.",
            "error",
          );
        }
      },
      onError: (err) => {
        setPendingId(null);
        showAlert(err.message, "error");
      },
    });
  };

  const [confirmDisableId, setConfirmDisableId] = useState<string | null>(null);

  const disable = (ambassadorId: string) => {
    if (isApproving || isDisabling) return;
    setConfirmDisableId(ambassadorId);
  };

  const executeDisable = () => {
    if (!confirmDisableId) return;
    const ambassadorId = confirmDisableId;
    setConfirmDisableId(null);
    setPendingId(ambassadorId);
    commitDisable({
      variables: { input: { ambassadorId } },
      onCompleted: (resp) => {
        setPendingId(null);
        const r = resp.disableAmbassador;
        if (r?.success) {
          showAlert(r.message || "Ambassador disabled.", "success");
          refresh();
        } else {
          showAlert(
            r?.message || "Could not disable ambassador.",
            "error",
          );
        }
      },
      onError: (err) => {
        setPendingId(null);
        showAlert(err.message, "error");
      },
    });
  };

  if (rows.length === 0) {
    return (
      <div
        className="spark-card p-10 text-center"
        style={{ color: "var(--spark-text-meta)" }}
      >
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-text-meta)",
          }}
        >
          PENDING · 0
        </p>
        <p className="display text-2xl mt-2" style={{ color: "var(--spark-text)" }}>
          Nobody waiting.
        </p>
        <p className="mt-2 text-sm">
          New BAs who sign up via Apple, Google, or email will land here for
          approval. We email{" "}
          <code style={{ color: "var(--spark-lime)" }}>
            NEW_AMBASSADOR_ALERT_EMAILS
          </code>{" "}
          the moment one lands.
        </p>
        <button
          onClick={() => navigate("/people")}
          className="mt-6 px-4 py-2 rounded-xl text-sm"
          style={{
            background: "transparent",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
          }}
        >
          ← Back to People
        </button>
      </div>
    );
  }

  return (
    <div className="spark-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr
            style={{
              borderBottom: "1px solid var(--spark-border)",
              background: "rgba(var(--spark-ink-rgb),0.02)",
            }}
          >
            <th className="text-left p-4 label-mini">BA</th>
            <th className="text-left p-4 label-mini">CONTACT</th>
            <th className="text-left p-4 label-mini">SIGNED UP</th>
            <th className="text-right p-4 label-mini">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const u = row.user;
            const ambassadorId = String(row.id);
            const name =
              [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
              u?.email ||
              "(unknown)";
            const busy = pendingId === ambassadorId;
            return (
              <tr
                key={ambassadorId}
                style={{
                  borderBottom: "1px solid var(--spark-border)",
                }}
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="rounded-full grid place-items-center font-bold"
                      style={{
                        width: 36,
                        height: 36,
                        background: "rgba(var(--spark-accent-rgb),0.10)",
                        color: "var(--spark-lime)",
                        fontSize: 13,
                      }}
                    >
                      {initialsOf(
                        u?.firstName ?? null,
                        u?.lastName ?? null,
                        u?.email ?? "?",
                      )}
                    </div>
                    <div>
                      <p style={{ color: "var(--spark-text)" }}>{name}</p>
                      <p
                        className="mono text-[10px] mt-0.5"
                        style={{
                          letterSpacing: "0.14em",
                          color: "var(--spark-text-meta)",
                        }}
                      >
                        A-{String(row.uuid).slice(-4).toUpperCase()}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <p style={{ color: "var(--spark-text)" }}>
                    {u?.email ?? "—"}
                  </p>
                  {row.phone && (
                    <p
                      className="mono text-[11px] mt-0.5"
                      style={{ color: "var(--spark-text-meta)" }}
                    >
                      {row.phone}
                    </p>
                  )}
                </td>
                <td
                  className="p-4 mono text-xs"
                  style={{
                    letterSpacing: "0.06em",
                    color: "var(--spark-text-secondary)",
                  }}
                >
                  {fmtDate(row.createdAt)}
                </td>
                <td className="p-4 text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => disable(ambassadorId)}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(239,90,42,0.45)",
                        color: "var(--spark-orange)",
                        opacity: busy ? 0.5 : 1,
                      }}
                      title="Disable this signup"
                    >
                      Disable
                    </button>
                    <button
                      onClick={() => approve(ambassadorId)}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{
                        background: "var(--spark-lime)",
                        color: "var(--spark-on-accent)",
                        opacity: busy ? 0.5 : 1,
                      }}
                      title="Approve — BA can now be invited to shifts"
                    >
                      {busy ? "Working…" : "Approve →"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {confirmDisableId ? (
        <SparkConfirm
          tone="danger"
          kicker="Ambassador signup"
          title="Disable this signup?"
          body="They won't be able to sign in or claim shifts."
          confirmLabel="Disable signup"
          busy={isDisabling}
          onConfirm={executeDisable}
          onCancel={() => setConfirmDisableId(null)}
        />
      ) : null}
    </div>
  );
};

export default function SparkPendingAmbassadors() {
  return (
    <Layout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-text-meta)",
              }}
            >
              <Link to="/people" style={{ color: "var(--spark-lime)" }}>
                ← PEOPLE
              </Link>{" "}
              · PENDING APPROVAL
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              Waiting on you
            </h1>
            <p className="mt-2" style={{ color: "var(--spark-text-meta)" }}>
              Brand ambassadors who created an account but haven't been
              approved for shifts yet. Approve to unlock — disable if the
              signup looks bogus.
            </p>
          </div>
        </div>

        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Loading queue…
            </div>
          }
        >
          <Inner />
        </Suspense>
      </div>
    </Layout>
  );
}
