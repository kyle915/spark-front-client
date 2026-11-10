import {
  Suspense,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { commitMutation } from "relay-runtime";
import environment from "@/api/relay/environment";
import Layout from "@/layout/Layout";
import { PanelSkeleton } from "@/layout/PageSkeletons";
import SparkEmptyState from "@/shared/SparkEmptyState";
import { useAuthStore } from "@/store/authStore";
import { RecapsListQuery } from "@/api/queries/RecapsListQuery";
import type { RecapsListQuery as RecapsListQueryType } from "@api/queries/__generated__/RecapsListQuery.graphql";
import { CustomRecapsListQuery } from "@/api/queries/CustomRecapsListQuery";
import type { CustomRecapsListQuery as CustomRecapsListQueryType } from "@api/queries/__generated__/CustomRecapsListQuery.graphql";
import { RecapListKindsQuery } from "@/api/queries/RecapListKindsQuery";
import type { RecapListKindsQuery as RecapListKindsQueryType } from "@api/queries/__generated__/RecapListKindsQuery.graphql";
import { RECAPS_PAGE_SIZE } from "@/recap/unifiedRecapsFetch";

const APPROVALS_FIRST = Math.max(200, RECAPS_PAGE_SIZE);

const EMPTY_LEGACY_PAGE: RecapsListQueryType["response"] = {
  recaps: {
    totalCount: 0,
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      endCursor: null,
    },
    edges: [],
  },
};

const EMPTY_CUSTOM_PAGE: CustomRecapsListQueryType["response"] = {
  customRecaps: {
    totalCount: 0,
    pageInfo: {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      endCursor: null,
    },
    edges: [],
  },
};
import { ApproveRecapMutation } from "@/api/mutations/ApproveRecapMutation";
import type { ApproveRecapMutation as ApproveRecapMutationType } from "@api/mutations/__generated__/ApproveRecapMutation.graphql";
import { ApproveCustomRecapMutation } from "@/api/mutations/ApproveCustomRecapMutation";
import type { ApproveCustomRecapMutation as ApproveCustomRecapMutationType } from "@api/mutations/__generated__/ApproveCustomRecapMutation.graphql";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import { ApproveRequestMutation } from "@/api/mutations/ApproveRequestMutation";
import type { ApproveRequestMutation as ApproveRequestMutationType } from "@api/mutations/__generated__/ApproveRequestMutation.graphql";
import { DeclineRequestMutation } from "@/api/mutations/DeclineRequestMutation";
import type { DeclineRequestMutation as DeclineRequestMutationType } from "@api/mutations/__generated__/DeclineRequestMutation.graphql";
import { recapFileUrl } from "@/utils/recapFileUrl";
import { thumbUrl } from "@/utils/thumb";

/**
 * Spark v2 — Client Approvals (/my-approvals).
 *
 * The clean, brand-stakeholder counterpart to the admin `/approvals`
 * ops queue. Where the admin page is the RMM request-approval workload
 * (bulk approve/decline, decline-reason emails to requestors, SLA
 * tracking, "copy queue for Slack"), this page answers one question for
 * a client: "what recaps are still waiting on me?"
 *
 * It lists the client's own recaps that haven't been signed off yet
 * (approved == false), each with the event/recap summary and a
 * "Review" link to the recap detail. No admin ops controls.
 *
 * DATA SCOPE — safe. Both `recaps` and `customRecaps` are tenant-scoped
 * server-side (recaps/queries.py filters `event__tenant_id=tenant_id`),
 * and we pass `useAuthStore().tenantId` — the same id every per-tenant
 * surface resolves — so a client only ever sees their own tenant's
 * recaps. We additionally pass `approved: false` to fetch only the
 * pending pile.
 *
 * ONE-CLICK SIGN-OFF (safe as of the recap-IDOR sweep). approveRecap /
 * approveCustomRecap are now tenant-scoped on the backend: they authorize
 * the caller against the recap's owning tenant (#708) and a cross-tenant
 * id is denied with a non-existence-leaking "not found" (#247). So a
 * client can sign off their OWN recap straight from this list, and a
 * guessed cross-tenant id can neither be approved nor probed. Each row
 * keeps its "Review" link to the detail view; the inline "Approve" adds a
 * two-step confirm so a sign-off (which emails the requestor + mapped RMM
 * the PDF) is never a single stray click. On success the row drops off
 * immediately (the approved=false query also prunes it on its next fetch).
 */

