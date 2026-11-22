import SparkGhostButton from "@/shared/SparkGhostButton";
import { useStoreSheetStore } from "@/store/storeSheetStore";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useLazyLoadQuery, useMutation, useRelayEnvironment } from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import Layout from "@/layout/Layout";
import { RecapsListSkeleton } from "@/layout/PageSkeletons";
import { RecapsListQuery } from "@/api/queries/RecapsListQuery";
import { thumbUrl } from "@/utils/thumb";
import type { RecapsListQuery as RecapsListQueryType } from "@api/queries/__generated__/RecapsListQuery.graphql";
// Slim list ops for the unified /recaps card grid. Detail keeps
// RecapQuery / CustomRecapsQueryDetailsQuery (full file/field arrays).
import { CustomRecapsListQuery } from "@/api/queries/CustomRecapsListQuery";
import { RecapListKindsQuery } from "@/api/queries/RecapListKindsQuery";
import type { RecapListKindsQuery as RecapListKindsQueryType } from "@api/queries/__generated__/RecapListKindsQuery.graphql";
import { RecapSourceBadge } from "@/recap/RecapSourceBadge";
import { coActivationLabel } from "@/recap/coActivationLabel";
import { ThirdPartyRecapBadge } from "@/recap/ThirdPartyRecapBadge";
import { recapApprovalMeta } from "@/recap/recapApprovalMeta";
import type { CustomRecapsListQuery as CustomRecapsListQueryType } from "@api/queries/__generated__/CustomRecapsListQuery.graphql";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@api/queries/__generated__/RmmClientsQuery.graphql";
import { GenerateCampaignReportPdfMutation } from "@/api/mutations/GenerateCampaignReportPdfMutation";
import type { GenerateCampaignReportPdfMutation as GenerateCampaignReportPdfMutationType } from "@api/mutations/__generated__/GenerateCampaignReportPdfMutation.graphql";
import { BulkApproveRecapsMutation } from "@/api/mutations/BulkApproveRecapsMutation";
import { bulkApproveMessage, idsByKind, selectedRows } from "@/recap/recapSelection";
import type { BulkApproveRecapsMutation as BulkApproveRecapsMutationType } from "@api/mutations/__generated__/BulkApproveRecapsMutation.graphql";
import { ArchiveRecapMutation } from "@/api/mutations/ArchiveRecapMutation";
import type { ArchiveRecapMutation as ArchiveRecapMutationType } from "@/api/mutations/__generated__/ArchiveRecapMutation.graphql";
import { ArchiveCustomRecapMutation } from "@/api/mutations/ArchiveCustomRecapMutation";
import type { ArchiveCustomRecapMutation as ArchiveCustomRecapMutationType } from "@/api/mutations/__generated__/ArchiveCustomRecapMutation.graphql";
import { MarkRecapsSharedMutation } from "@/api/mutations/MarkRecapsSharedMutation";
import type { MarkRecapsSharedMutation as MarkRecapsSharedMutationType } from "@api/mutations/__generated__/MarkRecapsSharedMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useBaLabel from "@/hooks/useBaLabel";
import useSparkRole from "@/hooks/useSparkRole";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SidebarTabCount from "@/shared/SidebarTabCount";
import { recapRowStatus } from "./recapRowStatus";
import { recapFileUrl } from "@/utils/recapFileUrl";
import ShareRecapModal from "@/recap/components/ShareRecapModal";
import ShareRecapsBulkModal from "@/recap/components/ShareRecapsBulkModal";
import PushToPlanSheet from "@/field/PushToPlanSheet";
import { showsMissingRecaps } from "@/field/missingRecaps";
import { isTorchTenant } from "@/field/torch";
import LinkedSheetChip from "@/components/inputs/LinkedSheetChip";
import EmailCampaignReportModal from "./EmailCampaignReportModal";
import ImportConnecteamButton from "./ImportConnecteamButton";
import ExportReceiptsButton from "./ExportReceiptsButton";
import { ActionMorphButton } from "@/motion/ActionMorphButton";
import { CountReel } from "@/motion/CountReel";
import { StatusMorph } from "@/motion/StatusMorph";
import {
  dispatchOpenJump,
  holdActionSuccess,
  type ActionPhase,
} from "@/motion/opsMotion";
import { SparkBentoTile, SparkStat } from "@/shared/SparkStatBlocks";
import {
  recapConversionPercent,
  recapListKpis,
  sumConversionBases,
  aggregateRows,
} from "@/shared/sparkStat";
import {
  appendUniqueByUuid,
  domWindowForIndex,
  expandDomWindow,
  RECAPS_DOM_WINDOW_SIZE,
} from "./recapsListPagination";
import {
  fetchUnifiedRecapsFromPlan,
  fetchUnifiedRecapsPage,
  planUnifiedRecapsLoadMore,
  unifiedRecapsPageVariables,
} from "./unifiedRecapsFetch";
import { partitionRecapsForBulkArchive } from "./recapBulkArchive";
import {
  buildRecapListSearchParams,
  consumeRecapsListNeedsRefresh,
  readRecapListUrlFilters,
  recapEmptyKind,
  recapIsEmptyShell,
  recapListStatusWord,
  recapListServerFilters,
  recapMatchesBaName,
  recapMatchesPipeline,
  recapTypeChips,
  withRecapListReturn,
  type RecapListReturnFilters,
  type RecapsListNavState,
} from "./recapListFilters";
import { prefetchRecapDetails } from "./prefetchRecapDetail";
import {
  markRecapOpenedInQueue,
  pickNextReviewItem,
  recapQueueWarmTargets,
  saveRecapReviewQueue,
} from "./recapReviewQueue";
import {
  recapActivationFilterLabel,
  recapMatchesActivationFilter,
  recapTypeForRow,
  type RecapActivationFilter,
  type RecapTypeKey,
} from "@/lib/activationBucket";
import { BaNameFilter } from "./BaNameFilter";
import { RecapTypeChips } from "./RecapTypeChips";
import ListSearch from "@/components/search/ListSearch";
import { RecapReviewFlagBadges } from "./RecapReviewFlagBadges";
import { useRecapReviewFlags } from "./useRecapReviewFlags";
import type { ReviewFlagSummary } from "./reviewCheckDisplay";
import { useRecapTypeCounts } from "./useRecapTypeCounts";
import { inputColorScheme } from "@/theme/inputColorScheme";

// Backend cap. Mirrored from `GenerateCampaignReportPdfInput` —
// keeps the sticky action bar's button disabled with a friendly
// message instead of letting the user fire a request that the
// resolver will reject.
const CAMPAIGN_REPORT_MAX = 50;

/**
 * Spark v2 — Recaps list.
 * Wireframe: spark-demo/index.html lines 1183-1224 + realRecapCard.
 */

// ── US state resolution for the state filter ─────────────────────────
// The dropdown is built from each recap's stateCode. Custom-recap tenants
// that run guerrilla street sampling (Feel Free) file events with a full
// ADDRESS but no State FK, so the server-resolved `eventState` (which walks
// FKs only) is null and legacy `event.state.code` is empty — that's why
// FL/TX never appeared. This mirrors the backend's
// events.routing.extract_state_code: accept a state NAME, or pull the
// trailing 2-letter code out of an address string.
const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE",
  "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI",
  idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
  "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX",
  utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};
const US_CODES = new Set(Object.values(US_STATES));
// Longest first so "West Virginia" wins over "Virginia".
const US_STATE_NAMES = Object.keys(US_STATES).sort((a, b) => b.length - a.length);

function toStateCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  // 1. Already a bare 2-letter code (legacy event.state.code, or "TX").
  if (raw.length === 2 && US_CODES.has(raw.toUpperCase())) return raw.toUpperCase();
  // 2. Trailing 2-letter code before an optional ZIP (address form), after
  //    dropping a "USA"/"United States" suffix. Most authoritative, so it
  //    beats a state-named city ("Indiana, PA" → PA).
  const norm = raw.replace(/\b(?:usa|united states)\b\.?\s*$/i, "").trim();
  const m = norm.match(/(?:^|[,\s])([A-Za-z]{2})(?:[,\s]+\d{5}(?:-\d{4})?)?[,\s]*$/);
  if (m && US_CODES.has(m[1].toUpperCase())) return m[1].toUpperCase();
  // 3. Full state name anywhere in the string.
  const low = norm.toLowerCase();
  for (const name of US_STATE_NAMES) {
    if (new RegExp(`\\b${name}\\b`).test(low)) return US_STATES[name];
  }
  return null;
}

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
  approvalMeta: string | null;
  heroImage: string | null;
  fileCount: number;
  engagements: number | null;
  // Consumers SAMPLED — the conversion base (sold ÷ sampled). Distinct from
  // engagements: a custom recap can carry both a typed total_engagements (286)
  // and a "consumers sampled" field (278), and conversion must use the latter.
  // Null on legacy recaps that don't track a separate sampled count.
  consumersSampled: number | null;
  productsSold: number | null;
  // Dry demo (no product tasted): CONV pairs its sold with People engaged.
  isDryDemo: boolean;
  peopleEngaged: number | null;
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
  // Filed via the tenant's recap-only / 3rd-party agency check-in link.
  // Distinct from isExternalBa (a write-in name). Drives the list badge.
  isThirdParty: boolean;
  excludeFromAggregates: boolean;
  // "Submitted by Torch team" — filed via the brand's client-team link.
  // Counts in totals; display only.
  sourceLabel: string;
  storeMappingStatus: string;
  // Relay global id of the recap's PRIMARY ambassador (Recap.ambassador /
  // CustomRecap.ambassador), or null for external/unlinked BAs.
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
  // Retail / On-Premise / Event / Guerilla / Seeding — the server's
  // classification; drives the type chips and which rows feed CONV.
  recapType: RecapTypeKey;
  shareToken: string | null;
  sharedAt: string | null;
  archivedAt: string | null;
  /** Advisory flagged review-check summaries (Needs-review list badges). */
  reviewFlags?: { code: string; label: string }[];
};

// CONV = products sold ÷ consumers sampled for product retail, and
// products sold ÷ people engaged for a dry demo. Event / Guerilla /
// Seeding rows have no CONV. `empty` is what to show when there's no
// base/sold (— for the card, "" for CSV/TSV cells).
const conversionStr = (
  r: {
    productsSold: number | null;
    consumersSampled: number | null;
    engagements: number | null;
    isDryDemo: boolean;
    peopleEngaged: number | null;
    recapType: RecapTypeKey;
  },
  empty: string,
): string => recapConversionPercent({ ...r, requestType: null }, empty);

/** When both Eng and Conv are on screen, Conv keeps lime and Eng goes neutral. */
function demoteEngWhenConvIsLime<
  T extends { label: string; tone?: "default" | "lime" | "orange" },
>(items: T[]): T[] {
  const convIsPrimary = items.some(
    (k) => k.label === "Conv" && k.tone === "lime",
  );
  if (!convIsPrimary) return items;
  return items.map((k) =>
    k.label === "Eng" ? { ...k, tone: "default" } : k,
  );
}

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

const SlaHours: React.FC<{ since: string }> = ({ since }) => {
  const ms = Date.now() - new Date(since).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const hours = ms / 3_600_000;
  const days = hours / 24;
  const label = hours < 24 ? `${Math.max(1, Math.round(hours))}h since event` : `${Math.round(days)}d since event`;
  const color = days > 9 ? "var(--spark-orange)" : hours > 3 ? "var(--spark-warn-ink, #f5c042)" : "var(--spark-faint, rgba(var(--spark-ink-rgb),0.38))";
  return (
    <p className="mono text-[10px] mt-1" style={{ letterSpacing: "0.12em", color }} title="Time since the activation — 3h is the sell, not 9 days.">
      {label}
    </p>
  );
};

const isoLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const daysAgoIso = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoLocal(d);
};
const TODAY_ISO = isoLocal(new Date());
const DAYS_7_ISO = daysAgoIso(7);
const DAYS_30_ISO = daysAgoIso(30);
const DAYS_90_ISO = daysAgoIso(90);

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: "var(--spark-text)",
  border: "1px solid var(--spark-border)",
};
const limeBtn: React.CSSProperties = {
  background: "var(--spark-lime)",
  color: "var(--spark-on-accent)",
};

type LegacyRecapNode =
  RecapsListQueryType["response"]["recaps"]["edges"][number]["node"];
type CustomRecapNode =
  CustomRecapsListQueryType["response"]["customRecaps"]["edges"][number]["node"];

const mapLegacyRecap = (n: LegacyRecapNode): Recap => {
  const retailerName = n.eventRetailer || "—";
  const stateCode = toStateCode(n.eventState);
  const hero = n.heroFile?.file
    ? thumbUrl(recapFileUrl(n.heroFile.file), 400)
    : null;
  const fileCount = n.recapFilesCount ?? 0;
  const requestUuid = n.requestUuid ?? null;
  const requestType = n.requestTypeName ?? null;
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
    name: n.name ?? "Untitled recap",
    date: n.eventDate ?? n.createdAt ?? "",
    retailerName,
    stateCode,
    approved: Boolean(n.approved),
    approvalMeta: recapApprovalMeta(
      Boolean(n.approved),
      n.approvedBy,
      n.approvedAt ?? null,
    ),
    heroImage: hero,
    fileCount,
    engagements: n.totalEngagements ?? null,
    consumersSampled: null,
    productsSold: n.productsSold ?? null,
    isDryDemo: false,
    peopleEngaged: null,
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
    recapType: recapTypeForRow(n.recapType, requestType),
    shareToken: n.shareToken ?? null,
    sharedAt: n.sharedAt ?? null,
    archivedAt: n.archivedAt ?? null,
    isThirdParty: false,
    excludeFromAggregates: false,
    sourceLabel: "",
    storeMappingStatus: "",
  };
};

