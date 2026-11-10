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
import SparkEmptyState from "@/shared/SparkEmptyState";
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
  const { tenantId, user: currentUser } = useAuthStore();
  const currentEmail = (currentUser?.email ?? "").toLowerCase() || null;

  // Optimistic removal: deleteUser deactivates the user server-side (and the
  // tenant queryset filters on is_active), but useLazyLoadQuery won't refetch
  // on its own — so hide removed cards locally too.
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const onRemoved = (id: string) =>
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const data = useLazyLoadQuery<UsersQueryType>(
    UsersQuery,
    { filters: tenantId ? { tenantId } : null, first: 500 },
    { fetchPolicy: "store-or-network" },
  );

  const allUsers = useMemo(() => {
    return (data?.users?.edges ?? [])
      .map((e) => e?.node)
      .filter((n): n is UserNode => Boolean(n))
      .filter((n) => !removedIds.has(n.id));
  }, [data, removedIds]);

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
              color: "var(--spark-text-meta)",
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
            style={{ color: "var(--spark-text-meta)" }}
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
        onRemoved={onRemoved}
        currentEmail={currentEmail}
      />

      {/* Clients */}
      <Section
        title="Client users"
        subtitle="Brand stakeholders with limited access (their requests + recaps)."
        users={clientUsers}
        onRemoved={onRemoved}
        currentEmail={currentEmail}
      />
    </div>
  );
};

const Section: React.FC<{
  title: string;
  subtitle: string;
  users: UserNode[];
  onRemoved: (id: string) => void;
  currentEmail: string | null;
}> = ({ title, subtitle, users, onRemoved, currentEmail }) => {
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
          style={{ color: "var(--spark-text-meta)" }}
        >
          {subtitle}
        </p>
      </div>
      {users.length === 0 ? (
        <SparkEmptyState
          title={`No ${title.toLowerCase()} in this workspace yet.`}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {users.map((u) => (
            <MemberCard
              key={u.id}
              user={u}
              onRemoved={onRemoved}
              currentEmail={currentEmail}
            />
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
const MemberCard: React.FC<{
  user: UserNode;
  onRemoved: (id: string) => void;
  currentEmail: string | null;
}> = ({ user, onRemoved, currentEmail }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [commit, isInFlight] =
    useMutation<UpdateUserMutationType>(UpdateUserMutation);

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  // Hide Remove on your own card — the backend also blocks self-removal.
  const isSelf =
    !!currentEmail && (user.email ?? "").toLowerCase() === currentEmail;

  // Soft-remove: deleteUser deactivates the user + their tenant links (and the
  // BA profile, if any) server-side; history is preserved and they can be
  // re-invited later. Raw POST mirrors the People page's remove flow.
  const remove = async () => {
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
              deleteUser(input: $input) { success message }
            }
          `,
          variables: { input: { userId: user.id } },
        }),
      });
      const json = await res.json();
      const r = json?.data?.deleteUser;
      if (json.errors?.length || !r?.success) {
        showAlert(
          `Couldn't remove ${displayName(user)}: ${
            r?.message ?? json.errors?.[0]?.message ?? "unknown error"
          }`,
          "error",
        );
        return;
      }
      showAlert(`${displayName(user)} removed from the workspace.`, "success");
      setConfirming(false);
      onRemoved(user.id);
    } catch (e) {
      showAlert(`Remove failed: ${(e as Error).message}`, "error");
    } finally {
      setRemoveBusy(false);
    }
  };

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
              style={{ color: "var(--spark-text-meta)" }}
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
          <div className="flex gap-2">
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
            {!isSelf && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: "transparent",
                  color: "var(--spark-orange)",
                  border: "1px solid rgba(239,90,42,0.4)",
                }}
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{
            background: "rgba(10,11,13,0.7)",
            backdropFilter: "blur(8px)",
          }}
          onClick={() => !removeBusy && setConfirming(false)}
        >
          <div
            className="spark-card p-5 w-full"
            style={{ maxWidth: 420, borderRadius: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-orange)",
              }}
            >
              REMOVE FROM WORKSPACE
            </p>
            <h3
              className="display text-xl font-bold mt-2"
              style={{ letterSpacing: "-0.02em" }}
            >
              Remove {displayName(user)}?
            </h3>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--spark-text-secondary)" }}
            >
              {user.email ?? "—"} · {(user.role?.name ?? "—").toUpperCase()}
            </p>
            <div
              className="mt-4 p-3 text-xs leading-relaxed"
              style={{
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                borderRadius: 12,
                color: "var(--spark-text-secondary)",
              }}
            >
              They lose access immediately. Their past recaps, requests, and
              events stay for the record. You can re-invite them later with the
              same email and they'll keep their history.
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={removeBusy}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                  opacity: removeBusy ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={removeBusy}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-orange)",
                  color: "#0a0d09",
                  border: "none",
                  opacity: removeBusy ? 0.6 : 1,
                  cursor: removeBusy ? "not-allowed" : "pointer",
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

export default function SparkTeam() {
  const { isAdmin } = useSparkRole();
  if (!isAdmin) {
    return (
      <Layout>
        <div className="max-w-2xl">
          <h1 className="display text-3xl font-bold">Admin only.</h1>
          <p
            className="mt-2"
            style={{ color: "var(--spark-text-meta)" }}
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
            style={{ color: "var(--spark-text-meta)" }}
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
