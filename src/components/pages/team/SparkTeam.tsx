/**
 * Spark v2 — Team page.
 *
 * Lists the admins + spark-admins in the workspace. Each card supports
 * inline editing of the member's safe profile fields (first/last name +
 * email) via the existing updateUser mutation. The role badge is a
 * permission level (UserRoleEnum: AMBASSADOR / CLIENT / SPARK) and stays
 * read-only here — role/permission management is a separate, deliberate
 * surface (out of scope for this page).
 */

import React, { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";
import { UsersQuery } from "@/api/queries/UsersQuery";
import type { UsersQuery as UsersQueryType } from "@api/queries/__generated__/UsersQuery.graphql";
import { UpdateUserMutation } from "@/api/mutations/UpdateUserMutation";
import type { UpdateUserMutation as UpdateUserMutationType } from "@api/mutations/__generated__/UpdateUserMutation.graphql";

type UserNode = NonNullable<
  NonNullable<
    NonNullable<UsersQueryType["response"]["users"]>["edges"][number]
  >["node"]
>;

const displayName = (u: UserNode) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") ||
  u.email ||
  "(unnamed)";

const ROLE_TONE: Record<string, string> = {
  "spark admin": "var(--spark-lime)",
  "spark-admin": "var(--spark-lime)",
  admin: "var(--spark-sky)",
  client: "var(--spark-purple)",
  ambassador: "var(--spark-gold)",
};

const Inner: React.FC = () => {
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<UsersQueryType>(
    UsersQuery,
    { filters: tenantId ? { tenantId } : null, first: 500 },
    { fetchPolicy: "store-or-network" },
  );

  const allUsers = useMemo(() => {
    return (data?.users?.edges ?? [])
      .map((e) => e?.node)
      .filter((n): n is UserNode => Boolean(n));
  }, [data]);

  const adminUsers = useMemo(() => {
    return allUsers.filter((u) => {
      const role = (u.role?.name ?? "").toLowerCase();
      return (
        role === "admin" || role === "spark admin" || role === "spark-admin"
      );
    });
  }, [allUsers]);

  const clientUsers = useMemo(() => {
    return allUsers.filter((u) => {
      const role = (u.role?.name ?? "").toLowerCase();
      return role === "client";
    });
  }, [allUsers]);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            TEAM · {allUsers.length} TOTAL
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Who's on Spark.
          </h1>
          <p
            className="mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Admins, clients, and other users in this workspace.
            Brand Ambassadors live on the People page.
          </p>
        </div>
        <a
          href="/users/create"
          className="px-4 py-2 rounded-xl text-sm font-semibold transition"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            border: "none",
            textDecoration: "none",
          }}
        >
          + Add user
        </a>
      </div>

      {/* Admins */}
      <Section
        title="Admins"
        subtitle="Full access to this workspace."
        users={adminUsers}
      />

      {/* Clients */}
      <Section
        title="Client users"
        subtitle="Brand stakeholders with limited access (their requests + recaps)."
        users={clientUsers}
      />
    </div>
  );
};

const Section: React.FC<{
  title: string;
  subtitle: string;
  users: UserNode[];
}> = ({ title, subtitle, users }) => {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <h2
          className="display text-xl font-bold"
          style={{ letterSpacing: "-0.02em" }}
        >
          {title}
        </h2>
        <p
          className="text-xs"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          {subtitle}
        </p>
      </div>
      {users.length === 0 ? (
        <div
          className="spark-card p-6 text-center"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          No {title.toLowerCase()} in this workspace yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {users.map((u) => (
            <MemberCard key={u.id} user={u} />
          ))}
        </div>
      )}
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  borderRadius: 10,
  padding: "0.5rem 0.7rem",
  color: "var(--spark-text)",
  fontSize: "0.85rem",
  outline: "none",
  width: "100%",
  fontFamily: "Space Grotesk, sans-serif",
};

