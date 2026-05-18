import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { RequestsQuery } from "@/api/queries/RequestsQuery";
import type { RequestsQuery as RequestsQueryType } from "@api/queries/__generated__/RequestsQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";

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
          : { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.12)", fg: "rgba(255,255,255,0.55)" };
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
  return (
    <div
      onClick={onFocus}
      className="spark-card p-5 transition"
      style={{
        outline: selected
          ? "2px solid var(--spark-lime)"
          : focused
            ? "2px solid var(--spark-sky)"
            : "1px solid transparent",
        outlineOffset: selected || focused ? -1 : 0,
        boxShadow: focused
          ? "0 0 24px rgba(95,184,239,0.25)"
          : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="mt-1.5 w-4 h-4 cursor-pointer accent-[var(--spark-lime)]"
            aria-label={`Select ${row.reqId}`}
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.16em",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                {row.reqId}
              </span>
              {sourceChip}
              {ageChip}
            </div>
            <p className="font-bold text-base">{row.venue}</p>
            <p
              className="text-sm"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              {row.locationDate}
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {row.type} · {row.requester}
            </p>
            <p
              className="mono text-[10px] mt-2"
              style={{
                letterSpacing: "0.14em",
                color: "var(--spark-gold)",
              }}
            >
              {row.statusNote.toUpperCase()}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={onApprove}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow: "0 0 24px rgba(197,245,70,0.35)",
              opacity: busy ? 0.5 : 1,
            }}
          >
            ✓ Approve
          </button>
          <button
            onClick={onDecline}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm transition"
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
            className="px-4 py-2 rounded-xl text-sm transition"
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
    </div>
  );
};

/* ─────────────────── inner ─────────────────── */

