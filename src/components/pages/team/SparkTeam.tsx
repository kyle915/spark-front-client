/**
 * Spark v2 — Team page.
 *
 * Lists the admins + spark-admins in the workspace. Read-only for v1
 * (create/edit users lives at /users/create). When user management
 * mutations land here in v2, swap the "(view-only)" badge for an
 * inline editor.
 */

import React, { Suspense, useMemo } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import { UsersQuery } from "@/api/queries/UsersQuery";
import type { UsersQuery as UsersQueryType } from "@api/queries/__generated__/UsersQuery.graphql";

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
          {users.map((u) => {
            const role = (u.role?.name ?? "—").toLowerCase();
            const tone =
              ROLE_TONE[role] ?? "rgba(255,255,255,0.6)";
            return (
              <div key={u.id} className="spark-card p-4">
                <div className="flex items-center gap-3">
                  {u.image ? (
                    <img
                      src={u.image}
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
                        (u.firstName?.[0] ?? "") +
                        (u.lastName?.[0] ?? "")
                      ).toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {displayName(u)}
                    </p>
                    <p
                      className="text-xs truncate"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      {u.email ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
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
                    {(u.role?.name ?? "—").toUpperCase()}
                  </span>
                </div>
              </div>
            );
          })}
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
