/**
 * Spark v2 — Clients list page.
 *
 * Lists every Client (brand stakeholder organization) in the
 * workspace. Wire is read-only for v1 — create lives at
 * /clients/new, and tapping a row opens the per-client detail page
 * at /clients/:tenantId (SparkClientDetail), routed with the row's
 * Client.tenantId and the name/email in router state.
 */

import React, { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import { ClientsQuery } from "@/api/queries/ClientsQuery";
import type { ClientsQuery as ClientsQueryType } from "@api/queries/__generated__/ClientsQuery.graphql";

type ClientNode = NonNullable<
  NonNullable<
    NonNullable<ClientsQueryType["response"]["clients"]>["edges"][number]
  >["node"]
>;

const Inner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const [search, setSearch] = useState("");

  const data = useLazyLoadQuery<ClientsQueryType>(
    ClientsQuery,
    { filters: tenantId ? { tenantId } : {} },
    { fetchPolicy: "store-or-network" },
  );

  const clients = useMemo<ClientNode[]>(() => {
    return (data?.clients?.edges ?? [])
      .map((e) => e?.node)
      .filter((n): n is ClientNode => Boolean(n));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q),
    );
  }, [clients, search]);

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
            CLIENTS · {clients.length}
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Brands you serve.
          </h1>
          <p
            className="mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Every client organization in this workspace. Tap a row to
            see the brand's program performance, insights & field team.
          </p>
        </div>
        <button
          onClick={() => navigate("/clients/new")}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            border: "none",
          }}
        >
          + New client
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full max-w-md rounded-xl text-sm"
        style={{
          background: "var(--spark-bg)",
          border: "1px solid var(--spark-border)",
          color: "var(--spark-text)",
          padding: "0.75rem 0.95rem",
        }}
      />

      {filtered.length === 0 ? (
        <div
          className="spark-card p-8 text-center"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          {clients.length === 0
            ? "No clients in this workspace yet. Use + New client to add one."
            : "No matches."}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() =>
                navigate(`/clients/${c.tenantId}`, {
                  // Pass the name/email so the detail header paints
                  // instantly — there's no tenant-by-id query to fetch
                  // it from on the detail page.
                  state: { clientName: c.name, clientEmail: c.email },
                })
              }
              className="spark-card hov p-5 text-left"
              style={{
                background: "var(--spark-card)",
                cursor: "pointer",
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="display font-bold"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(197,245,70,0.10)",
                    color: "var(--spark-lime)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 13,
                  }}
                >
                  {(c.name ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">
                    {c.name ?? "(unnamed)"}
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    {c.email ?? "—"}
                  </p>
                </div>
              </div>
              <p
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.16em",
                  color: "var(--spark-lime)",
                }}
              >
                VIEW CLIENT →
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function SparkClients() {
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
            The Clients page is a Spark Admin surface.
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
            Loading clients…
          </div>
        }
      >
        <Inner />
      </Suspense>
    </Layout>
  );
}
