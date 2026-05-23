import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { RecapsQuery } from "@/api/queries/RecapsQuery";
import type { RecapsQuery as RecapsQueryType } from "@api/queries/__generated__/RecapsQuery.graphql";
import { GetCustomRecapsQuery } from "@/api/queries/CustomRecapsQuery";
import type { CustomRecapsQuery as CustomRecapsQueryType } from "@api/queries/__generated__/CustomRecapsQuery.graphql";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@api/queries/__generated__/RmmClientsQuery.graphql";
import { GenerateCampaignReportPdfMutation } from "@/api/mutations/GenerateCampaignReportPdfMutation";
import type { GenerateCampaignReportPdfMutation as GenerateCampaignReportPdfMutationType } from "@api/mutations/__generated__/GenerateCampaignReportPdfMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";
import { recapFileUrl } from "@/utils/recapFileUrl";
import LinkedSheetChip from "@/components/inputs/LinkedSheetChip";
import EmailCampaignReportModal from "./EmailCampaignReportModal";
import ImportConnecteamPdfModal from "./ImportConnecteamPdfModal";
import { FileUpIcon } from "lucide-react";

// Backend cap. Mirrored from `GenerateCampaignReportPdfInput` —
// keeps the sticky action bar's button disabled with a friendly
// message instead of letting the user fire a request that the
// resolver will reject.
const CAMPAIGN_REPORT_MAX = 50;

/**
 * Spark v2 — Recaps list.
 * Wireframe: spark-demo/index.html lines 1183-1224 + realRecapCard.
 */

type Recap = {
  // Relay-encoded id — opaque base64 the backend resolves back to an
  // int. Needed by the Campaign Report mutation, which takes a list
  // of recap ids. Distinct from `uuid` which is the human-friendly
  // short-code (last 4 chars are surfaced as R-XXXX).
  id: string;
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
  // Distinguishes a standard recap row from a customRecap row so the
  // open-card click can route to /recap/view-custom/:uuid instead of
  // /recap/view/:uuid.
  isCustom: boolean;
};

// Compute a 0-3 completeness score from the signals already in the
// list query so the card can flag thin recaps without an extra
// round-trip. Skips approval as a signal (admins approve regardless
// of completeness; that's a separate workflow).
//
// Score buckets:
//   3 → all three present (engagements, products sold, photos)
//   2 → "thin" but useful (some data + photos OR strong numbers)
//   ≤1 → "sparse" — needs review before going to a client
//
// We only render the chip when score < 3 — full recaps don't need a
// gold star, they just need to not get flagged.
type QualityTier = "sparse" | "thin" | null;

