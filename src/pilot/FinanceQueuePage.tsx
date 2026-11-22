import React, { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import {
  exceptionStatusLabel,
  formatHonestMoney,
  type FinanceExceptionStatusKind,
} from "./pilotHelpers";
import { PlanGateCallout } from "./PlanGateCallout";
import { PilotQueriesFinanceQueuePageQuery } from "@/api/queries/PilotQueries";
import {
  PilotMutationsAssignExceptionMutation,
  PilotMutationsAttachExceptionProofMutation,
  PilotMutationsClarifyExceptionMutation,
  PilotMutationsFixExceptionMatchMutation,
  PilotMutationsResolveExceptionMutation,
} from "@/api/mutations/PilotMutations";
import type { PilotQueriesFinanceQueuePageQuery as FinanceQueryType } from "@/api/queries/__generated__/PilotQueriesFinanceQueuePageQuery.graphql";
import type { PilotMutationsAssignExceptionMutation as AssignExcType } from "@/api/mutations/__generated__/PilotMutationsAssignExceptionMutation.graphql";
import type { PilotMutationsAttachExceptionProofMutation as AttachProofType } from "@/api/mutations/__generated__/PilotMutationsAttachExceptionProofMutation.graphql";
import type { PilotMutationsFixExceptionMatchMutation as FixMatchType } from "@/api/mutations/__generated__/PilotMutationsFixExceptionMatchMutation.graphql";
import type { PilotMutationsClarifyExceptionMutation as ClarifyExcType } from "@/api/mutations/__generated__/PilotMutationsClarifyExceptionMutation.graphql";
import type { PilotMutationsResolveExceptionMutation as ResolveExcType } from "@/api/mutations/__generated__/PilotMutationsResolveExceptionMutation.graphql";

const META = { color: "var(--spark-text-meta)" } as const;
const BORDER = { border: "1px solid var(--spark-border)" } as const;
const FIELD_STYLE = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-field-bg, var(--spark-surface))",
  color: "var(--spark-text)",
} as const;
const PRIMARY_BTN_STYLE = {
  background: "var(--spark-lime)",
  color: "var(--spark-on-accent)",
  border: "1px solid var(--spark-lime)",
} as const;
const OK_BANNER_STYLE = {
  background: "var(--spark-ok-bg)",
  color: "var(--spark-ok-ink)",
  border: "1px solid var(--spark-ok-border)",
} as const;

