import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { RecapsQuery } from "@/api/queries/RecapsQuery";
import type { RecapsQuery as RecapsQueryType } from "@api/queries/__generated__/RecapsQuery.graphql";
// Pulled in so the unified /recaps view can list CustomRecap rows
// alongside the legacy Recap rows. Without this, custom-template
// tenants (Liquid Death, Borjomi, Girl Beer, …) had their recaps
// invisible on /recaps and only surfaced under /recaps/custom-list
// — Kyle reported Dumbo Market and Austin Psych Fest missing.
import { GetCustomRecapsQuery } from "@/api/queries/CustomRecapsQuery";
import type { CustomRecapsQuery as CustomRecapsQueryType } from "@api/queries/__generated__/CustomRecapsQuery.graphql";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@api/queries/__generated__/RmmClientsQuery.graphql";
import { AmbassadorsListQuery } from "@/api/queries/AmbassadorsListQuery";
import type { AmbassadorsListQuery as AmbassadorsListQueryType } from "@api/queries/__generated__/AmbassadorsListQuery.graphql";
import { GenerateCampaignReportPdfMutation } from "@/api/mutations/GenerateCampaignReportPdfMutation";
import type { GenerateCampaignReportPdfMutation as GenerateCampaignReportPdfMutationType } from "@api/mutations/__generated__/GenerateCampaignReportPdfMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";
import { recapFileUrl } from "@/utils/recapFileUrl";
import LinkedSheetChip from "@/components/inputs/LinkedSheetChip";
import EmailCampaignReportModal from "./EmailCampaignReportModal";
import ImportConnecteamButton from "./ImportConnecteamButton";

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
  // Discriminator. "legacy" rows come from the Recap model + the
  // `recaps` GraphQL resolver. "custom" rows come from the CustomRecap
  // model + the `customRecaps` resolver — used by tenants on a Custom
  // Recap Template (Liquid Death, Borjomi, Girl Beer, …). Both render
  // through the same card; click handler picks the right route based
  // on this field.
  kind: "legacy" | "custom";
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
  // Granular sale + spend numbers. Kept separate from productsSold so
  // exports can break out "Cans Sold" vs "Packs Sold" — clients
  // reconciling invoices need that split, not the combined number.
  // Custom recaps don't carry these scalars; rows from CustomRecap
  // leave them null and the export shows blank cells.
  cansSold: number | null;
  packsSold: number | null;
  accountSpendAmount: number | null;
  // BA attribution for exports + cards. Prefers the linked Ambassador's
  // full name; falls back to externalBaName for shifts worked by
  // people not yet in Spark (sub-contractors, one-off helpers).
  // Empty string when neither is set.
  baName: string;
  isExternalBa: boolean;
  // Relay global id of the recap's PRIMARY ambassador (Recap.ambassador /
  // CustomRecap.ambassador), or null for external/unlinked BAs. Used by the
  // client-side BA filter mirror for instant feedback; the server-side
  // `ambassadorId` filter is the source of truth.
  ambassadorId: string | null;
  // Deep-link back to the parent request on the Master Tracker so
  // ops can pivot from "what happened in the field" to "who asked
  // for this activation" in one click.
  requestUuid: string | null;
  requestShortId: string | null;
  // Event Activation / Retail Sampling / etc. — sourced from the
  // parent Request's request_type. Null when the recap isn't linked
  // to a request or the request type hasn't been set. Surfaced in
  // the CSV export so client reports can group by activation type.
  requestType: string | null;
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
  onOpen: () => void;
  onOpenRequest: ((uuid: string) => void) | null;
  // Multi-select for the campaign-report builder. When `selected` is
  // non-null the card shows a checkbox in the top-left and toggling
  // it calls `onToggleSelect` instead of opening the recap. The
  // parent owns the selected-set state; the card is dumb.
  selected: boolean;
  onToggleSelect: () => void;
}> = ({ recap, onOpen, onOpenRequest, selected, onToggleSelect }) => (
  <div
    onClick={(e) => {
      // Clicking the card's chrome (anywhere outside the explicit
      // checkbox) opens the recap. Clicking the checkbox itself
      // bubbles to its own handler and stops propagation before this
      // fires — see the input below.
      onOpen();
      void e;
    }}
    className="spark-card hov overflow-hidden cursor-pointer relative"
    style={
      selected
        ? {
            outline: "2px solid var(--spark-lime)",
            outlineOffset: 2,
          }
        : undefined
    }
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
  // The tenant's full server-side total (combined legacy + custom
  // totalCount, honouring any server-side date bounds) — drives the
  // header + stats cards and the "of {total}" in the count indicator.
  total: number;
  // How many recaps match the ACTIVE client-side filters (search /
  // status / retailer / state / date) over the rows currently LOADED.
  filteredTotal: number;
  // How many rows are currently loaded (merged legacy + custom, before
  // client-side filtering). Drives the "Showing {loaded} of {total}"
  // counter so the user can see there are more rows behind "Load more".
  loaded: number;
  // True when EITHER list resolver reports pageInfo.hasNextPage — i.e.
  // more rows exist on the server than we've fetched. Gates "Load more".
  hasMore: boolean;
  totalConsumers: number;
  totalProducts: number;
};