const ApprovalsInner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const data = useLazyLoadQuery<RequestsQueryType>(
    RequestsQuery,
    { first: 300, filters: tenantId ? { tenantId } : null },
    { fetchPolicy: "store-or-network" },
  );

  // Derive everything from the same dataset so the stats reflect what
  // the queue actually sees (no double-fetch, no stale numbers).
  const { pendingRows, recentlyDecided, stats } = useMemo(() => {
    const allNodes =
      data?.requests?.edges
        ?.map((e) => e?.node)
        ?.filter((n): n is NonNullable<typeof n> => Boolean(n)) ?? [];

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
      if (slug === "pending") {
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
      const market =
        n.retailer?.location?.name ?? n.location?.name ?? "—";
      const stateCode = n.retailer?.location?.state?.code ?? n.state?.code;
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
        locationDate: `${[market, stateCode].filter(Boolean).join(", ")} · ${date}`,
        requester: n.client?.name ?? n.distributor?.name ?? "—",
        type: n.requestType?.name ?? "Activation",
        source: "external" as const,
        statusNote: `Awaiting review · ${n.status?.name ?? "Pending"}`,
        pendingHours,
      };
    };

    const pendingRows: Row[] = pendingNodes.slice(0, 200).map(toRow);

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
  }, [data]);

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

  const confirmApprove = async () => {
    if (!approving) return;
    const r = approving;
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
      setApproving(null);
    } catch (e) {
      showAlert(`Couldn't approve: ${(e as Error).message}`, "error");
    } finally {
      setBusyId(null);
    }
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
      if (approving || declining || bulkConfirm || showHelp) {
        if (e.key === "Escape") {
          setApproving(null);
          setDeclining(null);
          setBulkConfirm(false);
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
          if (focused) {
            e.preventDefault();
            setApproving(focused);
          }
          break;
        case "d":
          if (focused) {
            e.preventDefault();
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
          {stats.pending}
        </p>
      </div>
      <div className="spark-card p-4">
        <p className="label-mini">APPROVED · 30D</p>
        <p
          className="tab-num text-3xl font-bold mt-1"
          style={{ color: "var(--spark-lime)" }}
        >
          {stats.approvedLast30}
        </p>
      </div>
      <div className="spark-card p-4">
        <p className="label-mini">DECLINED · 30D</p>
        <p
          className="tab-num text-3xl font-bold mt-1"
          style={{ color: "var(--spark-orange)" }}
        >
          {stats.declinedLast30}
        </p>
      </div>
      <div className="spark-card p-4">
        <p className="label-mini">DECIDED &lt; 24H</p>
        <p
          className="tab-num text-3xl font-bold mt-1"
          style={{
            color:
              stats.slaPct === null
                ? "rgba(255,255,255,0.55)"
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
          border: "1px solid rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.5)",
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
            color: "rgba(255,255,255,0.55)",
          }}
        >
          RECENTLY DECIDED · LAST 7D
        </p>
        <span
          className="mono text-[10px]"
          style={{
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.4)",
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
              onClick={() => navigate(`/request/view/${d.row.uuid}`)}
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
                    color: "rgba(255,255,255,0.55)",
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
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  {when.toUpperCase()}
                </span>
              </div>
              <p
                className="text-xs mt-1"
                style={{ color: "rgba(255,255,255,0.55)" }}
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
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              No pending requests match "{search}".
            </div>
          </>
        ) : (
          <div
            className="spark-card p-8 text-center text-sm"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Nothing in the approval queue. Nice work.
          </div>
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
        border: "1px solid rgba(197,245,70,0.35)",
        boxShadow: "0 0 24px rgba(197,245,70,0.18)",
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
          color: "rgba(255,255,255,0.6)",
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
          color: "rgba(255,255,255,0.55)",
        }}
      >
        CLEAR
      </button>
      <span className="flex-1" />
      <button
        type="button"
        onClick={() => setBulkConfirm(true)}
        disabled={bulkBusy}
        className="px-4 py-2 rounded-xl text-sm font-semibold"
        style={{
          background: "var(--spark-lime)",
          color: "#0a0d09",
          boxShadow: "0 0 18px rgba(197,245,70,0.35)",
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
      <div className="space-y-3">
      {rows.map((r, idx) => (
        <ApprovalRow
          key={r.uuid}
          row={r}
          busy={busyId === r.id}
          selected={selectedIds.has(r.id)}
          focused={focusedIdx === idx}
          onFocus={() => setFocusedIdx(idx)}
          onToggleSelect={() => toggleSelected(r.id)}
          onApprove={() => setApproving(r)}
          onDecline={() => setDeclining(r)}
          onView={() => navigate(`/request/view/${r.uuid}`)}
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
                ["a", "Approve focused"],
                ["d", "Decline focused"],
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
                    style={{ color: "rgba(255,255,255,0.7)" }}
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
                  color: "rgba(255,255,255,0.55)",
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
              style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}
            >
              Each one creates an Event row and triggers the branded
              approval email to its requestor. Failures (if any) get
              surfaced in the toast — successes are removed from the
              queue.
            </p>
            <div
              className="mt-4 p-4 rounded-xl text-xs max-h-48 overflow-y-auto"
              style={{
                background: "rgba(197,245,70,0.06)",
                border: "1px solid rgba(197,245,70,0.18)",
                color: "rgba(255,255,255,0.75)",
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
                        color: "rgba(255,255,255,0.45)",
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
                    color: "rgba(255,255,255,0.45)",
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
                  color: "rgba(255,255,255,0.55)",
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
                  boxShadow: "0 0 24px rgba(197,245,70,0.35)",
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

      {/* Approve confirmation — in Spark chrome instead of browser-native
          confirm(). Surfaces what actually happens downstream so kyle
          isn't flying blind on a "yes" click. */}
      {approving && (
        <div
          onClick={() => !busyId && setApproving(null)}
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
              APPROVE REQUEST
            </p>
            <h2
              className="display text-2xl font-bold"
              style={{ letterSpacing: "-0.03em" }}
            >
              Approve {approving.reqId}?
            </h2>
            <p
              className="text-sm mt-2"
              style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}
            >
              <strong>{approving.venue}</strong> · {approving.locationDate}
            </p>
            <div
              className="mt-4 p-4 rounded-xl text-xs"
              style={{
                background: "rgba(197,245,70,0.06)",
                border: "1px solid rgba(197,245,70,0.18)",
                color: "rgba(255,255,255,0.75)",
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
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => {
                  if (busyId) return;
                  setApproving(null);
                }}
                className="mono text-[11px] px-3"
                style={{
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                CANCEL
              </button>
              <button
                onClick={confirmApprove}
                disabled={busyId !== null}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-lime)",
                  color: "#0a0d09",
                  boxShadow: "0 0 24px rgba(197,245,70,0.35)",
                  opacity: busyId !== null ? 0.5 : 1,
                }}
              >
                {busyId ? "Approving…" : "✓ Approve + notify"}
              </button>
            </div>
          </div>
        </div>
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
              style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}
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
                    color: "rgba(255,255,255,0.75)",
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
                    : "rgba(255,255,255,0.45)",
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
                  color: "rgba(255,255,255,0.55)",
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

/* ─────────────────── page ─────────────────── */

export default function SparkApprovals() {
  // Approvals are admin-only; route is also wrapped in AdminOnly. Keep the
  // hook usage in case it's referenced elsewhere; auth gate at route level.
  void useSparkRole;
  return (
    <Layout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              PENDING APPROVALS
            </p>
            <h1
              className="display text-4xl font-bold mt-2"
              style={{ letterSpacing: "-0.04em" }}
            >
              Review &amp; approve.
            </h1>
            <p
              className="mt-2"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              External requests route to a mapped client user. Logged-in
              submissions auto-approve. Approvals queue a job in{" "}
              <span style={{ color: "var(--spark-gold)" }}>
                Queue for Ignite
              </span>
              .
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              ✉ Send admin digest
            </button>
            <button
              className="px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              ⚙ Auto-rules
            </button>
          </div>
        </div>

        {/* How it works */}
        <div
          className="spark-card p-5"
          style={{
            borderColor: "rgba(197,245,70,0.25)",
            background:
              "linear-gradient(180deg, rgba(197,245,70,0.06), transparent)",
          }}
        >
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.16em",
              color: "var(--spark-lime)",
            }}
          >
            APPROVAL ROUTING — HOW IT WORKS
          </p>
          <div className="grid md:grid-cols-3 gap-4 mt-4 text-sm">
            <div>
              <p className="font-bold">External request (no login)</p>
              <p
                className="mt-1"
                style={{ color: "rgba(255,255,255,0.65)" }}
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
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                → Auto-approved
                <br />→ Email confirmation to admin team
              </p>
            </div>
            <div>
              <p className="font-bold">Daily digest</p>
              <p
                className="mt-1"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                → Cron sends end-of-day summary to admins
                <br />→ Pending / approved / declined counts
              </p>
            </div>
          </div>
        </div>

        {/* Queue (stats live inside ApprovalsInner so they share the data fetch) */}
        <Suspense
          fallback={
            <div
              className="spark-card p-8 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Loading approvals…
            </div>
          }
        >
          <ApprovalsInner />
        </Suspense>
      </div>
    </Layout>
  );
}
