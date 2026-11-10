import { Component, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { fetchQuery, useLazyLoadQuery, useRelayEnvironment } from "react-relay/hooks";
import type { IEnvironment } from "relay-runtime";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { ApprovalsListQuery } from "@/api/queries/ApprovalsListQuery";
import type {
  ApprovalsListQuery as ApprovalsListQueryType,
  ApprovalsListQuery$variables,
} from "@api/queries/__generated__/ApprovalsListQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";
import { refreshSidebarCounts } from "@/hooks/useSidebarCounts";
import SparkEmptyState from "@/shared/SparkEmptyState";
import SparkOverlay from "@/shared/SparkOverlay";
import SparkPageHeader from "@/shared/SparkPageHeader";
import { CountReel } from "@/motion/CountReel";

/**
 * Spark v2 — Approvals.
 * Wireframe: spark-demo/index.html lines 987-1026 + approvalRow helper.
 */

const formatDate = (raw: string | null | undefined) => {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return raw;
  }
};

type Row = {
  id: string;
  uuid: string;
  reqId: string;
  venue: string;
  locationDate: string;
  requester: string;
  type: string;
  source: "external" | "internal";
  statusNote: string;
  /** Hours the request has been sitting in pending. */
  pendingHours: number | null;
};

async function callApprovalMutation(
  mutation: "approveRequest" | "declineRequest",
  variables: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  const inputType =
    mutation === "approveRequest" ? "ApproveRequestInput" : "DeclineRequestInput";
  const body = JSON.stringify({
    query: `
      mutation Run($input: ${inputType}!) {
        ${mutation}(input: $input) {
          success
          message
        }
      }
    `,
    variables,
  });
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
    },
    body,
  });
  const json = await res.json();
  if (json.errors?.length) {
    return {
      success: false,
      message: json.errors.map((e: { message: string }) => e.message).join("; "),
    };
  }
  const r = json?.data?.[mutation] ?? { success: false, message: "Unknown error." };
  return { success: !!r.success, message: r.message ?? "" };
}

/* ─────────────────── row ─────────────────── */

const ApprovalRow: React.FC<{
  row: Row;
  onView: () => void;
  onApprove: () => void;
  onDecline: () => void;
  onToggleSelect: () => void;
  onFocus: () => void;
  selected: boolean;
  focused: boolean;
  busy: boolean;
  zebra: boolean;
}> = ({
  row,
  onView,
  onApprove,
  onDecline,
  onToggleSelect,
  onFocus,
  selected,
  focused,
  busy,
  zebra,
}) => {
  const sourceChip =
    row.source === "external" ? (
      <span className="chip chip-sky">EXTERNAL · NEEDS CLIENT APPROVAL</span>
    ) : (
      <span className="chip chip-lime">INTERNAL · AUTO-APPROVED</span>
    );

  // Age chip — friendly relative label, colored by SLA breach.
  // <24h = subtle, 24–72h = gold, >72h = orange. None when we can't
  // tell (no createdAt).
  const ageChip = (() => {
    const h = row.pendingHours;
    if (h === null) return null;
    let label: string;
    if (h < 1) label = "JUST IN";
    else if (h < 24) label = `${h}h OLD`;
    else if (h < 72) label = `${Math.floor(h / 24)}d OLD`;
    else label = `${Math.floor(h / 24)}d OLD · SLA BREACH`;
    const tone =
      h >= 72
        ? { bg: "rgba(239,90,42,0.16)", border: "rgba(239,90,42,0.45)", fg: "var(--spark-orange)" }
        : h >= 24
          ? { bg: "rgba(214,196,95,0.14)", border: "rgba(214,196,95,0.4)", fg: "var(--spark-gold)" }
          : { bg: "rgba(255,255,255,0.04)", border: "var(--spark-hairline, rgba(255,255,255,0.08))", fg: "var(--spark-muted, rgba(255,255,255,0.5))" };
    return (
      <span
        className="mono text-[10px] px-2 py-0.5 rounded-md"
        style={{
          letterSpacing: "0.14em",
          background: tone.bg,
          border: `1px solid ${tone.border}`,
          color: tone.fg,
        }}
      >
        {label}
      </span>
    );
  })();
  const rowPad = "0.4rem 0.75rem";
  const actionPad = "px-2.5 py-1 text-xs";
  return (
    <div
      onClick={onFocus}
      className={
        selected
          ? "spark-row-selected cursor-pointer transition-colors"
          : focused
            ? "cursor-pointer transition-colors bg-[rgba(95,184,239,0.08)]"
            : zebra
              ? "cursor-pointer transition-colors bg-white/[0.035] hover:bg-white/[0.08]"
              : "cursor-pointer transition-colors hover:bg-white/[0.08]"
      }
      style={{
        borderBottom: "1px solid var(--spark-border)",
        outline: selected
          ? "2px solid rgba(239,90,42,0.65)"
          : focused
            ? "2px solid var(--spark-sky)"
            : "none",
        outlineOffset: -1,
        padding: rowPad,
      }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-wrap">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 shrink-0 cursor-pointer accent-[var(--spark-lime)]"
          aria-label={`Select ${row.reqId}`}
        />
        <span
          className="mono text-[10px] shrink-0"
          style={{
            letterSpacing: "0.14em",
            color: "var(--spark-muted, rgba(255,255,255,0.5))",
          }}
        >
          {row.reqId}
        </span>
        <p
          className="font-semibold truncate min-w-0 text-sm"
          style={{ flex: "1 1 140px" }}
        >
          {row.venue}
        </p>
        <span
          className="text-xs truncate hidden md:inline"
          style={{ color: "var(--spark-text-meta)", maxWidth: 220 }}
        >
          {row.locationDate}
        </span>
        <span
          className="text-xs shrink-0 hidden lg:inline"
          style={{ color: "var(--spark-muted, rgba(255,255,255,0.5))" }}
        >
          {row.type}
        </span>
        {ageChip}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            onClick={onApprove}
            disabled={busy}
            className={`${actionPad} rounded-lg font-semibold`}
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              opacity: busy ? 0.5 : 1,
            }}
          >
            ✓ Approve
          </button>
          <button
            onClick={onDecline}
            disabled={busy}
            className={`${actionPad} rounded-lg transition`}
            style={{
              background: "transparent",
              color: "var(--spark-orange)",
              border: "1px solid rgba(239,90,42,0.4)",
              opacity: busy ? 0.5 : 1,
            }}
          >
            ✗ Decline
          </button>
          <button
            onClick={onView}
            className={`${actionPad} rounded-lg transition`}
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            View
          </button>
        </div>
      </div>
      {focused ? (
        <div className="mt-3 pl-7 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {sourceChip}
          </div>
          <p className="text-sm" style={{ color: "var(--spark-text-secondary)" }}>
            {row.locationDate}
          </p>
          <p
            className="text-xs"
            style={{ color: "var(--spark-muted, rgba(255,255,255,0.5))" }}
          >
            {row.type} · {row.requester}
          </p>
          <p
            className="mono text-[10px]"
            style={{ letterSpacing: "0.14em", color: "var(--spark-gold)" }}
          >
            {row.statusNote.toUpperCase()}
          </p>
        </div>
      ) : null}
    </div>
  );
};

