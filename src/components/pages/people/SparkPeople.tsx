import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { UsersQuery } from "@/api/queries/UsersQuery";
import type { UsersQuery as UsersQueryType } from "@api/queries/__generated__/UsersQuery.graphql";
import { TenantsQuery } from "@/api/queries/TenantsQuery";
import type { TenantsQuery as TenantsQueryType } from "@api/queries/__generated__/TenantsQuery.graphql";
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
              {filtered.length === 0 && (
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
              {filtered.map((p) => (
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
                          if (
                            !window.confirm(
                              `Remove ${p.name}?\n\nThey'll lose access immediately. Existing recaps, requests, and events stay attached for audit. You can re-invite them with the same email later.`,
                            )
                          )
                            return;
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
                                    mutation DeleteUser($input: DeleteUserInput!) {
                                      deleteUser(input: $input) {
                                        success
                                        message
                                      }
                                    }
                                  `,
                                  variables: { input: { userId: p.id } },
                                }),
                              },
                            );
                            const json = await res.json();
                            const r = json?.data?.deleteUser;
                            if (json.errors?.length || !r?.success) {
                              alert(
                                `Couldn't remove: ${
                                  r?.message ??
                                  json.errors?.[0]?.message ??
                                  "unknown error"
                                }`,
                              );
                              return;
                            }
                            // Optimistic: just reload. Cheap on a small
                            // user table.
                            window.location.reload();
                          } catch (e) {
                            alert(`Remove failed: ${(e as Error).message}`);
                          }
                        }}
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
