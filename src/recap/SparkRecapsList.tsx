import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { RecapsQuery } from "@/api/queries/RecapsQuery";
import type { RecapsQuery as RecapsQueryType } from "@api/queries/__generated__/RecapsQuery.graphql";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@api/queries/__generated__/RmmClientsQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import useSparkRole from "@/hooks/useSparkRole";
import { recapFileUrl } from "@/utils/recapFileUrl";
import LinkedSheetChip from "@/components/inputs/LinkedSheetChip";

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
  fileCount: number;
  engagements: number | null;
  productsSold: number | null;
  // Deep-link back to the parent request on the Master Tracker so
  // ops can pivot from "what happened in the field" to "who asked
  // for this activation" in one click.
  requestUuid: string | null;
  requestShortId: string | null;
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

const RecapCard: React.FC<{
  recap: Recap;
  onOpen: () => void;
  onOpenRequest: ((uuid: string) => void) | null;
}> = ({ recap, onOpen, onOpenRequest }) => (
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
      <span
        className="absolute bottom-2 left-2 mono"
        style={{
          fontSize: 9,
          letterSpacing: "0.14em",
          padding: "2px 6px",
          borderRadius: 999,
          background:
            recap.fileCount > 0
              ? "rgba(197,245,70,0.15)"
              : "rgba(239,90,42,0.15)",
          color:
            recap.fileCount > 0
              ? "var(--spark-lime)"
              : "var(--spark-orange)",
          border: `1px solid ${recap.fileCount > 0 ? "rgba(197,245,70,0.35)" : "rgba(239,90,42,0.35)"}`,
        }}
      >
        ◉ {recap.fileCount} FILE{recap.fileCount === 1 ? "" : "S"}
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

      {recap.requestUuid && onOpenRequest && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenRequest(recap.requestUuid!);
          }}
          className="mono inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-[10px]"
          style={{
            letterSpacing: "0.14em",
            background: "rgba(197,245,70,0.10)",
            border: "1px solid rgba(197,245,70,0.30)",
            color: "var(--spark-lime)",
          }}
          title="View the parent request on the Master Tracker"
        >
          ← {recap.requestShortId} REQUEST
        </button>
      )}

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

type SortKey = "date-desc" | "date-asc" | "eng-desc" | "sold-desc";
type StatusKey = "all" | "approved" | "draft";

const PAGE_SIZE = 60;