const mapCustomRecap = (n: CustomRecapNode): Recap => ({
  kind: "custom" as const,
  id: String(n.id),
  uuid: String(n.uuid),
  name: n.name ?? n.customRecapTemplate?.name ?? "Custom recap",
  date: n.eventDate ?? n.createdAt ?? "",
  retailerName: n.eventRetailer || "—",
  stateCode: toStateCode(n.eventState) ?? toStateCode(n.eventAddress),
  approved: Boolean(n.approved),
  approvalMeta: recapApprovalMeta(
    Boolean(n.approved),
    n.approvedBy,
    n.approvedAt ?? null,
  ),
  heroImage: thumbUrl(n.heroImageUrl, 400) || n.heroImageUrl || null,
  fileCount: n.customRecapFilesCount ?? 0,
  engagements: n.totalEngagements ?? n.consumersSampled ?? null,
  consumersSampled: n.consumersSampled ?? null,
  productsSold: n.soldUnits ?? null,
  isDryDemo: Boolean(n.isDryDemo),
  peopleEngaged: n.peopleEngaged ?? null,
  cansSold: null,
  packsSold: null,
  accountSpendAmount: n.accountSpend ?? null,
  baName:
    [n.ambassador?.user?.firstName, n.ambassador?.user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || (n.baDisplayName ?? "").trim(),
  isExternalBa: !n.ambassador?.id && Boolean((n.baDisplayName ?? "").trim()),
  ambassadorId: n.ambassador?.id ? String(n.ambassador.id) : null,
  requestUuid: null,
  requestShortId: null,
  requestType: n.customRecapTemplate?.name ?? null,
  recapType: recapTypeForRow(n.recapType, n.customRecapTemplate?.name),
  shareToken: n.shareToken ?? null,
  sharedAt: n.sharedAt ?? null,
  archivedAt: n.archivedAt ?? null,
  isThirdParty: Boolean(n.isThirdParty),
  excludeFromAggregates: Boolean(n.excludeFromAggregates),
  sourceLabel: [n.sourceLabel ?? "", coActivationLabel(n.coActivation?.brandNames)]
    .filter(Boolean)
    .join(" · "),
  storeMappingStatus: n.storeMappingStatus ?? "",
});

const recapsFromConnection = <
  TEdge extends { node?: TNode | null } | null | undefined,
  TNode,
>(
  edges: ReadonlyArray<TEdge> | null | undefined,
  mapNode: (node: TNode) => Recap,
): Recap[] =>
  edges
    ?.map((e) => e?.node)
    ?.filter((n): n is TNode => Boolean(n))
    ?.map(mapNode) ?? [];

const RecapCard: React.FC<{
  recap: Recap;
  // Destination URL for this recap. Rendered as a real <a href> (see the
  // stretched-link overlay below) so right-click → "Open in new tab",
  // ⌘/Ctrl-click, and middle-click all work; a plain left-click still does
  // in-app SPA navigation.
  href: string;
  onOpenRequest: ((uuid: string) => void) | null;
  // Opens the on-platform Share modal (email + copy link) for this recap.
  onShare: (recap: Recap) => void;
  // Multi-select for the campaign-report builder. When `selected` is
  // non-null the card shows a checkbox in the top-left and toggling
  // it calls `onToggleSelect` instead of opening the recap. The
  // parent owns the selected-set state; the card is dumb.
  selected: boolean;
  onToggleSelect: () => void;
  selectMode: boolean;
  showSla: boolean;
  forceApproved?: boolean;
  // Ops-only: pick which of this recap's numbers count toward a plan.
  onPushToPlan?: ((recap: Recap) => void) | null;
  onOpenRecap?: ((recap: Recap) => void) | null;
  reviewFlags?: readonly ReviewFlagSummary[] | null;
}> = ({ recap, href, onOpenRequest, onShare, selected, onToggleSelect, selectMode, showSla, forceApproved, onPushToPlan, onOpenRecap, reviewFlags }) => {
  const baLabel = useBaLabel();
  const [heroFailed, setHeroFailed] = useState(false);
  const emptyShell = recapIsEmptyShell(recap);
  const approved = recap.approved || Boolean(forceApproved);
  const { isClient } = useSparkRole();
  const status = recapRowStatus({
    emptyShell,
    approved,
    sharedAt: recap.sharedAt,
    archivedAt: recap.archivedAt,
    isClient,
  });
  const statusText = status.text;
  const convValue = conversionStr(recap, "—");
  const convLive = convValue !== "—";
  const completeness = emptyShell
    ? "Not filed"
    : [
        recap.fileCount > 0
          ? `${recap.fileCount} photo${recap.fileCount === 1 ? "" : "s"}`
          : "No photos",
        recap.engagements != null || recap.productsSold != null
          ? "Metrics in"
          : "No metrics",
      ].join(" · ");
  return (
  <div
    className="spark-card hov overflow-hidden cursor-pointer relative"
    style={{
      ...(selected
        ? {
            outline: "2px solid rgba(239,90,42,0.85)",
            outlineOffset: 2,
            boxShadow: "inset 0 0 0 1px rgba(239,90,42,0.35)",
          }
        : {}),
      ...(emptyShell
        ? {
            opacity: 0.72,
            borderStyle: "dashed",
          }
        : {}),
    }}
  >
    {/* Stretched-link overlay — a real <a href> covering the whole card.
        Left-click navigates in-app (react-router intercepts); right-click /
        ⌘-click / middle-click get the browser's native "open in new tab".
        The checkbox and request button sit at a higher z-index (below) so
        they still receive their own clicks instead of the overlay. */}
    <Link
      to={href}
      onClick={() => onOpenRecap?.(recap)}
      aria-label={`Open recap ${recap.name}`}
      className="absolute inset-0 z-[1]"
    />
    {/* Checkbox sits above the hero so it's reachable without
        depending on row-level hover; tapping it doesn't open the
        recap. Lime when on so it pairs with the brand. */}
    {(selectMode || selected) && (
    <label
      onClick={(e) => e.stopPropagation()}
      className="absolute top-3 left-2 z-10 cursor-pointer"
      style={{
        background: "rgba(0,0,0,0.55)",
        border: "1px solid rgba(var(--spark-ink-rgb),0.25)",
        borderRadius: 6,
        padding: "4px 6px",
      }}
      title={selected ? "Deselect" : "Select"}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        className="cursor-pointer"
        style={{
          accentColor: "var(--spark-orange, #ef5a2a)",
          width: 14,
          height: 14,
          display: "block",
        }}
      />
    </label>
    )}
    <div
      className="h-32 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 50%, rgba(var(--spark-ok-rgb),0.10), transparent 70%)",
      }}
    >
      {recap.heroImage && !heroFailed ? (
        <img
          src={recap.heroImage}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.5))",
          }}
          onError={() => setHeroFailed(true)}
        />
      ) : recap.heroImage && heroFailed ? (
        <div className="absolute inset-0 grid place-items-center">
          <span className="chip chip-orange">Photo failed</span>
        </div>
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
          // Always over a photo: white on a dark scrim in both appearances.
          color: "rgba(255,255,255,0.92)",
          background: "rgba(0,0,0,0.5)",
          padding: "2px 6px",
          borderRadius: 6,
        }}
      >
        R-{recap.uuid.slice(-4).toUpperCase()}
      </span>
      <span
        className={`absolute top-2 right-2 chip ${
          status.tone === "attention" ? "chip-orange" : ""
        }`}
        style={
          status.tone === "neutral"
            ? {
                background: "rgba(var(--spark-ink-rgb),0.06)",
                border: "1px solid rgba(var(--spark-ink-rgb),0.18)",
                color: "var(--spark-text-secondary)",
              }
            : status.tone === "done"
              ? {
                  // Reminted chip-lime is off-white outline — unreadable as
                  // "approved" on busy hero photos. Match the green used by
                  // the "Approved by …" meta line under the card title.
                  background: "rgba(var(--spark-ok-rgb),0.92)",
                  border: "1px solid rgba(var(--spark-ok-rgb),1)",
                  color: "var(--spark-on-accent)",
                }
              : {
                  // Sits on a photo: needs its own solid ground to be
                  // readable in either appearance.
                  background: "var(--spark-surface)",
                  border: "1px solid var(--spark-orange)",
                  color: "var(--spark-orange)",
                }
        }
      >
        ● <StatusMorph value={statusText} />
      </span>
      {recap.isThirdParty ? (
        <span className="absolute bottom-2 left-2">
          <ThirdPartyRecapBadge onPhoto notInTotals={recap.excludeFromAggregates} />
        </span>
      ) : recap.sourceLabel ? (
        <span className="absolute bottom-2 left-2">
          <RecapSourceBadge label={recap.sourceLabel} />
        </span>
      ) : null}
    </div>

    <div className="p-4">
      <p className="font-bold text-sm truncate" title={recap.name}>
        {recap.name}
      </p>
      {recap.isThirdParty ? (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <ThirdPartyRecapBadge notInTotals={recap.excludeFromAggregates} />
          {recap.storeMappingStatus === "unmatched" ? (
            <span className="chip chip-orange">Map store</span>
          ) : recap.storeMappingStatus === "mapped" ? (
            <span className="chip chip-muted">Store mapped</span>
          ) : null}
        </div>
      ) : recap.sourceLabel ? (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <RecapSourceBadge label={recap.sourceLabel} />
        </div>
      ) : null}
      <p
        className="mono text-[10px] uppercase mt-1 truncate"
        style={{
          letterSpacing: "0.14em",
          color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))",
        }}
      >
        {/* BA FIRST. "Who filed this" is the first thing ops asks of a
            recap, and on a walk-in event there's no retailer, so the line
            used to open with a bare em-dash. Retailer is kept but only when
            it's real. */}
        {baLabel(recap.baName) || "Unattributed"}
        {recap.retailerName && recap.retailerName !== "—" ? (
          <>
            {" · "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                useStoreSheetStore.getState().openStoreSheet({
                  recapId: recap.uuid,
                  storeName: recap.retailerName,
                  fallbackTitle: recap.retailerName,
                });
              }}
              title={`Open store profile for ${recap.retailerName}`}
              className="relative z-20 underline underline-offset-2 cursor-pointer uppercase mono text-[10px]"
              style={{
                color: "var(--spark-text-secondary)",
                background: "none",
                border: 0,
                padding: 0,
                letterSpacing: "0.14em",
              }}
            >
              {recap.retailerName}
            </button>
          </>
        ) : (
          ""
        )}
        {recap.stateCode ? ` · ${recap.stateCode}` : ""}
        {recap.date ? ` · ${formatDate(recap.date)}` : ""}
      </p>
      <p
        className="mono text-[10px] mt-1"
        style={{
          letterSpacing: "0.12em",
          color: emptyShell ? "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))" : "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))",
        }}
      >
        {completeness}
      </p>
      {recap.approvalMeta ? (
        <p
          className="mono text-[10px] mt-1"
          style={{
            letterSpacing: "0.1em",
            color: "rgba(var(--spark-ok-rgb),0.75)",
          }}
        >
          {recap.approvalMeta}
        </p>
      ) : null}
      {emptyShell ? (
        <p
          className="text-[12px] mt-1"
          style={{ color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))" }}
        >
          BA clocked out — recap not filed
        </p>
      ) : null}
      {showSla && !emptyShell && recap.date ? <SlaHours since={recap.date} /> : null}
      {!emptyShell && !approved ? (
        <div className="mt-2">
          <RecapReviewFlagBadges flags={reviewFlags} />
        </div>
      ) : null}

      <div className="relative z-10 spark-row-actions spark-row-actions--until-hover mt-2">
        {recap.requestUuid && onOpenRequest && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenRequest(recap.requestUuid!);
            }}
            className="mono inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px]"
            style={{
              letterSpacing: "0.14em",
              background: "rgba(var(--spark-ok-rgb),0.10)",
              border: "1px solid rgba(var(--spark-ok-rgb),0.30)",
              color: "var(--spark-lime)",
            }}
            title="View the parent request on the Master Tracker"
          >
            ← {recap.requestShortId} REQUEST
          </button>
        )}
        {recap.shareToken && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onShare(recap);
            }}
            className="mono inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px]"
            style={{
              letterSpacing: "0.14em",
              background: "rgba(var(--spark-ink-rgb),0.06)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text-secondary)",
            }}
            title="Share the public /r/:token link"
          >
            ↗ SHARE
          </button>
        )}
        {onPushToPlan && !emptyShell && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onPushToPlan(recap);
            }}
            className="mono inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px]"
            style={{
              letterSpacing: "0.14em",
              background: "rgba(var(--spark-ink-rgb),0.06)",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text-secondary)",
            }}
            title="Push this recap's metrics to a field marketing plan"
          >
            → PLAN
          </button>
        )}
      </div>

      {!emptyShell ? (
      <div
        className="mt-3 pt-3 grid grid-cols-3 gap-2"
        style={{ borderTop: "1px solid var(--spark-border)" }}
      >
        <SparkStat
          tone={convLive ? undefined : "lime"}
          value={
            recap.engagements != null
              ? recap.engagements.toLocaleString()
              : "—"
          }
          label="Eng"
        />
        <SparkStat
          value={
            recap.productsSold != null
              ? recap.productsSold.toLocaleString()
              : "—"
          }
          label="Sold"
        />
        <SparkStat
          tone={convLive ? "lime" : undefined}
          value={convValue}
          label="Conv"
        />
      </div>
      ) : null}
    </div>
  </div>
  );
};

const recapHref = (
  r: Recap,
  listStatus?: StatusKey,
  listActivation?: RecapActivationFilter,
  extra?: RecapListReturnFilters | null,
) =>
  withRecapListReturn(
    r.kind === "custom" ? `/recap/view-custom/${r.uuid}` : `/recap/view/${r.uuid}`,
    listStatus,
    listActivation,
    extra,
  );

const reviewRecapPath = (
  kind: "legacy" | "custom",
  uuid: string,
  extra?: RecapListReturnFilters | null,
) =>
  withRecapListReturn(
    kind === "custom" ? `/recap/view-custom/${uuid}` : `/recap/view/${uuid}`,
    "needs_review",
    "all",
    extra,
  );