type SortKey = "date-desc" | "date-asc" | "eng-desc" | "sold-desc";
type StatusKey = "all" | "approved" | "draft";

// Initial number of rows fetched from EACH list resolver (legacy +
// custom). "Load more" grows this by LOAD_MORE_STEP, re-fetching both
// queries with a larger `first`. We used to fetch the whole tenant set
// in one shot (first: 2000) which, for a high-volume tenant like Liquid
// Death, made the single payload so heavy the page hung on "Loading
// recaps…". A bounded initial page paints fast; "Load more" pulls the
// rest on demand.
const INITIAL_LIMIT = 300;

// How many more rows each "Load more" click requests (added to `first`
// on BOTH queries). Re-fetches are cheap relative to the all-at-once
// fetch and only happen when the user explicitly asks for more.
const LOAD_MORE_STEP = 300;

const RecapsListInner: React.FC<{
  search: string;
  retailerFilter: string;
  stateFilter: string;
  rmmFilter: string;
  // Filter by the recap's PRIMARY Ambassador (Recap.ambassador) — the BA
  // shown on the card/PDF. "all" = no filter; otherwise the Ambassador's
  // Relay global id, pushed server-side as `ambassadorId` (the resolver
  // decodes it). Mirrors rmmFilter end-to-end.
  baFilter: string;
  statusFilter: StatusKey;
  // Inclusive ISO yyyy-mm-dd bounds; empty string = no bound on that
  // side. Filter strips at the day level — recap dates are stored as
  // yyyy-mm-dd or yyyy-mm-ddTHH:MM:SS so a lexicographic compare on
  // the first 10 chars is correct here.
  dateFrom: string;
  dateTo: string;
  sortKey: SortKey;
  // Server fetch size — the `first` we ask BOTH list resolvers for. Grown
  // by the parent's "Load more" button (see onMeta.hasMore below).
  limit: number;
  onMeta: (m: Meta) => void;
  onVisibleRecapsChange?: (recaps: Recap[]) => void;
  // Campaign Report multi-select. The Set lives in the parent so
  // selections survive filter changes; the content view just renders
  // checkboxes against it and reports toggles back up.
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
}> = ({ search, retailerFilter, stateFilter, rmmFilter, baFilter, statusFilter, dateFrom, dateTo, sortKey, limit, onMeta, onVisibleRecapsChange, selectedIds, onToggleSelected }) => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  // Client view (an Ignite admin toggled into client mode, or a genuine
  // client login) must NOT see unapproved drafts — only approved recaps.
  // We ask the server for approved-only by passing `approved: true` in
  // the filters when in client mode. The admin/RMM view passes no
  // `approved` filter so it still sees drafts. The backend independently
  // forces approved-only for genuine client logins, so this is the
  // belt-and-suspenders frontend half for the admin-side "Client view"
  // toggle (which the server can't distinguish from a normal admin).
  const { isClient } = useSparkRole();
  const approvedOnly = isClient ? true : null;
  // Server-side date bounds. The backend RecapFiltersInput /
  // CustomRecapFiltersInput both expose inclusive startDate / endDate
  // (YYYY-MM-DD), so when the user picks a date range we push it into the
  // query. That matters now that we only load a bounded page: without it
  // a date filter could only see rows already pulled into the window
  // (newest first), so a query for an OLDER period would come back empty
  // until the user clicked "Load more" enough times. Passing the bounds
  // server-side lets older matches surface in the first page. The
  // client-side date filter below still runs (belt-and-suspenders, and it
  // also handles undated rows), so behaviour is unchanged for the no-date
  // case. Empty string = unbounded on that side → send null.
  const startDate = dateFrom || null;
  const endDate = dateTo || null;
  // Fetch a BOUNDED page from the legacy `recaps` resolver (first: limit),
  // grown by the parent's "Load more". We used to fetch the whole tenant
  // set in one shot which hung the page for high-volume tenants (Liquid
  // Death). The list still applies search / status / retailer / state
  // filters CLIENT-SIDE over whatever rows are loaded; date bounds are
  // additionally pushed to the server (above) so older matches aren't
  // hidden behind the load window.
  const data = useLazyLoadQuery<RecapsQueryType>(
    RecapsQuery,
    {
      first: limit,
      filters: tenantId
        ? {
            tenantId,
            rmmAsignedId: rmmFilter === "all" ? null : rmmFilter,
            // Filters by the recap's PRIMARY ambassador (Recap.ambassador_id);
            // the resolver decodes the Relay global id. "all" → no filter.
            ambassadorId: baFilter === "all" ? null : baFilter,
            // Client view → approved-only; admin/RMM view → drafts too.
            approved: approvedOnly,
            startDate,
            endDate,
          }
        : null,
    },
    // Always refetch on mount. store-or-network served a STALE cached
    // connection that omitted recaps created/approved after the cache was
    // populated — so a recap submitted minutes earlier looked "lost" from
    // the list (it was always safe in the DB). store-and-network paints the
    // cache instantly, then refreshes from the server.
    { fetchPolicy: "store-and-network" },
  );

  // Parallel query for tenants on a Custom Recap Template. Fetched with
  // the SAME bounded `first: limit` as the legacy list and merged on the
  // client. Both queries grow together when "Load more" bumps `limit`, so
  // neither flow is starved. Typical tenants have either-or (legacy XOR
  // custom); a tenant with both just loads `limit` of each per page.
  const customData = useLazyLoadQuery<CustomRecapsQueryType>(
    GetCustomRecapsQuery,
    {
      first: limit,
      // Client view → approved-only; admin/RMM view → drafts too. Date
      // bounds pushed server-side for the same reason as the legacy query.
      filters: tenantId
        ? {
            tenantId,
            // Same primary-ambassador filter as the legacy query above —
            // CustomRecapFiltersInput inherits ambassadorId. "all" → no filter.
            ambassadorId: baFilter === "all" ? null : baFilter,
            approved: approvedOnly,
            startDate,
            endDate,
          }
        : null,
    },
    // Always refetch on mount — same reason as the legacy query above. A
    // stale cached connection here is what made just-submitted CUSTOM recaps
    // vanish from the list after approve.
    { fetchPolicy: "store-and-network" },
  );

  const recaps: Recap[] = useMemo(() => {
    const legacy: Recap[] =
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
          // request.requestType is a NamedEntity; pull the human
          // label ("Event Activation", "Retail Sampling", …). Null
          // when the recap isn't linked to a request or the request
          // hasn't been categorised yet.
          const requestType =
            n.event?.request?.requestType?.name ?? null;
          const linkedBaName = [
            n.ambassador?.user?.firstName,
            n.ambassador?.user?.lastName,
          ]
            .filter(Boolean)
            .join(" ")
            .trim();
          const baName =
            linkedBaName ||
            (n.externalBaName ?? "").trim() ||
            "";
          return {
            kind: "legacy" as const,
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
            cansSold: n.totalCansSold ?? null,
            packsSold: n.totalPacksSold ?? null,
            accountSpendAmount: n.accountSpendAmount ?? null,
            baName,
            isExternalBa: !linkedBaName && Boolean(n.externalBaName),
            ambassadorId: n.ambassador?.id ? String(n.ambassador.id) : null,
            requestUuid: requestUuid ? String(requestUuid) : null,
            requestShortId: requestUuid
              ? `R-${String(requestUuid).slice(-4).toUpperCase()}`
              : null,
            requestType,
          };
        }) ?? [];

    // Custom recaps go through a different model (CustomRecap, not
    // Recap) so the available fields differ slightly. We map to the
    // same Recap shape so the rest of the page (filters, CSV export,
    // card rendering) doesn't need to branch. Fields that don't
    // exist on CustomRecap are set to safe defaults:
    //   - heroImage: pulled from customRecapFiles, first image-typed
    //     URL we find; null if none
    //   - fileCount: customRecapFiles.length
    //   - productsSold: null (CustomRecap doesn't carry a totalised
    //     products-sold scalar; the per-product breakdown lives in
    //     customRecapSalePerformance which is too detailed for the
    //     list card)
    //   - requestUuid/requestShortId: null because CustomRecap
    //     doesn't link to a Request row (it's tied to a JobAssignment
    //     instead; opening the recap shows the BA + event)
    // SOLD (cans+packs), ENG (consumers-sampled fallback), the hero image,
    // and the file count are now computed SERVER-SIDE (CustomRecap.soldUnits /
    // consumersSampled / heroImageUrl / customRecapFilesCount) so the list
    // query no longer pulls every field value + file per recap — that full
    // payload across thousands of rows is what made the list slow. The server
    // helpers replicate the old client derivations byte-for-byte.
    const custom: Recap[] =
      customData?.customRecaps?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          return {
            kind: "custom" as const,
            id: String(n.id),
            uuid: String(n.uuid),
            name:
              n.name ?? n.event?.name ?? n.customRecapTemplate?.name ?? "Custom recap",
            date: n.event?.date ?? n.createdAt ?? "",
            retailerName: n.retailer?.name ?? "—",
            stateCode: null,
            approved: Boolean(n.approved),
            heroImage: n.heroImageUrl ?? null,
            fileCount: n.customRecapFilesCount ?? 0,
            engagements: n.totalEngagements ?? n.consumersSampled ?? null,
            productsSold: n.soldUnits ?? null,
            // CustomRecap doesn't carry these scalar fields; leave
            // blank in the row so the export shows empty cells rather
            // than fake zeroes. Future work could pull from custom
            // fields when templates name them clearly.
            cansSold: null,
            packsSold: null,
            accountSpendAmount: null,
            baName: [
              n.ambassador?.user?.firstName,
              n.ambassador?.user?.lastName,
            ]
              .filter(Boolean)
              .join(" ")
              .trim(),
            isExternalBa: false,
            ambassadorId: n.ambassador?.id ? String(n.ambassador.id) : null,
            requestUuid: null,
            requestShortId: null,
            requestType: n.customRecapTemplate?.name ?? null,
          };
        }) ?? [];

    // Newest first. Mixed sort means custom and legacy recaps from
    // the same day land next to each other on the page instead of
    // siloed into two clumps.
    return [...legacy, ...custom].sort((a, b) => {
      const aT = a.date ? new Date(a.date).getTime() : 0;
      const bT = b.date ? new Date(b.date).getTime() : 0;
      return bT - aT;
    });
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
      // Mirror the server-side `ambassadorId` filter on the loaded rows so
      // the grid updates instantly when the BA dropdown changes (Relay also
      // re-fetches; the server result is the source of truth). Keyed on the
      // row's PRIMARY ambassador id — external/unlinked BAs (ambassadorId
      // null) drop out of a narrowed BA filter.
      const matchBa = baFilter === "all" || r.ambassadorId === baFilter;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "approved" ? r.approved : !r.approved);
      // Date range: compare on the yyyy-mm-dd prefix. Each bound is
      // inclusive — `dateFrom` = "2026-05-01" passes recaps from May 1
      // onwards, `dateTo` = "2026-05-31" passes recaps up to and
      // including May 31. Empty string on either bound = no limit
      // on that side. Recaps with no date pass when both bounds are
      // empty and fail otherwise (so a narrowed range doesn't show
      // undated rows that would distort budget reconciliation totals).
      const recapDay = (r.date || "").slice(0, 10);
      const matchDate =
        (!dateFrom && !dateTo) ||
        (recapDay !== "" &&
          (!dateFrom || recapDay >= dateFrom) &&
          (!dateTo || recapDay <= dateTo));
      return matchQ && matchR && matchS && matchBa && matchStatus && matchDate;
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
  }, [recaps, search, retailerFilter, stateFilter, baFilter, statusFilter, dateFrom, dateTo, sortKey]);

  // We paint every loaded row that matches the client-side filters.
  // Pagination now lives at the FETCH layer (`limit` / "Load more"), so
  // there's no separate client-side display slice — `filtered` is what
  // renders.
  const displayed = filtered;

  // Whether either resolver has more rows on the server than we've
  // fetched. Drives the parent's "Load more" gate.
  const hasMore = Boolean(
    data?.recaps?.pageInfo?.hasNextPage ||
      customData?.customRecaps?.pageInfo?.hasNextPage,
  );

  // Publish counts up to the page chrome. `total` is the combined
  // server-side total (both flows). `loaded` is how many rows we've
  // pulled; `hasMore` gates "Load more"; `filteredTotal` is how many of
  // the loaded rows match the active client-side filters.
  useEffect(() => {
    const totalConsumers = recaps.reduce((s, r) => s + (r.engagements ?? 0), 0);
    const totalProducts = recaps.reduce((s, r) => s + (r.productsSold ?? 0), 0);
    onMeta({
      retailers,
      states,
      // Tenant's full total spans BOTH flows. Summing the two server
      // totalCounts so a custom-only tenant (legacy totalCount = 0) no
      // longer shows "0 PUBLISHED". Honours server-side date bounds when
      // a range is active.
      total:
        (data?.recaps?.totalCount ?? 0) +
        (customData?.customRecaps?.totalCount ?? 0),
      filteredTotal: filtered.length,
      loaded: recaps.length,
      hasMore,
      totalConsumers,
      totalProducts,
    });
  }, [
    retailers,
    states,
    data?.recaps?.totalCount,
    customData?.customRecaps?.totalCount,
    recaps,
    filtered.length,
    hasMore,
    onMeta,
  ]);

  // Bubble the currently-visible (painted) recaps up so the outer page
  // can wire them to the CSV / TSV export buttons — the "Copy N" label
  // then matches what's on screen.
  useEffect(() => {
    if (onVisibleRecapsChange) onVisibleRecapsChange(displayed);
  }, [displayed, onVisibleRecapsChange]);

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
      {displayed.map((r) => (
        <RecapCard
          key={r.uuid}
          recap={r}
          selected={selectedIds.has(r.id)}
          onToggleSelect={() => onToggleSelected(r.id)}
          onOpen={() =>
            navigate(
              r.kind === "custom"
                ? `/recap/view-custom/${r.uuid}`
                : `/recap/view/${r.uuid}`,
            )
          }
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

// Brand Ambassador filter — mirrors RmmFilterDropdown. Populated from the
// tenant-scoped `ambassadors` resolver (active BAs only). The dropdown
// `value` is the Ambassador's Relay global id, which is exactly what the
// `ambassadorId` recap filter expects (the resolver decodes it). Filters by
// the recap's PRIMARY ambassador (the BA shown on the card/PDF).
const BaFilterDropdown: React.FC<{
  tenantId: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ tenantId, value, onChange }) => {
  const data = useLazyLoadQuery<AmbassadorsListQueryType>(
    AmbassadorsListQuery,
    { filters: { tenantId, isActive: true }, first: 500 },
    { fetchPolicy: "store-or-network" },
  );
  const ambassadors = (data?.ambassadors?.edges ?? []).filter(Boolean);
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
      title="Filter by Brand Ambassador"
    >
      <option value="all">All ambassadors</option>
      {ambassadors.map((edge) => {
        const node = edge?.node;
        if (!node) return null;
        const label =
          [node.user?.firstName, node.user?.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          node.user?.email ||
          String(node.uuid);
        return (
          <option key={node.id} value={String(node.id)}>
            {label}
          </option>
        );
      })}
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
  // Brand Ambassador filter. "all" = no filter; otherwise the Ambassador's
  // Relay global id (pushed server-side as `ambassadorId`). Mirrors rmmFilter.
  const [baFilter, setBaFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  // Inclusive date range for the budget-reconciliation filter
  // Myriant asked for. Empty string = unbounded on that side, so the
  // default ("","") is the same as "all dates". Stored as ISO yyyy-
  // mm-dd to match the native <input type="date"> value shape and
  // r.date which is already date-prefixed.
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  // Server fetch size — how many rows we ask EACH list resolver for.
  // "Load more" bumps it by LOAD_MORE_STEP, re-fetching both queries with
  // a larger `first`. Reset to INITIAL_LIMIT when the server-side filters
  // change (tenant scope, RMM, and the date bounds we push to the server)
  // so a freshly-scoped query starts from a small, fast page again.
  const [limit, setLimit] = useState(INITIAL_LIMIT);
  useEffect(() => {
    setLimit(INITIAL_LIMIT);
  }, [rmmFilter, baFilter, dateFrom, dateTo]);
  const [meta, setMeta] = useState<Meta>({
    retailers: [],
    states: [],
    total: 0,
    filteredTotal: 0,
    loaded: 0,
    hasMore: false,
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
      // Request type — Event Activation / Retail Sampling / etc.
      // Nevena needs this so client reports can group by activation
      // type. Empty when the recap isn't linked to a request.
      "Request Type",
      "BA Name",
      "BA Type",
      "Status",
      "Engagements",
      "Products Sold",
      "Cans Sold",
      "Packs Sold",
      "Account Spend",
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
          r.requestType ?? "",
          r.baName,
          r.isExternalBa ? "external" : (r.baName ? "spark" : ""),
          r.approved ? "approved" : "draft",
          r.engagements ?? "",
          r.productsSold ?? "",
          r.cansSold ?? "",
          r.packsSold ?? "",
          r.accountSpendAmount ?? "",
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
      "Request Type",
      "BA Name",
      "BA Type",
      "Status",
      "Engagements",
      "Products Sold",
      "Cans Sold",
      "Packs Sold",
      "Account Spend",
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
          r.requestType ?? "",
          r.baName,
          r.isExternalBa ? "external" : (r.baName ? "spark" : ""),
          r.approved ? "approved" : "draft",
          r.engagements ?? "",
          r.productsSold ?? "",
          r.cansSold ?? "",
          r.packsSold ?? "",
          r.accountSpendAmount ?? "",
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
            <ImportConnecteamButton variant="ghost" />
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
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                }}
              >
                + Build template
              </button>
            )}
            {!isClient && (
              // Primary action: build a recap against any Master-Tracker
              // event. /recap/create's event picker already lists every
              // tenant event, so this is the global "file a recap" entry
              // point from the recaps tab.
              <button
                onClick={() => (window.location.href = "/recap/create")}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-lime)",
                  color: "#0a0d09",
                  boxShadow: "0 0 24px rgba(197,245,70,0.35)",
                }}
              >
                + New recap
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
          {tenantId && (
            <Suspense fallback={null}>
              <BaFilterDropdown
                tenantId={tenantId}
                value={baFilter}
                onChange={setBaFilter}
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

          {/* Date range — Myriant asked for this so she can pull
              recaps for a specific budget reconciliation period. Both
              bounds inclusive; clearing both = "all dates" (same as
              before this filter existed). */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl text-sm"
            style={{
              padding: "0.75rem 0.95rem",
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              maxWidth: 160,
              outline: "none",
              colorScheme: "dark",
            }}
            title="From date (inclusive)"
            placeholder="From"
          />
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
            →
          </span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl text-sm"
            style={{
              padding: "0.75rem 0.95rem",
              background: "var(--spark-bg)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              maxWidth: 160,
              outline: "none",
              colorScheme: "dark",
            }}
            title="To date (inclusive)"
            placeholder="To"
          />
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              className="rounded-xl text-xs px-3 py-2"
              style={{
                background: "transparent",
                color: "rgba(255,255,255,0.55)",
                border: "1px solid var(--spark-border)",
              }}
              title="Clear date range"
            >
              Clear dates
            </button>
          )}
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
            baFilter={baFilter}
            statusFilter={statusFilter}
            dateFrom={dateFrom}
            dateTo={dateTo}
            sortKey={sortKey}
            limit={limit}
            onMeta={onMeta}
            onVisibleRecapsChange={setVisibleRecaps}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
          />
        </Suspense>

        {/* Load-more gate + counter. The gate fires off the SERVER's
            pageInfo.hasNextPage (meta.hasMore) — i.e. there are more rows
            on the server than we've fetched — so each click pulls another
            bounded page instead of loading everything up front (the old
            2000-row hang). The counter shows how many rows are loaded vs
            the combined server total; client-side filters (search /
            status / retailer / state / date) run over the loaded rows. */}
        {(meta.hasMore || (meta.total > 0 && meta.loaded > 0)) && (
          <div className="flex flex-col items-center gap-2 py-4">
            {meta.hasMore && (
              <button
                onClick={() => setLimit((l) => l + LOAD_MORE_STEP)}
                className="px-5 py-2.5 rounded-2xl text-sm font-semibold"
                style={{
                  background: "var(--spark-lime)",
                  color: "#0a0d09",
                  boxShadow: "0 0 20px rgba(197,245,70,0.35)",
                }}
              >
                Load {LOAD_MORE_STEP} more →
              </button>
            )}
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              Showing {meta.loaded} of {Math.max(meta.total, meta.loaded)}
              {meta.filteredTotal !== meta.loaded
                ? ` · ${meta.filteredTotal} match filters`
                : ""}
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
    </Layout>
  );
}
