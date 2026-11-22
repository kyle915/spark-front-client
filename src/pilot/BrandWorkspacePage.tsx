import React, { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { checkinUrl, providerSubmitUrl } from "@/utils/publicHosts";
import { workspaceRoleLabel } from "./pilotHelpers";
import { PilotQueriesWorkspaceOverviewQuery } from "@/api/queries/PilotQueries";
import {
  PilotMutationsAssignWorkMutation,
  PilotMutationsInviteMemberMutation,
  PilotMutationsRegisterProviderMutation,
  PilotMutationsRespondAssignmentMutation,
  PilotMutationsRevokeMembershipMutation,
  PilotMutationsRevokeProviderMutation,
  PilotMutationsSetSourceInclusionMutation,
} from "@/api/mutations/PilotMutations";
import type { PilotQueriesWorkspaceOverviewQuery as OverviewQueryType } from "@/api/queries/__generated__/PilotQueriesWorkspaceOverviewQuery.graphql";
import type { PilotMutationsRegisterProviderMutation as RegisterProviderType } from "@/api/mutations/__generated__/PilotMutationsRegisterProviderMutation.graphql";
import type { PilotMutationsInviteMemberMutation as InviteMemberType } from "@/api/mutations/__generated__/PilotMutationsInviteMemberMutation.graphql";
import type { PilotMutationsRevokeMembershipMutation as RevokeMemberType } from "@/api/mutations/__generated__/PilotMutationsRevokeMembershipMutation.graphql";
import type { PilotMutationsRevokeProviderMutation as RevokeProviderType } from "@/api/mutations/__generated__/PilotMutationsRevokeProviderMutation.graphql";
import type { PilotMutationsAssignWorkMutation as AssignWorkType } from "@/api/mutations/__generated__/PilotMutationsAssignWorkMutation.graphql";
import type { PilotMutationsRespondAssignmentMutation as RespondAssignType } from "@/api/mutations/__generated__/PilotMutationsRespondAssignmentMutation.graphql";
import type { PilotMutationsSetSourceInclusionMutation as InclusionMutationType } from "@/api/mutations/__generated__/PilotMutationsSetSourceInclusionMutation.graphql";

const META = { color: "var(--spark-text-meta)" } as const;
const BORDER = { border: "1px solid var(--spark-border)" } as const;

const WorkspaceBody: React.FC<{ fetchKey: number; bump: () => void }> = ({
  fetchKey,
  bump,
}) => {
  const data = useLazyLoadQuery<OverviewQueryType>(
    PilotQueriesWorkspaceOverviewQuery,
    {},
    { fetchPolicy: "network-only", fetchKey },
  );
  const ws = data.workspaceOverview;

  const [commitRegister, registering] =
    useMutation<RegisterProviderType>(PilotMutationsRegisterProviderMutation);
  const [commitInvite, inviting] =
    useMutation<InviteMemberType>(PilotMutationsInviteMemberMutation);
  const [commitRevokeMember] =
    useMutation<RevokeMemberType>(PilotMutationsRevokeMembershipMutation);
  const [commitRevokeProvider] =
    useMutation<RevokeProviderType>(PilotMutationsRevokeProviderMutation);
  const [commitAssign, assigning] =
    useMutation<AssignWorkType>(PilotMutationsAssignWorkMutation);
  const [commitRespond] =
    useMutation<RespondAssignType>(PilotMutationsRespondAssignmentMutation);
  const [commitInclusion] =
    useMutation<InclusionMutationType>(PilotMutationsSetSourceInclusionMutation);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Register provider state
  const [provName, setProvName] = useState("");
  const [provEmail, setProvEmail] = useState("");

  // Invite member state
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState("brand_reviewer");
  const [invProviderUuid, setInvProviderUuid] = useState("");
  const [canRecaps, setCanRecaps] = useState(true);
  const [canFinance, setCanFinance] = useState(false);
  const [canSpend, setCanSpend] = useState(false);

  // Assign work state
  const [assignProvUuid, setAssignProvUuid] = useState("");
  const [assignProgramId, setAssignProgramId] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assignNotes, setAssignNotes] = useState("");

  const isExternalRole =
    invRole === "provider_manager" || invRole === "provider_rep";

  const copyLink = async (url: string, key: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(key);
      window.setTimeout(() => setCopiedCode(null), 1600);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider mono" style={META}>
            Brand-Owned Workspace · {ws.mode} ({ws.planTier})
          </p>
          <h1
            className="display text-2xl lg:text-3xl font-bold mt-1"
            style={{ letterSpacing: "-0.02em" }}
          >
            {ws.tenantName} Workspace & Agencies
          </h1>
          <p className="text-xs mt-1" style={META}>
            Signed in as{" "}
            <strong className="text-white">
              {workspaceRoleLabel(ws.viewerRole)}
            </strong>
            {ws.viewerProviderName ? ` · ${ws.viewerProviderName}` : ""}
          </p>
        </div>
      </header>

      {feedback && (
        <div
          className="p-3 rounded-xl text-xs font-medium"
          style={{
            background: "rgba(197,245,70,0.12)",
            color: "#c5f546",
            border: "1px solid rgba(197,245,70,0.3)",
          }}
        >
          {feedback}
        </div>
      )}

      {/* Admin controls: Register Agency + Invite Member */}
      {ws.isBrandAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form
            className="spark-card p-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!provName.trim()) return;
              commitRegister({
                variables: {
                  name: provName.trim(),
                  contactEmail: provEmail.trim(),
                  slug: "",
                },
                onCompleted: (r) => {
                  if (r.registerProviderOrganization.ok) {
                    setProvName("");
                    setProvEmail("");
                    setFeedback("Registered field provider organization.");
                    bump();
                  } else {
                    setFeedback(
                      r.registerProviderOrganization.error ?? "Failed to register agency.",
                    );
                  }
                },
              });
            }}
          >
            <h2 className="display text-base font-bold">
              Register Field Agency / Provider
            </h2>
            <p className="text-xs" style={META}>
              Outside providers only ever see programs and visits explicitly assigned to them.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                required
                value={provName}
                onChange={(e) => setProvName(e.target.value)}
                placeholder="Agency name (e.g. FieldPulse)"
                className="px-3 py-2 rounded-xl text-sm bg-black/30"
                style={BORDER}
              />
              <input
                type="email"
                value={provEmail}
                onChange={(e) => setProvEmail(e.target.value)}
                placeholder="ops@agency.com"
                className="px-3 py-2 rounded-xl text-sm bg-black/30"
                style={BORDER}
              />
            </div>
            <button
              type="submit"
              disabled={registering}
              className="px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: "#c5f546", color: "#0A0B0D" }}
            >
              + Add Provider
            </button>
          </form>

          <form
            className="spark-card p-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!invEmail.trim()) return;
              commitInvite({
                variables: {
                  email: invEmail.trim(),
                  workspaceRole: invRole,
                  providerUuid: isExternalRole ? invProviderUuid || null : null,
                  canApproveRecaps: !isExternalRole && canRecaps,
                  canApproveFinance: !isExternalRole && canFinance,
                  canApproveSpend: !isExternalRole && canSpend,
                },
                onCompleted: (r) => {
                  if (r.inviteWorkspaceMember.ok) {
                    setInvEmail("");
                    setFeedback("Workspace member invited / updated.");
                    bump();
                  } else {
                    setFeedback(
                      r.inviteWorkspaceMember.error ?? "Failed to invite member.",
                    );
                  }
                },
              });
            }}
          >
            <h2 className="display text-base font-bold">
              Invite Teammate or Agency User
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="email"
                required
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
                placeholder="teammate@brand.com"
                className="px-3 py-2 rounded-xl text-sm bg-black/30"
                style={BORDER}
              />
              <select
                value={invRole}
                onChange={(e) => setInvRole(e.target.value)}
                className="px-3 py-2 rounded-xl text-sm bg-black/30"
                style={BORDER}
              >
                <option value="brand_admin">Brand Admin</option>
                <option value="brand_reviewer">Brand Ops / Reviewer</option>
                <option value="finance_reviewer">Finance Reviewer</option>
                <option value="brand_viewer">Read-Only Viewer</option>
                <option value="provider_manager">External Agency Manager</option>
                <option value="provider_rep">External Field Rep</option>
              </select>
            </div>
            {isExternalRole ? (
              <select
                required
                value={invProviderUuid}
                onChange={(e) => setInvProviderUuid(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm bg-black/30"
                style={BORDER}
              >
                <option value="">Select agency organization…</option>
                {ws.providers.map((p) => (
                  <option key={p.uuid} value={p.uuid}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex flex-wrap gap-4 text-xs">
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={canRecaps}
                    onChange={(e) => setCanRecaps(e.target.checked)}
                  />
                  Recap approver
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={canFinance}
                    onChange={(e) => setCanFinance(e.target.checked)}
                  />
                  Finance approver
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={canSpend}
                    onChange={(e) => setCanSpend(e.target.checked)}
                  />
                  Spend / rebook approver
                </label>
              </div>
            )}
            <button
              type="submit"
              disabled={inviting}
              className="px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: "#c5f546", color: "#0A0B0D" }}
            >
              Send Workspace Invite
            </button>
          </form>
        </div>
      )}

      {/* Providers & Combined-Reporting Source Inclusion */}
      <section className="spark-card p-5 space-y-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="display text-lg font-bold">
            Field Providers & Combined-Reporting Inclusion
          </h2>
          <span className="text-xs mono" style={META}>
            {ws.providers.length} provider{ws.providers.length === 1 ? "" : "s"}
          </span>
        </div>
        {ws.providers.length === 0 ? (
          <p className="text-xs" style={META}>
            No outside field providers registered yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr style={META}>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Contact</th>
                  <th className="py-2 pr-3">Combined Reporting</th>
                  {ws.isBrandAdmin && <th className="py-2 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {ws.providers.map((p) => (
                  <tr
                    key={p.uuid}
                    style={{ borderTop: "1px solid var(--spark-border)" }}
                  >
                    <td className="py-2.5 pr-3 font-semibold">{p.name}</td>
                    <td className="py-2.5 pr-3 mono" style={META}>
                      {p.contactEmail || "—"}
                    </td>
                    <td className="py-2.5 pr-3">
                      {ws.canEditBrandOps ? (
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={p.includeInCombinedReporting}
                            onChange={(e) => {
                              commitInclusion({
                                variables: {
                                  providerUuid: p.uuid,
                                  includeInCombinedReporting: e.target.checked,
                                  notes: "Updated from Workspace settings",
                                },
                                onCompleted: () => bump(),
                              });
                            }}
                          />
                          <span>
                            {p.includeInCombinedReporting
                              ? "Included in rollups & insights"
                              : "Excluded from combined rollups"}
                          </span>
                        </label>
                      ) : (
                        <span>
                          {p.includeInCombinedReporting ? "Included" : "Excluded"}
                        </span>
                      )}
                    </td>
                    {ws.isBrandAdmin && (
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            commitRevokeProvider({
                              variables: { providerUuid: p.uuid },
                              onCompleted: () => {
                                setFeedback(
                                  `Revoked all workspace access & field links for ${p.name}.`,
                                );
                                bump();
                              },
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                          style={{
                            color: "#ef5a2a",
                            border: "1px solid rgba(239,90,42,0.4)",
                          }}
                        >
                          Revoke agency
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Program / Visit Assignments + Mobile Field Links */}
      <section className="spark-card p-5 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="display text-lg font-bold">
              Assigned Programs, Visits & Mobile Field Links
            </h2>
            <p className="text-xs" style={META}>
              Each assignment mints a scoped mobile submission link on client.igniteproductions.co.
            </p>
          </div>
        </div>

        {ws.canEditBrandOps && ws.providers.length > 0 && (
          <form
            className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!assignProvUuid) return;
              commitAssign({
                variables: {
                  providerUuid: assignProvUuid,
                  scopeType: "program",
                  eventTypeId: assignProgramId ? Number(assignProgramId) : null,
                  visitUuid: null,
                  dueDate: assignDueDate || null,
                  notes: assignNotes.trim(),
                },
                onCompleted: (r) => {
                  if (r.assignProviderWork.ok) {
                    setAssignNotes("");
                    setFeedback(
                      `Created assignment (${r.assignProviderWork.targetUuid ?? ""}).`,
                    );
                    bump();
                  } else {
                    setFeedback(
                      r.assignProviderWork.error ?? "Failed to create assignment.",
                    );
                  }
                },
              });
            }}
          >
            <select
              required
              value={assignProvUuid}
              onChange={(e) => setAssignProvUuid(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-black/30"
              style={BORDER}
            >
              <option value="">Select agency…</option>
              {ws.providers.map((p) => (
                <option key={p.uuid} value={p.uuid}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={assignProgramId}
              onChange={(e) => setAssignProgramId(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-black/30"
              style={BORDER}
            >
              <option value="">All retail programs</option>
              {ws.programs.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={assignDueDate}
              onChange={(e) => setAssignDueDate(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-black/30"
              style={BORDER}
            />
            <input
              value={assignNotes}
              onChange={(e) => setAssignNotes(e.target.value)}
              placeholder="Briefing / store instructions"
              className="px-3 py-2 rounded-xl text-xs bg-black/30"
              style={BORDER}
            />
            <button
              type="submit"
              disabled={assigning}
              className="px-3 py-2 rounded-xl text-xs font-bold"
              style={{ background: "#c5f546", color: "#0A0B0D" }}
            >
              + Assign Program
            </button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr style={META}>
                <th className="py-2 pr-3">Agency</th>
                <th className="py-2 pr-3">Scope</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Mobile Field Link</th>
                <th className="py-2 text-right">Response</th>
              </tr>
            </thead>
            <tbody>
              {ws.assignments.map((a) => {
                const mobileUrl = providerSubmitUrl(a.submissionCode);
                const walkupUrl = checkinUrl(a.submissionCode);
                return (
                  <tr
                    key={a.uuid}
                    style={{ borderTop: "1px solid var(--spark-border)" }}
                  >
                    <td className="py-2.5 pr-3 font-medium">{a.providerName}</td>
                    <td className="py-2.5 pr-3">
                      {a.storeLabel ?? a.programName ?? a.scopeType}
                      {a.dueDate ? ` · due ${a.dueDate}` : ""}
                    </td>
                    <td className="py-2.5 pr-3 mono">{a.status}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyLink(mobileUrl, a.uuid)}
                          className="px-2.5 py-1 rounded-lg mono text-xs"
                          style={{
                            background: "rgba(197,245,70,0.12)",
                            color: "#c5f546",
                          }}
                        >
                          {copiedCode === a.uuid
                            ? "Copied!"
                            : `Copy ${a.submissionCode}`}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyLink(walkupUrl, `${a.uuid}-w`)}
                          className="px-2 py-1 rounded-lg text-[11px]"
                          style={BORDER}
                        >
                          {copiedCode === `${a.uuid}-w`
                            ? "Copied check-in"
                            : "Check-in URL"}
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 text-right">
                      {ws.viewerProviderUuid === a.providerUuid &&
                      a.status === "assigned" ? (
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              commitRespond({
                                variables: {
                                  assignmentUuid: a.uuid,
                                  decision: "accept",
                                  responseNote: "Accepted in portal",
                                },
                                onCompleted: () => bump(),
                              })
                            }
                            className="px-2.5 py-1 rounded-lg font-semibold"
                            style={{ background: "#c5f546", color: "#0A0B0D" }}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              commitRespond({
                                variables: {
                                  assignmentUuid: a.uuid,
                                  decision: "decline",
                                  responseNote: "Capacity conflict",
                                },
                                onCompleted: () => bump(),
                              })
                            }
                            className="px-2.5 py-1 rounded-lg font-semibold"
                            style={{ color: "#ef5a2a", ...BORDER }}
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <span style={META}>{a.responseNote || "—"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Active Members & Approvers */}
      {ws.canViewConsolidated && (
        <section className="spark-card p-5 space-y-3">
          <h2 className="display text-lg font-bold">
            Workspace Members & Designated Approvers
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr style={META}>
                  <th className="py-2 pr-3">Person</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Approver Rights</th>
                  <th className="py-2 pr-3">Status</th>
                  {ws.isBrandAdmin && <th className="py-2 text-right">Revoke</th>}
                </tr>
              </thead>
              <tbody>
                {ws.members.map((m) => {
                  const rights = [
                    m.canApproveRecaps ? "Recaps" : null,
                    m.canApproveFinance ? "Finance" : null,
                    m.canApproveSpend ? "Spend/Rebook" : null,
                  ].filter(Boolean);
                  return (
                    <tr
                      key={m.uuid}
                      style={{ borderTop: "1px solid var(--spark-border)" }}
                    >
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{m.fullName || m.email}</div>
                        <div className="mono text-[11px]" style={META}>
                          {m.email}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        {workspaceRoleLabel(m.workspaceRole)}
                        {m.providerName ? ` · ${m.providerName}` : ""}
                      </td>
                      <td className="py-2.5 pr-3">
                        {rights.length > 0 ? rights.join(", ") : "—"}
                      </td>
                      <td className="py-2.5 pr-3 mono">{m.status}</td>
                      {ws.isBrandAdmin && (
                        <td className="py-2.5 text-right">
                          {m.status === "active" && (
                            <button
                              type="button"
                              onClick={() =>
                                commitRevokeMember({
                                  variables: { membershipUuid: m.uuid },
                                  onCompleted: () => {
                                    setFeedback(`Revoked ${m.email} immediately.`);
                                    bump();
                                  },
                                })
                              }
                              className="px-2.5 py-1 rounded-lg text-xs"
                              style={{
                                color: "#ef5a2a",
                                border: "1px solid rgba(239,90,42,0.35)",
                              }}
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Audit Log */}
      {ws.auditLogs.length > 0 && (
        <section className="spark-card p-5 space-y-3">
          <h2 className="display text-base font-bold">
            Workspace Security & Permission Audit Trail
          </h2>
          <ul className="space-y-2 text-xs m-0 p-0 list-none">
            {ws.auditLogs.slice(0, 15).map((log) => (
              <li
                key={log.uuid}
                className="flex flex-wrap items-baseline justify-between gap-2 py-1.5"
                style={{ borderTop: "1px solid var(--spark-border)" }}
              >
                <span>
                  <strong className="mono text-[11px] uppercase mr-2" style={{ color: "#c5f546" }}>
                    {log.category}
                  </strong>
                  {log.summary}
                </span>
                <span className="mono text-[11px]" style={META}>
                  {log.actorEmail ?? "system"} · {log.createdAt.slice(0, 19).replace("T", " ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export const BrandWorkspacePage: React.FC = () => {
  const [fetchKey, setFetchKey] = useState(0);
  return (
    <div className="p-4 lg:p-8">
      <Suspense fallback={<p className="text-sm mono">Loading workspace…</p>}>
        <WorkspaceBody
          fetchKey={fetchKey}
          bump={() => setFetchKey((k) => k + 1)}
        />
      </Suspense>
    </div>
  );
};

export default BrandWorkspacePage;
