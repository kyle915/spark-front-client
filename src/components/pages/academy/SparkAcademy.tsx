import React, { Suspense, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useLazyLoadQuery } from "react-relay/hooks";
import Layout from "@/layout/Layout";
import SparkEmptyState from "@/shared/SparkEmptyState";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import { AcademyModulesAdminQuery } from "@/api/queries/AcademyModulesAdminQuery";
import type { AcademyModulesAdminQuery as AcademyModulesAdminQueryType } from "@api/queries/__generated__/AcademyModulesAdminQuery.graphql";
import { kindColor, kindLabel } from "@/lib/academy";

type ModuleRow = {
  uuid: string;
  title: string;
  kind: string;
  body: string;
  order: number;
  published: boolean;
};

const Card: React.FC<{
  m: ModuleRow;
  onOpen: () => void;
}> = ({ m, onOpen }) => {
  const color = kindColor(m.kind);
  const readMins = Math.max(1, Math.round(m.body.split(/\s+/).filter(Boolean).length / 200));
  return (
    <div className="spark-card hov p-5 cursor-pointer" onClick={onOpen}>
      <div className="flex items-center justify-between mb-2">
        <span
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.16em",
            color,
          }}
        >
          {kindLabel(m.kind).toUpperCase()}
        </span>
        {m.published ? (
          <span className="chip chip-lime">PUBLISHED</span>
        ) : (
          <span className="chip chip-muted">DRAFT</span>
        )}
      </div>
      <h3
        className="display text-lg font-bold mb-1"
        style={{ letterSpacing: "-0.02em" }}
      >
        {m.title}
      </h3>
      <div className="flex items-center justify-between mt-4">
        <span
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          ~{readMins} MIN READ
        </span>
      </div>
    </div>
  );
};

const AcademyInner: React.FC<{ tenantId: string; isAdmin: boolean }> = ({
  tenantId,
  isAdmin,
}) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | string>("all");

  const data = useLazyLoadQuery<AcademyModulesAdminQueryType>(
    AcademyModulesAdminQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" },
  );

  const modules = useMemo<ModuleRow[]>(
    () =>
      (data.academyModulesAdmin ?? [])
        .filter((m): m is NonNullable<typeof m> => Boolean(m))
        .map((m) => ({
          uuid: String(m.uuid),
          title: m.title,
          kind: m.kind,
          body: m.body,
          order: m.order,
          published: m.published,
        }))
        .sort((a, b) => a.order - b.order),
    [data],
  );

  const kinds = useMemo(() => {
    const set = new Set<string>();
    modules.forEach((m) => set.add(m.kind));
    return Array.from(set).sort();
  }, [modules]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return modules.filter((m) => {
      if (kindFilter !== "all" && m.kind !== kindFilter) return false;
      if (!isAdmin && !m.published) return false;
      if (
        q &&
        !m.title.toLowerCase().includes(q) &&
        !m.body.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [modules, kindFilter, search, isAdmin]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            SPARK ACADEMY · {filtered.length} MODULE
            {filtered.length === 1 ? "" : "S"}
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Train your BAs.
          </h1>
          <p
            className="mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Brand 101, product deep-dives, activation playbooks,
            compliance. Published modules sync to the Spark Mobile app.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => navigate("/academy/manage")}
            className="px-5 py-3 rounded-2xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow: "0 0 20px rgba(242,243,238,0.35)",
            }}
          >
            Manage modules
          </button>
        )}
      </div>

      <div className="spark-card p-4 flex flex-wrap items-center gap-2">
        <span className="label-mini mr-2">KIND</span>
        <button
          onClick={() => setKindFilter("all")}
          className="chip chip-muted"
          style={
            kindFilter === "all"
              ? { outline: "1.5px solid currentColor" }
              : undefined
          }
        >
          All
        </button>
        {kinds.map((k) => (
          <button
            key={k}
            onClick={() => setKindFilter(k)}
            className="chip chip-lime"
            style={
              kindFilter === k
                ? { outline: "1.5px solid currentColor" }
                : undefined
            }
          >
            {kindLabel(k)}
          </button>
        ))}
        <span className="flex-1" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search modules…"
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

      {filtered.length === 0 ? (
        modules.length === 0 ? (
          isAdmin ? (
            <SparkEmptyState
              title="No modules yet"
              body='Build the first one on Manage — "Liquid Death · Brand 101" is a good start.'
            />
          ) : (
            <SparkEmptyState
              title="No modules yet"
              body="Your Ignite RMM hasn't published any training modules yet."
            />
          )
        ) : (
          <SparkEmptyState title="No modules match these filters." />
        )
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <Card
              key={m.uuid}
              m={m}
              onOpen={() => navigate(`/academy/${m.uuid}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function SparkAcademy() {
  const { tenantId } = useAuthStore();
  const { isAdmin } = useSparkRole();

  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="text-xs py-12"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Loading academy…
          </div>
        }
      >
        {tenantId ? (
          <AcademyInner tenantId={tenantId} isAdmin={isAdmin} />
        ) : (
          <div
            className="text-xs py-12"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            No tenant selected.
          </div>
        )}
      </Suspense>
    </Layout>
  );
}
