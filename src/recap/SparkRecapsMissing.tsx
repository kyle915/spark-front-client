import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { MissingRecapEventsQuery } from "@/api/queries/MissingRecapEventsQuery";
import type { MissingRecapEventsQuery as MissingRecapEventsQueryType } from "@api/queries/__generated__/MissingRecapEventsQuery.graphql";
import { NudgeAmbassadorForRecapMutation } from "@/api/mutations/NudgeAmbassadorForRecapMutation";
import type { NudgeAmbassadorForRecapMutation as NudgeAmbassadorForRecapMutationType } from "@api/mutations/__generated__/NudgeAmbassadorForRecapMutation.graphql";
import ImportConnecteamButton from "./ImportConnecteamButton";

/**
 * /recaps/missing — admin drill-down for events that already wrapped
 * but don't have a recap filed yet.
 *
 * Reads from `missingRecapEvents`. Per row:
 *   - Event identity (name / venue / state / overdue chip)
 *   - List of assigned BAs with a "Nudge" button per BA (fires the
 *     push notification)
 *   - "File for them" link → /recap/create?event=<uuid>&ambassador=<uuid>
 *   - Deep-link to the parent request if there is one
 *
 * The drill-down complements the sidebar "N RECAPS DUE" badge from
 * PR #215 — that badge surfaces the count; this page is where the
 * admin actually clears the queue.
 */

type LookbackKey = "7" | "30" | "90";

