import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { UsersQuery } from "@/api/queries/UsersQuery";
import type { UsersQuery as UsersQueryType } from "@api/queries/__generated__/UsersQuery.graphql";
import { TenantsQuery } from "@/api/queries/TenantsQuery";
import type { TenantsQuery as TenantsQueryType } from "@api/queries/__generated__/TenantsQuery.graphql";
import { SetDefaultExternalRmmMutation } from "@/api/mutations/SetDefaultExternalRmmMutation";
import type { SetDefaultExternalRmmMutation as SetDefaultExternalRmmMutationType } from "@api/mutations/__generated__/SetDefaultExternalRmmMutation.graphql";
import { SetTenantRecapRecipientEmailsMutation } from "@/api/mutations/SetTenantRecapRecipientEmailsMutation";
import type { SetTenantRecapRecipientEmailsMutation as SetTenantRecapRecipientEmailsMutationType } from "@api/mutations/__generated__/SetTenantRecapRecipientEmailsMutation.graphql";
import { SetScheduledReportEnabledMutation } from "@/api/mutations/SetScheduledReportEnabledMutation";
import type { SetScheduledReportEnabledMutation as SetScheduledReportEnabledMutationType } from "@api/mutations/__generated__/SetScheduledReportEnabledMutation.graphql";
import { SetClientWeeklyDigestEnabledMutation } from "@/api/mutations/SetClientWeeklyDigestEnabledMutation";
import type { SetClientWeeklyDigestEnabledMutation as SetClientWeeklyDigestEnabledMutationType } from "@api/mutations/__generated__/SetClientWeeklyDigestEnabledMutation.graphql";
import { SendTestClientReportMutation } from "@/api/mutations/SendTestClientReportMutation";
import type { SendTestClientReportMutation as SendTestClientReportMutationType } from "@api/mutations/__generated__/SendTestClientReportMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";

/**
 * Spark v2 — People (user management).
 *
 * Lists everyone currently in the tenant (admins, clients, ambassadors)
 * with role chips + an "Invite" button for adding new people. Email
 * templates pending Kyle's copy — for now the invite UI captures the
 * inputs and shows a "Email queued" toast.
 */

type PersonRow = {
  id: string;
  uuid: string;
  name: string;
  email: string;
  role: string;
  roleSlug: string;
  initials: string;
};