const RecapCompactRow: React.FC<{
  recap: Recap;
  href: string;
  selected: boolean;
  focused: boolean;
  selectMode: boolean;
  onToggleSelect: () => void;
  forceApproved?: boolean;
  onOpenRecap?: ((recap: Recap) => void) | null;
  reviewFlags?: readonly ReviewFlagSummary[] | null;
}> = ({ recap, href, selected, focused, selectMode, onToggleSelect, forceApproved, onOpenRecap, reviewFlags }) => {
  const baLabel = useBaLabel();
  const [heroFailed, setHeroFailed] = useState(false);
  const emptyShell = recapIsEmptyShell(recap);
  const approved = recap.approved || Boolean(forceApproved);
  const { isClient } = useSparkRole();
  const status = recapRowStatus({
    emptyShell,
    approved,
    sharedAt: recap.sharedAt,
    archivedAt: recap.archivedAt,
    isClient,
  });
  const statusText = status.text;
  return (
    <div
      className="spark-inset-row relative"
      style={{
        minHeight: 40,
        padding: "3px 10px",
        gap: 8,
        background: focused
          ? "rgba(239,90,42,0.14)"
          : selected
            ? "var(--spark-selected-row, rgba(239,90,42,0.18))"
            : "transparent",
        outline: focused
          ? "1px solid rgba(239,90,42,0.65)"
          : selected
            ? "1px solid rgba(239,90,42,0.45)"
            : undefined,
        outlineOffset: -1,
      }}
    >
      <Link
        to={href}
        onClick={() => onOpenRecap?.(recap)}
        aria-label={`Open recap ${recap.name}`}
        className="absolute inset-0 z-[1]"
      />
      {(selectMode || selected) && (
        <label
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 cursor-pointer shrink-0"
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            style={{ accentColor: "#ef5a2a", width: 14, height: 14 }}
          />
        </label>
      )}
      <div
        className="relative z-10 shrink-0 overflow-hidden"
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: "rgba(239,90,42,0.08)",
        }}
      >
        {recap.heroImage && !heroFailed ? (
          <img
            src={recap.heroImage}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setHeroFailed(true)}
          />
        ) : recap.heroImage && heroFailed ? (
          <span className="chip chip-orange absolute inset-0 grid place-items-center text-[8px]">
            Photo failed
          </span>
        ) : (
          <span className="grid place-items-center w-full h-full text-base" aria-hidden>
            ◈
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 relative z-10">
        <p className="text-[13px] font-semibold leading-tight truncate">{baLabel(recap.baName) || "Unattributed"}</p>
        {recap.isThirdParty ? (
          <div className="mt-1 flex items-center gap-1 flex-wrap">
            <ThirdPartyRecapBadge compact notInTotals={recap.excludeFromAggregates} />
            {recap.storeMappingStatus === "unmatched" ? (
              <span className="chip chip-orange chip-sm">Map store</span>
            ) : null}
          </div>
        ) : recap.sourceLabel ? (
          <div className="mt-1 flex items-center gap-1 flex-wrap">
            <RecapSourceBadge compact label={recap.sourceLabel} />
          </div>
        ) : null}
        {!emptyShell && !approved ? (
          <div className="mt-1">
            <RecapReviewFlagBadges flags={reviewFlags} compact />
          </div>
        ) : null}
        <p
          className="mono text-[10px] truncate"
          style={{ letterSpacing: "0.12em", color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))" }}
        >
          {recap.retailerName && recap.retailerName !== "—" ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                useStoreSheetStore.getState().openStoreSheet({
                  recapId: recap.uuid,
                  storeName: recap.retailerName,
                  fallbackTitle: recap.retailerName,
                });
              }}
              title={`Open store profile for ${recap.retailerName}`}
              className="relative z-20 underline underline-offset-2 cursor-pointer mono text-[10px]"
              style={{
                color: "var(--spark-text-secondary)",
                background: "none",
                border: 0,
                padding: 0,
                letterSpacing: "0.12em",
              }}
            >
              {recap.retailerName}
            </button>
          ) : (
            recap.name
          )}
          {recap.date ? ` · ${formatDate(recap.date)}` : ""}
        </p>
      </div>
      <span
        className={`relative z-10 chip chip-sm shrink-0 ${
          status.tone === "neutral"
            ? ""
            : status.tone === "done"
              ? "chip-lime"
              : "chip-orange"
        }`}
        style={
          status.tone === "neutral"
            ? {
                background: "rgba(var(--spark-ink-rgb),0.06)",
                border: "1px solid rgba(var(--spark-ink-rgb),0.18)",
                color: "var(--spark-text-secondary)",
              }
            : undefined
        }
      >
        {statusText}
      </span>
      <div className="relative z-10 hidden sm:flex items-center gap-2 shrink-0">
        <SparkStat
          size="sm"
          tone="lime"
          value={
            recap.engagements != null
              ? recap.engagements.toLocaleString()
              : "—"
          }
          label="Eng"
        />
        <SparkStat
          size="sm"
          value={
            recap.productsSold != null
              ? recap.productsSold.toLocaleString()
              : "—"
          }
          label="Sold"
        />
      </div>
    </div>
  );
};

type Meta = {
  retailers: string[];
  states: string[];
  baNames: string[];
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
  // more rows exist on the server than we've fetched. Gates infinite
  // scroll. A failed page-2 fetch must NOT clear this in a way that
  // unmounts the rows already on screen.
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError: string | null;
  totalConsumers: number;
  totalProducts: number;
  // Retail + On-Premise only — CONV uses these so Event activations
  // don't dilute sold ÷ eng.
  conversionConsumers: number;
  conversionProducts: number;
  conversionDryDemos: number;
  notInTotals: number;
};

type SortKey = "date-desc" | "date-asc" | "eng-desc" | "sold-desc";
type StatusKey =
  | "submitted"
  | "needs_review"
  | "approved"
  | "shared"
  | "archived"
  | "all"
  | "draft";

type RecapsListFetchPolicy =
  | "store-or-network"
  | "store-and-network"
  | "network-only";

const EMPTY_LEGACY_PAGE: RecapsListQueryType["response"] = {
  recaps: {
    edges: [],
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
      endCursor: null,
      startCursor: null,
    },
    totalCount: 0,
  },
};

const EMPTY_CUSTOM_PAGE: CustomRecapsListQueryType["response"] = {
  customRecaps: {
    edges: [],
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
      endCursor: null,
      startCursor: null,
    },
    totalCount: 0,
  },
};

/** Runs RecapsListQuery, or returns an empty stub when this kind is unused. */
const RecapsLegacyGate: React.FC<{
  enabled: boolean;
  variables: RecapsListQueryType["variables"];
  fetchPolicy: RecapsListFetchPolicy;
  fetchKey: number;
  children: (data: RecapsListQueryType["response"]) => ReactNode;
}> = ({ enabled, variables, fetchPolicy, fetchKey, children }) => {
  if (!enabled) return <>{children(EMPTY_LEGACY_PAGE)}</>;
  return (
    <RecapsLegacyLive
      variables={variables}
      fetchPolicy={fetchPolicy}
      fetchKey={fetchKey}
    >
      {children}
    </RecapsLegacyLive>
  );
};

const RecapsLegacyLive: React.FC<{
  variables: RecapsListQueryType["variables"];
  fetchPolicy: RecapsListFetchPolicy;
  fetchKey: number;
  children: (data: RecapsListQueryType["response"]) => ReactNode;
}> = ({ variables, fetchPolicy, fetchKey, children }) => {
  const data = useLazyLoadQuery<RecapsListQueryType>(
    RecapsListQuery,
    variables,
    { fetchPolicy, fetchKey },
  );
  return <>{children(data)}</>;
};

/** Runs CustomRecapsListQuery, or empty stub when this kind is unused. */
const RecapsCustomGate: React.FC<{
  enabled: boolean;
  variables: CustomRecapsListQueryType["variables"];
  fetchPolicy: RecapsListFetchPolicy;
  fetchKey: number;
  children: (data: CustomRecapsListQueryType["response"]) => ReactNode;
}> = ({ enabled, variables, fetchPolicy, fetchKey, children }) => {
  if (!enabled) return <>{children(EMPTY_CUSTOM_PAGE)}</>;
  return (
    <RecapsCustomLive
      variables={variables}
      fetchPolicy={fetchPolicy}
      fetchKey={fetchKey}
    >
      {children}
    </RecapsCustomLive>
  );
};

const RecapsCustomLive: React.FC<{
  variables: CustomRecapsListQueryType["variables"];
  fetchPolicy: RecapsListFetchPolicy;
  fetchKey: number;
  children: (data: CustomRecapsListQueryType["response"]) => ReactNode;
}> = ({ variables, fetchPolicy, fetchKey, children }) => {
  const data = useLazyLoadQuery<CustomRecapsListQueryType>(
    CustomRecapsListQuery,
    variables,
    { fetchPolicy, fetchKey },
  );
  return <>{children(data)}</>;
};

const RecapsListInner: React.FC<{
  search: string;
  retailerFilter: string;
  stateFilter: string;
  rmmFilter: string;
  // Typed BA name. Empty = no filter. Pushed server-side as
  // `ambassadorName` (contains-match on linked BA + external write-in).
  baName: string;
  statusFilter: StatusKey;
  activationFilter: RecapActivationFilter;
  // Inclusive ISO yyyy-mm-dd bounds; empty string = no bound on that
  // side. Filter strips at the day level — recap dates are stored as
  // yyyy-mm-dd or yyyy-mm-ddTHH:MM:SS so a lexicographic compare on
  // the first 10 chars is correct here.
  dateFrom: string;
  dateTo: string;
  sortKey: SortKey;
  onMeta: (m: Meta) => void;
  onVisibleRecapsChange?: (recaps: Recap[]) => void;
  // Campaign Report multi-select. The Set lives in the parent so
  // selections survive filter changes; the content view just renders
  // checkboxes against it and reports toggles back up.
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  selectMode: boolean;
  queueEmpty: boolean;
  filterChips: { key: string; label: string }[];
  onClearFilters: () => void;
  justApprovedIds: Set<string>;
  refreshKey: number;
  density: "cards" | "compact";
  focusedId: string | null;
  needsStoreMap: boolean;
  targetPage: number;
  onPageChange: (page: number) => void;
  returnFilters?: RecapListReturnFilters | null;
  onOpenRecap?: ((recap: Recap) => void) | null;
  reviewFlagsById?: Map<string, ReviewFlagSummary[]>;
}> = ({ search, retailerFilter, stateFilter, rmmFilter, baName, statusFilter, activationFilter, dateFrom, dateTo, sortKey, onMeta, onVisibleRecapsChange, selectedIds, onToggleSelected, selectMode, queueEmpty, filterChips, onClearFilters, justApprovedIds, refreshKey, density, focusedId, needsStoreMap, targetPage, onPageChange, returnFilters, onOpenRecap, reviewFlagsById }) => {
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
  const pipeline = statusFilter === "draft" ? "needs_review" : statusFilter;
  const searchQ = search.trim() || null;
  const [baNameQuery, setBaNameQuery] = useState(baName.trim());
  // The recap whose Share modal is open (null = closed). Held here so
  // both the cards grid and the compact list can raise it.
  const [shareTarget, setShareTarget] = useState<Recap | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setBaNameQuery(baName.trim()), 250);
    return () => window.clearTimeout(t);
  }, [baName]);
  // Date bounds, type, status etc. all go server-side so a bounded page
  // still surfaces older / narrower matches; the client-side pass below
  // is belt-and-suspenders (and handles undated rows).
  const listFilters = useMemo(
    () =>
      tenantId
        ? recapListServerFilters({
            tenantId,
            isClient,
            statusFilter,
            rmmFilter,
            baName: baNameQuery,
            retailerFilter,
            stateFilter,
            dateFrom,
            dateTo,
            activationFilter,
          })
        : null,
    [
      tenantId,
      isClient,
      statusFilter,
      rmmFilter,
      baNameQuery,
      retailerFilter,
      stateFilter,
      dateFrom,
      dateTo,
      activationFilter,
    ],
  );
  const customListFilters = useMemo(
    () =>
      listFilters
        ? { ...listFilters, needsStoreMap: needsStoreMap || null }
        : null,
    [listFilters, needsStoreMap],
  );
  const unifiedPage1 = unifiedRecapsPageVariables(null);
  const environment = useRelayEnvironment();

  // Tenant-level EXISTS (warmed by idle prefetch) — skip unused kind
  // without a filtered totalCount probe waterfall before page-1.
  const kinds = useLazyLoadQuery<RecapListKindsQueryType>(
    RecapListKindsQuery,
    { tenantId: tenantId || null },
    {
      fetchPolicy: refreshKey === 0 ? "store-or-network" : "network-only",
      fetchKey: refreshKey,
    },
  );
  const enableLegacy = Boolean(kinds.recapListKinds?.hasLegacy);
  const enableCustom = Boolean(kinds.recapListKinds?.hasCustom);
  const listFetchPolicy: RecapsListFetchPolicy =
    refreshKey === 0 ? "store-or-network" : "network-only";

  const legacyVars = {
    first: unifiedPage1.legacy.first,
    after: unifiedPage1.legacy.after,
    q: searchQ,
    filters: listFilters,
  };
  const customVars = {
    first: unifiedPage1.custom.first,
    after: unifiedPage1.custom.after,
    q: searchQ,
    filters: customListFilters,
  };
  const fetchedRest = {
    search,
    retailerFilter,
    stateFilter,
    rmmFilter,
    baName,
    baNameQuery,
    statusFilter,
    activationFilter,
    dateFrom,
    dateTo,
    sortKey,
    onMeta,
    onVisibleRecapsChange,
    selectedIds,
    onToggleSelected,
    selectMode,
    queueEmpty,
    filterChips,
    onClearFilters,
    justApprovedIds,
    refreshKey,
    density,
    focusedId,
    needsStoreMap,
    searchQ,
    listFilters,
    customListFilters,
    pipeline,
    isClient,
    tenantId,
    environment,
    shareTarget,
    setShareTarget,
    targetPage,
    onPageChange,
    returnFilters,
    onOpenRecap,
    reviewFlagsById,
  } as const;

  // Mount both page queries in one component when both kinds exist so
  // they suspend/fetch in parallel (nested gates would waterfall).
  if (enableLegacy && enableCustom) {
    return (
      <RecapsBothLive
        legacyVariables={legacyVars}
        customVariables={customVars}
        fetchPolicy={listFetchPolicy}
        fetchKey={refreshKey}
        {...fetchedRest}
      />
    );
  }
  if (enableLegacy) {
    return (
      <RecapsLegacyGate
        enabled
        variables={legacyVars}
        fetchPolicy={listFetchPolicy}
        fetchKey={refreshKey}
      >
        {(data) => (
          <RecapsListFetched
            data={data}
            customData={EMPTY_CUSTOM_PAGE}
            enableLegacy
            enableCustom={false}
            {...fetchedRest}
          />
        )}
      </RecapsLegacyGate>
    );
  }
  if (enableCustom) {
    return (
      <RecapsCustomGate
        enabled
        variables={customVars}
        fetchPolicy={listFetchPolicy}
        fetchKey={refreshKey}
      >
        {(customData) => (
          <RecapsListFetched
            data={EMPTY_LEGACY_PAGE}
            customData={customData}
            enableLegacy={false}
            enableCustom
            {...fetchedRest}
          />
        )}
      </RecapsCustomGate>
    );
  }
  return (
    <RecapsListFetched
      data={EMPTY_LEGACY_PAGE}
      customData={EMPTY_CUSTOM_PAGE}
      enableLegacy={false}
      enableCustom={false}
      {...fetchedRest}
    />
  );
};

const RecapsBothLive: React.FC<{
  legacyVariables: RecapsListQueryType["variables"];
  customVariables: CustomRecapsListQueryType["variables"];
  fetchPolicy: RecapsListFetchPolicy;
  fetchKey: number;
  search: string;
  retailerFilter: string;
  stateFilter: string;
  rmmFilter: string;
  baName: string;
  baNameQuery: string;
  statusFilter: StatusKey;
  activationFilter: RecapActivationFilter;
  dateFrom: string;
  dateTo: string;
  sortKey: SortKey;
  onMeta: (m: Meta) => void;
  onVisibleRecapsChange?: (recaps: Recap[]) => void;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  selectMode: boolean;
  queueEmpty: boolean;
  filterChips: { key: string; label: string }[];
  onClearFilters: () => void;
  justApprovedIds: Set<string>;
  refreshKey: number;
  density: "cards" | "compact";
  focusedId: string | null;
  needsStoreMap: boolean;
  searchQ: string | null;
  listFilters: RecapsListQueryType["variables"]["filters"];
  customListFilters: CustomRecapsListQueryType["variables"]["filters"];
  pipeline: StatusKey;
  isClient: boolean;
  tenantId: string | null | undefined;
  environment: ReturnType<typeof useRelayEnvironment>;
  shareTarget: Recap | null;
  setShareTarget: Dispatch<SetStateAction<Recap | null>>;
  targetPage: number;
  onPageChange: (page: number) => void;
  returnFilters?: RecapListReturnFilters | null;
  onOpenRecap?: ((recap: Recap) => void) | null;
  reviewFlagsById?: Map<string, ReviewFlagSummary[]>;
}> = ({ legacyVariables, customVariables, fetchPolicy, fetchKey, ...rest }) => {
  const data = useLazyLoadQuery<RecapsListQueryType>(
    RecapsListQuery,
    legacyVariables,
    { fetchPolicy, fetchKey },
  );
  const customData = useLazyLoadQuery<CustomRecapsListQueryType>(
    CustomRecapsListQuery,
    customVariables,
    { fetchPolicy, fetchKey },
  );
  return (
    <RecapsListFetched
      data={data}
      customData={customData}
      enableLegacy
      enableCustom
      {...rest}
    />
  );
};

