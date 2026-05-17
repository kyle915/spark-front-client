import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { RecapsQuery } from "@/api/queries/RecapsQuery";
import type { RecapsQuery as RecapsQueryType } from "@api/queries/__generated__/RecapsQuery.graphql";
import { useAuthStore } from "@/store/authStore";

/**
 * Spark v2 — Recaps list.
 * Wireframe: spark-demo/index.html lines 1183-1224 + realRecapCard.
 */

type Recap = {
  uuid: string;
  name: string;
  date: string;
  retailerName: string;
  stateCode: string | null;
  approved: boolean;
};

const formatDate = (raw: string | null | undefined) => {
  if (!raw) return "";
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

const RecapCard: React.FC<{ recap: Recap; onOpen: () => void }> = ({
  recap,
  onOpen,
}) => (
  <div
    onClick={onOpen}
    className="spark-card hov overflow-hidden cursor-pointer"
  >
    <div
      className="h-28 grid place-items-center relative"
      style={{
        background:
          "radial-gradient(circle at 50% 50%, rgba(197,245,70,0.10), transparent 70%)",
      }}
    >
      <span className="text-4xl" aria-hidden>
        ◈
      </span>
      <span
        className="absolute top-2 left-2 mono"
        style={{
          fontSize: 9,
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.55)",
        }}
      >
        R-{recap.uuid.slice(-4).toUpperCase()}
      </span>
      <span
        className={`absolute top-2 right-2 chip ${recap.approved ? "chip-lime" : "chip-orange"}`}
      >
        ● {recap.approved ? "APPROVED" : "DRAFT"}
      </span>
    </div>

    <div className="p-4">
      <p className="font-bold text-sm truncate" title={recap.name}>
        {recap.name}
      </p>
      <p
        className="mono text-[10px] uppercase mt-1 truncate"
        style={{
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        {recap.retailerName}
        {recap.stateCode ? ` · ${recap.stateCode}` : ""}
        {recap.date ? ` · ${formatDate(recap.date)}` : ""}
      </p>

      <div
        className="mt-3 pt-3 grid grid-cols-3 gap-2 text-center"
        style={{ borderTop: "1px solid var(--spark-border)" }}
      >
        <div>
          <p
            className="tab-num text-base font-bold"
            style={{ color: "var(--spark-lime)" }}
          >
            —
          </p>
          <p className="label-mini">ENG</p>
        </div>
        <div>
          <p className="tab-num text-base font-bold">—</p>
          <p className="label-mini">SOLD</p>
        </div>
        <div>
          <p
            className="tab-num text-base font-bold"
            style={{ color: "var(--spark-lime)" }}
          >
            —
          </p>
          <p className="label-mini">CONV</p>
        </div>
      </div>
    </div>
  </div>
);

type Meta = {
  retailers: string[];
  states: string[];
  total: number;
};

const RecapsListInner: React.FC<{
  search: string;
  retailerFilter: string;
  stateFilter: string;
  onMeta: (m: Meta) => void;
}> = ({ search, retailerFilter, stateFilter, onMeta }) => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  // Tenant scoping is REQUIRED for the recaps query to return rows.
  const data = useLazyLoadQuery<RecapsQueryType>(
    RecapsQuery,
    { first: 100, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  const recaps: Recap[] = useMemo(() => {
    return (
      data?.recaps?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          const retailerName =
            n.event?.retailer?.name ??
            n.event?.request?.retailer?.name ??
            "—";
          const stateCode =
            n.event?.state?.code ??
            n.event?.retailer?.location?.state?.code ??
            n.state?.code ??
            null;
          return {
            uuid: String(n.uuid),
            name: n.name ?? n.event?.name ?? "Untitled recap",
            date: n.event?.date ?? n.createdAt ?? "",
            retailerName,
            stateCode,
            approved: Boolean(n.approved),
          };
        }) ?? []
    );
  }, [data]);

  const retailers = useMemo(
    () =>
      Array.from(
        new Set(recaps.map((r) => r.retailerName).filter(Boolean)),
      ).sort(),
    [recaps],
  );
  const states = useMemo(
    () =>
      Array.from(
        new Set(recaps.map((r) => r.stateCode).filter(Boolean) as string[]),
      ).sort(),
    [recaps],
  );

  useMemo(() => {
    onMeta({
      retailers,
      states,
      total: data?.recaps?.totalCount ?? recaps.length,
    });
  }, [retailers, states, data?.recaps?.totalCount, recaps.length, onMeta]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return recaps.filter((r) => {
      const matchQ =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.retailerName.toLowerCase().includes(q);
      const matchR =
        retailerFilter === "all" || r.retailerName === retailerFilter;
      const matchS = stateFilter === "all" || r.stateCode === stateFilter;
      return matchQ && matchR && matchS;
    });
  }, [recaps, search, retailerFilter, stateFilter]);

  if (filtered.length === 0) {
    return (
      <div
        className="spark-card p-8 text-center text-sm"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        No recaps match these filters.
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((r) => (
        <RecapCard
          key={r.uuid}
          recap={r}
          onOpen={() => navigate(`/recap/view/${r.uuid}`)}
        />
      ))}
    </div>
  );
};

export default function SparkRecapsList() {
  const [search, setSearch] = useState("");
  const [retailerFilter, setRetailerFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [meta, setMeta] = useState<Meta>({
    retailers: [],
    states: [],
    total: 0,
  });

  const onMeta = useMemo(() => (next: Meta) => setMeta(next), []);

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              RECAPS · {meta.total} PUBLISHED
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              Every recap.
            </h1>
            <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
              Real field data, synced nightly from BA submissions.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => alert("CSV export coming soon")}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              ↓ Export CSV
            </button>
            <button
              onClick={() => alert("Recap template builder coming soon")}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                boxShadow: "0 0 24px rgba(197,245,70,0.35)",
              }}
            >
              + Build template
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="spark-card p-4">
            <p className="label-mini">RECAPS · 90D</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              {meta.total}
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">CONSUMERS</p>
            <p className="tab-num text-3xl font-bold mt-1">—</p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">PRODUCTS SOLD</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              —
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">CANS SOLD</p>
            <p className="tab-num text-3xl font-bold mt-1">—</p>
          </div>
        </div>

        <div className="spark-card p-4 flex flex-wrap gap-3 items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search venue, retailer…"
            className="rounded-xl text-sm"
            style={{
              padding: "0.75rem 0.95rem",
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              flex: 1,
              minWidth: 200,
              maxWidth: 280,
              outline: "none",
            }}
          />
          <select
            value={retailerFilter}
            onChange={(e) => setRetailerFilter(e.target.value)}
            className="rounded-xl text-sm"
            style={{
              padding: "0.75rem 0.95rem",
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              maxWidth: 200,
              outline: "none",
            }}
          >
            <option value="all">All retailers</option>
            {meta.retailers.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="rounded-xl text-sm"
            style={{
              padding: "0.75rem 0.95rem",
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              maxWidth: 180,
              outline: "none",
            }}
          >
            <option value="all">All states</option>
            {meta.states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading recaps…
            </div>
          }
        >
          <RecapsListInner
            search={search}
            retailerFilter={retailerFilter}
            stateFilter={stateFilter}
            onMeta={onMeta}
          />
        </Suspense>
      </div>
    </Layout>
  );
}