/* ─────────────────── data ─────────────────── */

/** "queue" is Queue for Ignite: also awaiting approval (the sidebar badge counts both). */
const AWAITING_SLUGS = ["pending", "queue"];

const isAwaiting = (status: { slug?: string | null; name?: string | null } | null | undefined): boolean =>
  AWAITING_SLUGS.includes((status?.slug ?? status?.name ?? "").toLowerCase());

/**
 * The queue gets its own fetch: sharing one capped, furthest-date-first page
 * with approved/declined rows let a long upcoming schedule push pending
 * requests off the end.
 */
const queueVariables = (tenantId: string | null | undefined): ApprovalsListQuery$variables => ({
  first: 300,
  filters: tenantId ? { tenantId, statusSlugs: AWAITING_SLUGS } : { statusSlugs: AWAITING_SLUGS },
});

const decidedVariables = (tenantId: string | null | undefined): ApprovalsListQuery$variables => ({
  first: 300,
  filters: tenantId
    ? { tenantId, statusSlugs: ["approved", "declined"] }
    : { statusSlugs: ["approved", "declined"] },
});

const copyQueueVariables = (tenantId: string | null | undefined): ApprovalsListQuery$variables => ({
  first: 100,
  filters: tenantId ? { tenantId, statusSlugs: AWAITING_SLUGS } : { statusSlugs: AWAITING_SLUGS },
});

/**
 * Approve/decline go through a raw fetch, so the Relay store never learns the
 * status changed. Re-pull every query that renders pending state so header
 * stats, recently-decided, the copy button and the sidebar badge stay honest
 * (and a remount doesn't resurrect decided rows from the cache).
 */
function refreshAfterDecision(
  environment: IEnvironment,
  tenantId: string | null | undefined,
): void {
  for (const variables of [
    queueVariables(tenantId),
    decidedVariables(tenantId),
    copyQueueVariables(tenantId),
  ]) {
    fetchQuery<ApprovalsListQueryType>(environment, ApprovalsListQuery, variables)
      .toPromise()
      .catch(() => undefined);
  }
  void refreshSidebarCounts(environment, tenantId);
}

/* ─────────────────── inner ─────────────────── */

