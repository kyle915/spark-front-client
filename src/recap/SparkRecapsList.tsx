import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLazyLoadQuery, useMutation, useRelayEnvironment } from "react-relay/hooks";
import { fetchQuery } from "relay-runtime";
import { Link, useNavigate, useSearchParams } from "react-router";
import Layout from "@/layout/Layout";
import { RecapsListSkeleton } from "@/layout/PageSkeletons";
import { RecapsQuery } from "@/api/queries/RecapsQuery";
import { thumbUrl } from "@/utils/thumb";
import type { RecapsQuery as RecapsQueryType } from "@api/queries/__generated__/RecapsQuery.graphql";
// Pulled in so the unified /recaps view can list CustomRecap rows
// alongside the legacy Recap rows. Without this, custom-template
// tenants (Liquid Death, Borjomi, Girl Beer, …) had their recaps
// invisible on /recaps and only surfaced under /recaps/custom-list
// — Kyle reported Dumbo Market and Austin Psych Fest missing.
import { GetCustomRecapsQuery } from "@/api/queries/CustomRecapsQuery";
import { ThirdPartyRecapBadge } from "@/recap/ThirdPartyRecapBadge";
import type { CustomRecapsQuery as CustomRecapsQueryType } from "@api/queries/__generated__/CustomRecapsQuery.graphql";
import { RmmClientsQuery } from "@/api/queries/RmmClientsQuery";
import type { RmmClientsQuery as RmmClientsQueryType } from "@api/queries/__generated__/RmmClientsQuery.graphql";
import { GenerateCampaignReportPdfMutation } from "@/api/mutations/GenerateCampaignReportPdfMutation";
import type { GenerateCampaignReportPdfMutation as GenerateCampaignReportPdfMutationType } from "@api/mutations/__generated__/GenerateCampaignReportPdfMutation.graphql";
import { BulkApproveRecapsMutation } from "@/api/mutations/BulkApproveRecapsMutation";
import type { BulkApproveRecapsMutation as BulkApproveRecapsMutationType } from "@api/mutations/__generated__/BulkApproveRecapsMutation.graphql";
import { MarkRecapsSharedMutation } from "@/api/mutations/MarkRecapsSharedMutation";
import type { MarkRecapsSharedMutation as MarkRecapsSharedMutationType } from "@api/mutations/__generated__/MarkRecapsSharedMutation.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";
import { recapFileUrl } from "@/utils/recapFileUrl";
import ShareRecapModal from "@/recap/components/ShareRecapModal";
import ShareRecapsBulkModal from "@/recap/components/ShareRecapsBulkModal";
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
  recapReviewStatus,
  type ActionPhase,
} from "@/motion/opsMotion";
import { SparkBentoTile, SparkStat } from "@/shared/SparkStat";
import { recapListKpis } from "@/shared/sparkStat";
import {
  appendUniqueByUuid,
  recapsListPageVariables,
} from "./recapsListPagination";
import {
  defaultRecapStatus,
  recapEmptyKind,
  recapListStatusWord,
  recapMatchesBaName,
  recapMatchesPipeline,
  sharedQueryFilter,
} from "./recapListFilters";
import { BaNameFilter } from "./BaNameFilter";

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
  heroImage: string | null;
  fileCount: number;
  engagements: number | null;
  // Consumers SAMPLED — the conversion base (sold ÷ sampled). Distinct from
  // engagements: a custom recap can carry both a typed total_engagements (286)
  // and a "consumers sampled" field (278), and conversion must use the latter.
  // Null on legacy recaps that don't track a separate sampled count.
  consumersSampled: number | null;
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
  // Filed via the tenant's recap-only / 3rd-party agency check-in link.
  // Distinct from isExternalBa (a write-in name). Drives the list badge.
  isThirdParty: boolean;
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
  shareToken: string | null;
  sharedAt: string | null;
};