const FinanceBody: React.FC<{
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  fetchKey: number;
  bump: () => void;
}> = ({
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  fetchKey,
  bump,
}) => {
  const data = useLazyLoadQuery<FinanceQueryType>(
    PilotQueriesFinanceQueuePageQuery,
    {
      exceptionType: typeFilter || null,
      status: statusFilter || null,
      providerUuid: null,
      periodStart: null,
      periodEnd: null,
    },
    { fetchPolicy: "network-only", fetchKey },
  );
  const ws = data.workspaceOverview;
  const q = data.financeExceptionQueue;
  const visits = data.canonicalVisits;

  const [commitAssign] = useMutation<AssignExcType>(
    PilotMutationsAssignExceptionMutation,
  );
  const [commitProof] = useMutation<AttachProofType>(
    PilotMutationsAttachExceptionProofMutation,
  );
  const [commitMatch] = useMutation<FixMatchType>(
    PilotMutationsFixExceptionMatchMutation,
  );
  const [commitClarify] = useMutation<ClarifyExcType>(
    PilotMutationsClarifyExceptionMutation,
  );
  const [commitResolve] = useMutation<ResolveExcType>(
    PilotMutationsResolveExceptionMutation,
  );

  const [activeUuid, setActiveUuid] = useState<string | null>(null);
  const [reasonByUuid, setReasonByUuid] = useState<Record<string, string>>({});
  const [proofUrlByUuid, setProofUrlByUuid] = useState<Record<string, string>>(
    {},
  );
  const [visitMatchByUuid, setVisitMatchByUuid] = useState<
    Record<string, string>
  >({});
  const [banner, setBanner] = useState<string | null>(null);

  return (
    <div className="space-y-6 max-w-6xl">
      <header>
        <p className="text-xs uppercase tracking-wider mono" style={META}>
          Decoupled from Operational Recap Approval · {ws.tenantName}
        </p>
        <h1
          className="display text-2xl lg:text-3xl font-bold mt-1"
          style={{ letterSpacing: "-0.02em" }}
        >
          Finance Exception & Proof Review Queue
        </h1>
        <p className="text-xs mt-1" style={META}>
          Approve field recaps without silently clearing missing proof, unitemized slips, duplicate charges, or unmatched expenses.
        </p>
      </header>

      {q.planGated ? (
        <PlanGateCallout
          title="Finance Exception & Proof Review Queue"
          message={q.planUpgradeMessage}
          requiredPlan={q.requiredPlan}
        />
      ) : null}

      {banner && (
        <div
          className="p-3 rounded-xl text-xs"
          style={OK_BANNER_STYLE}
        >
          {banner}
        </div>
      )}

      {/* Filters */}
      <div className="spark-card p-4 flex flex-wrap items-center gap-3 text-xs">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl"
          style={FIELD_STYLE}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="needs_clarification">Needs clarification</option>
          <option value="resolved">Resolved</option>
          <option value="exception_granted">Exception granted</option>
          <option value="auto_cleared">Auto-cleared</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl"
          style={FIELD_STYLE}
        >
          <option value="">All exception types</option>
          <option value="missing_rate_or_amount">Missing rate / amount</option>
          <option value="missing_proof">Missing proof</option>
          <option value="unitemized_proof">Unitemized proof</option>
          <option value="suspected_duplicate">Suspected duplicate charge</option>
          <option value="unmatched_cost">Unmatched cost / receipt</option>
          <option value="allocation_discrepancy">Allocation discrepancy</option>
        </select>

        <span className="ml-auto mono" style={META}>
          {q.exceptions.length} exception{q.exceptions.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Exceptions List */}
      <section className="space-y-3">
        {q.exceptions.length === 0 ? (
          <div className="spark-card p-6 text-xs" style={META}>
            No financial exceptions match the selected filters.
          </div>
        ) : (
          q.exceptions.map((exc) => {
            const expanded = activeUuid === exc.uuid;
            const noteVal = reasonByUuid[exc.uuid] ?? "";
            const statusLabel = exceptionStatusLabel(
              (exc.status as FinanceExceptionStatusKind) || "open",
            );
            return (
              <div key={exc.uuid} className="spark-card p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className="px-2.5 py-0.5 rounded-full font-semibold mono"
                        style={{
                          background:
                            exc.status === "open" ||
                            exc.status === "needs_clarification"
                              ? "rgba(239,90,42,0.14)"
                              : "var(--spark-ok-bg)",
                          color:
                            exc.status === "open" ||
                            exc.status === "needs_clarification"
                              ? "var(--spark-flag-ink, #ef5a2a)"
                              : "var(--spark-ok-ink)",
                        }}
                      >
                        {statusLabel}
                      </span>
                      <span className="mono uppercase text-[11px]" style={META}>
                        {exc.exceptionType.replace(/_/g, " ")}
                      </span>
                      {exc.storeLabel && (
                        <span className="font-semibold">
                          · {exc.storeLabel} ({exc.visitDate ?? "—"})
                        </span>
                      )}
                      {exc.providerName && (
                        <span style={META}>· {exc.providerName}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium">{exc.explanation}</p>
                    <p className="text-xs" style={META}>
                      Affected:{" "}
                      <strong className="mono">
                        {formatHonestMoney(exc.affectedAmount)}
                      </strong>{" "}
                      · Source: {exc.sourceLabel || "—"} · Owner:{" "}
                      <strong className="mono">
                        {exc.ownerEmail ?? "Unassigned"}
                      </strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveUuid(expanded ? null : exc.uuid)
                    }
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={BORDER}
                  >
                    {expanded ? "Hide actions" : "Review / Resolve"}
                  </button>
                </div>

                {expanded && ws.canEditFinance && (
                  <div
                    className="pt-3 space-y-3 text-xs"
                    style={{ borderTop: "1px solid var(--spark-border)" }}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      <select
                        value={exc.ownerUserId ?? ""}
                        onChange={(e) => {
                          const uid = e.target.value
                            ? Number(e.target.value)
                            : null;
                          commitAssign({
                            variables: {
                              exceptionUuid: exc.uuid,
                              ownerUserId: uid,
                            },
                            onCompleted: () => bump(),
                          });
                        }}
                        className="px-3 py-2 rounded-xl"
                        style={FIELD_STYLE}
                      >
                        <option value="">Assign owner…</option>
                        {ws.members
                          .filter((m) => m.status === "active")
                          .map((m) => (
                            <option key={m.uuid} value={m.userId}>
                              {m.fullName || m.email}
                            </option>
                          ))}
                      </select>

                      <div className="flex gap-1.5">
                        <input
                          value={proofUrlByUuid[exc.uuid] ?? ""}
                          onChange={(e) =>
                            setProofUrlByUuid((p) => ({
                              ...p,
                              [exc.uuid]: e.target.value,
                            }))
                          }
                          placeholder="Attach itemized receipt URL…"
                          className="flex-1 px-3 py-2 rounded-xl"
                          style={FIELD_STYLE}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const url = (proofUrlByUuid[exc.uuid] ?? "").trim();
                            if (!url) return;
                            commitProof({
                              variables: {
                                exceptionUuid: exc.uuid,
                                proofUrl: url,
                                label: "Finance attached itemized proof",
                                isItemized: true,
                                verifiedAmount: exc.affectedAmount ?? null,
                              },
                              onCompleted: (r) => {
                                if (r.attachFinanceExceptionProof.ok) {
                                  setBanner(
                                    "Attached proof & recomputed visit cost.",
                                  );
                                  bump();
                                }
                              },
                            });
                          }}
                          className="px-3 py-2 rounded-xl font-semibold"
                          style={FIELD_STYLE}
                        >
                          Attach Proof
                        </button>
                      </div>

                      {exc.exceptionType === "unmatched_cost" && (
                        <div className="flex gap-1.5">
                          <select
                            value={visitMatchByUuid[exc.uuid] ?? ""}
                            onChange={(e) =>
                              setVisitMatchByUuid((p) => ({
                                ...p,
                                [exc.uuid]: e.target.value,
                              }))
                            }
                            className="flex-1 px-3 py-2 rounded-xl"
                            style={FIELD_STYLE}
                          >
                            <option value="">Match to visit…</option>
                            {visits.map((v) => (
                              <option key={v.uuid} value={v.uuid}>
                                {v.storeLabel} ({v.visitDate})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const vUuid = visitMatchByUuid[exc.uuid];
                              if (!vUuid) return;
                              commitMatch({
                                variables: {
                                  exceptionUuid: exc.uuid,
                                  visitUuid: vUuid,
                                  category: "product",
                                },
                                onCompleted: () => {
                                  setBanner("Linked unmatched cost to visit.");
                                  bump();
                                },
                              });
                            }}
                            className="px-3 py-2 rounded-xl font-semibold"
                            style={FIELD_STYLE}
                          >
                            Link Visit
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={noteVal}
                        onChange={(e) =>
                          setReasonByUuid((p) => ({
                            ...p,
                            [exc.uuid]: e.target.value,
                          }))
                        }
                        placeholder="Required audit reason or clarification question…"
                        className="flex-1 min-w-[240px] px-3 py-2 rounded-xl"
                        style={FIELD_STYLE}
                      />
                      <button
                        type="button"
                        disabled={!noteVal.trim()}
                        onClick={() =>
                          commitClarify({
                            variables: {
                              exceptionUuid: exc.uuid,
                              note: noteVal.trim(),
                            },
                            onCompleted: () => {
                              setBanner("Requested clarification.");
                              bump();
                            },
                          })
                        }
                        className="px-3 py-2 rounded-xl font-semibold"
                        style={FIELD_STYLE}
                      >
                        Request Clarification
                      </button>
                      <button
                        type="button"
                        disabled={!noteVal.trim()}
                        onClick={() =>
                          commitResolve({
                            variables: {
                              exceptionUuid: exc.uuid,
                              resolutionStatus: "exception_granted",
                              reason: noteVal.trim(),
                              updatedAmount: null,
                            },
                            onCompleted: () => {
                              setBanner(
                                "Granted documented exception & recomputed rollups.",
                              );
                              bump();
                            },
                          })
                        }
                        className="px-3 py-2 rounded-xl font-semibold"
                        style={{
                          background: "var(--spark-warn-badge-bg)",
                          color: "var(--spark-warn-badge-ink)",
                          border: "1px solid var(--spark-border)",
                        }}
                      >
                        Grant Exception
                      </button>
                      <button
                        type="button"
                        disabled={!noteVal.trim()}
                        onClick={() =>
                          commitResolve({
                            variables: {
                              exceptionUuid: exc.uuid,
                              resolutionStatus: "resolved",
                              reason: noteVal.trim(),
                              updatedAmount: null,
                            },
                            onCompleted: () => {
                              setBanner("Resolved financial exception.");
                              bump();
                            },
                          })
                        }
                        className="px-3 py-2 rounded-xl font-bold"
                        style={PRIMARY_BTN_STYLE}
                      >
                        Resolve
                      </button>
                    </div>

                    {exc.audits.length > 0 && (
                      <ul className="space-y-1 pt-2 m-0 p-0 list-none" style={META}>
                        {exc.audits.map((a) => (
                          <li key={a.uuid} className="mono text-[11px]">
                            [{a.createdAt.slice(0, 16).replace("T", " ")}]{" "}
                            {a.actorEmail ?? "system"} · {a.action}: {a.note}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* Separate Non-Blocking Operational Field Notices */}
      {q.operationalNotices.length > 0 && (
        <section className="spark-card p-5 space-y-2">
          <h2 className="display text-base font-bold">
            Advisory Operational Field Notices (Separate from Financial Close)
          </h2>
          <p className="text-xs" style={META}>
            Short clock-ins and duplicate activation photos stay visible for ops coaching without blocking financial reconciliation.
          </p>
          <ul className="space-y-1.5 text-xs m-0 p-0 list-none pt-1">
            {q.operationalNotices.map((n) => (
              <li
                key={n.id}
                className="py-1.5 flex items-center justify-between gap-2"
                style={{ borderTop: "1px solid var(--spark-border)" }}
              >
                <span>
                  <strong className="mono mr-2">{n.kind}</strong>
                  {n.detail}
                </span>
                <span className="mono text-[11px]" style={META}>
                  {n.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export const FinanceQueuePage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [fetchKey, setFetchKey] = useState(0);
  return (
    <div className="p-4 lg:p-8">
      <Suspense fallback={<p className="text-sm mono">Loading finance queue…</p>}>
        <FinanceBody
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          fetchKey={fetchKey}
          bump={() => setFetchKey((k) => k + 1)}
        />
      </Suspense>
    </div>
  );
};

export default FinanceQueuePage;