type PendingRecap = {
  kind: "legacy" | "custom";
  id: string;
  uuid: string;
  name: string;
  /** YYYY-MM-DD or ISO; "" when neither event date nor createdAt exist. */
  date: string;
  /** "Venue · City, ST" — best-effort, "—" when unknown. */
  where: string;
  /** "Event Activation" / template name / null. */
  typeLabel: string | null;
  /** Sort key — event date (ms), falling back to createdAt, then 0. */
  sortMs: number;
  heroImage: string | null;
  fileCount: number;
};

const fmtDate = (raw: string | null | undefined): string => {
  if (!raw) return "—";
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

const toMs = (raw: string | null | undefined): number => {
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
};

const joinWhere = (venue: string | null, city: string | null, st: string | null): string => {
  const place = [city, st].filter(Boolean).join(", ");
  const parts = [venue, place].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
};

/* ─────────────────── row ─────────────────── */

const ApprovalRow: React.FC<{
  row: PendingRecap;
  onApproved: (key: string) => void;
  selected: boolean;
  onToggleSelected: (key: string) => void;
}> = ({ row, onApproved, selected, onToggleSelected }) => {
  const reviewTo =
    row.kind === "custom"
      ? `/recap/view-custom/${row.uuid}`
      : `/recap/view/${row.uuid}`;

  // Both hooks are created unconditionally (rules of hooks); we fire the one
  // matching this row's kind. Approval is tenant-scoped server-side (#708)
  // and cross-tenant ids read as "not found" (#247), so this is safe.
  const [commitLegacy, legacyInFlight] =
    useMutation<ApproveRecapMutationType>(ApproveRecapMutation);
  const [commitCustom, customInFlight] =
    useMutation<ApproveCustomRecapMutationType>(ApproveCustomRecapMutation);

  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = legacyInFlight || customInFlight;
  const hasPhotos = Boolean(row.heroImage) || row.fileCount > 0;

  const approve = useCallback(() => {
    setError(null);
    const key = `${row.kind}:${row.id}`;
    const fail = (msg?: string | null) =>
      setError(msg ?? "Couldn't sign off this recap. Please try again.");
    if (row.kind === "custom") {
      commitCustom({
        variables: { input: { id: row.id, approved: true } },
        onCompleted: (res) =>
          res.approveCustomRecap?.success
            ? onApproved(key)
            : fail(res.approveCustomRecap?.message),
        onError: () => fail(),
      });
    } else {
      commitLegacy({
        variables: { input: { id: row.id, approved: true } },
        onCompleted: (res) =>
          res.approveRecap?.success
            ? onApproved(key)
            : fail(res.approveRecap?.message),
        onError: () => fail(),
      });
    }
  }, [row.kind, row.id, commitCustom, commitLegacy, onApproved]);

  return (
    <li
      className="spark-card p-4 flex items-center justify-between gap-4 flex-wrap"
      style={{
        background: "var(--spark-card-bg, rgba(255,255,255,0.02))",
        borderRadius: 14,
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelected(`${row.kind}:${row.id}`)}
        aria-label={`Select ${row.name} for sign-off`}
        className="w-4 h-4 shrink-0"
        style={{ accentColor: "var(--spark-lime)" }}
      />
      {row.heroImage ? (
        <img
          src={row.heroImage}
          alt=""
          className="w-16 h-16 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div
          className="w-16 h-16 rounded-lg shrink-0 flex items-center justify-center mono text-[10px] text-center px-1"
          style={{
            letterSpacing: "0.08em",
            background: "rgba(255,255,255,0.04)",
            border: "1px dashed rgba(255,255,255,0.18)",
            color: "var(--spark-text-meta)",
          }}
        >
          {row.fileCount > 0 ? `${row.fileCount} PHOTOS` : "NO PHOTOS"}
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{row.name}</span>
          <span className="chip chip-orange">AWAITING SIGN-OFF</span>
          {row.typeLabel && (
            <span
              className="mono text-[10px] px-2 py-0.5 rounded-full"
              style={{
                letterSpacing: "0.12em",
                color: "var(--spark-text-secondary)",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {row.typeLabel.toUpperCase()}
            </span>
          )}
        </div>
        <p className="text-[13px] mt-1" style={{ color: "var(--spark-text-meta)" }}>
          {row.where}
          <span style={{ opacity: 0.5 }}> · </span>
          {fmtDate(row.date)}
        </p>
        {error && (
          <p
            className="text-[12px] mt-1.5"
            style={{ color: "var(--spark-danger, #ff7a7a)" }}
            role="alert"
          >
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          to={reviewTo}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "var(--spark-text)",
            textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
          title="Open this recap to review the details"
        >
          Review →
        </Link>

        {confirming ? (
          <>
            <button
              type="button"
              onClick={approve}
              disabled={inFlight}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                border: "none",
                opacity: inFlight ? 0.6 : 1,
                cursor: inFlight ? "default" : "pointer",
              }}
              title="Confirm — this signs off the recap and emails the requestor + RMM"
            >
              {inFlight ? "Signing off…" : "Confirm sign-off"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={inFlight}
              className="px-3 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text-secondary)",
                border: "1px solid rgba(255,255,255,0.14)",
                cursor: inFlight ? "default" : "pointer",
              }}
            >
              Cancel
            </button>
          </>
        ) : hasPhotos ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition"
            style={{
              background: "transparent",
              color: "var(--spark-lime)",
              border: "1px solid var(--spark-lime)",
              cursor: "pointer",
            }}
            title="Review the photos on this row, then confirm"
          >
            Approve
          </button>
        ) : (
          <Link
            to={reviewTo}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition"
            style={{
              background: "transparent",
              color: "var(--spark-lime)",
              textDecoration: "none",
              border: "1px solid var(--spark-lime)",
            }}
            title="Open the recap — there are no photos on this row"
          >
            Review first
          </Link>
        )}
      </div>
    </li>
  );
};

/* ─────────────────── kind-gated dual fetch ─────────────────── */

const ApprovalsLegacyLive: React.FC<{
  variables: RecapsListQueryType["variables"];
  children: (data: RecapsListQueryType["response"]) => ReactNode;
}> = ({ variables, children }) => {
  const data = useLazyLoadQuery<RecapsListQueryType>(
    RecapsListQuery,
    variables,
    { fetchPolicy: "store-and-network" },
  );
  return <>{children(data)}</>;
};

const ApprovalsLegacyGate: React.FC<{
  enabled: boolean;
  variables: RecapsListQueryType["variables"];
  children: (data: RecapsListQueryType["response"]) => ReactNode;
}> = ({ enabled, variables, children }) => {
  if (!enabled) return <>{children(EMPTY_LEGACY_PAGE)}</>;
  return (
    <ApprovalsLegacyLive variables={variables}>{children}</ApprovalsLegacyLive>
  );
};

const ApprovalsCustomLive: React.FC<{
  variables: CustomRecapsListQueryType["variables"];
  children: (data: CustomRecapsListQueryType["response"]) => ReactNode;
}> = ({ variables, children }) => {
  const data = useLazyLoadQuery<CustomRecapsListQueryType>(
    CustomRecapsListQuery,
    variables,
    { fetchPolicy: "store-and-network" },
  );
  return <>{children(data)}</>;
};

const ApprovalsCustomGate: React.FC<{
  enabled: boolean;
  variables: CustomRecapsListQueryType["variables"];
  children: (data: CustomRecapsListQueryType["response"]) => ReactNode;
}> = ({ enabled, variables, children }) => {
  if (!enabled) return <>{children(EMPTY_CUSTOM_PAGE)}</>;
  return (
    <ApprovalsCustomLive variables={variables}>{children}</ApprovalsCustomLive>
  );
};

/* ─────────────────── inner ─────────────────── */

const ClientApprovalsInner: React.FC = () => {
  const { tenantId } = useAuthStore();

  // Rows the client just signed off — hidden immediately for snappy feedback.
  // The approved=false queries also prune them on their next network refresh
  // (store-and-network), so this is belt-and-suspenders, not the only path.
  const [approvedKeys, setApprovedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const handleApproved = useCallback((key: string) => {
    setApprovedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  // Kind gate (same as SparkRecapsList) — skip the unused GraphQL
  // pipeline when the tenant only has legacy or only custom rows.
  const kindsData = useLazyLoadQuery<RecapListKindsQueryType>(
    RecapListKindsQuery,
    { tenantId: tenantId ?? null },
    { fetchPolicy: "store-or-network" },
  );
  const hasLegacy = Boolean(kindsData.recapListKinds?.hasLegacy);
  const hasCustom = Boolean(kindsData.recapListKinds?.hasCustom);
  // Empty probe → still hit both so a brand mid-migration is not blank.
  const enableLegacy = hasLegacy || (!hasLegacy && !hasCustom);
  const enableCustom = hasCustom || (!hasLegacy && !hasCustom);
  const listFilters = tenantId ? { tenantId, approved: false } : null;

  return (
    <ApprovalsLegacyGate
      enabled={enableLegacy}
      variables={{ first: APPROVALS_FIRST, filters: listFilters }}
    >
      {(data) => (
        <ApprovalsCustomGate
          enabled={enableCustom}
          variables={{ first: APPROVALS_FIRST, filters: listFilters }}
        >
          {(customData) => (
            <ClientApprovalsMerged
              data={data}
              customData={customData}
              approvedKeys={approvedKeys}
              onApproved={handleApproved}
            />
          )}
        </ApprovalsCustomGate>
      )}
    </ApprovalsLegacyGate>
  );
};

const ClientApprovalsMerged: React.FC<{
  data: RecapsListQueryType["response"];
  customData: CustomRecapsListQueryType["response"];
  approvedKeys: Set<string>;
  onApproved: (key: string) => void;
}> = ({ data, customData, approvedKeys, onApproved }) => {
  const rows: PendingRecap[] = useMemo(() => {
    const legacy: PendingRecap[] =
      data?.recaps?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          const venue = n.eventRetailer || null;
          const st = n.eventState || null;
          const date = n.eventDate ?? n.createdAt ?? "";
          return {
            kind: "legacy" as const,
            id: String(n.id),
            uuid: String(n.uuid),
            name: n.name ?? "Untitled recap",
            date,
            where: joinWhere(venue, null, st),
            typeLabel: n.requestTypeName ?? null,
            sortMs: toMs(n.eventDate) || toMs(n.createdAt),
            heroImage: n.heroFile?.file
              ? thumbUrl(recapFileUrl(n.heroFile.file), 400)
              : null,
            fileCount: n.recapFilesCount ?? 0,
          };
        }) ?? [];

    const custom: PendingRecap[] =
      customData?.customRecaps?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
        ?.map((n) => {
          const date = n.eventDate ?? n.createdAt ?? "";
          return {
            kind: "custom" as const,
            id: String(n.id),
            uuid: String(n.uuid),
            name:
              n.name ??
              n.customRecapTemplate?.name ??
              "Custom recap",
            date,
            where: joinWhere(
              n.eventRetailer || null,
              n.eventRetailer ? null : (n.eventAddress ?? null),
              n.eventState || null,
            ),
            typeLabel: n.customRecapTemplate?.name ?? null,
            sortMs: toMs(n.eventDate) || toMs(n.createdAt),
            heroImage: n.heroImageUrl ? thumbUrl(n.heroImageUrl, 400) : null,
            fileCount: n.customRecapFilesCount ?? 0,
          };
        }) ?? [];

    return [...legacy, ...custom].sort((a, b) => b.sortMs - a.sortMs);
  }, [data, customData]);

  const visibleRows = useMemo(
    () => rows.filter((r) => !approvedKeys.has(`${r.kind}:${r.id}`)),
    [rows, approvedKeys],
  );

  // Bulk sign-off: tick rows, then confirm once. Each recap is signed off
  // with the same mutation the per-row button uses, one after another, so
  // a failure on one leaves the rest untouched and still selected.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNote, setBulkNote] = useState<string | null>(null);
  const toggleSelected = useCallback((key: string) => {
    setBulkNote(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const selectedRows = useMemo(
    () => visibleRows.filter((r) => selected.has(`${r.kind}:${r.id}`)),
    [visibleRows, selected],
  );
  const allSelected =
    visibleRows.length > 0 && selectedRows.length === visibleRows.length;

  const signOffOne = (row: PendingRecap) =>
    new Promise<boolean>((resolve) => {
      if (row.kind === "custom") {
        commitMutation<ApproveCustomRecapMutationType>(environment, {
          mutation: ApproveCustomRecapMutation,
          variables: { input: { id: row.id, approved: true } },
          onCompleted: (res) => resolve(Boolean(res.approveCustomRecap?.success)),
          onError: () => resolve(false),
        });
      } else {
        commitMutation<ApproveRecapMutationType>(environment, {
          mutation: ApproveRecapMutation,
          variables: { input: { id: row.id, approved: true } },
          onCompleted: (res) => resolve(Boolean(res.approveRecap?.success)),
          onError: () => resolve(false),
        });
      }
    });

  const runBulk = async () => {
    setBulkBusy(true);
    setBulkConfirming(false);
    let failed = 0;
    for (const row of selectedRows) {
      const key = `${row.kind}:${row.id}`;
      const ok = await signOffOne(row);
      if (ok) {
        onApproved(key);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      } else {
        failed += 1;
      }
    }
    setBulkBusy(false);
    setBulkNote(
      failed > 0
        ? `${failed} recap${failed === 1 ? "" : "s"} couldn't be signed off and ${failed === 1 ? "is" : "are"} still selected. Please try again.`
        : null,
    );
  };

  if (visibleRows.length === 0) {
    return (
      <SparkEmptyState
        title="You're all caught up."
        body="Nothing awaiting your approval."
      />
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap mb-3 text-sm">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              setSelected(
                allSelected
                  ? new Set()
                  : new Set(visibleRows.map((r) => `${r.kind}:${r.id}`)),
              )
            }
            className="w-4 h-4"
            style={{ accentColor: "var(--spark-lime)" }}
          />
          Select all ({visibleRows.length})
        </label>
        {selectedRows.length > 0 &&
          (bulkConfirming ? (
            <>
              <span>
                Sign off {selectedRows.length} recap
                {selectedRows.length === 1 ? "" : "s"}? Each one is emailed
                to your team.
              </span>
              <button
                type="button"
                onClick={runBulk}
                className="px-3 py-1.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--spark-lime)", color: "#0a0d09" }}
              >
                Yes, sign off
              </button>
              <button
                type="button"
                onClick={() => setBulkConfirming(false)}
                className="underline"
                style={{ color: "var(--spark-text-secondary)" }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setBulkConfirming(true)}
              disabled={bulkBusy}
              className="px-3 py-1.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              {bulkBusy
                ? "Signing off…"
                : `Sign off selected (${selectedRows.length})`}
            </button>
          ))}
        {bulkNote && (
          <span role="alert" style={{ color: "var(--spark-orange)" }}>
            {bulkNote}
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {visibleRows.map((r) => (
          <ApprovalRow
            key={`${r.kind}:${r.id}`}
            row={r}
            onApproved={onApproved}
            selected={selected.has(`${r.kind}:${r.id}`)}
            onToggleSelected={toggleSelected}
          />
        ))}
      </ul>
    </>
  );
};

/* ═══════════════ requests: pending-approval queue ═══════════════ */
/*
 * The request twin of the recap queue above. This is the surface that was
 * missing: a client RMM had NO in-app list of incoming requests awaiting
 * their approve/decline — the Master Tracker sorts by event date and buries
 * a fresh submission, so the confirmation email was the only reliable path
 * (the REQ-1481 / Liquid Death report). These rows are the same pending
 * requests the sidebar "Approvals" badge already counts, sorted NEWEST-
 * SUBMISSION-FIRST so a just-arrived request is always at the top.
 *
 * SAFE: `requests` is tenant-scoped server-side (resolve_tenant_id forces a
 * client to their own tenant), and approveRequest/declineRequest authorize
 * the caller against the request's tenant (a member may decide, an
 * ambassador may not) — so a client can only ever see + act on their own
 * tenant's requests.
 */

type PendingRequest = {
  id: string;
  uuid: string;
  reqLabel: string; // "REQ-1481"
  venue: string;
  where: string; // "Market, ST"
  date: string; // formatted event date, or ""
  requester: string;
  typeLabel: string;
  createdMs: number; // submission time — the sort key
  pendingHours: number | null;
};

// Relay global ids are base64("TypeName:pk"); decode to the human REQ number
// so the row reads "REQ-1481" (matching the confirmation email). Falls back
// to a short slice when the id isn't a decodable global id.
const reqLabelFromGlobalId = (globalId: string): string => {
  try {
    const decoded = atob(globalId);
    const m = decoded.match(/:(\d+)$/);
    if (m) return `REQ-${m[1]}`;
  } catch {
    /* not base64 — fall through */
  }
  return `REQ-${String(globalId).slice(-4).toUpperCase()}`;
};

const ageLabel = (h: number | null): string | null => {
  if (h === null) return null;
  if (h < 1) return "JUST IN";
  if (h < 24) return `${h}h OLD`;
  const d = Math.floor(h / 24);
  return h >= 72 ? `${d}d OLD · SLA` : `${d}d OLD`;
};

const RequestApprovalRow: React.FC<{
  row: PendingRequest;
  onDecided: (id: string) => void;
}> = ({ row, onDecided }) => {
  const [commitApprove, approving] =
    useMutation<ApproveRequestMutationType>(ApproveRequestMutation);
  const [commitDecline, declining] =
    useMutation<DeclineRequestMutationType>(DeclineRequestMutation);
  const inFlight = approving || declining;

  const [mode, setMode] = useState<null | "approve" | "decline">(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fail = (msg?: string | null) =>
    setError(msg ?? "Something went wrong. Please try again.");

  const approve = useCallback(() => {
    setError(null);
    commitApprove({
      variables: { input: { id: row.id } },
      onCompleted: (res) =>
        res.approveRequest?.success
          ? onDecided(row.id)
          : fail(res.approveRequest?.message),
      onError: () => fail(),
    });
  }, [commitApprove, row.id, onDecided]);

  const decline = useCallback(() => {
    setError(null);
    commitDecline({
      variables: {
        input: { id: row.id, declineReason: reason.trim() || null },
      },
      onCompleted: (res) =>
        res.declineRequest?.success
          ? onDecided(row.id)
          : fail(res.declineRequest?.message),
      onError: () => fail(),
    });
  }, [commitDecline, row.id, reason, onDecided]);

  const age = ageLabel(row.pendingHours);
  const breached = (row.pendingHours ?? 0) >= 72;

  return (
    <li
      className="spark-card p-4"
      style={{
        background: "var(--spark-card-bg, rgba(255,255,255,0.02))",
        borderRadius: 14,
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="mono text-[10px]"
              style={{ letterSpacing: "0.16em", color: "var(--spark-text-meta)" }}
            >
              {row.reqLabel}
            </span>
            <span className="chip chip-sky">NEEDS YOUR APPROVAL</span>
            {age && (
              <span
                className="mono text-[10px] px-2 py-0.5 rounded-md"
                style={{
                  letterSpacing: "0.14em",
                  background: breached
                    ? "rgba(239,90,42,0.16)"
                    : "rgba(255,255,255,0.05)",
                  border: `1px solid ${
                    breached ? "rgba(239,90,42,0.45)" : "rgba(255,255,255,0.12)"
                  }`,
                  color: breached ? "var(--spark-orange)" : "rgba(255,255,255,0.6)",
                }}
              >
                {age}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold mt-1 truncate">{row.venue}</p>
          <p className="text-[13px]" style={{ color: "var(--spark-text-meta)" }}>
            {[row.where, row.date].filter(Boolean).join(" · ") || "—"}
          </p>
          <p
            className="text-[12px] mt-0.5"
            style={{ color: "var(--spark-text-meta)" }}
          >
            {[row.typeLabel, row.requester].filter(Boolean).join(" · ")}
          </p>
          {error && (
            <p
              className="text-[12px] mt-1.5"
              style={{ color: "var(--spark-danger, #ff7a7a)" }}
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0" style={{ minWidth: 150 }}>
          {mode === null && (
            <>
              <button
                type="button"
                onClick={() => setMode("approve")}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-lime)",
                  color: "#0a0d09",
                  border: "none",
                }}
              >
                ✓ Approve
              </button>
              <button
                type="button"
                onClick={() => setMode("decline")}
                className="px-4 py-2 rounded-xl text-sm"
                style={{
                  background: "transparent",
                  color: "var(--spark-orange)",
                  border: "1px solid rgba(239,90,42,0.4)",
                }}
              >
                ✗ Decline
              </button>
              <Link
                to={`/request/view/${row.uuid}`}
                className="px-4 py-2 rounded-xl text-sm text-center"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--spark-text)",
                  textDecoration: "none",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                View →
              </Link>
            </>
          )}
          {mode === "approve" && (
            <>
              <button
                type="button"
                onClick={approve}
                disabled={inFlight}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-lime)",
                  color: "#0a0d09",
                  border: "none",
                  opacity: inFlight ? 0.6 : 1,
                }}
                title="Confirm — approving moves this into scheduling and notifies the team"
              >
                {inFlight ? "Approving…" : "Confirm approve"}
              </button>
              <button
                type="button"
                onClick={() => setMode(null)}
                disabled={inFlight}
                className="px-3 py-2 rounded-xl text-sm"
                style={{
                  background: "transparent",
                  color: "var(--spark-text-secondary)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                Cancel
              </button>
            </>
          )}
          {mode === "decline" && (
            <>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional — emailed to the requestor)"
                rows={2}
                className="text-sm rounded-lg p-2"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--spark-text)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  width: 220,
                }}
              />
              <button
                type="button"
                onClick={decline}
                disabled={inFlight}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-orange)",
                  color: "#0a0d09",
                  border: "none",
                  opacity: inFlight ? 0.6 : 1,
                }}
              >
                {inFlight ? "Declining…" : "Confirm decline"}
              </button>
              <button
                type="button"
                onClick={() => setMode(null)}
                disabled={inFlight}
                className="px-3 py-2 rounded-xl text-sm"
                style={{
                  background: "transparent",
                  color: "var(--spark-text-secondary)",
                  border: "1px solid rgba(255,255,255,0.14)",
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
};

const ClientRequestApprovalsInner: React.FC = () => {
  const { tenantId } = useAuthStore();
  const [decidedIds, setDecidedIds] = useState<Set<string>>(() => new Set());
  const handleDecided = useCallback((id: string) => {
    setDecidedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const data = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    { first: 300, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-and-network" },
  );

  const rows: PendingRequest[] = useMemo(() => {
    const nodes =
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];
    return nodes
      .filter(
        (n) =>
          (n.status?.slug ?? n.status?.name ?? "").toLowerCase() === "pending",
      )
      .map((n) => {
        const market = n.market ?? "";
        const createdMs = n.createdAt ? new Date(n.createdAt).getTime() : 0;
        const pendingHours = createdMs
          ? Math.max(0, Math.round((Date.now() - createdMs) / 3_600_000))
          : null;
        return {
          id: String(n.id),
          uuid: String(n.uuid),
          reqLabel: reqLabelFromGlobalId(String(n.id)),
          venue: n.retailer?.name ?? n.name ?? "—",
          where: market,
          date: n.date ? fmtDate(n.date) : "",
          requester: n.client?.name ?? n.distributor?.name ?? "",
          typeLabel: n.requestType?.name ?? "Activation",
          createdMs,
          pendingHours,
        };
      })
      .sort((a, b) => b.createdMs - a.createdMs); // newest submission first
  }, [data]);

  const visible = useMemo(
    () => rows.filter((r) => !decidedIds.has(r.id)),
    [rows, decidedIds],
  );

  if (visible.length === 0) {
    return (
      <SparkEmptyState
        title="You're all caught up."
        body="No requests awaiting your approval."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {visible.map((r) => (
        <RequestApprovalRow key={r.id} row={r} onDecided={handleDecided} />
      ))}
    </ul>
  );
};

/* ─────────────────── page ─────────────────── */

/**
 * Layout-less body. Mirrors the AccountMapBody / ApprovalsBody pattern
 * so this view can be embedded elsewhere (e.g. a dashboard tab) without
 * nesting `<Layout>` twice. The default export wraps it in `<Layout>`
 * for the standalone `/my-approvals` route.
 */
export const ClientApprovalsBody: React.FC = () => {
  // Two approval stages for a brand stakeholder:
  //  • Requests — incoming activation requests awaiting approve/decline.
  //    This is the front of the funnel and the surface that was missing
  //    (the REQ-1481 report) — so it's the DEFAULT tab.
  //  • Recaps — post-event reports awaiting sign-off (the original page).
  const [tab, setTab] = useState<"requests" | "recaps">("requests");

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header — brand-voice, not SEO keyword stuffing. */}
      <div>
        <p
          className="mono text-[10px]"
          style={{ letterSpacing: "0.18em", color: "var(--spark-text-meta)" }}
        >
          YOUR APPROVALS
        </p>
        <h1
          className="display text-4xl font-bold mt-2"
          style={{ letterSpacing: "-0.04em" }}
        >
          Awaiting your approval.
        </h1>
        <p className="mt-2" style={{ color: "var(--spark-text-meta)" }}>
          {tab === "requests"
            ? "New activation requests submitted for your brand. Approve to move one into scheduling, or decline with a note."
            : "Recaps from your events that are waiting on your sign-off. Open one to review the details and approve it."}
        </p>
      </div>

      {/* Stage toggle. */}
      <div className="flex gap-2">
        {(
          [
            ["requests", "Requests"],
            ["recaps", "Recaps"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition"
            style={{
              background: tab === key ? "var(--spark-lime)" : "transparent",
              color: tab === key ? "#0a0d09" : "var(--spark-text)",
              border:
                tab === key
                  ? "none"
                  : "1px solid var(--spark-border, rgba(255,255,255,0.14))",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <Suspense fallback={<PanelSkeleton label="Loading your approvals" />}>
        {tab === "requests" ? (
          <ClientRequestApprovalsInner />
        ) : (
          <ClientApprovalsInner />
        )}
      </Suspense>
    </div>
  );
};

export default function SparkClientApprovals() {
  return (
    <Layout>
      <ClientApprovalsBody />
    </Layout>
  );
}