/**
 * Single team-member card. Read-only by default; the "Edit" affordance
 * swaps name/email into inline inputs. Save commits updateUser with only
 * the SAFE profile fields (firstName / lastName / email) and writes the
 * new values straight into the Relay store record so the row updates
 * without a refetch. Cancel reverts to the last-saved values.
 *
 * Role is intentionally not editable here — it's a permission level, not
 * a display title.
 */
const MemberCard: React.FC<{ user: UserNode }> = ({ user }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [commit, isInFlight] =
    useMutation<UpdateUserMutationType>(UpdateUserMutation);

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [email, setEmail] = useState(user.email ?? "");

  const role = (user.role?.name ?? "—").toLowerCase();
  const tone = ROLE_TONE[role] ?? "rgba(255,255,255,0.6)";

  const startEdit = () => {
    // Seed inputs from the latest record values before opening.
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setEmail(user.email ?? "");
    setEditing(true);
  };

  const cancelEdit = () => {
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setEmail(user.email ?? "");
    setEditing(false);
  };

  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  const trimmedEmail = email.trim();
  // First name + email are required (matches the create/edit user form).
  const canSave =
    !isInFlight && trimmedFirst.length > 0 && trimmedEmail.length > 0;

  const save = () => {
    if (!canSave) return;
    commit({
      variables: {
        input: {
          id: user.id,
          firstName: trimmedFirst,
          lastName: trimmedLast,
          email: trimmedEmail,
        },
      },
      // updateUser only returns { success, message }, so Relay can't
      // auto-merge. Write the edited fields onto the existing user record
      // by id; the list view (useLazyLoadQuery) re-renders from the store.
      updater: (store) => {
        const payload = store.getRootField("updateUser");
        if (!payload?.getValue("success")) return;
        const record = store.get(user.id);
        if (!record) return;
        record.setValue(trimmedFirst, "firstName");
        record.setValue(trimmedLast, "lastName");
        record.setValue(trimmedEmail, "email");
      },
      onCompleted: (response) => {
        const result = response.updateUser;
        if (result?.success) {
          showAlert(result.message || "Team member updated.", "success");
          setEditing(false);
        } else {
          showAlert(
            result?.message || "Couldn't update team member.",
            "error",
          );
        }
      },
      onError: (error) => {
        showAlert(error.message || "Couldn't update team member.", "error");
      },
    });
  };

  return (
    <div className="spark-card p-4">
      <div className="flex items-center gap-3">
        {user.image ? (
          <img
            src={user.image}
            alt=""
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            className="display font-bold"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              display: "grid",
              placeItems: "center",
              fontSize: 14,
            }}
          >
            {(
              (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")
            ).toUpperCase() || "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex gap-2">
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                aria-label="First name"
                style={inputStyle}
                autoFocus
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                aria-label="Last name"
                style={inputStyle}
              />
            </div>
          ) : (
            <p className="text-sm font-semibold truncate">
              {displayName(user)}
            </p>
          )}
          {!editing && (
            <p
              className="text-xs truncate"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              {user.email ?? "—"}
            </p>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@domain.com"
            aria-label="Email"
            type="email"
            style={inputStyle}
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.16em",
            color: tone,
            border: `1px solid ${tone}55`,
            padding: "2px 8px",
            borderRadius: 999,
          }}
        >
          {(user.role?.name ?? "—").toUpperCase()}
        </span>

        {editing ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isInFlight}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
                opacity: isInFlight ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                border: "none",
                opacity: canSave ? 1 : 0.5,
                cursor: canSave ? "pointer" : "not-allowed",
              }}
            >
              {isInFlight ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
};

export default function SparkTeam() {
  const { isAdmin } = useSparkRole();
  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-2xl">
          <h1 className="display text-3xl font-bold">Admin only.</h1>
          <p
            className="mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            The Team page is a Spark Admin surface.
          </p>
        </div>
      </Layout>
    );
  }
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="text-xs py-12"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Loading team…
          </div>
        }
      >
        <Inner />
      </Suspense>
    </Layout>
  );
}