const RecapsListInner: React.FC<{
  search: string;
  retailerFilter: string;
  stateFilter: string;
  rmmFilter: string;
  statusFilter: StatusKey;
  sortKey: SortKey;
  pageSize: number;
  onMeta: (m: Meta) => void;
  onVisibleRecapsChange?: (recaps: Recap[]) => void;
}> = ({ search, retailerFilter, stateFilter, rmmFilter, statusFilter, sortKey, pageSize, onMeta, onVisibleRecapsChange }) => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  // Initial page is PAGE_SIZE (60); "Load more" bumps pageSize in
  // 60-row chunks. We grow `first` rather than walk endCursor because
  // the existing query lacks @connection/@refetchable wiring and the
  // dataset is bounded (~hundreds, not millions) so refetching the
  // growing window is acceptable. Relay's response cache + the
  // network's gzip mean the additional bytes per click are roughly
  // 60-rows worth, not the full N-rows-cumulative.
  const data = useLazyLoadQuery<RecapsQueryType>(
    RecapsQuery,
    {
      first: pageSize,
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
          // Server-side resolvers do the work: heroFile is the first
          // browser-renderable image (jpg/png/webp/gif), recapFilesCount
          // is the COUNT(*) of all files. Client just prepends the
          // GCS bucket via recapFileUrl().
          const hero = n.heroFile?.file
            ? recapFileUrl(n.heroFile.file)
            : null;
          const fileCount = n.recapFilesCount ?? 0;
          const requestUuid = n.event?.request?.uuid ?? null;
          return {
            uuid: String(n.uuid),
            name: n.name ?? n.event?.name ?? "Untitled recap",
            date: n.event?.date ?? n.createdAt ?? "",
            retailerName,
            stateCode,
            approved: Boolean(n.approved),
            heroImage: hero,
            fileCount,
            engagements: n.totalEngagements ?? null,
            productsSold: n.productsSold ?? null,
            requestUuid: requestUuid ? String(requestUuid) : null,
            requestShortId: requestUuid
              ? `R-${String(requestUuid).slice(-4).toUpperCase()}`
              : null,
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
    const matched = recaps.filter((r) => {
      const matchQ =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.retailerName.toLowerCase().includes(q) ||
        (r.requestShortId?.toLowerCase().includes(q) ?? false);
      const matchR =
        retailerFilter === "all" || r.retailerName === retailerFilter;
      const matchS = stateFilter === "all" || r.stateCode === stateFilter;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "approved" ? r.approved : !r.approved);
      return matchQ && matchR && matchS && matchStatus;
    });

    // Sort in-place on the copy.
    return [...matched].sort((a, b) => {
      switch (sortKey) {
        case "date-asc":
          return (a.date || "").localeCompare(b.date || "");
        case "eng-desc":
          return (b.engagements ?? 0) - (a.engagements ?? 0);
        case "sold-desc":
          return (b.productsSold ?? 0) - (a.productsSold ?? 0);
        case "date-desc":
        default:
          return (b.date || "").localeCompare(a.date || "");
      }
    });
  }, [recaps, search, retailerFilter, stateFilter, statusFilter, sortKey]);

  // Bubble the currently-visible recaps up so the outer page can
  // wire them to the CSV export button.
  useEffect(() => {
    if (onVisibleRecapsChange) onVisibleRecapsChange(filtered);
  }, [filtered, onVisibleRecapsChange]);

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
          onOpenRequest={(reqUuid) =>
            navigate(`/request/view/${reqUuid}`, {
              state: { from: "/recaps/list" },
            })
          }
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
  const { isClient } = useSparkRole();
  const [search, setSearch] = useState("");
  const [retailerFilter, setRetailerFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [rmmFilter, setRmmFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  // "Load more" bumps this by PAGE_SIZE (60). Reset when filters
  // change so the user doesn't see "Load more (60 of 12)" when
  // narrowing the dataset.
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  useEffect(() => {
    setPageSize(PAGE_SIZE);
  }, [retailerFilter, stateFilter, rmmFilter, statusFilter]);
  const [meta, setMeta] = useState<Meta>({
    retailers: [],
    states: [],
    total: 0,
    totalConsumers: 0,
    totalProducts: 0,
  });

  const onMeta = useMemo(() => (next: Meta) => setMeta(next), []);

  const [visibleRecaps, setVisibleRecaps] = useState<Recap[]>([]);

  // CSV export of the currently-visible recaps (respects retailer /
  // state / RMM / search filters). Filename includes today's date.
  const exportCsv = () => {
    if (visibleRecaps.length === 0) {
      window.alert("Nothing to export — no recaps match the current filters.");
      return;
    }
    const esc = (raw: string | number | null | undefined) => {
      const s = (raw ?? "").toString();
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = [
      "R-ID",
      "Name",
      "Retailer",
      "State",
      "Date",
      "Status",
      "Engagements",
      "Products Sold",
      "Conv %",
      "Files",
      "UUID",
    ];
    const lines = [header.join(",")];
    for (const r of visibleRecaps) {
      const conv =
        r.engagements && r.productsSold && r.engagements > 0
          ? Math.round((r.productsSold / r.engagements) * 100) + "%"
          : "";
      lines.push(
        [
          `R-${r.uuid.slice(-4).toUpperCase()}`,
          r.name,
          r.retailerName,
          r.stateCode ?? "",
          r.date,
          r.approved ? "approved" : "draft",
          r.engagements ?? "",
          r.productsSold ?? "",
          conv,
          r.fileCount,
          r.uuid,
        ]
          .map(esc)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `spark-recaps-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // TSV-to-clipboard so kyle can paste straight into a Google Sheet
  // tab (Recap rollup). Same pattern as the Master Tracker.
  const [recapCopyState, setRecapCopyState] = useState<
    "idle" | "copying" | "copied"
  >("idle");
  const copyForSheets = async () => {
    if (visibleRecaps.length === 0 || recapCopyState !== "idle") return;
    setRecapCopyState("copying");
    const headers = [
      "R-ID",
      "Name",
      "Retailer",
      "State",
      "Date",
      "Status",
      "Engagements",
      "Products Sold",
      "Conv %",
      "Files",
      "UUID",
    ];
    const sanitize = (raw: string | number | null | undefined) =>
      (raw ?? "").toString().replace(/\t/g, " ").replace(/\r?\n/g, " ");
    const rows = [headers.join("\t")];
    for (const r of visibleRecaps) {
      const conv =
        r.engagements && r.productsSold && r.engagements > 0
          ? Math.round((r.productsSold / r.engagements) * 100) + "%"
          : "";
      rows.push(
        [
          `R-${r.uuid.slice(-4).toUpperCase()}`,
          r.name,
          r.retailerName,
          r.stateCode ?? "",
          r.date,
          r.approved ? "approved" : "draft",
          r.engagements ?? "",
          r.productsSold ?? "",
          conv,
          r.fileCount,
          r.uuid,
        ]
          .map(sanitize)
          .join("\t"),
      );
    }
    try {
      await navigator.clipboard.writeText(rows.join("\n"));
      setRecapCopyState("copied");
      window.setTimeout(() => setRecapCopyState("idle"), 2000);
    } catch {
      setRecapCopyState("idle");
      window.alert("Couldn't reach the clipboard. Try the CSV download.");
    }
  };

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
              {isClient ? "Your recaps." : "Every recap."}
            </h1>
            <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
              {isClient
                ? "Field reports from your activations, synced nightly with photos + numbers."
                : "Real field data, synced nightly from BA submissions."}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <LinkedSheetChip />
            <button
              onClick={copyForSheets}
              disabled={
                visibleRecaps.length === 0 || recapCopyState === "copying"
              }
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background:
                  recapCopyState === "copied"
                    ? "rgba(95,184,239,0.18)"
                    : "transparent",
                color:
                  recapCopyState === "copied"
                    ? "var(--spark-sky)"
                    : "var(--spark-text)",
                border: `1px solid ${
                  recapCopyState === "copied"
                    ? "rgba(95,184,239,0.5)"
                    : "var(--spark-border)"
                }`,
                opacity: visibleRecaps.length === 0 ? 0.5 : 1,
              }}
              title={
                visibleRecaps.length === 0
                  ? "Nothing to copy"
                  : `Copy ${visibleRecaps.length} recap${visibleRecaps.length === 1 ? "" : "s"} as TSV — paste into Google Sheets`
              }
            >
              {recapCopyState === "copied"
                ? `✓ Copied (${visibleRecaps.length})`
                : recapCopyState === "copying"
                  ? "Copying…"
                  : `📋 Copy for Sheets ${visibleRecaps.length > 0 ? `(${visibleRecaps.length})` : ""}`}
            </button>
            <button
              onClick={exportCsv}
              disabled={visibleRecaps.length === 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
                opacity: visibleRecaps.length === 0 ? 0.5 : 1,
              }}
              title={
                visibleRecaps.length === 0
                  ? "Nothing matches the current filters"
                  : `Download ${visibleRecaps.length} recap${visibleRecaps.length === 1 ? "" : "s"} as CSV`
              }
            >
              ↓ Export CSV{" "}
              {visibleRecaps.length > 0 ? `(${visibleRecaps.length})` : ""}
            </button>
            {!isClient && (
              <button
                onClick={() =>
                  (window.location.href = "/recaps/templates")
                }
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-lime)",
                  color: "#0a0d09",
                  boxShadow: "0 0 24px rgba(197,245,70,0.35)",
                }}
              >
                + Build template
              </button>
            )}
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
            placeholder="Search venue, retailer, R-ID…"
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
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusKey)}
            className="rounded-xl text-sm"
            style={{
              padding: "0.75rem 0.95rem",
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              maxWidth: 160,
              outline: "none",
            }}
            title="Filter by approval status"
          >
            <option value="all">All status</option>
            <option value="approved">Approved only</option>
            <option value="draft">Draft only</option>
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-xl text-sm"
            style={{
              padding: "0.75rem 0.95rem",
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              maxWidth: 200,
              outline: "none",
            }}
            title="Sort order"
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="eng-desc">Most consumers</option>
            <option value="sold-desc">Most products sold</option>
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
            rmmFilter={rmmFilter}
            statusFilter={statusFilter}
            sortKey={sortKey}
            pageSize={pageSize}
            onMeta={onMeta}
            onVisibleRecapsChange={setVisibleRecaps}
          />
        </Suspense>

        {meta.total > pageSize && (
          <div className="flex flex-col items-center gap-2 py-4">
            <button
              onClick={() => setPageSize((p) => p + PAGE_SIZE)}
              className="px-5 py-2.5 rounded-2xl text-sm font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                boxShadow: "0 0 20px rgba(197,245,70,0.35)",
              }}
            >
              Load {Math.min(PAGE_SIZE, meta.total - pageSize)} more →
            </button>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              {Math.min(pageSize, meta.total)} of {meta.total}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