const RecapsListFetched: React.FC<{
  data: RecapsListQueryType["response"];
  customData: CustomRecapsListQueryType["response"];
  enableLegacy: boolean;
  enableCustom: boolean;
  search: string;
  retailerFilter: string;
  stateFilter: string;
  rmmFilter: string;
  baName: string;
  baNameQuery: string;
  statusFilter: StatusKey;
  activationFilter: RecapActivationFilter;
  dateFrom: string;
  dateTo: string;
  sortKey: SortKey;
  onMeta: (m: Meta) => void;
  onVisibleRecapsChange?: (recaps: Recap[]) => void;
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
  selectMode: boolean;
  queueEmpty: boolean;
  filterChips: { key: string; label: string }[];
  onClearFilters: () => void;
  justApprovedIds: Set<string>;
  refreshKey: number;
  density: "cards" | "compact";
  focusedId: string | null;
  needsStoreMap: boolean;
  searchQ: string | null;
  listFilters: RecapsListQueryType["variables"]["filters"];
  customListFilters: CustomRecapsListQueryType["variables"]["filters"];
  pipeline: StatusKey;
  isClient: boolean;
  tenantId: string | null | undefined;
  environment: ReturnType<typeof useRelayEnvironment>;
  shareTarget: Recap | null;
  setShareTarget: Dispatch<SetStateAction<Recap | null>>;
  targetPage: number;
  onPageChange: (page: number) => void;
  returnFilters?: RecapListReturnFilters | null;
  onOpenRecap?: ((recap: Recap) => void) | null;
  reviewFlagsById?: Map<string, ReviewFlagSummary[]>;
}> = ({
  data,
  customData,
  enableLegacy,
  enableCustom,
  search,
  retailerFilter,
  stateFilter,
  rmmFilter,
  baName,
  baNameQuery,
  statusFilter,
  activationFilter,
  dateFrom,
  dateTo,
  sortKey,
  onMeta,
  onVisibleRecapsChange,
  selectedIds,
  onToggleSelected,
  selectMode,
  queueEmpty,
  filterChips,
  onClearFilters,
  justApprovedIds,
  refreshKey,
  density,
  focusedId,
  needsStoreMap,
  searchQ,
  listFilters,
  customListFilters,
  pipeline,
  isClient,
  tenantId,
  environment,
  shareTarget,
  setShareTarget,
  targetPage,
  onPageChange,
  returnFilters,
  onOpenRecap,
  reviewFlagsById,
}) => {
  const navigate = useNavigate();
  const { tenantSlug, tenantMeta } = useAuthStore();
  const plansOn = !isClient && isTorchTenant(tenantSlug, tenantMeta?.requestUrlName);
  const [planTarget, setPlanTarget] = useState<Recap | null>(null);

  const page1Legacy = useMemo(
    () => recapsFromConnection(data?.recaps?.edges, mapLegacyRecap),
    [data],
  );
  const page1Custom = useMemo(
    () => recapsFromConnection(customData?.customRecaps?.edges, mapCustomRecap),
    [customData],
  );

  const [extraLegacy, setExtraLegacy] = useState<Recap[]>([]);
  const [extraCustom, setExtraCustom] = useState<Recap[]>([]);
  const [legacyAfter, setLegacyAfter] = useState<string | null>(null);
  const [customAfter, setCustomAfter] = useState<string | null>(null);
  const [legacyHasMore, setLegacyHasMore] = useState(false);
  const [customHasMore, setCustomHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [loadedPages, setLoadedPages] = useState(1);
  const loadingMoreRef = useRef(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  // DOM window (see recapsListPagination): render only the first N filtered
  // rows; fetch/queue/selection/exports keep using the full filtered set.
  const [visibleCount, setVisibleCount] = useState(RECAPS_DOM_WINDOW_SIZE);
  const windowSentinelRef = useRef<HTMLDivElement | null>(null);

  const firstPageKey = [
    refreshKey,
    tenantId ?? "",
    rmmFilter,
    baNameQuery,
    dateFrom,
    dateTo,
    statusFilter,
    activationFilter,
    retailerFilter,
    stateFilter,
    search,
  ].join("|");

  useEffect(() => {
    setExtraLegacy([]);
    setExtraCustom([]);
    setLoadMoreError(null);
    setLoadingMore(false);
    setLoadedPages(1);
    setVisibleCount(RECAPS_DOM_WINDOW_SIZE);
    loadingMoreRef.current = false;
  }, [firstPageKey]);

  // Sorting reorders the same rows — restart the window so the top is shown.
  useEffect(() => {
    setVisibleCount(RECAPS_DOM_WINDOW_SIZE);
  }, [sortKey]);

  useEffect(() => {
    if (extraLegacy.length > 0) return;
    setLegacyAfter(data?.recaps?.pageInfo?.endCursor ?? null);
    setLegacyHasMore(Boolean(data?.recaps?.pageInfo?.hasNextPage));
  }, [data, extraLegacy.length]);

  useEffect(() => {
    if (extraCustom.length > 0) return;
    setCustomAfter(customData?.customRecaps?.pageInfo?.endCursor ?? null);
    setCustomHasMore(Boolean(customData?.customRecaps?.pageInfo?.hasNextPage));
  }, [customData, extraCustom.length]);

  const recaps: Recap[] = useMemo(() => {
    return [...page1Legacy, ...extraLegacy, ...page1Custom, ...extraCustom].sort(
      (a, b) => {
        const aT = a.date ? new Date(a.date).getTime() : 0;
        const bT = b.date ? new Date(b.date).getTime() : 0;
        return bT - aT;
      },
    );
  }, [page1Legacy, extraLegacy, page1Custom, extraCustom]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    const plan = planUnifiedRecapsLoadMore({
      enableLegacy,
      enableCustom,
      legacyHasMore,
      customHasMore,
      legacyAfter,
      customAfter,
    });
    if (!plan.hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const { legacy: legacyPage, custom: customPage } =
        await fetchUnifiedRecapsFromPlan(environment, plan, {
          q: searchQ,
          legacyFilters: listFilters,
          customFilters: customListFilters,
          fetchPolicy: "network-only",
        });
      if (legacyPage?.recaps) {
        setExtraLegacy((prev) =>
          appendUniqueByUuid(
            prev,
            recapsFromConnection(legacyPage.recaps.edges, mapLegacyRecap),
          ),
        );
        setLegacyAfter(legacyPage.recaps.pageInfo.endCursor ?? null);
        setLegacyHasMore(Boolean(legacyPage.recaps.pageInfo.hasNextPage));
      }
      if (customPage?.customRecaps) {
        setExtraCustom((prev) =>
          appendUniqueByUuid(
            prev,
            recapsFromConnection(
              customPage.customRecaps.edges,
              mapCustomRecap,
            ),
          ),
        );
        setCustomAfter(customPage.customRecaps.pageInfo.endCursor ?? null);
        setCustomHasMore(
          Boolean(customPage.customRecaps.pageInfo.hasNextPage),
        );
      }
      setLoadedPages((prev) => {
        const nextPage = prev + 1;
        if (nextPage > targetPage) onPageChange(nextPage);
        return nextPage;
      });
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Failed to fetch";
      setLoadMoreError(message);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [
    environment,
    enableLegacy,
    enableCustom,
    legacyHasMore,
    customHasMore,
    legacyAfter,
    customAfter,
    searchQ,
    listFilters,
    customListFilters,
    targetPage,
    onPageChange,
  ]);

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

  const baNames = useMemo(
    () =>
      Array.from(
        new Set(recaps.map((r) => r.baName).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b)),
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
      const matchBa = recapMatchesBaName(baName, r.baName);
      const matchStatus = recapMatchesPipeline({
        isClient,
        pipeline,
        approved: r.approved,
        sharedAt: r.sharedAt,
        archivedAt: r.archivedAt,
        justApproved: justApprovedIds.has(r.id),
        emptyShell: recapIsEmptyShell(r),
      });
      const matchActivation = recapMatchesActivationFilter(
        r.recapType,
        activationFilter,
      );
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
      const matchMap =
        !needsStoreMap ||
        (r.isThirdParty && r.storeMappingStatus === "unmatched");
      return (
        matchQ &&
        matchR &&
        matchS &&
        matchBa &&
        matchStatus &&
        matchActivation &&
        matchDate &&
        matchMap
      );
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
  }, [recaps, search, retailerFilter, stateFilter, baName, statusFilter, activationFilter, dateFrom, dateTo, sortKey, justApprovedIds, isClient, pipeline, needsStoreMap]);

  // `filtered` is the full loaded + filter-matching set: it feeds the
  // review queue (via onVisibleRecapsChange), selection, counts and
  // exports. Only the DOM is windowed — `windowed` is what paints, so
  // queue/selection semantics are unchanged when rows are off-window.
  const displayed = filtered;
  const windowed = filtered.slice(0, visibleCount);
  const canExpandWindow = windowed.length < filtered.length;
  const expandWindow = useCallback(
    () => setVisibleCount((c) => expandDomWindow(c, filtered.length)),
    [filtered.length],
  );

  // Keyboard focus (j/k in the parent) can land past the window — grow to it.
  useEffect(() => {
    if (!focusedId) return;
    const idx = filtered.findIndex((r) => r.uuid === focusedId);
    if (idx >= 0) {
      setVisibleCount((c) => domWindowForIndex(c, idx, filtered.length));
    }
  }, [focusedId, filtered]);

  // Auto-grow the window as its sentinel nears the viewport. The fetch
  // sentinel below only mounts once the window covers all filtered rows,
  // so scrolling expands DOM first, then fetches the next server page.
  useEffect(() => {
    if (!canExpandWindow) return;
    const el = windowSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) expandWindow();
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [canExpandWindow, expandWindow, windowed.length]);

  const hasMore = legacyHasMore || customHasMore;

  useEffect(() => {
    if (targetPage <= loadedPages) return;
    if (!hasMore || loadingMore || loadMoreError) return;
    void loadMore();
  }, [targetPage, loadedPages, hasMore, loadingMore, loadMoreError, loadMore]);

  useEffect(() => {
    if (!hasMore || loadingMore || loadMoreError) return;
    const el = loadMoreSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, loadMoreError, loadMore, recaps.length]);

  useEffect(() => {
    const counted = aggregateRows(recaps);
    const totalConsumers = counted.reduce((s, r) => s + (r.engagements ?? 0), 0);
    const totalProducts = counted.reduce((s, r) => s + (r.productsSold ?? 0), 0);
    const conversion = sumConversionBases(recaps);
    onMeta({
      retailers,
      states,
      baNames,
      total:
        (data?.recaps?.totalCount ?? 0) +
        (customData?.customRecaps?.totalCount ?? 0),
      filteredTotal: filtered.length,
      loaded: recaps.length,
      hasMore,
      loadingMore,
      loadMoreError,
      totalConsumers,
      totalProducts,
      conversionConsumers: conversion.engagements,
      conversionProducts: conversion.sold,
      conversionDryDemos: conversion.dryDemos,
      notInTotals: recaps.length - counted.length,
    });
  }, [
    retailers,
    states,
    baNames,
    data?.recaps?.totalCount,
    customData?.customRecaps?.totalCount,
    recaps,
    filtered.length,
    hasMore,
    loadingMore,
    loadMoreError,
    onMeta,
  ]);

  // Bubble the currently-visible (painted) recaps up so the outer page
  // can wire them to the CSV / TSV export buttons — the "Copy N" label
  // then matches what's on screen.
  useEffect(() => {
    if (onVisibleRecapsChange) onVisibleRecapsChange(displayed);
  }, [displayed, onVisibleRecapsChange]);

  const listFooter = (
    <div className="flex flex-col items-center gap-2 py-4">
      {canExpandWindow ? (
        <>
          <div ref={windowSentinelRef} className="h-8 w-full" />
          <button
            type="button"
            onClick={expandWindow}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            Show more recaps ({windowed.length} of {filtered.length} loaded)
          </button>
        </>
      ) : hasMore && !loadMoreError ? (
        <div ref={loadMoreSentinelRef} className="h-8 w-full" />
      ) : null}
      {loadingMore ? (
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.16em",
            color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))",
          }}
        >
          Loading more recaps…
        </p>
      ) : null}
      {loadMoreError ? (
        <div className="spark-card p-4 text-center max-w-md">
          <p className="text-sm" style={{ color: "var(--spark-text)" }}>
            Couldn’t load more recaps. The {recaps.length} already on
            screen are still here.
          </p>
          <p
            className="mono text-[11px] mt-2 break-words"
            style={{ color: "var(--spark-faint, rgba(var(--spark-ink-rgb),0.38))" }}
          >
            {loadMoreError.slice(0, 300)}
          </p>
          <button
            type="button"
            onClick={() => void loadMore()}
            className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );

  if (filtered.length === 0) {
    const emptyKind = recapEmptyKind({ isClient, queueEmpty, filterChips });
    return (
      <>
      <div
        className="spark-card p-8 text-center text-sm"
        style={{ color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))" }}
      >
        {emptyKind === "queue" ? (
          <>
            <p className="display text-2xl font-bold" style={{ color: "var(--spark-text)" }}>
              You’re caught up.
            </p>
            <p className="mt-2">
              No filed recaps need review in the last 30 days. Empty
              clock-out stubs stay under{" "}
              <span className="font-semibold">Submitted</span>.
            </p>
          </>
        ) : emptyKind === "window" ? (
          <div className="text-left max-w-lg mx-auto">
            <p className="display text-2xl font-bold" style={{ color: "var(--spark-text)" }}>
              No approved recaps in this window.
            </p>
            <p className="mt-2">
              Approved recaps from the last 30 days will show here.
            </p>
          </div>
        ) : (
          <div className="text-left max-w-lg mx-auto">
            <p className="display text-2xl font-bold" style={{ color: "var(--spark-text)" }}>
              Nothing in this view.
            </p>
            <p className="mt-2">
              These filters emptied the list. Clear one, or clear all.
            </p>
            {filterChips.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {filterChips.map((chip) => (
                  <span
                    key={chip.key}
                    className="mono text-[10px] px-2.5 py-1.5 rounded-full"
                    style={{
                      letterSpacing: "0.12em",
                      color: "var(--spark-lime)",
                      background: "rgba(var(--spark-ok-rgb),0.10)",
                      border: "1px solid rgba(var(--spark-ok-rgb),0.28)",
                    }}
                  >
                    {chip.label}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="mono text-[10px] px-2.5 py-1.5 rounded-full font-semibold"
                  style={{
                    letterSpacing: "0.12em",
                    color: "var(--spark-on-accent)",
                    background: "var(--spark-lime)",
                    border: "none",
                  }}
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {listFooter}
      </>
    );
  }

  if (density === "compact") {
    return (
      <>
      <div>
        <p className="spark-inset-label">Recaps</p>
        <div className="spark-inset-group">
          {windowed.map((r) => (
            <RecapCompactRow
              key={r.uuid}
              recap={r}
              href={recapHref(r, statusFilter, activationFilter, returnFilters)}
              selected={selectedIds.has(r.id)}
              focused={focusedId === r.uuid}
              selectMode={selectMode}
              onToggleSelect={() => onToggleSelected(r.id)}
              forceApproved={justApprovedIds.has(r.id)}
              onOpenRecap={onOpenRecap}
              reviewFlags={reviewFlagsById?.get(r.id)}
            />
          ))}
        </div>
      </div>
      {listFooter}
      </>
    );
  }

  return (
    <>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {windowed.map((r) => (
        <RecapCard
          key={r.uuid}
          recap={r}
          selected={selectedIds.has(r.id)}
          onToggleSelect={() => onToggleSelected(r.id)}
          selectMode={selectMode}
          showSla={pipeline === "needs_review"}
          href={recapHref(r, statusFilter, activationFilter, returnFilters)}
          forceApproved={justApprovedIds.has(r.id)}
          onShare={setShareTarget}
          onPushToPlan={plansOn ? setPlanTarget : null}
          onOpenRecap={onOpenRecap}
          reviewFlags={reviewFlagsById?.get(r.id)}
          onOpenRequest={(reqUuid) =>
            navigate(`/request/view/${reqUuid}`, {
              state: { from: "/recaps/list" },
            })
          }
        />
      ))}
    </div>
    {listFooter}
    {shareTarget?.shareToken && (
      <ShareRecapModal
        recapId={shareTarget.id}
        kind={shareTarget.kind}
        shareToken={shareTarget.shareToken}
        recapName={shareTarget.name}
        onClose={() => setShareTarget(null)}
      />
    )}
    {planTarget && (
      <PushToPlanSheet
        open
        onOpenChange={(next) => {
          if (!next) setPlanTarget(null);
        }}
        recapId={planTarget.id}
        kind={planTarget.kind}
        recapName={planTarget.name}
      />
    )}
    </>
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

// Index of the "BA Name" column in the CSV / copy-for-Sheets exports.
// Brand users get the export without it.
const BA_NAME_COL = 6;

export default function SparkRecapsList() {
  const { tenantId, tenantSlug, tenantMeta } = useAuthStore();
  const { isClient } = useSparkRole();
  const missingRecapsOn = showsMissingRecaps(
    tenantSlug,
    tenantMeta?.requestUrlName,
  );
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const baFromNav =
    typeof (location.state as { baName?: unknown } | null)?.baName === "string"
      ? String((location.state as { baName: string }).baName)
      : "";
  const initialUrlFilters = useMemo(
    () =>
      readRecapListUrlFilters(searchParams, {
        isClient,
        defaultFrom: DAYS_30_ISO,
        defaultTo: TODAY_ISO,
        weekFrom: DAYS_7_ISO,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [search, setSearch] = useState(initialUrlFilters.q);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [density, setDensity] = useState<"cards" | "compact">(() => {
    try {
      const saved = localStorage.getItem("spark-recaps-density");
      if (saved === "cards" || saved === "compact") return saved;
      return isClient ? "cards" : "compact";
    } catch {
      return isClient ? "cards" : "compact";
    }
  });
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);
  const [retailerFilter, setRetailerFilter] = useState(
    initialUrlFilters.retailer,
  );
  const [stateFilter, setStateFilter] = useState(initialUrlFilters.state);
  const [rmmFilter, setRmmFilter] = useState(initialUrlFilters.rmm);
  const [baName, setBaName] = useState(initialUrlFilters.ba || baFromNav);
  const [statusFilter, setStatusFilterState] = useState<StatusKey>(
    initialUrlFilters.status,
  );
  const [activationFilter, setActivationFilterState] =
    useState<RecapActivationFilter>(initialUrlFilters.activation);
  const [page, setPage] = useState<number>(initialUrlFilters.page);
  const setStatusFilter = useCallback((next: StatusKey) => {
    setStatusFilterState(next);
    setPage(1);
  }, []);
  const setActivationFilter = useCallback((next: RecapActivationFilter) => {
    setActivationFilterState(next);
    setPage(1);
  }, []);
  const [needsStoreMap, setNeedsStoreMap] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  // Work-queue default: last 30 days for admin AND client. "All published"
  // clears both bounds so the archive is an explicit choice. Clients used
  // to start at month-start, which made the 30d chip look like a lie.
  const [dateFrom, setDateFrom] = useState<string>(initialUrlFilters.from);
  const [dateTo, setDateTo] = useState<string>(initialUrlFilters.to);
  const lastSyncedSearchRef = useRef(searchParams.toString());
  const filterSignature = [
    statusFilter,
    activationFilter,
    search.trim(),
    retailerFilter,
    stateFilter,
    rmmFilter,
    baName.trim(),
    dateFrom,
    dateTo,
  ].join("|");
  const prevFilterSignatureRef = useRef(filterSignature);
  useEffect(() => {
    if (prevFilterSignatureRef.current !== filterSignature) {
      prevFilterSignatureRef.current = filterSignature;
      setPage(1);
    }
  }, [filterSignature]);
  useEffect(() => {
    const incoming = searchParams.toString();
    if (incoming === lastSyncedSearchRef.current) return;
    lastSyncedSearchRef.current = incoming;
    const parsed = readRecapListUrlFilters(searchParams, {
      isClient,
      defaultFrom: DAYS_30_ISO,
      defaultTo: TODAY_ISO,
      weekFrom: DAYS_7_ISO,
    });
    setStatusFilterState(parsed.status);
    setActivationFilterState(parsed.activation);
    setSearch(parsed.q);
    setRetailerFilter(parsed.retailer);
    setStateFilter(parsed.state);
    setRmmFilter(parsed.rmm);
    if (parsed.ba || !baFromNav) setBaName(parsed.ba);
    setDateFrom(parsed.from);
    setDateTo(parsed.to);
    setPage(parsed.page);
    prevFilterSignatureRef.current = [
      parsed.status,
      parsed.activation,
      parsed.q.trim(),
      parsed.retailer,
      parsed.state,
      parsed.rmm,
      (parsed.ba || (!baFromNav ? "" : baName)).trim(),
      parsed.from,
      parsed.to,
    ].join("|");
  }, [searchParams, isClient, baFromNav, baName]);
  useEffect(() => {
    const nextParams = buildRecapListSearchParams({
      isClient,
      status: statusFilter,
      activation: activationFilter,
      q: search,
      retailer: retailerFilter,
      state: stateFilter,
      rmm: rmmFilter,
      ba: baName,
      from: dateFrom,
      to: dateTo,
      page,
      defaultFrom: DAYS_30_ISO,
      defaultTo: TODAY_ISO,
      weekFrom: DAYS_7_ISO,
    });
    const nextStr = nextParams.toString();
    lastSyncedSearchRef.current = nextStr;
    if (nextStr !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    isClient,
    statusFilter,
    activationFilter,
    search,
    retailerFilter,
    stateFilter,
    rmmFilter,
    baName,
    dateFrom,
    dateTo,
    page,
    searchParams,
    setSearchParams,
  ]);
  useEffect(() => {
    if (baFromNav) setBaName(baFromNav);
  }, [baFromNav]);
  const [opsOpen, setOpsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const activeFilterCount =
    Number(retailerFilter !== "all") +
    Number(stateFilter !== "all") +
    Number(rmmFilter !== "all") +
    Number(Boolean(baName.trim())) +
    Number(dateFrom !== DAYS_30_ISO || dateTo !== TODAY_ISO);
  const [reviewNextBusy, setReviewNextBusy] = useState(false);
  const environment = useRelayEnvironment();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  const [meta, setMeta] = useState<Meta>({
    retailers: [],
    states: [],
    baNames: [],
    total: 0,
    filteredTotal: 0,
    loaded: 0,
    hasMore: false,
    loadingMore: false,
    loadMoreError: null,
    totalConsumers: 0,
    totalProducts: 0,
    conversionConsumers: 0,
    conversionProducts: 0,
    conversionDryDemos: 0,
    notInTotals: 0,
  });

  const onMeta = useMemo(() => (next: Meta) => setMeta(next), []);

  const [visibleRecaps, setVisibleRecaps] = useState<Recap[]>([]);
  const [justApprovedIds, setJustApprovedIds] = useState<Set<string>>(
    () => new Set(),
  );

  const returnFilters = useMemo<RecapListReturnFilters>(
    () => ({
      q: search,
      retailer: retailerFilter,
      state: stateFilter,
      rmm: rmmFilter,
      ba: baName,
      from:
        (dateFrom === DAYS_30_ISO || dateFrom === DAYS_7_ISO) &&
        dateTo === TODAY_ISO
          ? ""
          : dateFrom,
      to:
        (dateFrom === DAYS_30_ISO || dateFrom === DAYS_7_ISO) &&
        dateTo === TODAY_ISO
          ? ""
          : dateTo,
      range:
        dateFrom === DAYS_7_ISO && dateTo === TODAY_ISO
          ? "week"
          : !dateFrom && !dateTo
            ? "all"
            : null,
      page,
    }),
    [
      search,
      retailerFilter,
      stateFilter,
      rmmFilter,
      baName,
      dateFrom,
      dateTo,
      page,
    ],
  );

  const currentReturnHref = useMemo(() => {
    const qs = buildRecapListSearchParams({
      isClient,
      status: statusFilter,
      activation: activationFilter,
      q: search,
      retailer: retailerFilter,
      state: stateFilter,
      rmm: rmmFilter,
      ba: baName,
      from: dateFrom,
      to: dateTo,
      page,
      defaultFrom: DAYS_30_ISO,
      defaultTo: TODAY_ISO,
      weekFrom: DAYS_7_ISO,
    }).toString();
    return qs ? `/recaps/list?${qs}` : "/recaps/list";
  }, [
    isClient,
    statusFilter,
    activationFilter,
    search,
    retailerFilter,
    stateFilter,
    rmmFilter,
    baName,
    dateFrom,
    dateTo,
    page,
  ]);

  const queueItems = useMemo(
    () =>
      visibleRecaps
        .filter((r) => !recapIsEmptyShell(r))
        .map((r) => ({
          uuid: r.uuid,
          isCustom: r.kind === "custom",
          href: recapHref(r, statusFilter, activationFilter, returnFilters),
          approved: r.approved || justApprovedIds.has(r.id),
          archived: Boolean(r.archivedAt),
        })),
    [
      visibleRecaps,
      statusFilter,
      activationFilter,
      returnFilters,
      justApprovedIds,
    ],
  );
  const visibleReviewCount = queueItems.filter(
    (item) => !item.approved && !item.archived,
  ).length;

  const flagTargets = useMemo(
    () =>
      visibleRecaps
        .filter(
          (r) =>
            !r.approved &&
            !justApprovedIds.has(r.id) &&
            !recapIsEmptyShell(r),
        )
        .map((r) => ({ id: r.id, kind: r.kind })),
    [visibleRecaps, justApprovedIds],
  );
  const flagsEnabled =
    !isClient &&
    (statusFilter === "needs_review" || statusFilter === "draft");
  const reviewFlagsById = useRecapReviewFlags(flagTargets, flagsEnabled);

  useEffect(() => {
    if (isClient || queueItems.length === 0) return;
    saveRecapReviewQueue({
      items: queueItems,
      returnHref: currentReturnHref,
    });
  }, [isClient, queueItems, currentReturnHref]);

  const handleOpenRecap = useCallback(
    (r: Recap) => {
      if (!isClient && queueItems.length > 0) {
        saveRecapReviewQueue({
          items: queueItems,
          lastOpenedUuid: r.uuid,
          returnHref: currentReturnHref,
        });
      } else {
        markRecapOpenedInQueue(r.uuid);
      }
      if (!isClient) {
        prefetchRecapDetails(
          environment,
          recapQueueWarmTargets(r.uuid).map((item) => ({
            uuid: item.uuid,
            isCustom: item.isCustom,
          })),
        );
      }
    },
    [currentReturnHref, environment, isClient, queueItems],
  );

  const openNextReview = useCallback(async () => {
    if (isClient || !tenantId || reviewNextBusy) return;
    const onNeedsReview =
      statusFilter === "needs_review" || statusFilter === "draft";
    const nextInVisible = pickNextReviewItem(queueItems);
    if (onNeedsReview && nextInVisible) {
      saveRecapReviewQueue({
        items: queueItems,
        lastOpenedUuid: nextInVisible.uuid,
        returnHref: currentReturnHref,
      });
      prefetchRecapDetails(environment, [
        {
          uuid: nextInVisible.uuid,
          isCustom: nextInVisible.isCustom,
        },
        ...recapQueueWarmTargets(nextInVisible.uuid),
      ]);
      navigate(nextInVisible.href);
      return;
    }
    setReviewNextBusy(true);
    try {
      const filters = {
        tenantId: String(tenantId),
        approved: false,
        archived: false,
      };
      const kindsData = await fetchQuery<RecapListKindsQueryType>(
        environment,
        RecapListKindsQuery,
        { tenantId: String(tenantId) },
        { fetchPolicy: "store-or-network" },
      ).toPromise();
      const hasLegacy = Boolean(kindsData?.recapListKinds?.hasLegacy);
      const hasCustom = Boolean(kindsData?.recapListKinds?.hasCustom);
      // Same fallback as idle prefetch: unknown/empty probe → fetch both.
      const fetchLegacy = hasLegacy || (!hasLegacy && !hasCustom);
      const fetchCustom = hasCustom || (!hasLegacy && !hasCustom);
      const { legacy, custom } = await fetchUnifiedRecapsPage(environment, {
        fetchLegacy,
        fetchCustom,
        legacyVariables: { last: 10, filters },
        customVariables: { last: 10, filters },
        fetchPolicy: "network-only",
      });
      const picks: { kind: "legacy" | "custom"; uuid: string; at: string }[] =
        [];
      for (const edge of legacy?.recaps?.edges ?? []) {
        const legacyNode = edge?.node;
        if (legacyNode?.uuid) {
          picks.push({
            kind: "legacy",
            uuid: String(legacyNode.uuid),
            at: legacyNode.createdAt || legacyNode.eventDate || "",
          });
        }
      }
      for (const edge of custom?.customRecaps?.edges ?? []) {
        const customNode = edge?.node;
        if (customNode?.uuid) {
          picks.push({
            kind: "custom",
            uuid: String(customNode.uuid),
            at: customNode.createdAt || customNode.eventDate || "",
          });
        }
      }
      picks.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
      const fetchedQueueItems = picks.map((p) => ({
        uuid: p.uuid,
        isCustom: p.kind === "custom",
        href: reviewRecapPath(p.kind, p.uuid, returnFilters),
        approved: false,
        archived: false,
      }));
      const next = pickNextReviewItem(fetchedQueueItems);
      if (!next) {
        showAlert("Nothing waiting for review.", "info");
        return;
      }
      saveRecapReviewQueue({
        items: fetchedQueueItems,
        lastOpenedUuid: next.uuid,
        returnHref: currentReturnHref,
      });
      prefetchRecapDetails(environment, [
        { uuid: next.uuid, isCustom: next.isCustom },
        ...recapQueueWarmTargets(next.uuid),
      ]);
      navigate(next.href);
    } catch {
      showAlert("Couldn't open the next recap.", "error");
    } finally {
      setReviewNextBusy(false);
    }
  }, [
    currentReturnHref,
    environment,
    isClient,
    navigate,
    queueItems,
    returnFilters,
    reviewNextBusy,
    showAlert,
    statusFilter,
    tenantId,
  ]);

  // Warm the first few Needs-review details so Review next / j-Enter feel instant.
  useEffect(() => {
    if (isClient || !flagsEnabled || queueItems.length === 0) return;
    const head = queueItems
      .filter((item) => !item.approved && !item.archived)
      .slice(0, 3);
    if (head.length === 0) return;
    prefetchRecapDetails(environment, head);
  }, [environment, flagsEnabled, isClient, queueItems]);

  useEffect(() => {
    try {
      localStorage.setItem("spark-recaps-density", density);
    } catch {
      /* ignore */
    }
  }, [density]);

  useEffect(() => {
    if (visibleRecaps.length === 0) {
      if (focusedIdx !== -1) setFocusedIdx(-1);
      return;
    }
    if (focusedIdx >= visibleRecaps.length) setFocusedIdx(visibleRecaps.length - 1);
  }, [visibleRecaps.length, focusedIdx]);

  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        el.isContentEditable
      );
    };
    const onKey = (e: KeyboardEvent) => {
      if (showHelp) {
        if (e.key === "Escape" || e.key === "?") {
          e.preventDefault();
          setShowHelp(false);
        }
        return;
      }
      if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "?" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setShowHelp(true);
        return;
      }
      if (isTypingTarget(e.target)) {
        if (e.key === "Escape" && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }
      if ((e.key === "n" || e.key === "N") && !e.metaKey && !e.ctrlKey && !isClient) {
        e.preventDefault();
        void openNextReview();
        return;
      }
      if (visibleRecaps.length === 0) return;
      const focused = focusedIdx >= 0 ? visibleRecaps[focusedIdx] : null;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(visibleRecaps.length - 1, i + 1 < 0 ? 0 : i + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(0, (i < 0 ? 0 : i) - 1));
      } else if (e.key === "Enter" && focused) {
        e.preventDefault();
        handleOpenRecap(focused);
        navigate(recapHref(focused, statusFilter, activationFilter, returnFilters));
      } else if (e.key === "Escape" && focusedIdx !== -1) {
        e.preventDefault();
        setFocusedIdx(-1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [focusedIdx, handleOpenRecap, isClient, navigate, openNextReview, returnFilters, showHelp, statusFilter, activationFilter, visibleRecaps]);

  // ─── Campaign report multi-select ────────────────────────────
  // Set of recap.id (relay id) the user has ticked. Survives filter
  // changes — kyle can switch retailer, tick a few more, etc. The
  // sticky action bar at the bottom of the page shows the count and
  // fires the Campaign Report mutation.
  // The row is remembered with its id (recapSelection.ts), so a bulk
  // action can still act on a pick the current filter hides — the bar's
  // "N SELECTED" and what the actions touch are always the same set.
  const [selection, setSelection] = useState<Map<string, Recap>>(
    () => new Map(),
  );
  const selectedIds = useMemo(() => new Set(selection.keys()), [selection]);
  const toggleSelected = (id: string) =>
    setSelection((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        const row = visibleRecaps.find((r) => r.id === id);
        if (row) next.set(id, row);
      }
      return next;
    });
  const clearSelection = () => setSelection(new Map());
  // Select-all operates on the recaps currently on screen (loaded +
  // filter-matching), matching how the campaign report reads the
  // selection. Toggles: when everything visible is already ticked it
  // unticks just those rows, leaving off-screen picks intact.
  const allVisibleSelected =
    visibleRecaps.length > 0 &&
    visibleRecaps.every((r) => selectedIds.has(r.id));
  const toggleSelectAllVisible = () =>
    setSelection((prev) => {
      const next = new Map(prev);
      for (const r of visibleRecaps) {
        if (allVisibleSelected) next.delete(r.id);
        else next.set(r.id, r);
      }
      return next;
    });
  // Whether the "Email Report" compose modal is open. Lives at the
  // page level so the sticky bar can both open it and read the same
  // orderedSelectedIds the download button uses.
  const [emailReportOpen, setEmailReportOpen] = useState(false);

  const [commitReport, isGeneratingReport] =
    useMutation<GenerateCampaignReportPdfMutationType>(
      GenerateCampaignReportPdfMutation,
    );
  const [commitBulkApprove, isBulkApproving] =
    useMutation<BulkApproveRecapsMutationType>(BulkApproveRecapsMutation);
  const [commitArchiveRecap] =
    useMutation<ArchiveRecapMutationType>(ArchiveRecapMutation);
  const [commitArchiveCustomRecap] =
    useMutation<ArchiveCustomRecapMutationType>(ArchiveCustomRecapMutation);
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const [approvePhase, setApprovePhase] = useState<ActionPhase>("idle");
  // Detail approve/archive sets refreshRecaps / session flag so we skip
  // store-or-network and drop the row from Needs review without F5.
  const [refreshKey, setRefreshKey] = useState(() => {
    const nav = location.state as RecapsListNavState | null;
    if (nav?.refreshRecaps || consumeRecapsListNeedsRefresh()) return 1;
    return 0;
  });
  // Type chip counts read every other list filter, never the type itself.
  const typeCountVariables = useMemo(
    () =>
      tenantId
        ? {
            q: search.trim() || null,
            filters: {
              ...recapListServerFilters({
                tenantId,
                isClient,
                statusFilter,
                rmmFilter,
                baName,
                retailerFilter,
                stateFilter,
                dateFrom,
                dateTo,
                activationFilter: "all",
              }),
              needsStoreMap: needsStoreMap || null,
            },
          }
        : null,
    [
      tenantId,
      search,
      isClient,
      statusFilter,
      rmmFilter,
      baName,
      retailerFilter,
      stateFilter,
      dateFrom,
      dateTo,
      needsStoreMap,
    ],
  );
  const typeCounts = useRecapTypeCounts(typeCountVariables, refreshKey);
  const typeChips = useMemo(
    () => recapTypeChips(typeCounts, activationFilter),
    [typeCounts, activationFilter],
  );
  const [commitMarkShared, isMarkingShared] =
    useMutation<MarkRecapsSharedMutationType>(MarkRecapsSharedMutation);

  // Every selected recap, on-screen ones first in the order the user sees
  // them (the campaign report's cover order), then picks the current
  // filter hides. All bulk actions read this, so they act on exactly what
  // the bar counts.
  const selectedRecaps = useMemo(
    () => selectedRows(selection, visibleRecaps),
    [selection, visibleRecaps],
  );
  const orderedSelectedIds = useMemo(
    () => selectedRecaps.map((r) => r.id),
    [selectedRecaps],
  );

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

  const selectedByKind = useMemo(
    () => idsByKind(selectedRecaps),
    [selectedRecaps],
  );

  const approveSelected = () => {
    if (selectedIds.size === 0 || isBulkApproving || approvePhase !== "idle") return;
    setApprovePhase("pending");
    // Exactly the selected recaps, on screen or not.
    const targets = selectedRecaps;
    const approvedNow = new Set(targets.map((r) => r.id));
    const requested = targets.length;
    commitBulkApprove({
      variables: {
        input: {
          recapIds: selectedByKind.recapIds,
          customRecapIds: selectedByKind.customRecapIds,
          approved: true,
        },
      },
      onCompleted: (res) => {
        const payload = res.bulkApproveRecaps;
        // The server approves one by one and reports how many it did; a
        // recap it couldn't approve leaves success false with a reason.
        const approvedCount = payload?.updatedCount ?? 0;
        const toast = bulkApproveMessage({
          requested,
          approved: approvedCount,
          singleLabel:
            requested === 1
              ? targets[0]?.retailerName || targets[0]?.name
              : null,
          reason: payload?.message,
        });
        if (payload?.success && approvedCount === requested) {
          showAlert(toast.text, toast.tone);
          setJustApprovedIds(approvedNow);
          setApprovePhase("success");
          void holdActionSuccess().then(() => {
            clearSelection();
            setApprovePhase("idle");
            setJustApprovedIds(new Set());
            setRefreshKey((k) => k + 1);
          });
        } else {
          // Some or none approved: say the true count and why, keep the
          // selection for a retry, and reload so approved rows move on.
          setApprovePhase("idle");
          showAlert(toast.text, toast.tone);
          if (approvedCount > 0) setRefreshKey((k) => k + 1);
        }
      },
      onError: (err) => {
        setApprovePhase("idle");
        showAlert(err.message, "error");
      },
    });
  };

  // Bulk archive — manual ops only (AI never archives). Reuses the detail
  // pages' single-recap mutations sequentially, split by kind: stamps
  // archived_at only, never touches approved, sends no client email.
  // Already-archived rows are skipped by the partition helper.
  const archiveSelected = async () => {
    if (selectedIds.size === 0 || isBulkArchiving) return;
    const targets = partitionRecapsForBulkArchive(selectedRecaps, selectedIds);
    const total = targets.recapIds.length + targets.customRecapIds.length;
    if (total === 0) {
      showAlert("Selected recaps are already archived.", "info");
      return;
    }
    const ok = window.confirm(
      `Archive ${total} recap${total === 1 ? "" : "s"}? They stay on file as proof, leave Needs review, and are hidden from clients. Approval status is unchanged and no client email is sent.`,
    );
    if (!ok) return;
    setIsBulkArchiving(true);
    let okCount = 0;
    const failures: string[] = [];
    const archiveOne = (
      kind: "legacy" | "custom",
      id: string,
    ): Promise<void> =>
      new Promise((resolve) => {
        const done = (success: boolean, message?: string | null) => {
          if (success) okCount += 1;
          else failures.push(message ?? "archive failed");
          resolve();
        };
        if (kind === "custom") {
          commitArchiveCustomRecap({
            variables: { input: { id, reason: null } },
            onCompleted: (res) =>
              done(
                Boolean(res.archiveCustomRecap?.success),
                res.archiveCustomRecap?.message,
              ),
            onError: (err) => done(false, err.message),
          });
        } else {
          commitArchiveRecap({
            variables: { input: { id, reason: null } },
            onCompleted: (res) =>
              done(
                Boolean(res.archiveRecap?.success),
                res.archiveRecap?.message,
              ),
            onError: (err) => done(false, err.message),
          });
        }
      });
    // Sequential like bulk approve in SparkApprovals — avoids hammering API.
    for (const id of targets.recapIds) await archiveOne("legacy", id);
    for (const id of targets.customRecapIds) await archiveOne("custom", id);
    setIsBulkArchiving(false);
    if (okCount > 0) {
      clearSelection();
      setRefreshKey((k) => k + 1);
    }
    if (failures.length === 0) {
      showAlert(
        `Archived ${okCount} recap${okCount === 1 ? "" : "s"} — kept as proof, hidden from clients.`,
        "success",
      );
    } else if (okCount > 0) {
      showAlert(
        `Archived ${okCount}, failed ${failures.length}: ${failures[0]}`,
        "warning",
      );
    } else {
      showAlert(`Archive failed: ${failures[0] ?? "unknown error"}`, "error");
    }
  };

  // Bulk Share / Email modal. The selected Recap objects (every pick,
  // the same set the campaign report exports) feed the
  // modal's list, the copy-links path, and the shareRecapsByEmail
  // mutation.
  const [bulkShareOpen, setBulkShareOpen] = useState(false);
  const selectedShareRecaps = useMemo(
    () =>
      selectedRecaps.map((r) => ({
        id: r.id,
        kind: r.kind,
        name: r.name,
        shareToken: r.shareToken,
      })),
    [selectedRecaps],
  );

  // Copy-links path inside the bulk modal: handing someone the public
  // links IS sharing, so stamp Shared exactly like the old clipboard
  // button did. (The email path stamps shared_at server-side instead.)
  const markSelectedShared = () => {
    commitMarkShared({
      variables: {
        input: {
          recapIds: selectedByKind.recapIds,
          customRecapIds: selectedByKind.customRecapIds,
        },
      },
      onCompleted: (res) => {
        if (!res.markRecapsShared?.success) {
          showAlert(res.markRecapsShared?.message ?? "Couldn't mark shared.", "warning");
        }
      },
    });
  };

  type SavedView = {
    name: string;
    search: string;
    retailerFilter: string;
    stateFilter: string;
    baName: string;
    statusFilter: StatusKey;
    activationFilter: RecapActivationFilter;
    dateFrom: string;
    dateTo: string;
  };
  const viewsKey = `spark.recapFilterViews.${tenantId ?? "none"}`;
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try {
      const raw = localStorage.getItem(viewsKey);
      return raw ? (JSON.parse(raw) as SavedView[]) : [];
    } catch {
      return [];
    }
  });
  const persistViews = (next: SavedView[]) => {
    setSavedViews(next);
    localStorage.setItem(viewsKey, JSON.stringify(next));
  };
  const pinCurrentView = () => {
    const name = window.prompt("Name this filter view (e.g. Girl Beer CA this week)");
    if (!name?.trim()) return;
    persistViews([
      ...savedViews.filter((v) => v.name !== name.trim()),
      {
        name: name.trim(),
        search,
        retailerFilter,
        stateFilter,
        baName,
        statusFilter,
        activationFilter,
        dateFrom,
        dateTo,
      },
    ]);
  };
  const applyView = (v: SavedView) => {
    setSearch(v.search);
    setRetailerFilter(v.retailerFilter);
    setStateFilter(v.stateFilter);
    setBaName(v.baName ?? "");
    setStatusFilter(v.statusFilter);
    setActivationFilter(v.activationFilter ?? "all");
    setDateFrom(v.dateFrom);
    setDateTo(v.dateTo);
  };

  // CSV export of the currently-visible recaps (respects retailer /
  // state / RMM / search filters). Filename includes today's date.
  const exportCsv = () => {
    if (visibleRecaps.length === 0) {
      showAlert("Nothing to export — no recaps match the current filters.", "info");
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
      "Consumers Sampled",
      "Products Sold",
      "Cans Sold",
      "Packs Sold",
      "Account Spend",
      "Conv %",
      "Files",
      "UUID",
    ];
    const lines = [
      header.filter((_, i) => !isClient || i !== BA_NAME_COL).join(","),
    ];
    for (const r of visibleRecaps) {
      const conv = conversionStr(r, "");
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
          r.consumersSampled ?? "",
          r.productsSold ?? "",
          r.cansSold ?? "",
          r.packsSold ?? "",
          r.accountSpendAmount ?? "",
          conv,
          r.fileCount,
          r.uuid,
        ]
          .filter((_, i) => !isClient || i !== BA_NAME_COL)
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
      "Consumers Sampled",
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
    const rows = [
      headers.filter((_, i) => !isClient || i !== BA_NAME_COL).join("\t"),
    ];
    for (const r of visibleRecaps) {
      const conv = conversionStr(r, "");
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
          r.consumersSampled ?? "",
          r.productsSold ?? "",
          r.cansSold ?? "",
          r.packsSold ?? "",
          r.accountSpendAmount ?? "",
          conv,
          r.fileCount,
          r.uuid,
        ]
          .filter((_, i) => !isClient || i !== BA_NAME_COL)
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

  const pipelineKey =
    statusFilter === "draft" ? "needs_review" : statusFilter;
  // "NEEDS REVIEW" → "Needs review": the page reads in sentence case.
  const statusWordRaw = recapListStatusWord(isClient, pipelineKey);
  const statusWord =
    statusWordRaw.charAt(0) + statusWordRaw.slice(1).toLowerCase();
  const windowLabel =
    !dateFrom && !dateTo
      ? `${statusWord} · all time`
      : dateFrom === DAYS_30_ISO && dateTo === TODAY_ISO
        ? `${statusWord} · last 30 days`
        : dateFrom === DAYS_90_ISO && dateTo === TODAY_ISO
          ? `${statusWord} · last 90 days`
          : dateFrom && dateTo
            ? `${statusWord} · ${dateFrom} → ${dateTo}`
            : dateFrom
              ? `${statusWord} · from ${dateFrom}`
              : `${statusWord} · to ${dateTo}`;
  const isQueueDefault =
    !isClient &&
    (statusFilter === "needs_review" || statusFilter === "draft") &&
    dateFrom === DAYS_30_ISO &&
    dateTo === TODAY_ISO &&
    !search.trim() &&
    retailerFilter === "all" &&
    stateFilter === "all" &&
    rmmFilter === "all" &&
    !baName.trim() &&
    activationFilter === "all";
  const datePreset =
    !dateFrom && !dateTo
      ? "all"
      : dateFrom === DAYS_30_ISO && dateTo === TODAY_ISO
        ? "30d"
        : dateFrom === DAYS_90_ISO && dateTo === TODAY_ISO
          ? "90d"
          : "custom";
  const applyDatePreset = (preset: "30d" | "90d" | "all") => {
    if (preset === "all") {
      setDateFrom("");
      setDateTo("");
      return;
    }
    setDateFrom(preset === "90d" ? DAYS_90_ISO : DAYS_30_ISO);
    setDateTo(TODAY_ISO);
  };
  const showAllPublished = () => {
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };
  const clearAllFilters = () => {
    setSearch("");
    setRetailerFilter("all");
    setStateFilter("all");
    setRmmFilter("all");
    setBaName("");
    setStatusFilter(isClient ? "approved" : "all");
    setActivationFilter("all");
    setNeedsStoreMap(false);
    setDateFrom("");
    setDateTo("");
  };
  const filterChips = [
    !isClient && statusFilter !== "all"
      ? {
          key: "status",
          label:
            statusFilter === "needs_review" || statusFilter === "draft"
              ? "Needs review"
              : statusFilter === "approved"
                ? "Approved"
                : statusFilter === "shared"
                  ? "Shared"
                  : statusFilter === "archived"
                    ? "Archived"
                    : "Submitted",
        }
      : null,
    activationFilter !== "all"
      ? {
          key: "activation",
          label: recapActivationFilterLabel(activationFilter),
        }
      : null,
    search.trim() ? { key: "search", label: search.trim() } : null,
    retailerFilter !== "all" ? { key: "client", label: retailerFilter } : null,
    stateFilter !== "all" ? { key: "state", label: stateFilter } : null,
    rmmFilter !== "all" ? { key: "rmm", label: "RMM" } : null,
    baName.trim() ? { key: "ba", label: baName.trim() } : null,
    !isClient && needsStoreMap
      ? { key: "store-map", label: "Map store" }
      : null,
    dateFrom || dateTo
      ? {
          key: "date",
          label:
            dateFrom === DAYS_7_ISO && dateTo === TODAY_ISO
              ? "This week"
              : dateFrom === DAYS_30_ISO && dateTo === TODAY_ISO
                ? "30d"
                : dateFrom === DAYS_90_ISO && dateTo === TODAY_ISO
                  ? "90d"
                  : [dateFrom, dateTo].filter(Boolean).join(" → ") || "Dates",
        }
      : null,
  ].filter((c): c is { key: string; label: string } => Boolean(c));
  const filterStyle: React.CSSProperties = {
    padding: "0.65rem 0.85rem",
    background: "var(--spark-bg)",
    border: "1px solid var(--spark-border)",
    color: "var(--spark-text)",
    outline: "none",
  };

  return (
    <Layout>
      <div className="space-y-3 max-w-7xl spark-fade-in spark-scale">
        <SparkPageHeader
          title="Recaps"
          titleClassName="text-3xl md:text-4xl font-bold"
          support={
            isClient
              ? "Every approved recap from your program — photos, numbers and notes."
              : "Scan, flag-check, approve. Advisory badges never auto-approve."
          }
          action={
            !isClient ? (
              <div className="flex flex-wrap gap-2">
                <SparkGhostButton
                  onClick={() => {
                    window.location.href = "/recap/create";
                  }}
                >
                  + New recap
                </SparkGhostButton>
              </div>
            ) : null
          }
        />
        {tenantId ? (
          <ListSearch list="recaps" tenantId={String(tenantId)} isClient={isClient} />
        ) : null}
        <div
          className="sticky top-0 z-20 spark-sticky-filters flex flex-col"
          style={{
            background: "rgba(var(--spark-bg-rgb),0.94)",
            border: "1px solid rgba(var(--spark-ink-rgb),0.07)",
            borderRadius: 10,
          }}
        >
          <div className="flex flex-wrap gap-2 items-center">
            <div className="min-w-[120px] mr-1 shrink-0">
              <p className="label-mini">Total</p>
              <p
                className="tab-num text-2xl font-bold leading-none mt-0.5"
                style={{ color: "var(--spark-lime)" }}
              >
                <CountReel value={meta.total} />
              </p>
            </div>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search venue, retailer, R-ID…"
              className="rounded-xl text-sm"
              style={{ ...filterStyle, flex: 1, minWidth: 140, maxWidth: 320 }}
            />
            {!isClient && (
              <div
                className="flex rounded-xl overflow-x-auto max-w-full spark-scroll-fade"
                style={{ border: "1px solid var(--spark-border)" }}
              >
                {(
                  [
                    ["needs_review", "Needs review"],
                    ["approved", "Approved"],
                    ["shared", "Shared"],
                    ["archived", "Archived"],
                    ["submitted", "Submitted"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(key)}
                    className="px-2.5 py-2 text-xs font-semibold whitespace-nowrap"
                    style={{
                      background:
                        pipelineKey === key
                          ? "rgba(var(--spark-ok-rgb),0.16)"
                          : "transparent",
                      color:
                        pipelineKey === key
                          ? "var(--spark-lime)"
                          : "rgba(var(--spark-ink-rgb),0.65)",
                    }}
                  >
                    {label}
                    {key === "needs_review" ? (
                      <SidebarTabCount pick="recapsNeedsReview" />
                    ) : null}
                  </button>
                ))}
              </div>
            )}
            {!isClient && (
              <button
                type="button"
                disabled={reviewNextBusy}
                onClick={() => {
                  void openNextReview();
                }}
                className="rounded-xl px-3 py-2 text-xs font-bold shrink-0"
                style={{
                  // Primary action colour. Orange is reserved for warnings.
                  color: "var(--spark-on-accent)",
                  background: "var(--spark-lime)",
                  border: "1px solid var(--spark-lime)",
                  opacity: reviewNextBusy ? 0.6 : 1,
                }}
              >
                {reviewNextBusy
                  ? "Opening…"
                  : `Review next${visibleReviewCount ? ` · ${visibleReviewCount}` : ""}`}
              </button>
            )}
            <RecapTypeChips
              chips={typeChips}
              active={activationFilter}
              onChange={setActivationFilter}
            />
            {/* Phone: collapse density / Jump / Map / Select / Pin / dates / export */}
            {/* Menu anchors to the sticky card, not the button, so it never runs off a phone screen. */}
            <div className="md:hidden">
              <button
                type="button"
                onClick={() => {
                  setOpsOpen(false);
                  setToolsOpen((v) => !v);
                }}
                className="rounded-xl text-xs px-3 py-2 font-semibold"
                style={toolsOpen ? limeBtn : ghostBtn}
                aria-expanded={toolsOpen}
                aria-haspopup="menu"
              >
                More{toolsOpen ? " ▴" : " ▾"}
              </button>
              {toolsOpen && (
                <div
                  className="absolute inset-x-0 top-full mt-2 z-40 flex flex-col gap-1 p-2 rounded-2xl"
                  style={{
                    background: "rgba(var(--spark-bg-rgb),0.98)",
                    border: "1px solid var(--spark-border)",
                    boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
                  }}
                  role="menu"
                >
                  <div
                    className="flex overflow-hidden rounded-xl"
                    style={{ border: "1px solid var(--spark-border)" }}
                  >
                    {(
                      [
                        ["cards", "Cards"],
                        ["compact", "Scan"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setDensity(key)}
                        className="flex-1 px-2.5 py-2 text-xs font-semibold"
                        style={{
                          background:
                            density === key
                              ? "rgba(var(--spark-ok-rgb),0.16)"
                              : "transparent",
                          color:
                            density === key
                              ? "var(--spark-lime)"
                              : "rgba(var(--spark-ink-rgb),0.65)",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      dispatchOpenJump(e.currentTarget);
                      setToolsOpen(false);
                    }}
                    className="px-3 py-2 rounded-xl text-sm font-semibold text-left"
                    style={ghostBtn}
                  >
                    Jump to a recap
                  </button>
                  {!isClient && (
                    <button
                      type="button"
                      onClick={() => setNeedsStoreMap((v) => !v)}
                      className="px-3 py-2 rounded-xl text-sm font-semibold text-left"
                      style={needsStoreMap ? limeBtn : ghostBtn}
                    >
                      Map store
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectMode((v) => !v)}
                    className="px-3 py-2 rounded-xl text-sm font-semibold text-left"
                    style={selectMode ? limeBtn : ghostBtn}
                  >
                    {selectMode ? "Selecting" : "Select"}
                  </button>
                  {!isClient && (
                    <button
                      type="button"
                      onClick={() => {
                        pinCurrentView();
                        setToolsOpen(false);
                      }}
                      className="px-3 py-2 rounded-xl text-sm font-semibold text-left"
                      style={ghostBtn}
                    >
                      Pin view
                    </button>
                  )}
                  {savedViews.length > 0 && (
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const v = savedViews.find(
                          (x) => x.name === e.target.value,
                        );
                        if (v) applyView(v);
                        e.currentTarget.value = "";
                        setToolsOpen(false);
                      }}
                      className="rounded-xl text-sm"
                      style={{ ...filterStyle, maxWidth: "100%" }}
                    >
                      <option value="">Saved views…</option>
                      {savedViews.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {!isClient && missingRecapsOn && (
                    <button
                      type="button"
                      onClick={() => {
                        navigate("/recaps/missing");
                        setToolsOpen(false);
                      }}
                      className="px-3 py-2 rounded-xl text-sm font-semibold text-left"
                      style={ghostBtn}
                    >
                      Missing
                    </button>
                  )}
                  <div
                    className="flex overflow-hidden rounded-xl"
                    style={{ border: "1px solid var(--spark-border)" }}
                  >
                    {(["30d", "90d", "all"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => applyDatePreset(p)}
                        className="flex-1 px-2.5 py-2 text-xs font-semibold"
                        style={{
                          background:
                            datePreset === p
                              ? "rgba(var(--spark-ok-rgb),0.16)"
                              : "transparent",
                          color:
                            datePreset === p
                              ? "var(--spark-lime)"
                              : "rgba(var(--spark-ink-rgb),0.65)",
                        }}
                      >
                        {p === "all" ? "All" : `${parseInt(p, 10)} days`}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      showAllPublished();
                      setToolsOpen(false);
                    }}
                    className="px-3 py-2 rounded-xl text-sm font-semibold text-left"
                    style={ghostBtn}
                  >
                    All published
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setToolsOpen(false);
                      setOpsOpen(true);
                    }}
                    className="px-3 py-2 rounded-xl text-sm font-semibold text-left"
                    style={ghostBtn}
                  >
                    Export / Import…
                  </button>
                </div>
              )}
            </div>
            <RecapTypeChips
              compact
              chips={typeChips}
              active={activationFilter}
              onChange={setActivationFilter}
            />
          </div>

          {/* Desktop: full control strip (unchanged tools, minus status / New which sit above) */}
          <div className="hidden md:flex flex-wrap gap-2 items-center">
            <div
              className="flex overflow-hidden"
              style={{ border: "1px solid var(--spark-border)", borderRadius: 12 }}
            >
              {(
                [
                  ["cards", "Cards"],
                  ["compact", "Scan"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDensity(key)}
                  className="px-2.5 py-2 text-xs font-semibold"
                  style={{
                    background:
                      density === key ? "rgba(var(--spark-ok-rgb),0.16)" : "transparent",
                    color:
                      density === key
                        ? "var(--spark-lime)"
                        : "rgba(var(--spark-ink-rgb),0.65)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={(e) => dispatchOpenJump(e.currentTarget)}
              className="rounded-xl text-xs px-3 py-2 font-semibold"
              style={ghostBtn}
              title="Jump to a recap"
            >
              Jump to a recap
              <span
                className="mono ml-2 text-[10px]"
                style={{ letterSpacing: "0.12em", opacity: 0.65 }}
              >
                ⌘K
              </span>
            </button>
            {!isClient && (
              <button
                type="button"
                onClick={() => setNeedsStoreMap((v) => !v)}
                className="rounded-xl text-xs px-3 py-2 font-semibold"
                style={needsStoreMap ? limeBtn : ghostBtn}
              >
                Map store
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectMode((v) => !v)}
              className="rounded-xl text-xs px-3 py-2 font-semibold"
              style={selectMode ? limeBtn : ghostBtn}
              title="Select multiple recaps for bulk actions"
            >
              {selectMode ? "Selecting" : "Select"}
            </button>
            {!isClient && (
              <button
                type="button"
                onClick={pinCurrentView}
                className="rounded-xl text-xs px-3 py-2 font-semibold"
                style={ghostBtn}
                title="Save the current filters as a named view"
              >
                Pin view
              </button>
            )}
            {savedViews.length > 0 && (
              <select
                defaultValue=""
                onChange={(e) => {
                  const v = savedViews.find((x) => x.name === e.target.value);
                  if (v) applyView(v);
                  e.currentTarget.value = "";
                }}
                className="rounded-xl text-sm"
                style={{ ...filterStyle, maxWidth: 180 }}
              >
                <option value="">Saved views…</option>
                {savedViews.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            )}
            {!isClient && missingRecapsOn && (
              <button
                type="button"
                onClick={() => navigate("/recaps/missing")}
                className="rounded-xl text-xs px-3 py-2 font-semibold"
                style={ghostBtn}
                title="Events in the last 30 days with no recap filed"
              >
                Missing
              </button>
            )}
            <div
              className="flex rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--spark-border)" }}
            >
              {(["30d", "90d", "all"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyDatePreset(p)}
                  className="px-2.5 py-2 text-xs font-semibold"
                  style={{
                    background:
                      datePreset === p ? "rgba(var(--spark-ok-rgb),0.16)" : "transparent",
                    color:
                      datePreset === p
                        ? "var(--spark-lime)"
                        : "rgba(var(--spark-ink-rgb),0.65)",
                  }}
                >
                  {p === "all" ? "All dates" : `${parseInt(p, 10)} days`}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={showAllPublished}
              className="rounded-xl text-xs px-3 py-2 font-semibold"
              style={ghostBtn}
              title="Show every published recap, all dates"
            >
              All published
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setToolsOpen(false);
                  setOpsOpen((v) => !v);
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={ghostBtn}
              >
                Export / Import ▾
              </button>
              {opsOpen && (
                <div
                  className="absolute right-0 top-full mt-2 z-40 flex flex-col gap-1 p-2 min-w-[240px] rounded-2xl"
                  style={{
                    background: "rgba(var(--spark-bg-rgb),0.98)",
                    border: "1px solid var(--spark-border)",
                    boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
                  }}
                >
                  <LinkedSheetChip />
                  <button
                    type="button"
                    onClick={() => {
                      exportCsv();
                      setOpsOpen(false);
                    }}
                    disabled={visibleRecaps.length === 0}
                    className="px-3 py-2 rounded-xl text-sm font-semibold text-left"
                    style={{
                      ...ghostBtn,
                      opacity: visibleRecaps.length === 0 ? 0.5 : 1,
                    }}
                  >
                    ↓ Export CSV
                    {visibleRecaps.length > 0 ? ` (${visibleRecaps.length})` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void copyForSheets();
                      setOpsOpen(false);
                    }}
                    disabled={
                      visibleRecaps.length === 0 || recapCopyState === "copying"
                    }
                    className="px-3 py-2 rounded-xl text-sm font-semibold text-left"
                    style={ghostBtn}
                  >
                    {recapCopyState === "copied"
                      ? `✓ Copied (${visibleRecaps.length})`
                      : "Copy for Sheets"}
                  </button>
                  <ExportReceiptsButton variant="ghost" />
                  <ImportConnecteamButton variant="ghost" />
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = "/imports";
                    }}
                    className="px-3 py-2 rounded-xl text-sm font-semibold text-left"
                    style={ghostBtn}
                  >
                    ↑ Import Provider CSV
                  </button>
                  {!isClient && (
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = "/recaps/templates";
                      }}
                      className="px-3 py-2 rounded-xl text-sm font-semibold text-left"
                      style={ghostBtn}
                    >
                      + Build template
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mobile: Export menu when opened from More */}
          {opsOpen && (
            <div
              className="md:hidden flex flex-col gap-1 p-2 rounded-2xl"
              style={{
                background: "rgba(var(--spark-bg-rgb),0.98)",
                border: "1px solid var(--spark-border)",
              }}
            >
              <div className="flex items-center justify-between px-1 pb-1">
                <span
                  className="mono text-[10px]"
                  style={{ letterSpacing: "0.14em", color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))" }}
                >
                  EXPORT / IMPORT
                </span>
                <button
                  type="button"
                  onClick={() => setOpsOpen(false)}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={ghostBtn}
                >
                  Close
                </button>
              </div>
              <LinkedSheetChip />
              <button
                type="button"
                onClick={() => {
                  exportCsv();
                  setOpsOpen(false);
                }}
                disabled={visibleRecaps.length === 0}
                className="px-3 py-2 rounded-xl text-sm font-semibold text-left"
                style={{
                  ...ghostBtn,
                  opacity: visibleRecaps.length === 0 ? 0.5 : 1,
                }}
              >
                ↓ Export CSV
                {visibleRecaps.length > 0 ? ` (${visibleRecaps.length})` : ""}
              </button>
              <button
                type="button"
                onClick={() => {
                  void copyForSheets();
                  setOpsOpen(false);
                }}
                disabled={
                  visibleRecaps.length === 0 || recapCopyState === "copying"
                }
                className="px-3 py-2 rounded-xl text-sm font-semibold text-left"
                style={ghostBtn}
              >
                {recapCopyState === "copied"
                  ? `✓ Copied (${visibleRecaps.length})`
                  : "Copy for Sheets"}
              </button>
              <ExportReceiptsButton variant="ghost" />
              <ImportConnecteamButton variant="ghost" />
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/imports";
                }}
                className="px-3 py-2 rounded-xl text-sm font-semibold text-left"
                style={ghostBtn}
              >
                ↑ Import Provider CSV
              </button>
              {!isClient && (
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/recaps/templates";
                  }}
                  className="px-3 py-2 rounded-xl text-sm font-semibold text-left"
                  style={ghostBtn}
                >
                  + Build template
                </button>
              )}
            </div>
          )}
          <div
            className="flex items-center gap-2 overflow-x-auto pt-1 spark-scroll-fade"
            aria-label="Current recap filter context"
            style={{ borderTop: "1px solid rgba(var(--spark-ink-rgb),0.07)" }}
          >
            <span
              className="text-[12px] shrink-0"
              style={{ color: "var(--spark-text-meta)" }}
            >
              Showing
            </span>
            <span className="text-[11px] font-semibold whitespace-nowrap">
              {windowLabel}
            </span>
            <span
              className="mono text-[9px] shrink-0"
              style={{ color: "var(--spark-text-meta)" }}
            >
              {meta.filteredTotal} matching
            </span>
            {filterChips.map((chip) => (
              <span
                key={chip.key}
                className="mono text-[9px] px-2 py-1 rounded-full whitespace-nowrap shrink-0"
                style={{
                  letterSpacing: "0.1em",
                  color: "#ef5a2a",
                  background: "rgba(239,90,42,0.10)",
                  border: "1px solid rgba(239,90,42,0.30)",
                }}
              >
                {chip.label}
              </span>
            ))}
            {!isQueueDefault && filterChips.length > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="mono text-[9px] px-2 py-1 rounded-full whitespace-nowrap shrink-0"
                style={{
                  color: "var(--spark-text-secondary)",
                  background: "transparent",
                  border: "1px solid rgba(var(--spark-ink-rgb),0.14)",
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="spark-bento" aria-label="Recap totals in view">
          {demoteEngWhenConvIsLime(
            recapListKpis({
              filteredTotal: meta.filteredTotal,
              loaded: meta.loaded,
              total: meta.total,
              engagements: meta.totalConsumers,
              sold: meta.totalProducts,
              conversionEngagements: meta.conversionConsumers,
              conversionSold: meta.conversionProducts,
              conversionDryDemos: meta.conversionDryDemos,
              notInTotals: meta.notInTotals,
              recapType: activationFilter,
            }),
          ).map((k) => (
            <SparkBentoTile key={k.label} {...k} />
          ))}
        </div>

        <div className="spark-card p-3 flex flex-wrap gap-2 items-center">
          <button
            type="button"
            className="rounded-xl text-sm px-3 py-2 font-semibold"
            style={
              moreFiltersOpen ||
              retailerFilter !== "all" ||
              stateFilter !== "all" ||
              rmmFilter !== "all" ||
              Boolean(baName.trim()) ||
              dateFrom !== DAYS_30_ISO ||
              dateTo !== TODAY_ISO
                ? limeBtn
                : ghostBtn
            }
            aria-expanded={moreFiltersOpen}
            onClick={() => setMoreFiltersOpen((v) => !v)}
          >
            {/* One Filters button on every screen size: retailer, state,
                dates (and the staff-only filters) stay out of the way until
                asked for. The count shows how many are narrowing the list. */}
            Filters
            {activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
            <span aria-hidden> {moreFiltersOpen ? "▴" : "▾"}</span>
          </button>
          <div
            className={`${
              moreFiltersOpen ? "flex" : "hidden"
            } flex-wrap gap-2 items-center w-full`}
          >
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
          {/* Internal filters (regional manager, ambassador name) are for
              Ignite staff; brand users filter by retailer, state and date. */}
          {tenantId && !isClient && (
            <Suspense fallback={null}>
              <RmmFilterDropdown
                tenantId={tenantId}
                value={rmmFilter}
                onChange={setRmmFilter}
              />
            </Suspense>
          )}
          {tenantId && !isClient && (
            <BaNameFilter
              tenantId={tenantId}
              value={baName}
              knownNames={meta.baNames}
              onChange={setBaName}
            />
          )}
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
              colorScheme: inputColorScheme(),
            }}
            title="From date (inclusive)"
            placeholder="From"
          />
          <span style={{ color: "var(--spark-faint, rgba(var(--spark-ink-rgb),0.38))", fontSize: 12 }}>
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
              colorScheme: inputColorScheme(),
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
                color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))",
                border: "1px solid var(--spark-border)",
              }}
              title="Clear date range"
            >
              Clear dates
            </button>
          )}
          </div>
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

        <Suspense fallback={<RecapsListSkeleton />}>
          <RecapsListInner
            search={search}
            retailerFilter={retailerFilter}
            stateFilter={stateFilter}
            rmmFilter={rmmFilter}
            baName={baName}
            statusFilter={statusFilter}
            activationFilter={activationFilter}
            queueEmpty={isQueueDefault}
            dateFrom={dateFrom}
            dateTo={dateTo}
            sortKey={sortKey}
            onMeta={onMeta}
            onVisibleRecapsChange={setVisibleRecaps}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
            selectMode={selectMode}
            filterChips={filterChips}
            onClearFilters={clearAllFilters}
            justApprovedIds={justApprovedIds}
            refreshKey={refreshKey}
            density={density}
            needsStoreMap={needsStoreMap}
            targetPage={page}
            onPageChange={setPage}
            returnFilters={returnFilters}
            onOpenRecap={handleOpenRecap}
            reviewFlagsById={reviewFlagsById}
            focusedId={
              focusedIdx >= 0 ? visibleRecaps[focusedIdx]?.uuid ?? null : null
            }
          />
        </Suspense>

        {meta.total > 0 && meta.loaded > 0 && (
          <div className="flex flex-col items-center gap-2 py-2">
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.16em",
                color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))",
              }}
            >
              Showing {meta.loaded} of {Math.max(meta.total, meta.loaded)}
              {meta.filteredTotal !== meta.loaded
                ? ` · ${meta.filteredTotal} match filters`
                : ""}
              {meta.loadingMore ? " · loading more" : ""}
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
            background: "rgba(var(--spark-bg-rgb),0.95)",
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
              color: "var(--spark-muted, rgba(var(--spark-ink-rgb),0.5))",
            }}
          >
            ✕ CLEAR
          </button>
          <button
            type="button"
            onClick={toggleSelectAllVisible}
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.14em",
              color: "var(--spark-text-secondary)",
            }}
            title="Select / unselect every recap currently on screen"
          >
            {allVisibleSelected ? "☒ UNSELECT ALL" : "☑ SELECT ALL"}
          </button>
          {!isClient && (
            <ActionMorphButton
              phase={approvePhase}
              onClick={approveSelected}
              disabled={isBulkApproving}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={limeBtn}
              pendingLabel="Approving…"
              successLabel="Approved"
            >
              Approve selected
            </ActionMorphButton>
          )}
          {!isClient && (
            <button
              type="button"
              onClick={() => void archiveSelected()}
              disabled={isBulkArchiving || isBulkApproving}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={ghostBtn}
              title="Archive stamps archived_at only — approval is unchanged and no client email is sent"
            >
              {isBulkArchiving ? "Archiving…" : "Archive selected"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setBulkShareOpen(true)}
            disabled={isMarkingShared || selectedShareRecaps.length === 0}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={ghostBtn}
            title="Copy the public links or email them in one digest"
          >
            ↗ Share / Email
          </button>
          {!isClient && (
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
            Email
          </button>
          )}
          {!isClient && (
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
              color: "var(--spark-on-accent)",
            }}
            title={
              selectedIds.size > CAMPAIGN_REPORT_MAX
                ? `Limit is ${CAMPAIGN_REPORT_MAX} recaps per report`
                : "Generate one combined PDF for the selected recaps"
            }
          >
            {isGeneratingReport
              ? `Generating ${selectedIds.size}…`
              : `Download (${selectedIds.size})`}
          </button>
          )}
        </div>
      )}

      {emailReportOpen && (
        <EmailCampaignReportModal
          recapIds={orderedSelectedIds}
          onClose={() => setEmailReportOpen(false)}
          onSent={clearSelection}
        />
      )}

      {bulkShareOpen && selectedShareRecaps.length > 0 && (
        <ShareRecapsBulkModal
          recaps={selectedShareRecaps}
          onClose={() => setBulkShareOpen(false)}
          onSent={() => {
            clearSelection();
            // Re-fetch so the pipeline column shows the Shared stamp
            // the API just wrote.
            setRefreshKey((k) => k + 1);
          }}
          onLinksCopied={markSelectedShared}
        />
      )}

      {showHelp && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center px-4"
          style={{ background: "rgba(var(--spark-bg-rgb),0.62)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowHelp(false)}
        >
          <div
            className="spark-card p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="spark-inset-label">Recaps keys</p>
            <div className="spark-inset-group">
              {[
                ["/", "Focus search"],
                ["n", "Review next"],
                ["j / k", "Move focus"],
                ["Enter", "Open recap"],
                ["?", "This help"],
                ["Esc", "Clear focus"],
              ].map(([key, label]) => (
                <div key={key} className="spark-inset-row justify-between">
                  <span className="text-sm">{label}</span>
                  <span className="mono text-[10px]" style={{ letterSpacing: "0.14em", color: "var(--spark-lime)" }}>
                    {key}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