const recapQualityTier = (recap: {
  engagements: number | null;
  productsSold: number | null;
  fileCount: number;
}): QualityTier => {
  let score = 0;
  if ((recap.engagements ?? 0) > 0) score += 1;
  if ((recap.productsSold ?? 0) > 0) score += 1;
  if (recap.fileCount > 0) score += 1;
  if (score >= 3) return null;
  if (score <= 1) return "sparse";
  return "thin";
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
  href: string;
  onOpen: (e: React.MouseEvent) => void;
  onOpenRequest: ((uuid: string, e: React.MouseEvent) => void) | null;
  requestHref: string | null;
  // Multi-select for the campaign-report builder. When `selected` is
  // non-null the card shows a checkbox in the top-left and toggling
  // it calls `onToggleSelect` instead of opening the recap. The
  // parent owns the selected-set state; the card is dumb.
  selected: boolean;
  onToggleSelect: () => void;
}> = ({ recap, href, onOpen, onOpenRequest, requestHref, selected, onToggleSelect }) => (
  // Real <a href> so:
  //  • left click  → onClick runs the SPA navigate (preserves state)
  //  • cmd/ctrl    → browser opens in new tab (we intentionally don't
  //                  preventDefault on modified clicks)
  //  • middle/right→ browser-native "open in new tab" works
  //  • copy link   → URL is meaningful
  <a
    href={href}
    onClick={(e) => {
      // Let the browser handle modifier + middle-click navigation.
      // Only intercept the plain left-click.
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      onOpen(e);
    }}
    className="spark-card hov overflow-hidden cursor-pointer relative block"
    style={{
      textDecoration: "none",
      color: "inherit",
      ...(selected
        ? {
            outline: "2px solid var(--spark-lime)",
            outlineOffset: 2,
          }
        : null),
    }}
  >
    {/* Checkbox sits above the hero so it's reachable without
        depending on row-level hover; tapping it doesn't open the
        recap. Lime when on so it pairs with the brand. */}
    <label
      onClick={(e) => e.stopPropagation()}
      className="absolute top-2 right-2 z-10 cursor-pointer"
      style={{
        background: "rgba(0,0,0,0.55)",
        border: "1px solid rgba(255,255,255,0.25)",
        borderRadius: 6,
        padding: "4px 6px",
      }}
      title={selected ? "Remove from campaign report" : "Add to campaign report"}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        className="cursor-pointer"
        style={{
          accentColor: "var(--spark-lime)",
          width: 14,
          height: 14,
          display: "block",
        }}
      />
    </label>
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
      {(() => {
        const tier = recapQualityTier(recap);
        if (!tier) return null;
        const cfg =
          tier === "sparse"
            ? {
                bg: "rgba(239,90,42,0.18)",
                fg: "var(--spark-orange)",
                br: "rgba(239,90,42,0.5)",
                label: "⚠ SPARSE",
                title: "Missing 2+ key fields. Needs review before client export.",
              }
            : {
                bg: "rgba(255,200,60,0.14)",
                fg: "#f5c042",
                br: "rgba(255,200,60,0.4)",
                label: "◐ THIN",
                title: "Missing one key field (numbers, samples, or photos).",
              };
        return (
          <span
            className="absolute mono"
            style={{
              top: 38, // sits just under the APPROVED/DRAFT chip
              right: 8,
              fontSize: 9,
              letterSpacing: "0.16em",
              padding: "2px 7px",
              borderRadius: 999,
              background: cfg.bg,
              color: cfg.fg,
              border: `1px solid ${cfg.br}`,
            }}
            title={cfg.title}
          >
            {cfg.label}
          </span>
        );
      })()}
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

      {recap.requestUuid && onOpenRequest && requestHref && (
        // Nested anchor — both wrapping <a> and this one are clickable.
        // We rely on onClick stopPropagation so the outer anchor's
        // SPA-nav doesn't fire when the chip is clicked. Modifier
        // clicks let the browser open whichever anchor is hit-tested
        // (inner takes priority) so right-click on the chip opens the
        // request in a new tab, right-click on the card opens the
        // recap in a new tab.
        <a
          href={requestHref}
          onClick={(e) => {
            e.stopPropagation();
            if (e.button !== 0) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            onOpenRequest(recap.requestUuid!, e);
          }}
          className="mono inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-[10px]"
          style={{
            letterSpacing: "0.14em",
            background: "rgba(197,245,70,0.10)",
            border: "1px solid rgba(197,245,70,0.30)",
            color: "var(--spark-lime)",
            textDecoration: "none",
          }}
          title="View the parent request on the Master Tracker"
        >
          ← {recap.requestShortId} REQUEST
        </a>
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
  </a>
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
  // Campaign Report multi-select. The Set lives in the parent so
  // selections survive filter changes; the content view just renders
  // checkboxes against it and reports toggles back up.
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
}> = ({ search, retailerFilter, stateFilter, rmmFilter, statusFilter, sortKey, pageSize, onMeta, onVisibleRecapsChange, selectedIds, onToggleSelected }) => {
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

  // Borjomi (and other custom-template tenants) file via customRecaps
  // instead of the standard recaps table. Query both in parallel and
  // merge — tenants that don't use customRecaps just get an empty list.
  const customData = useLazyLoadQuery<CustomRecapsQueryType>(
    GetCustomRecapsQuery,
    {
      first: pageSize,
      filters: tenantId ? { tenantId } : null,
    },
    { fetchPolicy: "store-or-network" },
  );

  const recaps: Recap[] = useMemo(() => {
    const std =
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
            id: String(n.id),
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
            isCustom: false,
          };
        }) ?? [];

    const custom =
      customData?.customRecaps?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          // Pick the first image-typed file as the hero. URL is stored
          // directly on customRecapFiles (already includes bucket prefix
          // OR is a relative key — both work in <img src>).
          const heroFile = (n.customRecapFiles ?? []).find((f) => {
            const ext = (f?.fileType?.name ?? "").toLowerCase();
            return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
          });
          const hero = heroFile?.url ? recapFileUrl(heroFile.url) : null;
          const retailerName = n.retailer?.name ?? "—";
          const stateCode = (n.state as { code?: string } | null)?.code ?? null;
          return {
            id: String(n.id),
            uuid: String(n.uuid),
            name: n.name ?? n.event?.name ?? "Untitled recap",
            date: n.event?.date ?? n.createdAt ?? "",
            retailerName,
            stateCode,
            approved: Boolean(n.approved),
            heroImage: hero,
            fileCount: (n.customRecapFiles ?? []).length,
            engagements: n.totalEngagements ?? null,
            productsSold: null,
            requestUuid: null,
            requestShortId: null,
            isCustom: true,
          };
        }) ?? [];

    return [...std, ...custom];
  }, [data, customData]);

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
      // Sum both totals so Borjomi-style tenants see their customRecap
      // count in the header strip instead of "0 PUBLISHED".
      total:
        (data?.recaps?.totalCount ?? 0) +
        (customData?.customRecaps?.totalCount ?? 0) ||
        recaps.length,
      totalConsumers,
      totalProducts,
    });
  }, [
    retailers,
    states,
    data?.recaps?.totalCount,
    customData?.customRecaps?.totalCount,
    recaps,
    onMeta,
  ]);

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
      {filtered.map((r) => {
        const href = r.isCustom
          ? `/recap/view-custom/${r.uuid}`
          : `/recap/view/${r.uuid}`;
        const requestHref = r.requestUuid
          ? `/request/view/${r.requestUuid}`
          : null;
        return (
          <RecapCard
            key={r.uuid}
            recap={r}
            href={href}
            requestHref={requestHref}
            selected={selectedIds.has(r.id)}
            onToggleSelect={() => onToggleSelected(r.id)}
            onOpen={() => navigate(href)}
            onOpenRequest={(reqUuid) =>
              navigate(`/request/view/${reqUuid}`, {
                state: { from: "/recaps/list" },
              })
            }
          />
        );
      })}
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
  const [importOpen, setImportOpen] = useState(false);
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

  // ─── Campaign report multi-select ────────────────────────────
  // Set of recap.id (relay id) the user has ticked. Survives filter
  // changes — kyle can switch retailer, tick a few more, etc. The
  // sticky action bar at the bottom of the page shows the count and
  // fires the Campaign Report mutation.
  const showAlert = useAlertStore((s) => s.showAlert);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());
  // Whether the "Email Report" compose modal is open. Lives at the
  // page level so the sticky bar can both open it and read the same
  // orderedSelectedIds the download button uses.
  const [emailReportOpen, setEmailReportOpen] = useState(false);

  const [commitReport, isGeneratingReport] =
    useMutation<GenerateCampaignReportPdfMutationType>(
      GenerateCampaignReportPdfMutation,
    );

  // The mutation expects ids ordered the way the user picked them on
  // the page (which determines cover-page recap order). We don't
  // store insertion order in the Set, so use the visible list order
  // as a sensible default — that matches what the user just saw.
  const orderedSelectedIds = useMemo(() => {
    if (selectedIds.size === 0) return [] as string[];
    return visibleRecaps
      .filter((r) => selectedIds.has(r.id))
      .map((r) => r.id);
  }, [visibleRecaps, selectedIds]);

  const generateReport = () => {
    if (selectedIds.size === 0 || isGeneratingReport) return;
    if (selectedIds.size > CAMPAIGN_REPORT_MAX) {
      showAlert(
        `Campaign report is limited to ${CAMPAIGN_REPORT_MAX} recaps per export. Trim your selection.`,
        "warning",
      );
      return;
    }
    commitReport({
      variables: {
        input: {
          recapIds: orderedSelectedIds,
        },
      },
      onCompleted: (res) => {
        const payload = res.generateCampaignReportPdf;
        if (payload?.success && payload.fileUrl) {
          window.open(payload.fileUrl, "_blank");
          showAlert(
            `Campaign report generated (${selectedIds.size} recap${selectedIds.size === 1 ? "" : "s"}).`,
            "success",
          );
          clearSelection();
        } else {
          showAlert(
            payload?.message ?? "Campaign report failed.",
            "error",
          );
        }
      },
      onError: (err) =>
        showAlert(`Campaign report failed: ${err.message}`, "error"),
    });
  };

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
            {!isClient && (
              <button
                onClick={() => setImportOpen(true)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2"
                style={{
                  background: "var(--spark-lime, #c5f546)",
                  color: "#0a0d09",
                }}
                title="Drop a Connecteam-exported recap PDF — text + photos auto-populate a draft recap."
              >
                <FileUpIcon className="w-4 h-4" />
                Import Connecteam PDF
              </button>
            )}
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
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
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

      {/* Sticky action bar — only renders when something is selected.
          Sits above the main content (z-50), inside the Layout so it
          tracks the inner padding. Disabled while the mutation is in
          flight; clicking ✕ clears the selection without firing. */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{
            background: "rgba(10, 13, 9, 0.95)",
            border: "1px solid var(--spark-border)",
            boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span
            className="mono text-[11px]"
            style={{
              letterSpacing: "0.16em",
              color: "var(--spark-lime)",
            }}
          >
            {selectedIds.size} SELECTED
          </span>
          {selectedIds.size > CAMPAIGN_REPORT_MAX && (
            <span
              className="text-[11px]"
              style={{ color: "var(--spark-orange)" }}
            >
              · Max {CAMPAIGN_REPORT_MAX} per export
            </span>
          )}
          <button
            type="button"
            onClick={clearSelection}
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            ✕ CLEAR
          </button>
          <button
            type="button"
            onClick={() => setEmailReportOpen(true)}
            disabled={
              isGeneratingReport ||
              selectedIds.size === 0 ||
              selectedIds.size > CAMPAIGN_REPORT_MAX
            }
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
            title={
              selectedIds.size > CAMPAIGN_REPORT_MAX
                ? `Limit is ${CAMPAIGN_REPORT_MAX} recaps per report`
                : "Email the combined PDF straight to a client"
            }
          >
            ✉ Email
          </button>
          <button
            type="button"
            onClick={generateReport}
            disabled={
              isGeneratingReport ||
              selectedIds.size === 0 ||
              selectedIds.size > CAMPAIGN_REPORT_MAX
            }
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow: "0 0 18px rgba(197,245,70,0.4)",
            }}
            title={
              selectedIds.size > CAMPAIGN_REPORT_MAX
                ? `Limit is ${CAMPAIGN_REPORT_MAX} recaps per report`
                : "Generate one combined PDF for the selected recaps"
            }
          >
            {isGeneratingReport
              ? `Generating ${selectedIds.size}…`
              : `📄 Download (${selectedIds.size})`}
          </button>
        </div>
      )}

      {emailReportOpen && (
        <EmailCampaignReportModal
          recapIds={orderedSelectedIds}
          onClose={() => setEmailReportOpen(false)}
          onSent={clearSelection}
        />
      )}
      {importOpen && (
        <ImportConnecteamPdfModal
          onClose={() => setImportOpen(false)}
        />
      )}
    </Layout>
  );
}