const fmtDate = (raw: string | null | undefined): string => {
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

const overdueChipStyle = (
  hoursOverdue: number | null,
): { background: string; color: string; border: string; label: string } => {
  if (hoursOverdue == null) {
    return {
      background: "rgba(255,255,255,0.05)",
      color: "rgba(255,255,255,0.55)",
      border: "1px solid rgba(255,255,255,0.15)",
      label: "OVERDUE",
    };
  }
  if (hoursOverdue >= 72) {
    return {
      background: "rgba(239,90,42,0.16)",
      color: "var(--spark-orange)",
      border: "1px solid rgba(239,90,42,0.45)",
      label: `OVERDUE ${Math.floor(hoursOverdue / 24)}d`,
    };
  }
  if (hoursOverdue >= 24) {
    return {
      background: "rgba(255,200,60,0.12)",
      color: "#f5c042",
      border: "1px solid rgba(255,200,60,0.35)",
      label: `OVERDUE ${Math.floor(hoursOverdue / 24)}d`,
    };
  }
  return {
    background: "rgba(197,245,70,0.08)",
    color: "var(--spark-lime)",
    border: "1px solid rgba(197,245,70,0.25)",
    label: `OVERDUE ${hoursOverdue}h`,
  };
};

const Inner: React.FC<{ tenantId: string | null; lookbackDays: number }> = ({
  tenantId,
  lookbackDays,
}) => {
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);

  const data = useLazyLoadQuery<MissingRecapEventsQueryType>(
    MissingRecapEventsQuery,
    { tenantId: tenantId ?? null, lookbackDays },
    { fetchPolicy: "store-or-network" },
  );

  const rows = useMemo(
    () => data?.missingRecapEvents ?? [],
    [data],
  );

  const [commitNudge, isNudging] =
    useMutation<NudgeAmbassadorForRecapMutationType>(
      NudgeAmbassadorForRecapMutation,
    );

  // Tracks the row currently being nudged so a row's button can show
  // "Sending…" without freezing the others.
  const [nudgingId, setNudgingId] = useState<string | null>(null);

  const nudge = (
    ambassadorEventUuid: string,
    venueLabel: string,
    name: string,
  ) => {
    if (isNudging) return;
    setNudgingId(ambassadorEventUuid);
    commitNudge({
      variables: { input: { ambassadorEventUuid } },
      onCompleted: (res) => {
        setNudgingId(null);
        const r = res.nudgeAmbassadorForRecap;
        if (r?.success) {
          showAlert(
            `${name} nudged for ${venueLabel}${
              r.devicesNotified != null
                ? ` (${r.devicesNotified} device${r.devicesNotified === 1 ? "" : "s"})`
                : ""
            }.`,
            "success",
          );
        } else {
          showAlert(r?.message ?? "Nudge failed.", "warning");
        }
      },
      onError: (err) => {
        setNudgingId(null);
        showAlert(err.message, "error");
      },
    });
  };

  if (rows.length === 0) {
    return (
      <div
        className="spark-card p-8 text-center"
        style={{ color: "rgba(255,255,255,0.65)" }}
      >
        <p
          className="display text-lg font-bold mb-2"
          style={{ color: "var(--spark-lime)" }}
        >
          ✦ All clear
        </p>
        <p className="text-sm">
          Every shift in the last {lookbackDays} day{lookbackDays === 1 ? "" : "s"}{" "}
          has a recap on file.
        </p>
      </div>
    );
  }

  // CSV export of the visible rows. Same format as the Master
  // Tracker / Recaps page exports — one row per (event, assigned
  // BA) pair so the spreadsheet can be sorted by BA without losing
  // the event context. Events with no assignments still get one row
  // (empty BA columns) so the count matches the on-screen list.
  const exportCsv = () => {
    if (rows.length === 0) {
      window.alert("Nothing to export.");
      return;
    }
    const esc = (raw: string | number | null | undefined) => {
      const s = (raw ?? "").toString();
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = [
      "Event UUID",
      "Event Name",
      "Venue",
      "Address",
      "State",
      "Date",
      "Hours Overdue",
      "BA Name",
      "BA Email",
      "BA Invite Status",
      "Ambassador Event UUID",
      "Request UUID",
    ];
    const lines = [header.join(",")];
    for (const row of rows) {
      const bas = row.assignedAmbassadors.length > 0
        ? row.assignedAmbassadors
        : [
            {
              name: "",
              email: "",
              isApproved: false,
              ambassadorEventUuid: "",
            },
          ];
      for (const ba of bas) {
        lines.push(
          [
            row.eventUuid,
            row.eventName,
            row.venue ?? "",
            row.address ?? "",
            row.stateCode ?? "",
            row.date ?? row.endTime ?? "",
            row.hoursOverdue ?? "",
            ba.name,
            ba.email ?? "",
            ba.name ? (ba.isApproved ? "accepted" : "pending") : "",
            ba.ambassadorEventUuid,
            row.requestUuid ?? "",
          ]
            .map(esc)
            .join(","),
        );
      }
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `spark-recaps-missing-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div
        className="flex items-center justify-between text-[10px]"
        style={{ paddingBottom: 2 }}
      >
        <span
          className="mono"
          style={{
            letterSpacing: "0.16em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {rows.length} EVENT{rows.length === 1 ? "" : "S"} OWING A RECAP
        </span>
        <button
          type="button"
          onClick={exportCsv}
          className="mono"
          style={{
            letterSpacing: "0.14em",
            color: "var(--spark-lime)",
          }}
          title="Download the visible list as CSV — one row per (event, BA) pair"
        >
          ⇣ EXPORT CSV
        </button>
      </div>
      {rows.map((row) => {
        const chip = overdueChipStyle(row.hoursOverdue ?? null);
        const venueLabel = row.venue || row.eventName;
        return (
          <div
            key={row.eventUuid}
            className="spark-card p-4"
            style={{ borderRadius: 14 }}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className="chip text-[10px] mono"
                    style={{
                      letterSpacing: "0.14em",
                      background: chip.background,
                      color: chip.color,
                      border: chip.border,
                      padding: "3px 8px",
                      borderRadius: 999,
                    }}
                  >
                    {chip.label}
                  </span>
                  {row.stateCode && (
                    <span
                      className="mono text-[10px]"
                      style={{
                        letterSpacing: "0.14em",
                        color: "rgba(255,255,255,0.55)",
                      }}
                    >
                      {row.stateCode}
                    </span>
                  )}
                </div>
                <p className="font-bold truncate" title={venueLabel}>
                  {venueLabel}
                </p>
                <p
                  className="text-xs mt-0.5 truncate"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  {fmtDate(row.date ?? row.endTime ?? null)}
                  {row.address ? ` · ${row.address}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {row.requestUuid && (
                  <button
                    type="button"
                    onClick={() => navigate(`/request/view/${row.requestUuid}`)}
                    className="mono text-[10px]"
                    style={{
                      letterSpacing: "0.14em",
                      color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    → REQUEST
                  </button>
                )}
              </div>
            </div>

            {row.assignedAmbassadors.length === 0 ? (
              <div
                className="mt-3 px-3 py-2 rounded-xl text-xs"
                style={{
                  background: "rgba(255,200,60,0.08)",
                  border: "1px solid rgba(255,200,60,0.25)",
                  color: "rgba(255,255,255,0.65)",
                }}
              >
                No BA assigned — file the recap manually or assign someone to the
                shift first.
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      // Seed the recap picker's search (`q`) with the event
                      // name alongside the uuid. The create page pre-selects
                      // by finding the uuid within the loaded page (~30
                      // events), so for tenants with many events the target
                      // fell outside the page and wasn't auto-selected.
                      // Seeding the name-search guarantees the event is in the
                      // results so the uuid match lands.
                      `/recap/create?event=${row.eventUuid}&q=${encodeURIComponent(row.eventName)}`,
                    )
                  }
                  className="mono text-[10px] ml-3"
                  style={{
                    letterSpacing: "0.14em",
                    color: "var(--spark-lime)",
                  }}
                >
                  + FILE NOW →
                </button>
              </div>
            ) : (
              <div
                className="mt-3 rounded-xl divide-y"
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                {row.assignedAmbassadors.map((ba) => {
                  const busy = nudgingId === ba.ambassadorEventUuid;
                  return (
                    <div
                      key={ba.ambassadorEventUuid}
                      className="flex items-center gap-3 px-3 py-2"
                      style={{
                        borderColor: "var(--spark-border)",
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          {ba.name}
                          {!ba.isApproved && (
                            <span
                              className="mono text-[10px] ml-2"
                              style={{
                                letterSpacing: "0.14em",
                                color: "rgba(255,200,60,0.85)",
                              }}
                            >
                              · PENDING
                            </span>
                          )}
                        </p>
                        {ba.email && (
                          <p
                            className="mono text-[10px] truncate"
                            style={{
                              letterSpacing: "0.14em",
                              color: "rgba(255,255,255,0.40)",
                            }}
                          >
                            {ba.email}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          nudge(ba.ambassadorEventUuid, venueLabel, ba.name)
                        }
                        disabled={busy || isNudging}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                        style={{
                          background: "transparent",
                          color: "var(--spark-text)",
                          border: "1px solid var(--spark-border)",
                        }}
                        title="Push 'Don't forget your recap' to this BA"
                      >
                        {busy ? "Sending…" : "🔔 Nudge"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/recap/create?event=${row.eventUuid}&ambassador=${ba.ambassadorUuid}&q=${encodeURIComponent(row.eventName)}`,
                          )
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{
                          background: "var(--spark-lime)",
                          color: "#0a0d09",
                        }}
                        title="Open the recap form pre-scoped to this BA + event"
                      >
                        File for them
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default function SparkRecapsMissing() {
  const { tenantId } = useAuthStore();
  const [lookback, setLookback] = useState<LookbackKey>("30");
  const lookbackDays = Number(lookback);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              RECAPS · MISSING
            </p>
            <h1 className="display text-2xl font-bold">Shifts still owing a recap</h1>
            <p
              className="text-sm mt-1"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Events that already wrapped but don't have a recap on file. Nudge the
              BA via push, or file the recap on their behalf.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ImportConnecteamButton variant="ghost" />
            <span
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              LOOKBACK
            </span>
            <select
              value={lookback}
              onChange={(e) => setLookback(e.target.value as LookbackKey)}
              className="rounded-xl text-xs"
              style={{
                padding: "0.45rem 0.9rem",
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
                outline: "none",
              }}
            >
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
        </div>

        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Loading missing recaps…
            </div>
          }
        >
          <Inner tenantId={tenantId ?? null} lookbackDays={lookbackDays} />
        </Suspense>
      </div>
    </Layout>
  );
}