const ROLE_CHIP: Record<string, string> = {
  admin: "chip chip-lime",
  "spark-admin": "chip chip-lime",
  client: "chip chip-sky",
  ambassador: "chip chip-purple",
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

const Inner: React.FC<{
  onOpenInvite: (role: "admin" | "client" | "ambassador") => void;
}> = ({ onOpenInvite }) => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const data = useLazyLoadQuery<UsersQueryType>(
    UsersQuery,
    {
      filters: tenantId ? { tenantId } : null,
      first: 500,
    },
    { fetchPolicy: "store-or-network" },
  );

  const rows: PersonRow[] = useMemo(() => {
    return (
      data?.users?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          const name = [n.firstName, n.lastName].filter(Boolean).join(" ");
          const role = n.role?.name ?? "Member";
          const slug = role.toString().toLowerCase().replace(/\s+/g, "-");
          return {
            id: String(n.id),
            uuid: String(n.uuid),
            name: name || (n.email ?? "Unknown"),
            email: n.email ?? "",
            role,
            roleSlug: slug,
            initials: initialsOf(name || (n.email ?? "")),
          };
        }) ?? []
    );
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (roleFilter !== "all" && r.roleSlug !== roleFilter) return false;
      if (
        q &&
        !r.name.toLowerCase().includes(q) &&
        !r.email.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [rows, search, roleFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.roleSlug] = (c[r.roleSlug] ?? 0) + 1;
    return c;
  }, [rows]);
  void navigate;

  // Remove flow — Spark-chrome modal + optimistic local removal so the
  // table doesn't have to full-reload after each delete.
  const showAlert = useAlertStore((s) => s.showAlert);
  const [removing, setRemoving] = useState<PersonRow | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [removeBusy, setRemoveBusy] = useState(false);

  const visibleFiltered = useMemo(
    () => filtered.filter((r) => !removedIds.has(r.id)),
    [filtered, removedIds],
  );

  // Default-external-RMM routing — pick one person who catches ALL
  // public-form requests for this tenant, instead of falling through
  // to the territory rules. Reads the active tenant out of the same
  // tenant list the InviteModal already pulls so we don't add a second
  // round-trip, then matches on the active tenantId from authStore.
  // Bumped after a tenant-scalar mutation (e.g. the weekly-digest toggle) so
  // activeTenant re-syncs from the server instead of serving the stale cached
  // tenant — keeps the toggle correct across a remount, no manual reload.
  const [tenantsFetchKey, setTenantsFetchKey] = useState(0);
  const tenantsData = useLazyLoadQuery<TenantsQueryType>(
    TenantsQuery,
    {},
    { fetchPolicy: "store-or-network", fetchKey: tenantsFetchKey },
  );
  const activeTenant = useMemo(() => {
    const nodes = (tenantsData?.tenants?.edges ?? [])
      .map((e) => e?.node)
      .filter((n): n is NonNullable<typeof n> => !!n);
    return nodes.find((t) => String(t.id) === String(tenantId)) ?? nodes[0] ?? null;
  }, [tenantsData, tenantId]);

  const currentDefaultRmmId = activeTenant?.defaultExternalRmm?.id ?? "";
  const [defaultRmmId, setDefaultRmmId] = useState<string>(currentDefaultRmmId);
  // Keep the select in sync once the tenant payload resolves (or the
  // active tenant changes) — server is the source of truth.
  useEffect(() => {
    setDefaultRmmId(currentDefaultRmmId);
  }, [currentDefaultRmmId]);

  const [commitDefaultRmm, defaultRmmInFlight] =
    useMutation<SetDefaultExternalRmmMutationType>(SetDefaultExternalRmmMutation);

  const handleDefaultRmmChange = (nextId: string) => {
    if (defaultRmmInFlight) return;
    const prevId = defaultRmmId;
    setDefaultRmmId(nextId); // optimistic
    commitDefaultRmm({
      variables: { input: { userId: nextId || null } },
      onCompleted: (res) => {
        const r = res.setDefaultExternalRmm;
        if (r?.success) {
          const resolvedId = r.tenant?.defaultExternalRmm?.id ?? "";
          setDefaultRmmId(resolvedId);
          const person = rows.find((p) => p.id === resolvedId);
          showAlert(
            resolvedId
              ? `External requests now route to ${person?.name ?? "the selected person"}.`
              : "External requests now use territory routing.",
            "success",
          );
        } else {
          setDefaultRmmId(prevId); // roll back
          showAlert(r?.message || "Could not update default recipient.", "error");
        }
      },
      onError: (err) => {
        setDefaultRmmId(prevId); // roll back
        showAlert(`Update failed: ${err.message}`, "error");
      },
    });
  };

  // Recap-approval email recipients — extra addresses that get the
  // recap-approval email for this brand on top of the RMM, client
  // users, and requestor. Free-form text (comma/newline separated),
  // so unlike the RMM select we save on an explicit button press
  // rather than on every keystroke. Same tenant payload as above is
  // the source of truth.
  const currentRecapEmails = activeTenant?.recapRecipientEmails ?? "";
  const [recapEmails, setRecapEmails] = useState<string>(currentRecapEmails);
  const [recapDirty, setRecapDirty] = useState(false);
  useEffect(() => {
    setRecapEmails(currentRecapEmails);
    setRecapDirty(false);
  }, [currentRecapEmails]);

  const [commitRecapEmails, recapEmailsInFlight] =
    useMutation<SetTenantRecapRecipientEmailsMutationType>(
      SetTenantRecapRecipientEmailsMutation,
    );

  const handleSaveRecapEmails = () => {
    if (recapEmailsInFlight) return;
    if (!tenantId) {
      showAlert("No tenant in scope.", "error");
      return;
    }
    commitRecapEmails({
      variables: { tenantId, emails: recapEmails },
      onCompleted: (res) => {
        const t = res.setTenantRecapRecipientEmails;
        if (t) {
          setRecapEmails(t.recapRecipientEmails);
          setRecapDirty(false);
          showAlert("Recap email recipients saved.", "success");
        } else {
          showAlert("Could not update recap email recipients.", "error");
        }
      },
      onError: (err) => {
        showAlert(`Update failed: ${err.message}`, "error");
      },
    });
  };

  // Monthly client report — automated monthly performance PDF emailed to
  // the recap recipients above on the 1st, for the prior month. The
  // toggle is bound to the tenant's `scheduledReportEnabled` flag (server
  // is source of truth). Shares its recipients with the recap card above,
  // so we key the "set recipients first" hint off the same `recapEmails`
  // state rather than a second field. Same active-tenant payload feeds it.
  const currentReportEnabled = activeTenant?.scheduledReportEnabled ?? false;
  const [reportEnabled, setReportEnabled] = useState<boolean>(
    currentReportEnabled,
  );
  useEffect(() => {
    setReportEnabled(currentReportEnabled);
  }, [currentReportEnabled]);

  // Recipients come from the (already-trimmed) recap email field above.
  // An empty list means the report has nowhere to go, so we warn before
  // enabling and surface a muted hint under the toggle.
  const hasRecapRecipients = recapEmails.trim().length > 0;

  const [commitReportEnabled, reportEnabledInFlight] =
    useMutation<SetScheduledReportEnabledMutationType>(
      SetScheduledReportEnabledMutation,
    );

  const handleToggleReport = (next: boolean) => {
    if (reportEnabledInFlight) return;
    if (!tenantId) {
      showAlert("No tenant in scope.", "error");
      return;
    }
    // Turning it ON with no recipients would email a report into the void.
    if (next && !hasRecapRecipients) {
      showAlert(
        "Add at least one recap recipient above before enabling the monthly report.",
        "error",
      );
      return;
    }
    const prev = reportEnabled;
    setReportEnabled(next); // optimistic
    commitReportEnabled({
      variables: { input: { tenantId, enabled: next } },
      onCompleted: (res) => {
        const r = res.setScheduledReportEnabled;
        if (r?.success) {
          setReportEnabled(r.enabled); // reflect server's resolved state
          showAlert(
            r.enabled
              ? "Monthly client report turned on."
              : "Monthly client report turned off.",
            "success",
          );
        } else {
          setReportEnabled(prev); // roll back
          showAlert(r?.message || "Could not update the monthly report.", "error");
        }
      },
      onError: (err) => {
        setReportEnabled(prev); // roll back
        showAlert(`Update failed: ${err.message}`, "error");
      },
    });
  };

  // Weekly client digest — Monday email rollup (this week at a glance /
  // coming up / needs your approval) to the same recap recipients. Its
  // OWN flag (clientWeeklyDigestEnabled), independent from the monthly
  // report toggle above, so each rolls out per tenant separately.
  const currentDigestEnabled = activeTenant?.clientWeeklyDigestEnabled ?? false;
  const [digestEnabled, setDigestEnabled] = useState<boolean>(
    currentDigestEnabled,
  );
  useEffect(() => {
    setDigestEnabled(currentDigestEnabled);
  }, [currentDigestEnabled]);

  const [commitDigestEnabled, digestEnabledInFlight] =
    useMutation<SetClientWeeklyDigestEnabledMutationType>(
      SetClientWeeklyDigestEnabledMutation,
    );

  const handleToggleDigest = (next: boolean) => {
    if (digestEnabledInFlight) return;
    if (!tenantId) {
      showAlert("No tenant in scope.", "error");
      return;
    }
    // Turning it ON with no recipients would email a digest into the void.
    if (next && !hasRecapRecipients) {
      showAlert(
        "Add at least one recap recipient above before enabling the weekly digest.",
        "error",
      );
      return;
    }
    const prev = digestEnabled;
    setDigestEnabled(next); // optimistic
    commitDigestEnabled({
      variables: { input: { tenantId, enabled: next } },
      onCompleted: (res) => {
        const r = res.setClientWeeklyDigestEnabled;
        if (r?.success) {
          setDigestEnabled(r.enabled); // reflect server's resolved state
          setTenantsFetchKey((k) => k + 1); // re-sync the cached tenant
          showAlert(
            r.enabled
              ? "Weekly client digest turned on."
              : "Weekly client digest turned off.",
            "success",
          );
        } else {
          setDigestEnabled(prev); // roll back
          showAlert(r?.message || "Could not update the weekly digest.", "error");
        }
      },
      onError: (err) => {
        setDigestEnabled(prev); // roll back
        showAlert(`Update failed: ${err.message}`, "error");
      },
    });
  };

  // "Send me a test" — emails a one-off preview report to the SIGNED-IN
  // user only (never the client / recap recipients). Defaults to the
  // prior complete month server-side.
  const [commitTestReport, testReportInFlight] =
    useMutation<SendTestClientReportMutationType>(SendTestClientReportMutation);

  const handleSendTestReport = () => {
    if (testReportInFlight) return;
    if (!tenantId) {
      showAlert("No tenant in scope.", "error");
      return;
    }
    commitTestReport({
      variables: { input: { tenantId } },
      onCompleted: (res) => {
        const r = res.sendTestClientReport;
        if (r?.success) {
          showAlert("Test report emailed to you.", "success");
        } else {
          showAlert(r?.message || "Could not send the test report.", "error");
        }
      },
      onError: (err) => {
        showAlert(`Test report failed: ${err.message}`, "error");
      },
    });
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
        },
        body: JSON.stringify({
          query: `
            mutation DeleteUser($input: DeleteUserInput!) {
              deleteUser(input: $input) {
                success
                message
              }
            }
          `,
          variables: { input: { userId: removing.id } },
        }),
      });
      const json = await res.json();
      const r = json?.data?.deleteUser;
      if (json.errors?.length || !r?.success) {
        showAlert(
          `Couldn't remove ${removing.name}: ${
            r?.message ?? json.errors?.[0]?.message ?? "unknown error"
          }`,
          "error",
        );
        return;
      }
      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.add(removing.id);
        return next;
      });
      showAlert(`${removing.name} removed.`, "success");
      setRemoving(null);
    } catch (e) {
      showAlert(`Remove failed: ${(e as Error).message}`, "error");
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="spark-card p-4">
          <p className="label-mini">EVERYONE</p>
          <p
            className="tab-num text-3xl font-bold mt-1"
            style={{ color: "var(--spark-lime)" }}
          >
            {counts.all || "—"}
          </p>
        </div>
        <div className="spark-card p-4">
          <p className="label-mini">ADMINS</p>
          <p className="tab-num text-3xl font-bold mt-1">
            {(counts["spark-admin"] ?? 0) + (counts.admin ?? 0) || "—"}
          </p>
        </div>
        <div className="spark-card p-4">
          <p className="label-mini">CLIENTS</p>
          <p
            className="tab-num text-3xl font-bold mt-1"
            style={{ color: "var(--spark-sky)" }}
          >
            {counts.client || "—"}
          </p>
        </div>
        <div className="spark-card p-4">
          <p className="label-mini">AMBASSADORS</p>
          <p className="tab-num text-3xl font-bold mt-1">
            {counts.ambassador || "—"}
          </p>
        </div>
      </div>

      <div className="spark-card p-4 flex flex-wrap items-center gap-2">
        <span className="label-mini mr-2">ROLE</span>
        {[
          { key: "all", label: "Everyone", chip: "chip chip-muted" },
          { key: "spark-admin", label: "Admins", chip: "chip chip-lime" },
          { key: "client", label: "Clients", chip: "chip chip-sky" },
          {
            key: "ambassador",
            label: "Ambassadors",
            chip: "chip chip-purple",
          },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setRoleFilter(f.key)}
            className={f.chip}
            style={
              roleFilter === f.key
                ? { outline: "1.5px solid currentColor" }
                : undefined
            }
          >
            {f.label} · {counts[f.key] ?? counts.all ?? 0}
          </button>
        ))}
        <span className="flex-1" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="rounded-xl text-xs"
          style={{
            padding: "0.45rem 0.9rem",
            background: "var(--spark-bg)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
            maxWidth: 220,
            outline: "none",
          }}
        />
      </div>

      {/* Default recipient for external (public-form) requests. Picking
          a person overrides territory routing — every public request
          for this tenant lands on them. "None" restores territory rules. */}
      <div className="spark-card p-4">
        <p className="label-mini">DEFAULT RECIPIENT FOR EXTERNAL REQUESTS</p>
        <p
          className="text-xs mt-1 mb-3"
          style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}
        >
          Who should all external (public-form) requests route to? Choose a
          person to override territory routing, or pick “None” to use it.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={defaultRmmId}
            disabled={defaultRmmInFlight}
            onChange={(e) => handleDefaultRmmChange(e.target.value)}
            className="rounded-xl text-sm"
            style={{
              padding: "0.55rem 0.9rem",
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              outline: "none",
              minWidth: 280,
              opacity: defaultRmmInFlight ? 0.6 : 1,
            }}
          >
            <option value="">— None (territory routing) —</option>
            {rows.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.email ? ` · ${p.email}` : ""}
              </option>
            ))}
          </select>
          {defaultRmmInFlight && (
            <span
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              SAVING…
            </span>
          )}
        </div>
      </div>

      {/* Recap-approval email recipients — extra addresses CC'd on the
          recap-approval email for this brand, in addition to the RMM,
          client users, and requestor. Free-form text, saved on the
          button press. */}
      <div className="spark-card p-4">
        <p className="label-mini">RECAP EMAIL RECIPIENTS</p>
        <p
          className="text-xs mt-1 mb-3"
          style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}
        >
          Comma- or newline-separated email addresses that receive the
          recap-approval email for this brand, in addition to the RMM, client
          users, and requestor.
        </p>
        <textarea
          value={recapEmails}
          disabled={recapEmailsInFlight}
          onChange={(e) => {
            setRecapEmails(e.target.value);
            setRecapDirty(true);
          }}
          rows={4}
          placeholder="ross@liquid-death.com, ops@liquid-death.com"
          className="rounded-xl text-sm w-full"
          style={{
            padding: "0.55rem 0.9rem",
            background: "var(--spark-bg)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
            outline: "none",
            resize: "vertical",
            minHeight: 96,
            opacity: recapEmailsInFlight ? 0.6 : 1,
          }}
        />
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button
            onClick={handleSaveRecapEmails}
            disabled={recapEmailsInFlight || !recapDirty}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow: "0 0 18px rgba(197,245,70,0.35)",
              opacity: recapEmailsInFlight || !recapDirty ? 0.5 : 1,
            }}
          >
            Save recipients
          </button>
          {recapEmailsInFlight && (
            <span
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              SAVING…
            </span>
          )}
        </div>
      </div>

      {/* Monthly client report — automated monthly performance PDF mailed
          to the recap recipients above on the 1st (for the prior month).
          Toggle is bound to the tenant's scheduledReportEnabled flag; the
          "Send me a test" button previews it to the signed-in user only. */}
      <div className="spark-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <p className="label-mini">MONTHLY CLIENT REPORT</p>
            <p
              className="text-xs mt-1"
              style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}
            >
              When on, this client gets an automated monthly performance
              report (PDF) emailed to the recap recipients above, on the 1st
              for the prior month.
            </p>
          </div>
          {/* On/off switch — spark-themed, lime when enabled. */}
          <button
            type="button"
            role="switch"
            aria-checked={reportEnabled}
            aria-label="Toggle monthly client report"
            disabled={reportEnabledInFlight}
            onClick={() => handleToggleReport(!reportEnabled)}
            className="rounded-full shrink-0"
            style={{
              position: "relative",
              width: 46,
              height: 26,
              padding: 0,
              border: "1px solid var(--spark-border)",
              background: reportEnabled
                ? "var(--spark-lime)"
                : "var(--spark-surface-2)",
              boxShadow: reportEnabled
                ? "0 0 14px rgba(197,245,70,0.35)"
                : "none",
              cursor: reportEnabledInFlight ? "default" : "pointer",
              opacity: reportEnabledInFlight ? 0.6 : 1,
              transition: "background 0.15s ease, box-shadow 0.15s ease",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: reportEnabled ? 22 : 2,
                width: 20,
                height: 20,
                borderRadius: "9999px",
                background: reportEnabled ? "#0a0d09" : "var(--spark-text)",
                transition: "left 0.15s ease",
              }}
            />
          </button>
        </div>

        {/* No-recipients hint — the report has nowhere to go until at least
            one recap recipient is set above. */}
        {!hasRecapRecipients && (
          <p
            className="text-xs mt-3"
            style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}
          >
            Add at least one recap recipient above first — the report has
            nowhere to send otherwise.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button
            onClick={handleSendTestReport}
            disabled={testReportInFlight}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
              cursor: testReportInFlight ? "default" : "pointer",
              opacity: testReportInFlight ? 0.5 : 1,
            }}
          >
            Send me a test
          </button>
          <span
            className="text-xs"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            The test goes to you, not the client.
          </span>
          {testReportInFlight && (
            <span
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              SENDING…
            </span>
          )}
        </div>
      </div>

      {/* Weekly client digest — Monday rollup email to the same recap
          recipients. Independent toggle (clientWeeklyDigestEnabled) so the
          digest and the monthly report roll out per tenant separately. */}
      <div className="spark-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <p className="label-mini">WEEKLY CLIENT DIGEST</p>
            <p
              className="text-xs mt-1"
              style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}
            >
              When on, this client gets a Monday email rollup — this week at
              a glance, what's coming up, and anything awaiting their
              approval — sent to the recap recipients above. Quiet weeks are
              skipped automatically.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={digestEnabled}
            aria-label="Toggle weekly client digest"
            disabled={digestEnabledInFlight}
            onClick={() => handleToggleDigest(!digestEnabled)}
            className="rounded-full shrink-0"
            style={{
              position: "relative",
              width: 46,
              height: 26,
              padding: 0,
              border: "1px solid var(--spark-border)",
              background: digestEnabled
                ? "var(--spark-lime)"
                : "var(--spark-surface-2)",
              boxShadow: digestEnabled
                ? "0 0 14px rgba(197,245,70,0.35)"
                : "none",
              cursor: digestEnabledInFlight ? "default" : "pointer",
              opacity: digestEnabledInFlight ? 0.6 : 1,
              transition: "background 0.15s ease, box-shadow 0.15s ease",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: digestEnabled ? 22 : 2,
                width: 20,
                height: 20,
                borderRadius: "9999px",
                background: digestEnabled ? "#0a0d09" : "var(--spark-text)",
                transition: "left 0.15s ease",
              }}
            />
          </button>
        </div>
        {!hasRecapRecipients && (
          <p
            className="text-xs mt-3"
            style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}
          >
            Add at least one recap recipient above first — the digest has
            nowhere to send otherwise.
          </p>
        )}
      </div>

      <div
        className="spark-card overflow-hidden"
        style={{ borderRadius: 20 }}
      >
        <div className="overflow-x-auto">
          <table
            className="w-full text-sm"
            style={{ minWidth: 800 }}
          >
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
                <th className="px-4 py-3">PERSON</th>
                <th className="px-4 py-3">EMAIL</th>
                <th className="px-4 py-3">ROLE</th>
                <th className="px-4 py-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {visibleFiltered.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-sm"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                  >
                    No people match.
                  </td>
                </tr>
              )}
              {visibleFiltered.map((p) => (
                <tr
                  key={p.uuid}
                  style={{ borderBottom: "1px solid var(--spark-border)" }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="spark-avatar">{p.initials}</span>
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td
                    className="px-4 py-3 mono text-xs"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  >
                    {p.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={ROLE_CHIP[p.roleSlug] ?? "chip chip-muted"}
                    >
                      {p.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-3">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(p.email);
                          showAlert(`Copied ${p.email}.`, "info");
                        }}
                        className="mono text-[10px]"
                        style={{
                          letterSpacing: "0.14em",
                          color: "rgba(255,255,255,0.55)",
                        }}
                      >
                        COPY EMAIL
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(
                              import.meta.env.VITE_GRAPHQL_ENDPOINT,
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
                                },
                                body: JSON.stringify({
                                  query: `
                                    mutation RequestMagicLink($input: RequestMagicLinkInput!) {
                                      requestMagicLink(input: $input) { success message }
                                    }
                                  `,
                                  variables: {
                                    input: {
                                      email: p.email,
                                      // Admin-frontend magic-link entry.
                                      redirect: "/",
                                    },
                                  },
                                }),
                              },
                            );
                            const json = await res.json();
                            const r = json?.data?.requestMagicLink;
                            if (json.errors?.length || !r?.success) {
                              showAlert(
                                `Couldn't resend: ${
                                  r?.message ??
                                  json.errors?.[0]?.message ??
                                  "unknown error"
                                }`,
                                "error",
                              );
                              return;
                            }
                            showAlert(
                              `Sign-in link sent to ${p.email}.`,
                              "success",
                            );
                          } catch (e) {
                            showAlert(
                              `Resend failed: ${(e as Error).message}`,
                              "error",
                            );
                          }
                        }}
                        className="mono text-[10px]"
                        style={{
                          letterSpacing: "0.14em",
                          color: "var(--spark-sky)",
                        }}
                        title="Re-send a magic-link sign-in email to this user"
                      >
                        RESEND LINK
                      </button>
                      <button
                        onClick={() => setRemoving(p)}
                        className="mono text-[10px]"
                        style={{
                          letterSpacing: "0.14em",
                          color: "var(--spark-orange)",
                        }}
                      >
                        REMOVE
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href="/people/pending"
          className="px-4 py-3 rounded-2xl text-sm font-semibold inline-flex items-center gap-2"
          style={{
            background: "transparent",
            color: "var(--spark-orange)",
            border: "1px solid rgba(239,90,42,0.45)",
          }}
          title="Approve or reject brand ambassadors waiting on you"
        >
          ⏳ Pending approvals →
        </a>
        <button
          onClick={() => onOpenInvite("admin")}
          className="px-4 py-3 rounded-2xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            boxShadow: "0 0 20px rgba(197,245,70,0.35)",
          }}
        >
          + Invite admin
        </button>
        <button
          onClick={() => onOpenInvite("client")}
          className="px-4 py-3 rounded-2xl text-sm font-semibold transition"
          style={{
            background: "transparent",
            color: "var(--spark-sky)",
            border: "1px solid rgba(95,184,239,0.4)",
          }}
        >
          + Invite client
        </button>
        <button
          onClick={() => onOpenInvite("ambassador")}
          className="px-4 py-3 rounded-2xl text-sm font-semibold transition"
          style={{
            background: "transparent",
            color: "var(--spark-purple)",
            border: "1px solid rgba(160,139,217,0.4)",
          }}
        >
          + Invite ambassador
        </button>
      </div>

      {/* Remove confirmation — in Spark chrome, not browser-native confirm().
          Spells out exactly what removing them does (and doesn't do) so kyle
          knows what happens to historical recaps/requests/events. */}
      {removing && (
        <div
          onClick={() => !removeBusy && setRemoving(null)}
          className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
          style={{
            background: "rgba(10,11,13,0.7)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg spark-card p-6"
            style={{ borderRadius: 20 }}
          >
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-orange)",
              }}
            >
              REMOVE FROM WORKSPACE
            </p>
            <h2
              className="display text-2xl font-bold"
              style={{ letterSpacing: "-0.03em" }}
            >
              Remove {removing.name}?
            </h2>
            <p
              className="text-sm mt-2"
              style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}
            >
              {removing.email}{" "}
              <span
                className={ROLE_CHIP[removing.roleSlug] ?? "chip chip-muted"}
                style={{ marginLeft: 6 }}
              >
                {removing.role.toUpperCase()}
              </span>
            </p>
            <div
              className="mt-4 p-4 rounded-xl text-xs"
              style={{
                background: "rgba(239,90,42,0.06)",
                border: "1px solid rgba(239,90,42,0.18)",
                color: "rgba(255,255,255,0.75)",
                lineHeight: 1.6,
              }}
            >
              <p
                className="mono text-[10px] mb-1"
                style={{
                  letterSpacing: "0.16em",
                  color: "var(--spark-orange)",
                }}
              >
                WHAT HAPPENS
              </p>
              1. They lose access to the workspace immediately.
              <br />
              2. Their historical recaps, requests, and events stay attached
              for audit.
              <br />
              3. You can re-invite them later with the same email — they'll
              keep their history.
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => {
                  if (removeBusy) return;
                  setRemoving(null);
                }}
                className="mono text-[11px] px-3"
                style={{
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={confirmRemove}
                disabled={removeBusy}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-orange)",
                  color: "#0a0d09",
                  opacity: removeBusy ? 0.5 : 1,
                }}
              >
                {removeBusy ? "Removing…" : "Remove from workspace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InviteModal: React.FC<{
  role: "admin" | "client" | "ambassador";
  onClose: () => void;
}> = ({ role, onClose }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  // Client invites scope to a single tenant; admin invites are
  // cross-tenant (backend ignores tenantId for admin). Ambassadors
  // default to the inviter's current tenant.
  const [pickedTenantId, setPickedTenantId] = useState<string>(
    localStorage.getItem("@tenantId") ?? "",
  );
  // Pull every tenant the inviter can see for the picker. Only render
  // the dropdown when role === 'client' since that's the only flow
  // that actually needs scoping per Kyle's spec.
  const tenantsData = useLazyLoadQuery<TenantsQueryType>(
    TenantsQuery,
    {},
    { fetchPolicy: "store-or-network" },
  );
  const tenants = useMemo(
    () =>
      (tenantsData?.tenants?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => !!n),
    [tenantsData],
  );

  const inputStyle: React.CSSProperties = {
    background: "var(--spark-bg)",
    border: "1px solid var(--spark-border)",
    borderRadius: 12,
    padding: "0.65rem 0.9rem",
    color: "var(--spark-text)",
    fontSize: "0.875rem",
    outline: "none",
    width: "100%",
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
      style={{
        background: "rgba(10,13,9,0.55)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md spark-card p-6"
        style={{ borderRadius: 20 }}
      >
        <p
          className="mono text-[10px] mb-1"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-lime)",
          }}
        >
          NEW {role.toUpperCase()}
        </p>
        <h2
          className="display text-2xl font-bold mb-4"
          style={{ letterSpacing: "-0.03em" }}
        >
          Invite a {role}.
        </h2>
        <div className="space-y-3">
          <div>
            <label className="label-mini block mb-1.5">Name</label>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maya R."
            />
          </div>
          <div>
            <label className="label-mini block mb-1.5">Email *</label>
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                role === "client"
                  ? "ross@liquid-death.com"
                  : role === "ambassador"
                    ? "maya@gmail.com"
                    : "name@igniteproductions.co"
              }
              required
            />
          </div>
          {role === "client" && (
            <div>
              <label className="label-mini block mb-1.5">
                Assign to brand / tenant *
              </label>
              <select
                style={inputStyle}
                value={pickedTenantId}
                onChange={(e) => setPickedTenantId(e.target.value)}
              >
                <option value="">— Select a brand —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p
                className="mono text-[10px] mt-1.5"
                style={{
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                CLIENT WILL ONLY SEE THIS TENANT'S DASHBOARD + REQUESTS
              </p>
            </div>
          )}
          <div>
            <label className="label-mini block mb-1.5">
              Personal note (optional)
            </label>
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: 70 }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                role === "client"
                  ? "Excited to onboard the Liquid Death program."
                  : "Welcome to the team!"
              }
              rows={3}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 mt-5">
          <button
            onClick={onClose}
            className="mono text-[11px]"
            style={{
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            CANCEL
          </button>
          <button
            onClick={async () => {
              if (!email.trim()) {
                showAlert("Email required.", "warning");
                return;
              }
              if (role === "client" && !pickedTenantId) {
                showAlert(
                  "Pick a brand to assign this client to.",
                  "warning",
                );
                return;
              }
              const [firstName, ...rest] = name.trim().split(/\s+/);
              const lastName = rest.join(" ");
              try {
                const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
                  },
                  body: JSON.stringify({
                    query: `
                      mutation InviteUser($input: InviteUserInput!) {
                        inviteUser(input: $input) {
                          success
                          message
                        }
                      }
                    `,
                    variables: {
                      input: {
                        email: email.trim(),
                        firstName: firstName || null,
                        lastName: lastName || null,
                        role,
                        tenantId:
                          role === "admin"
                            ? null
                            : role === "client"
                              ? pickedTenantId
                              : localStorage.getItem("@tenantId"),
                        note: note || null,
                      },
                    },
                  }),
                });
                const json = await res.json();
                if (json.errors?.length) {
                  throw new Error(
                    json.errors
                      .map((e: { message: string }) => e.message)
                      .join("; "),
                  );
                }
                const r = json?.data?.inviteUser;
                if (!r?.success) {
                  throw new Error(r?.message ?? "Invite failed.");
                }
                showAlert(r.message, "success");
                onClose();
              } catch (e) {
                showAlert(
                  `Invite failed: ${(e as Error).message}`,
                  "error",
                );
              }
            }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow: "0 0 18px rgba(197,245,70,0.35)",
            }}
          >
            Send invite →
          </button>
        </div>
      </div>
    </div>
  );
};

export default function SparkPeople() {
  const [inviteRole, setInviteRole] =
    useState<"admin" | "client" | "ambassador" | null>(null);
  return (
    <Layout>
      <div className="space-y-6 max-w-7xl">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            PEOPLE · WORKSPACE
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Team.
          </h1>
          <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            Everyone in the workspace — admins, clients, ambassadors.
            Invite new people directly.
          </p>
        </div>
        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading roster…
            </div>
          }
        >
          <Inner onOpenInvite={setInviteRole} />
        </Suspense>
      </div>
      {inviteRole && (
        <InviteModal role={inviteRole} onClose={() => setInviteRole(null)} />
      )}
    </Layout>
  );
}
