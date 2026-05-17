import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { RecapsQuery } from "@/api/queries/RecapsQuery";
import type { RecapsQuery as RecapsQueryType } from "@api/queries/__generated__/RecapsQuery.graphql";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@api/queries/__generated__/RmmClientsQuery.graphql";
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
  heroImage: string | null;
  engagements: number | null;
  productsSold: number | null;
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
      className="h-32 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 50%, rgba(197,245,70,0.10), transparent 70%)",
      }}
    >
      {recap.heroImage ? (
        <img
          src={recap.heroImage}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.5))",
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-4xl" aria-hidden>
            ◈
          </span>
        </div>
      )}
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
            {recap.engagements != null
              ? recap.engagements.toLocaleString()
              : "—"}
          </p>
          <p className="label-mini">ENG</p>
        </div>
        <div>
          <p className="tab-num text-base font-bold">
            {recap.productsSold != null
              ? recap.productsSold.toLocaleString()
              : "—"}
          </p>
          <p className="label-mini">SOLD</p>
        </div>
        <div>
          <p
            className="tab-num text-base font-bold"
            style={{ color: "var(--spark-lime)" }}
          >
            {recap.engagements && recap.productsSold && recap.engagements > 0
              ? `${Math.round((recap.productsSold / recap.engagements) * 100)}%`
              : "—"}
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
  totalConsumers: number;
  totalProducts: number;
};

const RecapsListInner: React.FC<{
  search: string;
  retailerFilter: string;
  stateFilter: string;
  rmmFilter: string;
  onMeta: (m: Meta) => void;
}> = ({ search, retailerFilter, stateFilter, rmmFilter, onMeta }) => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<RecapsQueryType>(
    RecapsQuery,
    {
      first: 1000,
      filters: tenantId
        ? {
            tenantId,
            rmmAsignedId: rmmFilter === "all" ? null : rmmFilter,
          }
        : null,
    },
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
          // Pick the first image-typed file as the hero. file field is a
          // URL when present.
          const imageFile = (n.recapFiles ?? []).find((f) => {
            const ext = (f?.fileType?.extension ?? "").toLowerCase();
            const url = (f?.file ?? "").toLowerCase();
            return (
              ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ||
              /\.(jpg|jpeg|png|webp|gif)(\?|$)/.test(url)
            );
          });
          return {
            uuid: String(n.uuid),
            name: n.name ?? n.event?.name ?? "Untitled recap",
            date: n.event?.date ?? n.createdAt ?? "",
            retailerName,
            stateCode,
            approved: Boolean(n.approved),
            heroImage: imageFile?.file ?? null,
            engagements: n.totalEngagements ?? null,
            productsSold: n.productsSold ?? null,
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
    const totalConsumers = recaps.reduce(
      (s, r) => s + (r.engagements ?? 0),
      0,
    );
    const totalProducts = recaps.reduce(
      (s, r) => s + (r.productsSold ?? 0),
      0,
    );
    onMeta({
      retailers,
      states,
      total: data?.recaps?.totalCount ?? recaps.length,
      totalConsumers,
      totalProducts,
    });
  }, [retailers, states, data?.recaps?.totalCount, recaps, onMeta]);

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

const RmmFilterDropdown: React.FC<{
  tenantId: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ tenantId, value, onChange }) => {
  const data = useLazyLoadQuery<RmmClientsQueryType>(
    RmmClientsQuery,
    { tenantId },
    { fetchPolicy: "store-or-network" },
  );
  const rmms = (data?.rmmClients ?? []).filter(Boolean);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
      <option value="all">All RMMs</option>
      {rmms.map((r) =>
        r ? (
          <option key={r.id} value={String(r.id)}>
            {[r.firstName, r.lastName].filter(Boolean).join(" ") ||
              r.username}
          </option>
        ) : null,
      )}
    </select>
  );
};

export default function SparkRecapsList() {
  const { tenantId } = useAuthStore();
  const [search, setSearch] = useState("");
  const [retailerFilter, setRetailerFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [rmmFilter, setRmmFilter] = useState("all");
  const [meta, setMeta] = useState<Meta>({
    retailers: [],
    states: [],
    total: 0,
    totalConsumers: 0,
    totalProducts: 0,
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
            <p className="tab-num text-3xl font-bold mt-1">
              {meta.totalConsumers > 0
                ? meta.totalConsumers.toLocaleString()
                : "—"}
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">PRODUCTS SOLD</p>
            <p
              className="tab-num text-3xl font-bold mt-1"
              style={{ color: "var(--spark-lime)" }}
            >
              {meta.totalProducts > 0
                ? meta.totalProducts.toLocaleString()
                : "—"}
            </p>
          </div>
          <div className="spark-card p-4">
            <p className="label-mini">AVG · CONV</p>
            <p className="tab-num text-3xl font-bold mt-1">
              {meta.totalConsumers > 0 && meta.totalProducts > 0
                ? `${Math.round((meta.totalProducts / meta.totalConsumers) * 100)}%`
                : "—"}
            </p>
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
          {tenantId && (
            <Suspense fallback={null}>
              <RmmFilterDropdown
                tenantId={tenantId}
                value={rmmFilter}
                onChange={setRmmFilter}
              />
            </Suspense>
          )}
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
            rmmFilter={rmmFilter}
            onMeta={onMeta}
          />
        </Suspense>
      </div>
    </Layout>
  );
}