// CONV = products sold ÷ consumers SAMPLED (a sampling program's conversion is
// sold-per-person-sampled, NOT sold-per-engagement). Falls back to engagements
// for legacy recaps with no separate sampled count. `empty` is what to show
// when there's no base/sold (— for the card, "" for CSV/TSV cells).
const conversionStr = (
  r: {
    productsSold: number | null;
    consumersSampled: number | null;
    engagements: number | null;
  },
  empty: string,
): string => {
  const base = r.consumersSampled ?? r.engagements;
  if (!base || base <= 0 || !r.productsSold) return empty;
  return `${Math.round((r.productsSold / base) * 100)}%`;
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

const SlaHours: React.FC<{ since: string }> = ({ since }) => {
  const ms = Date.now() - new Date(since).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const hours = ms / 3_600_000;
  const days = hours / 24;
  const label = hours < 24 ? `${Math.max(1, Math.round(hours))}h since event` : `${Math.round(days)}d since event`;
  const color = days > 9 ? "var(--spark-orange)" : hours > 3 ? "#f5c042" : "rgba(255,255,255,0.4)";
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
  color: "#0a0d09",
  boxShadow: "0 0 24px rgba(197,245,70,0.35)",
};

type LegacyRecapNode = RecapsQueryType["response"]["recaps"]["edges"][number]["node"];
type CustomRecapNode =
  CustomRecapsQueryType["response"]["customRecaps"]["edges"][number]["node"];

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
    heroImage: hero,
    fileCount,
    engagements: n.totalEngagements ?? null,
    consumersSampled: null,
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
    shareToken: n.shareToken ?? null,
    sharedAt: n.sharedAt ?? null,
    isThirdParty: false,
    storeMappingStatus: "",
  };
};