const ApprovalsInner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const environment = useRelayEnvironment();
  const queueData = useLazyLoadQuery<ApprovalsListQueryType>(
    ApprovalsListQuery,
    queueVariables(tenantId),
    { fetchPolicy: "store-or-network" },
  );
  const decidedData = useLazyLoadQuery<ApprovalsListQueryType>(
    ApprovalsListQuery,
    decidedVariables(tenantId),
    { fetchPolicy: "store-or-network" },
  );

  const { pendingRows, recentlyDecided, stats } = useMemo(() => {
    const seen = new Set<string>();
    const allNodes = [...(queueData?.requests?.edges ?? []), ...(decidedData?.requests?.edges ?? [])]
      .map((e) => e?.node)
      .filter((n): n is NonNullable<typeof n> => {
        if (!n || seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      });

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let pending = 0;
    let approvedLast30 = 0;
    let declinedLast30 = 0;
    let withinSlaCount = 0;
    let decidedCount = 0;
    const slaMs = 24 * 60 * 60 * 1000; // 24h decision SLA

    const pendingNodes = [] as typeof allNodes;
    const decidedRecent: { n: (typeof allNodes)[number]; slug: string; updated: number }[] = [];

    for (const n of allNodes) {
      const slug = (n.status?.slug ?? n.status?.name ?? "").toLowerCase();
      if (isAwaiting(n.status)) {
        pending += 1;
        pendingNodes.push(n);
        continue;
      }
      const updated = n.updatedAt ? new Date(n.updatedAt).getTime() : NaN;
      const created = n.createdAt ? new Date(n.createdAt).getTime() : NaN;
      const recent = Number.isFinite(updated) && updated >= thirtyDaysAgo;
      if (slug === "approved") {
        if (recent) approvedLast30 += 1;
        if (Number.isFinite(updated) && Number.isFinite(created)) {
          decidedCount += 1;
          if (updated - created <= slaMs) withinSlaCount += 1;
        }
        if (
          Number.isFinite(updated) &&
          Number.isFinite(created) &&
          updated >= sevenDaysAgo &&
          updated - created > 5_000 // skip auto-approves
        ) {
          decidedRecent.push({ n, slug, updated });
        }
      } else if (slug === "declined") {
        if (recent) declinedLast30 += 1;
        if (Number.isFinite(updated) && Number.isFinite(created)) {
          decidedCount += 1;
          if (updated - created <= slaMs) withinSlaCount += 1;
        }
        if (Number.isFinite(updated) && updated >= sevenDaysAgo) {
          decidedRecent.push({ n, slug, updated });
        }
      }
    }

    const slaPct =
      decidedCount > 0 ? Math.round((withinSlaCount / decidedCount) * 100) : null;

    const toRow = (n: (typeof allNodes)[number]): Row => {
      const market = n.market ?? "—";
      const date = formatDate(n.date);
      const createdMs = n.createdAt
        ? new Date(n.createdAt).getTime()
        : Number.NaN;
      const pendingHours = Number.isFinite(createdMs)
        ? Math.max(0, Math.round((Date.now() - createdMs) / 3_600_000))
        : null;
      return {
        id: String(n.id),
        uuid: String(n.uuid),
        reqId: `REQ-${String(n.id).slice(-4).toUpperCase()}`,
        venue: n.retailer?.name ?? n.name ?? "—",
        locationDate: `${market} · ${date}`,
        requester: n.client?.name ?? n.distributor?.name ?? "—",
        type: n.requestType?.name ?? "Activation",
        source: "external" as const,
        statusNote: `Awaiting review · ${n.status?.name ?? "Pending"}`,
        pendingHours,
      };
    };

    const pendingRows: Row[] = pendingNodes.map(toRow);

    decidedRecent.sort((a, b) => b.updated - a.updated);
    const recentlyDecided = decidedRecent.slice(0, 12).map((d) => ({
      row: toRow(d.n),
      slug: d.slug,
      updated: d.updated,
    }));

    return {
      pendingRows,
      recentlyDecided,
      stats: {
        pending,
        approvedLast30,
        declinedLast30,
        slaPct,
      },
    };
  }, [queueData, decidedData]);

  // Quick-filter the pending queue by venue / requester / req-id.
  const [search, setSearch] = useState("");
  // SLA-only filter — when ON, show only requests pending >72h.
  // Defaults OFF so the queue isn't hidden when there are no breaches.
  const [slaOnly, setSlaOnly] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  // Index of the keyboard-focused row (j/k navigation). -1 = no focus.
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);
  const [showHelp, setShowHelp] = useState(false);
  const matchesSearch = (r: Row, q: string) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return (
      r.venue.toLowerCase().includes(needle) ||
      r.requester.toLowerCase().includes(needle) ||
      r.reqId.toLowerCase().includes(needle) ||
      r.locationDate.toLowerCase().includes(needle)
    );
  };

  // Local removal so we don't have to round-trip the page after each
  // decision — the row simply disappears with a tiny fade.
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const rows = useMemo(
    () =>
      pendingRows
        .filter((r) => !removedIds.has(r.id))
        .filter((r) => matchesSearch(r, search))
        .filter((r) => {
          if (!slaOnly) return true;
          return typeof r.pendingHours === "number" && r.pendingHours >= 72;
        }),
    [pendingRows, removedIds, search, slaOnly],
  );

  const showAlert = useAlertStore((s) => s.showAlert);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Confirmation modals — Spark chrome, not browser-native.
  const [approving, setApproving] = useState<Row | null>(null);
  const [declining, setDeclining] = useState<Row | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  // Bulk-select state. Selected IDs are tracked separately from the
  // displayed rows so a search-filtered list doesn't deselect.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  // Separate modal state for bulk decline since it needs a shared
  // reason input, unlike bulk approve which is one-click.
  const [bulkDeclineOpen, setBulkDeclineOpen] = useState(false);
  const [bulkDeclineReason, setBulkDeclineReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // "Select all visible" only operates on the currently-filtered view —
  // safer than blast-selecting hidden rows.
  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = rows.every((r) => next.has(r.id));
      if (allSelected) {
        for (const r of rows) next.delete(r.id);
      } else {
        for (const r of rows) next.add(r.id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const confirmBulkApprove = async () => {
    const targets = rows.filter((r) => selectedIds.has(r.id));
    if (targets.length === 0) {
      setBulkConfirm(false);
      return;
    }
    setBulkBusy(true);
    // Run sequentially to avoid hammering the backend and to give the
    // user a clean success/fail count. 20-30 requests typical max.
    let okCount = 0;
    const failures: string[] = [];
    for (const r of targets) {
      try {
        const result = await callApprovalMutation("approveRequest", {
          input: { id: r.id },
        });
        if (result.success) {
          okCount += 1;
          setRemovedIds((prev) => {
            const next = new Set(prev);
            next.add(r.id);
            return next;
          });
        } else {
          failures.push(`${r.reqId}: ${result.message || "rejected"}`);
        }
      } catch (e) {
        failures.push(`${r.reqId}: ${(e as Error).message}`);
      }
    }
    if (okCount > 0) refreshAfterDecision(environment, tenantId);
    setBulkBusy(false);
    setBulkConfirm(false);
    clearSelection();
    if (failures.length === 0) {
      showAlert(
        `Approved ${okCount} request${okCount === 1 ? "" : "s"} — events queued for staffing.`,
        "success",
      );
    } else if (okCount > 0) {
      showAlert(
        `Approved ${okCount}, failed ${failures.length}: ${failures.slice(0, 2).join("; ")}${failures.length > 2 ? "…" : ""}`,
        "warning",
      );
    } else {
      showAlert(
        `All ${failures.length} approves failed. First: ${failures[0]}`,
        "error",
      );
    }
  };

  // Bulk decline — same shared reason for every selected row. Each
  // requestor still gets a personalised email via the branded
  // request_declined template; only the reason text is shared.
  const confirmBulkDecline = async () => {
    const targets = rows.filter((r) => selectedIds.has(r.id));
    if (targets.length === 0) {
      setBulkDeclineOpen(false);
      return;
    }
    const reason = bulkDeclineReason.trim();
    if (reason.length < 8) {
      showAlert(
        "Tell the requestors at least a sentence about why — they need that context.",
        "warning",
      );
      return;
    }
    setBulkBusy(true);
    let okCount = 0;
    const failures: string[] = [];
    for (const r of targets) {
      try {
        const result = await callApprovalMutation("declineRequest", {
          input: { id: r.id, declineReason: reason },
        });
        if (result.success) {
          okCount += 1;
          setRemovedIds((prev) => {
            const next = new Set(prev);
            next.add(r.id);
            return next;
          });
        } else {
          failures.push(`${r.reqId}: ${result.message || "rejected"}`);
        }
      } catch (e) {
        failures.push(`${r.reqId}: ${(e as Error).message}`);
      }
    }
    if (okCount > 0) refreshAfterDecision(environment, tenantId);
    setBulkBusy(false);
    setBulkDeclineOpen(false);
    setBulkDeclineReason("");
    clearSelection();
    if (failures.length === 0) {
      showAlert(
        `Declined ${okCount} request${okCount === 1 ? "" : "s"} — requestors notified.`,
        "success",
      );
    } else if (okCount > 0) {
      showAlert(
        `Declined ${okCount}, failed ${failures.length}: ${failures.slice(0, 2).join("; ")}${failures.length > 2 ? "…" : ""}`,
        "warning",
      );
    } else {
      showAlert(
        `All ${failures.length} declines failed. First: ${failures[0]}`,
        "error",
      );
    }
  };

  const approveRowNow = async (r: Row) => {
    if (busyId === r.id) return;
    setBusyId(r.id);
    try {
      const result = await callApprovalMutation("approveRequest", {
        input: { id: r.id },
      });
      if (!result.success) throw new Error(result.message || "Approve failed.");
      showAlert(`Approved ${r.reqId} — event queued for staffing.`, "success");
      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.add(r.id);
        return next;
      });
      refreshAfterDecision(environment, tenantId);
    } catch (e) {
      showAlert(`Couldn't approve: ${(e as Error).message}`, "error");
    } finally {
      setBusyId(null);
    }
  };

  const confirmApprove = async () => {
    if (!approving) return;
    const r = approving;
    await approveRowNow(r);
    setApproving(null);
  };

  const submitDecline = async () => {
    if (!declining) return;
    if (declineReason.trim().length < 8) {
      showAlert(
        "Tell the requestor at least a sentence about why — they need that context to revise.",
        "warning",
      );
      return;
    }
    setBusyId(declining.id);
    try {
      const result = await callApprovalMutation("declineRequest", {
        input: { id: declining.id, declineReason: declineReason.trim() },
      });
      if (!result.success) throw new Error(result.message || "Decline failed.");
      showAlert(`Declined ${declining.reqId} — requestor notified.`, "success");
      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.add(declining.id);
        return next;
      });
      refreshAfterDecision(environment, tenantId);
      setDeclining(null);
      setDeclineReason("");
    } catch (e) {
      showAlert(`Couldn't decline: ${(e as Error).message}`, "error");
    } finally {
      setBusyId(null);
    }
  };

  const slaLabel = stats.slaPct === null ? "—" : `${stats.slaPct}%`;

  // Keep the focused index in range as rows change (removed/filtered).
  useEffect(() => {
    if (rows.length === 0) {
      if (focusedIdx !== -1) setFocusedIdx(-1);
      return;
    }
    if (focusedIdx >= rows.length) setFocusedIdx(rows.length - 1);
  }, [rows.length, focusedIdx]);

  // Keyboard shortcuts. Skip when a modal is open or the user is typing
  // into an input/textarea (so 'a' in the decline reason field doesn't
  // approve the row).
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
      // Modal-open guards
      if (
        approving ||
        declining ||
        bulkConfirm ||
        bulkDeclineOpen ||
        showHelp
      ) {
        if (e.key === "Escape") {
          setApproving(null);
          setDeclining(null);
          setBulkConfirm(false);
          setBulkDeclineOpen(false);
          setShowHelp(false);
        }
        return;
      }
      // "/" focuses search — Gmail/Linear convention
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
        // Allow Esc to drop focus from search
        if (e.key === "Escape" && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }
      if (rows.length === 0) return;
      const focused = focusedIdx >= 0 ? rows[focusedIdx] : null;
      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setFocusedIdx((i) => Math.min(rows.length - 1, i + 1 < 0 ? 0 : i + 1));
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          setFocusedIdx((i) => Math.max(0, (i < 0 ? 0 : i) - 1));
          break;
        case "a":
        case "A":
          if (focused) {
            e.preventDefault();
            if (e.shiftKey) {
              void approveRowNow(focused);
            } else {
              setApproving(focused);
            }
          }
          break;
        case "d":
        case "D":
          if (focused) {
            e.preventDefault();
            if (e.shiftKey) {
              setDeclineReason("");
            }
            setDeclining(focused);
          }
          break;
        case " ":
        case "x":
          if (focused) {
            e.preventDefault();
            toggleSelected(focused.id);
          }
          break;
        case "Enter":
          if (focused) {
            e.preventDefault();
            navigate(`/request/view/${focused.uuid}`);
          }
          break;
        case "Escape":
          if (selectedIds.size > 0) {
            e.preventDefault();
            clearSelection();
          } else if (focusedIdx !== -1) {
            e.preventDefault();
            setFocusedIdx(-1);
          }
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rows,
    focusedIdx,
    approving,
    declining,
    bulkConfirm,
    showHelp,
    selectedIds,
  ]);

  const StatsGrid = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="spark-card p-4">
        <p className="label-mini">PENDING</p>
        <p
          className="tab-num text-3xl font-bold mt-1"
          style={{ color: "var(--spark-orange)" }}
        >
          <CountReel value={stats.pending} />
        </p>
      </div>
      <div className="spark-card p-4">
        <p className="label-mini">APPROVED · 30D</p>
        <p
          className="tab-num text-3xl font-bold mt-1"
          style={{ color: "var(--spark-lime)" }}
        >
          <CountReel value={stats.approvedLast30} />
        </p>
      </div>
      <div className="spark-card p-4">
        <p className="label-mini">DECLINED · 30D</p>
        <p
          className="tab-num text-3xl font-bold mt-1"
          style={{ color: "var(--spark-orange)" }}
        >
          <CountReel value={stats.declinedLast30} />
        </p>
      </div>
      <div className="spark-card p-4">
        <p className="label-mini">DECIDED &lt; 24H</p>
        <p
          className="tab-num text-3xl font-bold mt-1"
          style={{
            color:
              stats.slaPct === null
                ? "var(--spark-muted, rgba(255,255,255,0.5))"
                : stats.slaPct >= 80
                  ? "var(--spark-lime)"
                  : "var(--spark-orange)",
          }}
        >
          {slaLabel}
        </p>
      </div>
    </div>
  );

  // Count of pending rows that have breached the 72h SLA — used to
  // surface the filter only when it's actually useful (no fire = no
  // distraction).
  const slaBreachCount = useMemo(
    () =>
      pendingRows.filter(
        (r) => !removedIds.has(r.id) && typeof r.pendingHours === "number" && r.pendingHours >= 72,
      ).length,
    [pendingRows, removedIds],
  );

  const SearchBar = (
    <div className="spark-card px-4 py-3 flex items-center gap-3 flex-wrap">
      <input
        ref={searchRef}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search pending queue — venue, requester, REQ-id…  ( / to focus )"
        className="flex-1 bg-transparent text-sm focus:outline-none"
        style={{ color: "var(--spark-text)" }}
      />
      {/* SLA-breach quick-filter — only renders when there's actually
          something to filter. Toggles between "show only >72h pending"
          and the full queue. */}
      {slaBreachCount > 0 && (
        <button
          type="button"
          onClick={() => setSlaOnly((v) => !v)}
          className="mono text-[10px] px-2.5 py-1.5 rounded-md transition"
          title={
            slaOnly
              ? "Show the full pending queue again"
              : `Filter to only the ${slaBreachCount} request${slaBreachCount === 1 ? "" : "s"} pending >72h`
          }
          style={{
            letterSpacing: "0.14em",
            background: slaOnly
              ? "var(--spark-orange)"
              : "rgba(239,90,42,0.12)",
            border: `1px solid ${slaOnly ? "var(--spark-orange)" : "rgba(239,90,42,0.4)"}`,
            color: slaOnly ? "#0a0d09" : "var(--spark-orange)",
            fontWeight: slaOnly ? 700 : 400,
          }}
        >
          {slaOnly
            ? `✓ SLA BREACH · ${slaBreachCount}`
            : `⚠ SLA BREACH · ${slaBreachCount}`}
        </button>
      )}
      <button
        type="button"
        onClick={() => setShowHelp(true)}
        className="mono text-[10px] px-2 py-1 rounded-md"
        title="Keyboard shortcuts"
        style={{
          letterSpacing: "0.14em",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--spark-hairline, rgba(255,255,255,0.08))",
          color: "var(--spark-muted, rgba(255,255,255,0.5))",
        }}
      >
        ?
      </button>
    </div>
  );

  const RecentlyDecided = recentlyDecided.length === 0 ? null : (
    <div className="spark-card overflow-hidden">
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--spark-border)" }}
      >
        <p
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.18em",
            color: "var(--spark-muted, rgba(255,255,255,0.5))",
          }}
        >
          RECENTLY DECIDED · LAST 7D
        </p>
        <span
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.14em",
            color: "var(--spark-faint, rgba(255,255,255,0.38))",
          }}
        >
          {recentlyDecided.length} ITEMS
        </span>
      </div>
      <ul>
        {recentlyDecided.map((d, i) => {
          const isApproved = d.slug === "approved";
          const color = isApproved ? "var(--spark-lime)" : "var(--spark-orange)";
          const label = isApproved ? "✓ APPROVED" : "✗ DECLINED";
          const when = (() => {
            const diffMs = Date.now() - d.updated;
            const mins = Math.floor(diffMs / 60_000);
            if (mins < 60) return `${Math.max(1, mins)}m ago`;
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) return `${hrs}h ago`;
            const days = Math.floor(hrs / 24);
            return `${days}d ago`;
          })();
          return (
            <li
              key={d.row.uuid}
              onClick={() =>
                navigate(`/request/view/${d.row.uuid}`, {
                  state: { from: "/approvals" },
                })
              }
              className="px-5 py-3 cursor-pointer transition"
              style={{
                borderBottom:
                  i < recentlyDecided.length - 1
                    ? "1px solid var(--spark-border)"
                    : "none",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className="mono text-[10px] px-2 py-1 rounded-md"
                  style={{
                    letterSpacing: "0.14em",
                    background: `${color}1a`,
                    border: `1px solid ${color}40`,
                    color,
                  }}
                >
                  {label}
                </span>
                <span
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.14em",
                    color: "var(--spark-muted, rgba(255,255,255,0.5))",
                  }}
                >
                  {d.row.reqId}
                </span>
                <span className="text-sm font-semibold flex-1 min-w-0 truncate">
                  {d.row.venue}
                </span>
                <span
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.14em",
                    color: "var(--spark-faint, rgba(255,255,255,0.38))",
                  }}
                >
                  {when.toUpperCase()}
                </span>
              </div>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--spark-muted, rgba(255,255,255,0.5))" }}
              >
                {d.row.locationDate} · {d.row.requester}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        {StatsGrid}
        {pendingRows.length > 0 && search ? (
          <>
            {SearchBar}
            <SparkEmptyState title={`No pending requests match "${search}".`} />
          </>
        ) : (
          <SparkEmptyState
            title="Nothing in the approval queue."
            body="Nice work."
          />
        )}
        {RecentlyDecided}
      </div>
    );
  }

  const selectedCount = rows.filter((r) => selectedIds.has(r.id)).length;
  const allVisibleSelected =
    rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

  const BulkBar = selectedCount === 0 ? null : (
    <div
      className="sticky top-2 z-30 spark-card px-4 py-3 flex flex-wrap items-center gap-3"
      style={{
        background: "rgba(17,20,14,0.92)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(242,243,238,0.35)",
      }}
    >
      <span
        className="mono text-[10px]"
        style={{
          letterSpacing: "0.18em",
          color: "var(--spark-lime)",
        }}
      >
        {selectedCount} SELECTED
      </span>
      <button
        type="button"
        onClick={toggleSelectAllVisible}
        className="mono text-[10px]"
        style={{
          letterSpacing: "0.14em",
          color: "var(--spark-text-secondary)",
        }}
      >
        {allVisibleSelected ? "DESELECT ALL VISIBLE" : "SELECT ALL VISIBLE"}
      </button>
      <button
        type="button"
        onClick={clearSelection}
        className="mono text-[10px]"
        style={{
          letterSpacing: "0.14em",
          color: "var(--spark-muted, rgba(255,255,255,0.5))",
        }}
      >
        CLEAR
      </button>
      <span className="flex-1" />
      <button
        type="button"
        onClick={() => setBulkDeclineOpen(true)}
        disabled={bulkBusy}
        className="px-4 py-2 rounded-xl text-sm font-semibold"
        style={{
          background: "transparent",
          color: "var(--spark-orange)",
          border: "1px solid rgba(239,90,42,0.4)",
          opacity: bulkBusy ? 0.5 : 1,
        }}
      >
        ✗ Decline {selectedCount}
      </button>
      <button
        type="button"
        onClick={() => setBulkConfirm(true)}
        disabled={bulkBusy}
        className="px-4 py-2 rounded-xl text-sm font-semibold"
        style={{
          background: "var(--spark-lime)",
          color: "#0a0d09",
          opacity: bulkBusy ? 0.5 : 1,
        }}
      >
        ✓ Approve {selectedCount}
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {StatsGrid}
      {/* Show SearchBar when there's enough to search, OR when there
          are any SLA breaches (so the toggle is always reachable). */}
      {(pendingRows.length > 4 || slaBreachCount > 0) && SearchBar}
      {BulkBar}
      <div className="spark-card overflow-hidden">
      {rows.map((r, idx) => (
        <ApprovalRow
          key={r.uuid}
          row={r}
          zebra={idx % 2 === 1}
          busy={busyId === r.id}
          selected={selectedIds.has(r.id)}
          focused={focusedIdx === idx}
          onFocus={() => setFocusedIdx(idx)}
          onToggleSelect={() => toggleSelected(r.id)}
          onApprove={() => setApproving(r)}
          onDecline={() => setDeclining(r)}
          onView={() =>
            navigate(`/request/view/${r.uuid}`, {
              state: { from: "/approvals" },
            })
          }
        />
      ))}

      </div>

      {RecentlyDecided}

      {/* Keyboard shortcuts help — appears on '?' key or '?' button click.
          Lifted from the Gmail/Linear playbook: power users want these,
          mouse users never see them. */}
      {showHelp && (
        <div
          onClick={() => setShowHelp(false)}
          className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
          style={{
            background: "rgba(10,11,13,0.7)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md spark-card p-6"
            style={{ borderRadius: 20 }}
          >
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-sky)",
              }}
            >
              KEYBOARD SHORTCUTS
            </p>
            <h2
              className="display text-2xl font-bold mb-4"
              style={{ letterSpacing: "-0.03em" }}
            >
              Fly through the queue.
            </h2>
            <div className="space-y-2 text-sm">
              {[
                ["j / ↓", "Next request"],
                ["k / ↑", "Previous request"],
                ["a", "Approve focused (confirm)"],
                ["shift + a", "Approve focused now"],
                ["d", "Decline focused (confirm)"],
                ["shift + d", "Decline focused (reason)"],
                ["space / x", "Toggle bulk-select"],
                ["enter", "Open full view"],
                ["/", "Focus search"],
                ["esc", "Clear selection / drop focus"],
                ["?", "This help"],
              ].map(([key, desc]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3"
                >
                  <span
                    style={{ color: "var(--spark-text-secondary)" }}
                  >
                    {desc}
                  </span>
                  <kbd
                    className="mono px-2 py-0.5 rounded-md text-[11px]"
                    style={{
                      letterSpacing: "0.04em",
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "var(--spark-text)",
                    }}
                  >
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-5">
              <button
                onClick={() => setShowHelp(false)}
                className="mono text-[11px] px-3"
                style={{
                  letterSpacing: "0.14em",
                  color: "var(--spark-muted, rgba(255,255,255,0.5))",
                }}
              >
                ESC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk approve confirmation. Selected rows get approved sequentially
          so backend errors don't blast all at once and the user gets a
          clean success/fail count. */}
      {bulkConfirm && (
        <div
          onClick={() => !bulkBusy && setBulkConfirm(false)}
          className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
          style={{
            background: "rgba(10,11,13,0.7)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg spark-card p-6"
            style={{ borderRadius: 20 }}
          >
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-lime)",
              }}
            >
              BULK APPROVE
            </p>
            <h2
              className="display text-2xl font-bold"
              style={{ letterSpacing: "-0.03em" }}
            >
              Approve {selectedCount} request{selectedCount === 1 ? "" : "s"}?
            </h2>
            <p
              className="text-sm mt-2"
              style={{ color: "var(--spark-text-secondary)", lineHeight: 1.55 }}
            >
              Each one creates an Event row and triggers the branded
              approval email to its requestor. Failures (if any) get
              surfaced in the toast — successes are removed from the
              queue.
            </p>
            <div
              className="mt-4 p-4 rounded-xl text-xs max-h-48 overflow-y-auto"
              style={{
                background: "rgba(242,243,238,0.06)",
                border: "1px solid rgba(242,243,238,0.18)",
                color: "var(--spark-text-secondary)",
                lineHeight: 1.5,
              }}
            >
              {rows
                .filter((r) => selectedIds.has(r.id))
                .slice(0, 20)
                .map((r) => (
                  <div key={r.id}>
                    <span
                      className="mono text-[10px]"
                      style={{
                        letterSpacing: "0.14em",
                        color: "var(--spark-muted, rgba(255,255,255,0.5))",
                      }}
                    >
                      {r.reqId}
                    </span>{" "}
                    · {r.venue}
                  </div>
                ))}
              {selectedCount > 20 && (
                <div
                  className="mono text-[10px] mt-1"
                  style={{
                    letterSpacing: "0.14em",
                    color: "var(--spark-muted, rgba(255,255,255,0.5))",
                  }}
                >
                  …and {selectedCount - 20} more
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => {
                  if (bulkBusy) return;
                  setBulkConfirm(false);
                }}
                className="mono text-[11px] px-3"
                style={{
                  letterSpacing: "0.14em",
                  color: "var(--spark-muted, rgba(255,255,255,0.5))",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={confirmBulkApprove}
                disabled={bulkBusy}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-lime)",
                  color: "#0a0d09",
                  opacity: bulkBusy ? 0.5 : 1,
                }}
              >
                {bulkBusy
                  ? `Approving… (${selectedCount})`
                  : `✓ Approve ${selectedCount} + notify`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk decline modal. Shared reason for the whole batch — each
          requestor still gets a personalised email via the branded
          template, only the reason text is shared. ≥8 chars enforced
          per the single-row decline pattern. */}
      {bulkDeclineOpen && (
        <div
          onClick={() => !bulkBusy && setBulkDeclineOpen(false)}
          className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
          style={{
            background: "rgba(10,11,13,0.7)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg spark-card p-6"
            style={{ borderRadius: 20 }}
          >
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-orange)",
              }}
            >
              BULK DECLINE
            </p>
            <h2
              className="display text-2xl font-bold"
              style={{ letterSpacing: "-0.03em" }}
            >
              Decline {selectedCount} request{selectedCount === 1 ? "" : "s"}?
            </h2>
            <p
              className="text-sm mt-2"
              style={{ color: "var(--spark-text-secondary)" }}
            >
              One reason for the whole batch. Each requestor gets their
              own branded email with this note.
            </p>
            {/* Common-reason chips — same presets as the single-row
                decline. Speed up the common case of inventory/timing. */}
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                "No inventory in these markets right now — please re-pitch for Q3.",
                "Dates don't work for this batch — could you push by 1-2 weeks?",
                "These accounts aren't on our priority list this quarter.",
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBulkDeclineReason(preset)}
                  className="mono text-[10px] px-2.5 py-1.5 rounded-lg transition"
                  style={{
                    letterSpacing: "0.12em",
                    background: "rgba(239,90,42,0.08)",
                    border: "1px solid rgba(239,90,42,0.25)",
                    color: "var(--spark-text-secondary)",
                  }}
                >
                  {preset.split(" — ")[0].toUpperCase()}
                </button>
              ))}
            </div>
            <textarea
              autoFocus
              value={bulkDeclineReason}
              onChange={(e) => setBulkDeclineReason(e.target.value)}
              rows={4}
              placeholder="e.g., We don't have inventory in these markets until Q3."
              className="w-full mt-3 rounded-xl px-3 py-2 text-sm"
              style={{
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
              }}
            />
            <p
              className="mono text-[10px] mt-1.5"
              style={{
                letterSpacing: "0.14em",
                color:
                  bulkDeclineReason.trim().length < 8
                    ? "var(--spark-orange)"
                    : "var(--spark-muted, rgba(255,255,255,0.5))",
              }}
            >
              {bulkDeclineReason.trim().length < 8
                ? "AT LEAST A SENTENCE — REQUIRED"
                : `${bulkDeclineReason.trim().length} CHARS · WILL SEND TO ${selectedCount} REQUESTORS`}
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => {
                  if (bulkBusy) return;
                  setBulkDeclineOpen(false);
                  setBulkDeclineReason("");
                }}
                className="mono text-[11px] px-3"
                style={{
                  letterSpacing: "0.14em",
                  color: "var(--spark-muted, rgba(255,255,255,0.5))",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={confirmBulkDecline}
                disabled={bulkBusy || bulkDeclineReason.trim().length < 8}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-orange)",
                  color: "#0a0d09",
                  opacity:
                    bulkBusy || bulkDeclineReason.trim().length < 8 ? 0.5 : 1,
                }}
              >
                {bulkBusy
                  ? `Declining… (${selectedCount})`
                  : `✗ Decline ${selectedCount} + send comment`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve confirmation — in Spark chrome instead of browser-native
          confirm(). Surfaces what actually happens downstream so kyle
          isn't flying blind on a "yes" click. */}
      {approving && (
        <SparkOverlay
          onClose={() => {
            if (!busyId) setApproving(null);
          }}
          size="md"
          label={`Approve ${approving.reqId}?`}
        >
            <p className="spark-overlay-kicker" style={{ color: "var(--spark-lime)" }}>
              Approve request
            </p>
            <h2 className="spark-overlay-title">
              Approve {approving.reqId}?
            </h2>
            <p className="spark-overlay-copy">
              <strong style={{ color: "var(--spark-text)" }}>{approving.venue}</strong>
              {" · "}
              {approving.locationDate}
            </p>
            <div
              className="mt-4 p-4 rounded-xl text-xs"
              style={{
                background: "rgba(242,243,238,0.06)",
                border: "1px solid rgba(242,243,238,0.18)",
                color: "var(--spark-text-secondary)",
                lineHeight: 1.6,
              }}
            >
              <p className="mono text-[10px] mb-1" style={{ letterSpacing: "0.16em", color: "var(--spark-lime)" }}>
                WHAT HAPPENS
              </p>
              1. Event row is created and queued for staffing.
              <br />
              2. <strong>{approving.requester}</strong> gets the branded approval email + calendar invite.
              <br />
              3. Ignite staffs a BA and a clock-in link goes out the day of.
            </div>
            <div className="spark-overlay-actions">
              <button
                onClick={confirmApprove}
                disabled={busyId !== null}
                className="spark-overlay-action spark-overlay-action-primary"
              >
                {busyId ? "Approving…" : "Approve + notify"}
              </button>
              <button
                onClick={() => {
                  if (busyId) return;
                  setApproving(null);
                }}
                className="spark-overlay-action spark-overlay-action-cancel"
              >
                Cancel
              </button>
            </div>
        </SparkOverlay>
      )}

      {/* Decline modal — requires a comment per Kyle's spec. The
          comment goes back to the requestor in the branded decline
          email so they can revise/resubmit. */}
      {declining && (
        <div
          onClick={() => !busyId && setDeclining(null)}
          className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[10vh]"
          style={{
            background: "rgba(10,11,13,0.7)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg spark-card p-6"
            style={{ borderRadius: 20 }}
          >
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-orange)",
              }}
            >
              DECLINE REQUEST
            </p>
            <h2
              className="display text-2xl font-bold"
              style={{ letterSpacing: "-0.03em" }}
            >
              Why are you declining {declining.reqId}?
            </h2>
            <p
              className="text-sm mt-2"
              style={{ color: "var(--spark-text-secondary)", lineHeight: 1.55 }}
            >
              This goes to <strong>{declining.requester}</strong> in the
              decline email so they can revise and resubmit. Be specific —
              "out of inventory in this market" beats "no".
            </p>
            {/* Common-reason chips — kyle can tap one to seed the textarea
                and tweak from there. Speeds up the "no inventory in market"
                case (the most common decline) without skipping the required
                comment. */}
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                "No inventory in this market right now — please re-pitch for Q3.",
                "Date doesn't work — could you push by 1–2 weeks?",
                "Wrong activation type for this account — let's regroup.",
                "Account isn't on our priority list this quarter.",
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDeclineReason(preset)}
                  className="mono text-[10px] px-2.5 py-1.5 rounded-lg transition"
                  style={{
                    letterSpacing: "0.12em",
                    background: "rgba(239,90,42,0.08)",
                    border: "1px solid rgba(239,90,42,0.25)",
                    color: "var(--spark-text-secondary)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(239,90,42,0.16)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(239,90,42,0.08)")
                  }
                >
                  {preset.split(" — ")[0].toUpperCase()}
                </button>
              ))}
            </div>
            <textarea
              autoFocus
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={4}
              placeholder="e.g., We don't have inventory in this market until Q3, please push the date."
              className="w-full mt-3 rounded-xl px-3 py-2 text-sm"
              style={{
                background: "var(--spark-bg)",
                border: "1px solid var(--spark-border)",
                color: "var(--spark-text)",
              }}
            />
            <p
              className="mono text-[10px] mt-1.5"
              style={{
                letterSpacing: "0.14em",
                color:
                  declineReason.trim().length < 8
                    ? "var(--spark-orange)"
                    : "var(--spark-muted, rgba(255,255,255,0.5))",
              }}
            >
              {declineReason.trim().length < 8
                ? "AT LEAST A SENTENCE — REQUIRED"
                : `${declineReason.trim().length} CHARS`}
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => {
                  if (busyId) return;
                  setDeclining(null);
                  setDeclineReason("");
                }}
                className="mono text-[11px] px-3"
                style={{
                  letterSpacing: "0.14em",
                  color: "var(--spark-muted, rgba(255,255,255,0.5))",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={submitDecline}
                disabled={
                  busyId !== null || declineReason.trim().length < 8
                }
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-orange)",
                  color: "#0a0d09",
                  opacity:
                    busyId !== null || declineReason.trim().length < 8
                      ? 0.5
                      : 1,
                }}
              >
                {busyId ? "Sending…" : "Decline + send comment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Outer-header button that fetches the pending queue and copies a
 * Slack-friendly text summary to the clipboard. Useful for pasting
 * a status into a team channel without exporting CSV first.
 *
 * Lives outside the main Suspense so it can read the dataset itself
 * (the parent header doesn't have access to ApprovalsInner's rows).
 */
const ApprovalsCopyQueueButtonInner: React.FC = () => {
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<ApprovalsListQueryType>(
    ApprovalsListQuery,
    copyQueueVariables(tenantId),
    { fetchPolicy: "store-or-network" },
  );
  const showAlert = useAlertStore((s) => s.showAlert);
  const [copying, setCopying] = useState(false);

  const onCopy = async () => {
    if (copying) return;
    setCopying(true);
    const rows = (data?.requests?.edges ?? [])
      .map((e) => e?.node)
      .filter((n): n is NonNullable<typeof n> => Boolean(n))
      .filter((n) => isAwaiting(n.status));
    if (rows.length === 0) {
      showAlert("No pending requests to copy.", "info");
      setCopying(false);
      return;
    }
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const lines = [
      `*Pending approvals — ${today}* (${rows.length} open)`,
      "",
    ];
    for (const n of rows.slice(0, 50)) {
      const reqId = `REQ-${String(n.id).slice(-4).toUpperCase()}`;
      const venue = n.retailer?.name ?? n.name ?? "—";
      const market = n.market ?? "";
      const created = n.createdAt
        ? new Date(n.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "";
      lines.push(
        `• ${reqId} · ${venue}${market ? ` (${market})` : ""}${created ? ` · ${created}` : ""}`,
      );
    }
    if (rows.length > 50) {
      lines.push(`…and ${rows.length - 50} more`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showAlert(
        `Copied ${rows.length} pending request${rows.length === 1 ? "" : "s"} to clipboard.`,
        "success",
      );
    } catch (e) {
      showAlert(`Couldn't copy: ${(e as Error).message}`, "error");
    } finally {
      setCopying(false);
    }
  };

  return (
    <button
      onClick={onCopy}
      disabled={copying}
      className="px-4 py-2 rounded-xl text-sm font-semibold transition"
      style={{
        background: "transparent",
        color: "var(--spark-text)",
        border: "1px solid var(--spark-border)",
        opacity: copying ? 0.5 : 1,
      }}
      title="Copy the pending queue as a Slack-friendly text block"
    >
      {copying ? "Copying…" : "Copy queue for Slack"}
    </button>
  );
};

const ApprovalsCopyQueueButton: React.FC = () => (
  <Suspense fallback={null}>
    <ApprovalsCopyQueueButtonInner />
  </Suspense>
);

/**
 * Per-tenant linked Google Sheet shortcut. Reads the same
 * @spark.linkedSheet.url/{tenantId} localStorage key the Master
 * Tracker writes, so the chip auto-appears once it's set.
 */
const LinkedSheetChip: React.FC = () => {
  const { tenantId } = useAuthStore();
  const url = (() => {
    if (!tenantId) return "";
    try {
      return localStorage.getItem(`@spark.linkedSheet.url/${tenantId}`) ?? "";
    } catch {
      return "";
    }
  })();
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="px-3 py-2 rounded-xl text-sm font-semibold transition inline-flex items-center gap-2"
      style={{
        background: "rgba(95,184,239,0.10)",
        color: "var(--spark-sky)",
        border: "1px solid rgba(95,184,239,0.35)",
        textDecoration: "none",
      }}
      title="Open the brand's linked Google Sheet"
    >
      Sheet ↗
    </a>
  );
};

/* ─────────────────── page ─────────────────── */

/**
 * Layout-less body of the Approvals page. Lets the client dashboard
 * embed the queue as a tab without nesting `<Layout>` twice (which
 * would render the sidebar/topbar in the dashboard content area).
 *
 * The default export below wraps this in `<Layout>` for the
 * standalone `/approvals` route.
 */
export const ApprovalsBody: React.FC = () => {
  void useSparkRole;
  return (
    <div className="space-y-6 max-w-5xl spark-fade-in">
        <SparkPageHeader
          eyebrow="PENDING APPROVALS"
          title="Review & approve."
          support={
            <>
              External requests route to a mapped client user. Logged-in
              submissions auto-approve. Approvals queue a job in{" "}
              <span style={{ color: "var(--spark-gold)" }}>
                Queue for Ignite
              </span>
              .
            </>
          }
          action={
            <>
              <LinkedSheetChip />
              <ApprovalsCopyQueueButton />
            </>
          }
        />

        {/* How it works */}
        <details
          className="spark-card p-5"
          style={{
            borderColor: "rgba(242,243,238,0.25)",
            background:
              "linear-gradient(180deg, rgba(242,243,238,0.06), transparent)",
          }}
        >
          <summary
            className="mono text-[10px] cursor-pointer"
            style={{
              letterSpacing: "0.16em",
              color: "var(--spark-lime)",
            }}
          >
            APPROVAL ROUTING — HOW IT WORKS
          </summary>
          <div className="grid md:grid-cols-3 gap-4 mt-4 text-sm">
            <div>
              <p className="font-bold">External request (no login)</p>
              <p
                className="mt-1"
                style={{ color: "var(--spark-text-secondary)" }}
              >
                → Email to mapped client user with one-click{" "}
                <span style={{ color: "var(--spark-lime)" }}>[Approve]</span> /{" "}
                <span style={{ color: "var(--spark-orange)" }}>
                  [Decline]
                </span>{" "}
                links
                <br />→ FYI email to admin team
              </p>
            </div>
            <div>
              <p className="font-bold">Internal request (logged in)</p>
              <p
                className="mt-1"
                style={{ color: "var(--spark-text-secondary)" }}
              >
                → Auto-approved
                <br />→ Email confirmation to admin team
              </p>
            </div>
            <div>
              <p className="font-bold">Daily digest</p>
              <p
                className="mt-1"
                style={{ color: "var(--spark-text-secondary)" }}
              >
                → Cron sends end-of-day summary to admins
                <br />→ Pending / approved / declined counts
              </p>
            </div>
          </div>
        </details>

        {/* Queue (stats live inside ApprovalsInner so they share the data fetch).
            ApprovalsErrorBoundary catches the case where ApprovalsInner's
            RequestsQuery throws — historically (until the public /approve/<token>
            flow shipped) clients clicking the email link landed here without
            admin tenant access, the query 403'd, and the whole page
            blank-screened. The boundary now renders a useful message
            instead and points them to the email reply path. */}
        <ApprovalsErrorBoundary>
          <Suspense
            fallback={
              <div
                className="spark-card p-8 text-center text-sm"
                style={{ color: "var(--spark-muted, rgba(255,255,255,0.5))" }}
              >
                Loading approvals…
              </div>
            }
          >
            <ApprovalsInner />
          </Suspense>
        </ApprovalsErrorBoundary>
    </div>
  );
};

// Standalone `/approvals` route — wraps the body in the admin shell.
// `AdminOnly` already gates this route in AppRoutes.tsx; the body
// itself is reusable from the client dashboard's Approvals tab where
// the outer Layout already exists.
export default function SparkApprovals() {
  return (
    <Layout>
      <ApprovalsBody />
    </Layout>
  );
}

/**
 * Last-line-of-defense boundary around ApprovalsInner. Relay's
 * `useLazyLoadQuery` throws on permission errors (e.g. a client user
 * landing here from an old `/approvals?request=...` email link without
 * admin tenant access). Without a boundary, that throw escapes Suspense
 * and the parent unmounts → blank screen. With it, the user sees a
 * friendly message instead and we log the underlying error to the
 * console for debugging.
 */
class ApprovalsErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[SparkApprovals] query threw:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        className="spark-card p-8"
        style={{ borderColor: "rgba(255,138,76,0.3)" }}
      >
        <p
          className="mono text-[10px]"
          style={{ letterSpacing: "0.18em", color: "var(--spark-orange)" }}
        >
          COULDN'T LOAD APPROVALS
        </p>
        <h2 className="display text-xl font-bold mt-2">
          We hit a snag opening this page.
        </h2>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--spark-text-secondary)" }}
        >
          If you got here from an approval email, try clicking the button
          again — links sent after this fix lands open a no-login approval
          page directly. Otherwise, reach out to{" "}
          <a
            href="mailto:staffing@igniteproductions.co"
            style={{ color: "var(--spark-lime)" }}
          >
            staffing@igniteproductions.co
          </a>
          .
        </p>
        <p
          className="mono text-[10px] mt-4"
          style={{ letterSpacing: "0.14em", color: "var(--spark-faint, rgba(255,255,255,0.38))" }}
        >
          {this.state.error.message?.slice(0, 200)}
        </p>
      </div>
    );
  }
}