const mapCustomRecap = (n: CustomRecapNode): Recap => ({
  kind: "custom" as const,
  id: String(n.id),
  uuid: String(n.uuid),
  name:
    n.name ?? n.event?.name ?? n.customRecapTemplate?.name ?? "Custom recap",
  date: n.eventDate ?? n.event?.date ?? n.createdAt ?? "",
  retailerName: n.eventRetailer || "—",
  stateCode: toStateCode(n.eventState) ?? toStateCode(n.eventAddress),
  approved: Boolean(n.approved),
  heroImage: n.heroImageUrl ?? null,
  fileCount: n.customRecapFilesCount ?? 0,
  engagements: n.totalEngagements ?? n.consumersSampled ?? null,
  consumersSampled: n.consumersSampled ?? null,
  productsSold: n.soldUnits ?? null,
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
  shareToken: n.shareToken ?? null,
  sharedAt: n.sharedAt ?? null,
  isThirdParty: Boolean(n.isThirdParty),
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

const recapIsEmptyShell = (r: Recap): boolean => {
  const hasPhotos = Boolean(r.heroImage) || (r.fileCount ?? 0) > 0;
  const hasMetrics =
    r.engagements != null ||
    r.productsSold != null ||
    r.cansSold != null ||
    r.packsSold != null;
  return !hasPhotos && !hasMetrics;
};

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
}> = ({ recap, href, onOpenRequest, onShare, selected, onToggleSelect, selectMode, showSla, forceApproved }) => {
  const [heroFailed, setHeroFailed] = useState(false);
  const emptyShell = recapIsEmptyShell(recap);
  const approved = recap.approved || Boolean(forceApproved);
  const statusText = emptyShell ? "Not filed" : recapReviewStatus(approved);
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
            outline: "2px solid var(--spark-lime)",
            outlineOffset: 2,
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
        border: "1px solid rgba(255,255,255,0.25)",
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
          accentColor: "var(--spark-lime)",
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
          "radial-gradient(circle at 50% 50%, rgba(197,245,70,0.10), transparent 70%)",
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
          <span className="chip chip-orange">PHOTO FAIL</span>
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
          color: "rgba(255,255,255,0.55)",
        }}
      >
        R-{recap.uuid.slice(-4).toUpperCase()}
      </span>
      <span
        className={`absolute top-2 right-2 chip ${
          emptyShell
            ? ""
            : approved
              ? "chip-lime"
              : "chip-orange"
        }`}
        style={
          emptyShell
            ? {
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "rgba(255,255,255,0.62)",
              }
            : undefined
        }
      >
        ● <StatusMorph value={statusText} />
      </span>
      {recap.isThirdParty ? (
        <span className="absolute bottom-2 left-2">
          <ThirdPartyRecapBadge />
        </span>
      ) : null}
    </div>

    <div className="p-4">
      <p className="font-bold text-sm truncate" title={recap.name}>
        {recap.name}
      </p>
      {recap.isThirdParty ? (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <ThirdPartyRecapBadge />
          {recap.storeMappingStatus === "unmatched" ? (
            <span className="chip chip-orange">Map store</span>
          ) : recap.storeMappingStatus === "mapped" ? (
            <span className="chip chip-muted">Store mapped</span>
          ) : null}
        </div>
      ) : null}
      <p
        className="mono text-[10px] uppercase mt-1 truncate"
        style={{
          letterSpacing: "0.14em",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        {/* BA FIRST. "Who filed this" is the first thing ops asks of a
            recap, and on a walk-in event there's no retailer, so the line
            used to open with a bare em-dash. Retailer is kept but only when
            it's real. */}
        {recap.baName || "Unattributed"}
        {recap.retailerName && recap.retailerName !== "—"
          ? ` · ${recap.retailerName}`
          : ""}
        {recap.stateCode ? ` · ${recap.stateCode}` : ""}
        {recap.date ? ` · ${formatDate(recap.date)}` : ""}
      </p>
      <p
        className="mono text-[10px] mt-1"
        style={{
          letterSpacing: "0.12em",
          color: emptyShell ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.55)",
        }}
      >
        {completeness}
      </p>
      {emptyShell ? (
        <p
          className="text-[12px] mt-1"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          BA clocked out — recap not filed
        </p>
      ) : null}
      {showSla && !emptyShell && recap.date ? <SlaHours since={recap.date} /> : null}

      <div className="relative z-10 flex items-center gap-2 mt-2 flex-wrap">
        {recap.requestUuid && onOpenRequest && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenRequest(recap.requestUuid!);
            }}
            className="mono inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px]"
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
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--spark-border)",
              color: "rgba(255,255,255,0.75)",
            }}
            title="Share the public /r/:token link"
          >
            ↗ SHARE
          </button>
        )}
      </div>

      {!emptyShell ? (
      <div
        className="mt-3 pt-3 grid grid-cols-3 gap-2"
        style={{ borderTop: "1px solid var(--spark-border)" }}
      >
        <SparkStat
          tone="lime"
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
          tone="lime"
          value={conversionStr(recap, "—")}
          label="Conv"
        />
      </div>
      ) : null}
    </div>
  </div>
  );
};

const recapHref = (r: Recap) =>
  r.kind === "custom" ? `/recap/view-custom/${r.uuid}` : `/recap/view/${r.uuid}`;

const RecapCompactRow: React.FC<{
  recap: Recap;
  href: string;
  selected: boolean;
  focused: boolean;
  selectMode: boolean;
  onToggleSelect: () => void;
  forceApproved?: boolean;
}> = ({ recap, href, selected, focused, selectMode, onToggleSelect, forceApproved }) => {
  const [heroFailed, setHeroFailed] = useState(false);
  const emptyShell = recapIsEmptyShell(recap);
  const approved = recap.approved || Boolean(forceApproved);
  const statusText = emptyShell ? "Not filed" : recapReviewStatus(approved);
  return (
    <div
      className="spark-inset-row relative"
      style={{
        minHeight: 48,
        background: focused
          ? "rgba(197,245,70,0.08)"
          : selected
            ? "rgba(197,245,70,0.05)"
            : "transparent",
        outline: focused ? "1px solid rgba(197,245,70,0.45)" : undefined,
        outlineOffset: -1,
      }}
    >
      <Link to={href} aria-label={`Open recap ${recap.name}`} className="absolute inset-0 z-[1]" />
      {(selectMode || selected) && (
        <label
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 cursor-pointer shrink-0"
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            style={{ accentColor: "var(--spark-lime)", width: 14, height: 14 }}
          />
        </label>
      )}
      <div
        className="relative z-10 shrink-0 overflow-hidden"
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "rgba(197,245,70,0.08)",
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
            PHOTO FAIL
          </span>
        ) : (
          <span className="grid place-items-center w-full h-full text-base" aria-hidden>
            ◈
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 relative z-10">
        <p className="text-sm font-semibold truncate">{recap.baName || "Unattributed"}</p>
        {recap.isThirdParty ? (
          <div className="mt-1 flex items-center gap-1 flex-wrap">
            <ThirdPartyRecapBadge compact />
            {recap.storeMappingStatus === "unmatched" ? (
              <span className="chip chip-orange chip-sm">Map store</span>
            ) : null}
          </div>
        ) : null}
        <p
          className="mono text-[10px] truncate"
          style={{ letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)" }}
        >
          {recap.retailerName && recap.retailerName !== "—"
            ? recap.retailerName
            : recap.name}
        </p>
      </div>
      <span
        className={`relative z-10 chip shrink-0 ${
          emptyShell ? "" : approved ? "chip-lime" : "chip-orange"
        }`}
        style={
          emptyShell
            ? {
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "rgba(255,255,255,0.62)",
              }
            : undefined
        }
      >
        {statusText}
      </span>
      <div className="relative z-10 flex items-center gap-3 shrink-0">
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
};

type SortKey = "date-desc" | "date-asc" | "eng-desc" | "sold-desc";
type StatusKey = "submitted" | "needs_review" | "approved" | "shared" | "all" | "draft";

const RecapsListInner: React.FC<{
  search: string;
  retailerFilter: string;
  stateFilter: string;
  rmmFilter: string;
  // Typed BA name. Empty = no filter. Pushed server-side as
  // `ambassadorName` (contains-match on linked BA + external write-in).
  baName: string;
  statusFilter: StatusKey;
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
}> = ({ search, retailerFilter, stateFilter, rmmFilter, baName, statusFilter, dateFrom, dateTo, sortKey, onMeta, onVisibleRecapsChange, selectedIds, onToggleSelected, selectMode, queueEmpty, filterChips, onClearFilters, justApprovedIds, refreshKey, density, focusedId, needsStoreMap }) => {
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
  const pipeline = statusFilter === "draft" ? "needs_review" : statusFilter;
  const approvedFilter = isClient
    ? true
    : pipeline === "approved" || pipeline === "shared"
      ? true
      : pipeline === "needs_review"
        ? false
        : null;
  const retailerName = retailerFilter === "all" ? null : retailerFilter;
  const stateCode = stateFilter === "all" ? null : stateFilter;
  const searchQ = search.trim() || null;
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
  const [baNameQuery, setBaNameQuery] = useState(baName.trim());
  // The recap whose Share modal is open (null = closed). Held here so
  // both the cards grid and the compact list can raise it.
  const [shareTarget, setShareTarget] = useState<Recap | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setBaNameQuery(baName.trim()), 250);
    return () => window.clearTimeout(t);
  }, [baName]);
  const listFilters = useMemo(
    () =>
      tenantId
        ? {
            tenantId,
            rmmAsignedId: rmmFilter === "all" ? null : rmmFilter,
            ambassadorId: null,
            ambassadorName: baNameQuery || null,
            approved: approvedFilter,
            shared: sharedQueryFilter(isClient, pipeline),
            retailerName,
            stateCode,
            startDate,
            endDate,
          }
        : null,
    [
      tenantId,
      rmmFilter,
      baNameQuery,
      approvedFilter,
      isClient,
      pipeline,
      retailerName,
      stateCode,
      startDate,
      endDate,
    ],
  );
  const customListFilters = useMemo(
    () =>
      listFilters
        ? { ...listFilters, needsStoreMap: needsStoreMap || null }
        : null,
    [listFilters, needsStoreMap],
  );
  const page1Vars = recapsListPageVariables(null);
  const environment = useRelayEnvironment();

  // Page 1 only: first:50, after:null. Growing `first` past the API cap
  // (50) re-fetched the same 50 rows, the sentinel stayed in view, and
  // Relay aborted the in-flight request → "Failed to fetch". Later pages
  // use fetchQuery + after:endCursor so this hook never remounts.
  const data = useLazyLoadQuery<RecapsQueryType>(
    RecapsQuery,
    {
      first: page1Vars.first,
      after: page1Vars.after,
      q: searchQ,
      filters: listFilters,
    },
    { fetchPolicy: "store-or-network", fetchKey: refreshKey },
  );

  const customData = useLazyLoadQuery<CustomRecapsQueryType>(
    GetCustomRecapsQuery,
    {
      first: page1Vars.first,
      after: page1Vars.after,
      q: searchQ,
      filters: customListFilters,
    },
    { fetchPolicy: "store-or-network", fetchKey: refreshKey },
  );

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
  const loadingMoreRef = useRef(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  const firstPageKey = [
    refreshKey,
    tenantId ?? "",
    rmmFilter,
    baNameQuery,
    dateFrom,
    dateTo,
    statusFilter,
    retailerFilter,
    stateFilter,
    search,
  ].join("|");

  useEffect(() => {
    setExtraLegacy([]);
    setExtraCustom([]);
    setLoadMoreError(null);
    setLoadingMore(false);
    loadingMoreRef.current = false;
  }, [firstPageKey]);

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
    if (!legacyHasMore && !customHasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);
    const next = recapsListPageVariables;
    try {
      const [legacyPage, customPage] = await Promise.all([
        legacyHasMore
          ? fetchQuery<RecapsQueryType>(environment, RecapsQuery, {
              ...next(legacyAfter),
              q: searchQ,
              filters: listFilters,
            }, { fetchPolicy: "network-only" }).toPromise()
          : Promise.resolve(null),
        customHasMore
          ? fetchQuery<CustomRecapsQueryType>(
              environment,
              GetCustomRecapsQuery,
              {
                ...next(customAfter),
                q: searchQ,
                filters: customListFilters,
              },
              { fetchPolicy: "network-only" },
            ).toPromise()
          : Promise.resolve(null),
      ]);
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
    legacyHasMore,
    customHasMore,
    legacyAfter,
    customAfter,
    searchQ,
    listFilters,
    customListFilters,
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
        justApproved: justApprovedIds.has(r.id),
      });
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
      return matchQ && matchR && matchS && matchBa && matchStatus && matchDate && matchMap;
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
  }, [recaps, search, retailerFilter, stateFilter, baName, statusFilter, dateFrom, dateTo, sortKey, justApprovedIds, isClient, pipeline, needsStoreMap]);

  // We paint every loaded row that matches the client-side filters.
  // Pagination now lives at the FETCH layer (`limit` / "Load more"), so
  // there's no separate client-side display slice — `filtered` is what
  // renders.
  const displayed = filtered;

  const hasMore = legacyHasMore || customHasMore;

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
    const totalConsumers = recaps.reduce((s, r) => s + (r.engagements ?? 0), 0);
    const totalProducts = recaps.reduce((s, r) => s + (r.productsSold ?? 0), 0);
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
      {hasMore && !loadMoreError ? (
        <div ref={loadMoreSentinelRef} className="h-8 w-full" />
      ) : null}
      {loadingMore ? (
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.16em",
            color: "rgba(255,255,255,0.45)",
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
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            {loadMoreError.slice(0, 300)}
          </p>
          <button
            type="button"
            onClick={() => void loadMore()}
            className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--spark-lime)", color: "#0a0d09" }}
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
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        {emptyKind === "queue" ? (
          <>
            <p className="display text-2xl font-bold" style={{ color: "var(--spark-text)" }}>
              You’re caught up.
            </p>
            <p className="mt-2">
              No recaps need review in the last 30 days. Switch to{" "}
              <span className="font-semibold">Submitted</span> to browse
              the full archive.
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
                      background: "rgba(197,245,70,0.10)",
                      border: "1px solid rgba(197,245,70,0.28)",
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
                    color: "#0a0d09",
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
          {displayed.map((r) => (
            <RecapCompactRow
              key={r.uuid}
              recap={r}
              href={recapHref(r)}
              selected={selectedIds.has(r.id)}
              focused={focusedId === r.uuid}
              selectMode={selectMode}
              onToggleSelect={() => onToggleSelected(r.id)}
              forceApproved={justApprovedIds.has(r.id)}
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
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {displayed.map((r) => (
        <RecapCard
          key={r.uuid}
          recap={r}
          selected={selectedIds.has(r.id)}
          onToggleSelect={() => onToggleSelected(r.id)}
          selectMode={selectMode}
          showSla={pipeline === "needs_review"}
          href={recapHref(r)}
          forceApproved={justApprovedIds.has(r.id)}
          onShare={setShareTarget}
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

export default function SparkRecapsList() {
  const { tenantId } = useAuthStore();
  const { isClient } = useSparkRole();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const statusFromUrl = searchParams.get("status");
  const rangeFromUrl = searchParams.get("range");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [density, setDensity] = useState<"cards" | "compact">(() => {
    try {
      return localStorage.getItem("spark-recaps-density") === "compact"
        ? "compact"
        : "cards";
    } catch {
      return "cards";
    }
  });
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);
  const [retailerFilter, setRetailerFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [rmmFilter, setRmmFilter] = useState("all");
  const [baName, setBaName] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>(() =>
    defaultRecapStatus(isClient, statusFromUrl),
  );
  const [needsStoreMap, setNeedsStoreMap] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  // Work-queue default: last 30 days for admin AND client. "All published"
  // clears both bounds so the archive is an explicit choice. Clients used
  // to start at month-start, which made the 30d chip look like a lie.
  const [dateFrom, setDateFrom] = useState<string>(() => {
    if (rangeFromUrl === "week") return DAYS_7_ISO;
    return DAYS_30_ISO;
  });
  const [dateTo, setDateTo] = useState<string>(TODAY_ISO);
  useEffect(() => {
    const status = searchParams.get("status");
    if (status) {
      setStatusFilter(defaultRecapStatus(isClient, status));
    } else if (isClient) {
      setStatusFilter((s) =>
        s === "all" || s === "approved" ? s : "approved",
      );
    }
    if (searchParams.get("range") === "week") {
      setDateFrom(DAYS_7_ISO);
      setDateTo(TODAY_ISO);
    }
  }, [searchParams, isClient]);
  const [opsOpen, setOpsOpen] = useState(false);
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
  });

  const onMeta = useMemo(() => (next: Meta) => setMeta(next), []);

  const [visibleRecaps, setVisibleRecaps] = useState<Recap[]>([]);

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
        navigate(recapHref(focused));
      } else if (e.key === "Escape" && focusedIdx !== -1) {
        e.preventDefault();
        setFocusedIdx(-1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [focusedIdx, navigate, showHelp, visibleRecaps]);

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
  // Select-all operates on the recaps currently on screen (loaded +
  // filter-matching), matching how the campaign report reads the
  // selection. Toggles: when everything visible is already ticked it
  // unticks just those rows, leaving off-screen picks intact.
  const allVisibleSelected =
    visibleRecaps.length > 0 &&
    visibleRecaps.every((r) => selectedIds.has(r.id));
  const toggleSelectAllVisible = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const r of visibleRecaps) {
        if (allVisibleSelected) next.delete(r.id);
        else next.add(r.id);
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
  const [approvePhase, setApprovePhase] = useState<ActionPhase>("idle");
  const [justApprovedIds, setJustApprovedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [commitMarkShared, isMarkingShared] =
    useMutation<MarkRecapsSharedMutationType>(MarkRecapsSharedMutation);

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

  const selectedByKind = useMemo(() => {
    const recapIds: string[] = [];
    const customRecapIds: string[] = [];
    for (const r of visibleRecaps) {
      if (!selectedIds.has(r.id)) continue;
      if (r.kind === "custom") customRecapIds.push(r.id);
      else recapIds.push(r.id);
    }
    return { recapIds, customRecapIds };
  }, [visibleRecaps, selectedIds]);

  const approveSelected = () => {
    if (selectedIds.size === 0 || isBulkApproving || approvePhase !== "idle") return;
    setApprovePhase("pending");
    const approvedNow = new Set(selectedIds);
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
        if (payload?.success) {
          const names = visibleRecaps
            .filter((r) => approvedNow.has(r.id))
            .map((r) => r.retailerName || r.name)
            .filter(Boolean);
          const copy =
            names.length === 1
              ? `Approved · ${names[0]}`
              : `Approved · ${approvedNow.size}`;
          showAlert(copy, "success");
          setJustApprovedIds(approvedNow);
          setApprovePhase("success");
          void holdActionSuccess().then(() => {
            clearSelection();
            setApprovePhase("idle");
            setJustApprovedIds(new Set());
            setRefreshKey((k) => k + 1);
          });
        } else {
          setApprovePhase("idle");
          showAlert(payload?.message ?? "Bulk approve failed.", "error");
        }
      },
      onError: (err) => {
        setApprovePhase("idle");
        showAlert(err.message, "error");
      },
    });
  };

  // Bulk Share / Email modal. The selected Recap objects (visible ∩
  // selected — the same set the campaign report exports) feed the
  // modal's list, the copy-links path, and the shareRecapsByEmail
  // mutation.
  const [bulkShareOpen, setBulkShareOpen] = useState(false);
  const selectedShareRecaps = useMemo(
    () =>
      visibleRecaps
        .filter((r) => selectedIds.has(r.id))
        .map((r) => ({
          id: r.id,
          kind: r.kind,
          name: r.name,
          shareToken: r.shareToken,
        })),
    [visibleRecaps, selectedIds],
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
    setDateFrom(v.dateFrom);
    setDateTo(v.dateTo);
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
      "Consumers Sampled",
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
    const rows = [headers.join("\t")];
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
  const statusWord = recapListStatusWord(isClient, pipelineKey);
  const windowLabel =
    !dateFrom && !dateTo
      ? `${statusWord} · ALL TIME`
      : dateFrom === DAYS_30_ISO && dateTo === TODAY_ISO
        ? `${statusWord} · 30D`
        : dateFrom === DAYS_90_ISO && dateTo === TODAY_ISO
          ? `${statusWord} · 90D`
          : dateFrom && dateTo
            ? `${statusWord} · ${dateFrom} → ${dateTo}`
            : dateFrom
              ? `${statusWord} · FROM ${dateFrom}`
              : `${statusWord} · TO ${dateTo}`;
  const isQueueDefault =
    !isClient &&
    (statusFilter === "needs_review" || statusFilter === "draft") &&
    dateFrom === DAYS_30_ISO &&
    dateTo === TODAY_ISO &&
    !search.trim() &&
    retailerFilter === "all" &&
    stateFilter === "all" &&
    rmmFilter === "all" &&
    !baName.trim();
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
                  : "Submitted",
        }
      : null,
    search.trim() ? { key: "search", label: search.trim() } : null,
    retailerFilter !== "all" ? { key: "client", label: retailerFilter } : null,
    stateFilter !== "all" ? { key: "state", label: stateFilter } : null,
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
      <div className="space-y-4 max-w-7xl">
        <div
          className="sticky top-0 z-20 spark-card p-3 flex flex-wrap gap-2 items-center"
          style={{
            background: "rgba(10,13,9,0.92)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div className="min-w-[140px] mr-1">
            <p
              className="mono text-[10px]"
              style={{ letterSpacing: "0.16em", color: "rgba(255,255,255,0.45)" }}
            >
              RECAPS · {windowLabel}
            </p>
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
            style={{ ...filterStyle, flex: 1, minWidth: 180, maxWidth: 260 }}
          />
          <div
            className="flex overflow-hidden"
            style={{ border: "1px solid var(--spark-border)", borderRadius: 12 }}
          >
            {([
              ["cards", "Cards"],
              ["compact", "Scan"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setDensity(key)}
                className="px-2.5 py-2 text-xs font-semibold"
                style={{
                  background:
                    density === key ? "rgba(197,245,70,0.16)" : "transparent",
                  color:
                    density === key
                      ? "var(--spark-lime)"
                      : "rgba(255,255,255,0.65)",
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
            <span className="mono ml-2 text-[10px]" style={{ letterSpacing: "0.12em", opacity: 0.65 }}>
              ⌘K
            </span>
          </button>
          {!isClient && (
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--spark-border)" }}>
            {([
              ["needs_review", "Needs review"],
              ["approved", "Approved"],
              ["shared", "Shared"],
              ["submitted", "Submitted"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className="px-2.5 py-2 text-xs font-semibold"
                style={{
                  background:
                    pipelineKey === key ? "rgba(197,245,70,0.16)" : "transparent",
                  color:
                    pipelineKey === key
                      ? "var(--spark-lime)"
                      : "rgba(255,255,255,0.65)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          )}
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
          {!isClient && (
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
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--spark-border)" }}>
            {(["30d", "90d", "all"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => applyDatePreset(p)}
                className="px-2.5 py-2 text-xs font-semibold"
                style={{
                  background:
                    datePreset === p ? "rgba(197,245,70,0.16)" : "transparent",
                  color:
                    datePreset === p
                      ? "var(--spark-lime)"
                      : "rgba(255,255,255,0.65)",
                }}
              >
                {p === "all" ? "All dates" : p.toUpperCase()}
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
              onClick={() => setOpsOpen((v) => !v)}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={ghostBtn}
            >
              Export / Import ▾
            </button>
            {opsOpen && (
              <div
                className="absolute right-0 top-full mt-2 z-40 flex flex-col gap-1 p-2 min-w-[240px] rounded-2xl"
                style={{
                  background: "rgba(10,13,9,0.98)",
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
                  style={{ ...ghostBtn, opacity: visibleRecaps.length === 0 ? 0.5 : 1 }}
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
          {!isClient && (
            <button
              type="button"
              onClick={() => {
                window.location.href = "/recap/create";
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={limeBtn}
            >
              + New recap
            </button>
          )}
        </div>

        <div className="spark-bento" aria-label="Recap totals in view">
          {recapListKpis({
            filteredTotal: meta.filteredTotal,
            loaded: meta.loaded,
            total: meta.total,
            engagements: meta.totalConsumers,
            sold: meta.totalProducts,
          }).map((k) => (
            <SparkBentoTile key={k.label} {...k} />
          ))}
        </div>

        <div className="spark-card p-3 flex flex-wrap gap-2 items-center">
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
          {filterChips.length > 0 && !isQueueDefault && (
            <div className="flex flex-wrap gap-2 items-center w-full">
              {filterChips.map((chip) => (
                <span
                  key={chip.key}
                  className="mono text-[10px] px-2.5 py-1.5 rounded-full"
                  style={{
                    letterSpacing: "0.12em",
                    color: "var(--spark-lime)",
                    background: "rgba(197,245,70,0.10)",
                    border: "1px solid rgba(197,245,70,0.28)",
                  }}
                >
                  {chip.label}
                </span>
              ))}
              <button
                type="button"
                onClick={clearAllFilters}
                className="mono text-[10px] px-2.5 py-1.5 rounded-full font-semibold"
                style={{
                  letterSpacing: "0.12em",
                  color: "rgba(255,255,255,0.7)",
                  background: "transparent",
                  border: "1px solid var(--spark-border)",
                }}
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        <Suspense fallback={<RecapsListSkeleton />}>
          <RecapsListInner
            search={search}
            retailerFilter={retailerFilter}
            stateFilter={stateFilter}
            rmmFilter={rmmFilter}
            baName={baName}
            statusFilter={statusFilter}
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
                color: "rgba(255,255,255,0.45)",
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
            onClick={toggleSelectAllVisible}
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.75)",
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
            ✉ Email
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
          style={{ background: "rgba(10,13,9,0.62)", backdropFilter: "blur(8px)" }}
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
