import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import Layout from "@/layout/Layout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import SparkConfirm from "@/shared/SparkConfirm";
import { useAuthStore } from "@/store/authStore";
import FieldMarketingCalendar from "./FieldMarketingCalendar";
import FieldMarketingPlanForm from "./FieldMarketingPlanForm";
import {
  PLAN_ACTIVITIES,
  emptyPlanForm,
  formFromRow,
  planInput,
  type PlanFormState,
} from "./fieldMarketingForm";
import useSparkRole from "@/hooks/useSparkRole";
import ActivationPlansPipelineCard from "@/plans/ActivationPlansPipelineCard";
import { postGql } from "./fieldMarketingGql";
import PlanResultsSheet from "./PlanResultsSheet";
import { resultsBadge } from "./planResultsFormat";
import ProgramSwitch from "./ProgramSwitch";
import {
  downloadCsv,
  fieldMarketingCsv,
  matchesTactic,
} from "./fieldMarketingExport";
import {
  booksWithIgnite,
  deleteConfirmCopy,
  hasLogged,
  isBooked,
  requestFormHref,
  rowStatus,
  showsCans,
  showsDays,
  showsPours,
} from "./fieldMarketingRules";
import type { Board, FmEvent, Manager } from "./fieldMarketingTypes";

/**
 * Torch Plans = field marketing planner (merged with Activation Plans nav).
 * Dense month table, filter by market/RMM, projected KPI rollups, push to Ignite.
 */

type MutatedEvent = {
  id: string;
  requestCode: string | null;
  status: string;
  market?: string | null;
  startsOn?: string | null;
};

type DeletePayload = {
  deleteFieldMarketing: {
    success: boolean;
    message: string;
    requestCode: string | null;
    requestCancelled: boolean;
    canUndo: boolean;
  };
};

type Toast = { message: string; undoId: string | null };

const EVENT_FIELDS = `
  id market marketLabel managerName activity activityLabel name startsOn days
  address notes samplingFormat samplingLabel supportType supportLabel supportOther
  skuNames needsFieldSupport ambassadorCount supportTimes startTime endTime supportScope
  plannedFullCans plannedPourSamples plannedEmails
  loggedFullCans loggedPourSamples loggedEmails loggedDays loggedCases
  status requestCode requestUuid requestCancelled canBook deleteEffect
  deletedAt deletedByName deleteCancelledRequest resultsCounted resultsPending
`;

const BOARD = `
  query FieldMarketingBoard($month: String, $tenantId: ID, $market: String, $quarter: String, $activity: String, $includeDeleted: Boolean!) {
    fieldMarketing(month: $month, tenantId: $tenantId, market: $market, quarter: $quarter, activity: $activity, includeDeleted: $includeDeleted) {
      available
      month
      monthLabel
      canRestore
      managers { market marketLabel name email phone }
      kpis { key label detail target planned logged unit }
      skus
      events { ${EVENT_FIELDS} }
      deletedEvents { ${EVENT_FIELDS} }
    }
  }
`;

const PLAN = `
  mutation PlanFieldMarketing($input: PlanFieldMarketingInput!) {
    planFieldMarketing(input: $input) {
      success
      message
      event { id requestCode status market startsOn }
    }
  }
`;

const UPDATE = `
  mutation UpdateFieldMarketing($input: UpdateFieldMarketingInput!) {
    updateFieldMarketing(input: $input) {
      success
      message
      event { id requestCode status market startsOn }
    }
  }
`;

const SUBMIT = `
  mutation SubmitFieldMarketing($input: SubmitFieldMarketingInput!) {
    submitFieldMarketing(input: $input) {
      success
      message
      event { id requestCode status market startsOn }
    }
  }
`;

const LOG = `
  mutation LogFieldMarketing($input: LogFieldMarketingInput!) {
    logFieldMarketing(input: $input) {
      success
      message
    }
  }
`;

const DELETE = `
  mutation DeleteFieldMarketing($input: DeleteFieldMarketingInput!) {
    deleteFieldMarketing(input: $input) {
      success
      message
      requestCode
      requestCancelled
      canUndo
    }
  }
`;

const RESTORE = `
  mutation RestoreFieldMarketing($input: RestoreFieldMarketingInput!) {
    restoreFieldMarketing(input: $input) {
      success
      message
    }
  }
`;

const TACTICS = [{ id: "", label: "All tactics" }, ...PLAN_ACTIVITIES];

const FALLBACK_MANAGERS: Manager[] = [
  {
    market: "miami",
    marketLabel: "Miami",
    name: "Alec Aparicio",
    email: "alec@torchdrinks.com",
    phone: "786-348-9538",
  },
  {
    market: "orlando",
    marketLabel: "Orlando",
    name: "Octavius Jefferson",
    email: "octavius@torchdrinks.com",
    phone: "772-646-2137",
  },
  {
    market: "houston",
    marketLabel: "Houston",
    name: "Victoria Quintana",
    email: "victoria@torchdrinks.com",
    phone: "979-575-1622",
  },
  {
    market: "austin-dallas",
    marketLabel: "Austin / Dallas",
    name: "Brittany Senglin",
    email: "brittany@torchdrinks.com",
    phone: "972-978-7253",
  },
];

const ORANGE = "var(--spark-orange, #ef5a2a)";
const STICKY_ACTIONS =
  "md:sticky md:right-0 bg-base-100 md:shadow-[-12px_0_12px_-12px_rgba(0,0,0,0.35)]";

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function fmtNum(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function FieldMarketing() {
  const { tenantId } = useAuthStore();
  const { isClient } = useSparkRole();
  const [resultsFor, setResultsFor] = useState<FmEvent | null>(null);
  // Default: all plans (no date filter). Optional month narrows the table + KPIs.
  const [month, setMonth] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [tactic, setTactic] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [revealKey, setRevealKey] = useState(0);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<PlanFormState>(emptyPlanForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [exportQuarter, setExportQuarter] = useState("");
  const [exporting, setExporting] = useState(false);
  const [confirmRow, setConfirmRow] = useState<FmEvent | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [logDraft, setLogDraft] = useState({
    cans: "",
    pours: "",
    emails: "",
    days: "",
    cases: "",
  });
  const loadSeq = useRef(0);
  const formRef = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // On phones the form opens below the fold; bring it to the tap.
  useEffect(() => {
    if (!revealKey) return;
    const node = formRef.current;
    if (!node) return;
    // The sticky topbar wraps to ~150px on phones and would cover the form.
    const topbar = document.querySelector<HTMLElement>("header.sticky");
    node.style.scrollMarginTop = `${(topbar?.offsetHeight ?? 0) + 12}px`;
    node.querySelector<HTMLElement>("select, input")?.focus({ preventScroll: true });
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [revealKey]);

  useEffect(() => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError("");
    postGql<{ fieldMarketing: Board }>(BOARD, {
      month: month || null,
      tenantId: tenantId || null,
      market: marketFilter || null,
      activity: tactic || null,
      includeDeleted: showDeleted,
    })
      .then((data) => {
        if (seq !== loadSeq.current) return;
        setBoard(data.fieldMarketing);
        setSelected(new Set());
      })
      .catch((err) => {
        if (seq !== loadSeq.current) return;
        setError(err instanceof Error ? err.message : "Could not load the plan.");
      })
      .finally(() => {
        if (seq === loadSeq.current) setLoading(false);
      });
  }, [tenantId, month, marketFilter, tactic, showDeleted, reloadKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 10000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const skuOptions = board?.skus ?? [];
  const managers = board?.managers?.length ? board.managers : FALLBACK_MANAGERS;
  const events = useMemo(() => {
    const rows = board?.events ?? [];
    return rows.filter((row) => matchesTactic(row.activity, tactic));
  }, [board?.events, tactic]);
  const deletedEvents = board?.deletedEvents ?? [];
  const kpis = board?.kpis ?? [];

  const draftRows = useMemo(
    () => events.filter((row) => row.status !== "submitted"),
    [events],
  );

  const selectedDraftIds = useMemo(
    () => draftRows.filter((row) => selected.has(row.id)).map((row) => row.id),
    [draftRows, selected],
  );

  const summaryLine = useMemo(() => {
    if (!events.length) return "Nothing in the plan for this filter.";
    const booked = events.filter(isBooked).length;
    const cancelled = events.filter((row) => row.requestCancelled).length;
    const confirmed = events.filter(
      (row) => row.status === "submitted" && !isBooked(row) && !row.requestCancelled,
    ).length;
    const parts = [
      `${events.length} in plan`,
      `${draftRows.length} draft`,
      `${booked} booked with Ignite`,
    ];
    if (confirmed > 0) parts.push(`${confirmed} confirmed (no request)`);
    if (cancelled > 0) parts.push(`${cancelled} request cancelled`);
    return parts.join(" · ");
  }, [events, draftRows]);

  const activeManager = marketFilter
    ? managers.find((m) => m.market === marketFilter)
    : null;

  /** Show the touched row: drop the month filter and follow it to its market. */
  function reloadShowing(rowMarket?: string | null) {
    setMonth("");
    if (rowMarket && marketFilter && rowMarket !== marketFilter) {
      setMarketFilter(rowMarket);
    }
    reload();
  }

  function openNewForm() {
    if (showPlanForm && !editingId) {
      setShowPlanForm(false);
      return;
    }
    setEditingId(null);
    setFormError("");
    setForm({ ...emptyPlanForm, market: marketFilter || emptyPlanForm.market });
    setShowPlanForm(true);
    revealForm();
  }

  function openEdit(row: FmEvent) {
    setEditingId(row.id);
    setFormError("");
    setForm(formFromRow(row));
    setShowPlanForm(true);
    setView("list");
    revealForm();
  }

  function revealForm() {
    setRevealKey((k) => k + 1);
  }

  function closeForm() {
    setShowPlanForm(false);
    setEditingId(null);
    setFormError("");
    setForm({ ...emptyPlanForm, market: marketFilter || emptyPlanForm.market });
  }

  async function save(submit: boolean) {
    setSaving(true);
    setFormError("");
    setNotice("");
    try {
      const input = { ...planInput(form), tenantId: tenantId || null };
      let ev: MutatedEvent | null;
      if (editingId) {
        const data = await postGql<{ updateFieldMarketing: { event: MutatedEvent | null } }>(
          UPDATE,
          { input: { ...input, eventId: editingId } },
        );
        ev = data.updateFieldMarketing.event;
        if (submit && ev) {
          const booked = await postGql<{ submitFieldMarketing: { event: MutatedEvent | null } }>(
            SUBMIT,
            { input: { eventId: ev.id, tenantId: tenantId || null } },
          );
          ev = booked.submitFieldMarketing.event;
        }
      } else {
        const data = await postGql<{ planFieldMarketing: { event: MutatedEvent | null } }>(
          PLAN,
          { input: { ...input, submit } },
        );
        ev = data.planFieldMarketing.event;
      }
      const code = ev?.requestCode;
      const savedMarket = form.market;
      closeForm();
      setNotice(
        submit
          ? code
            ? `Submitted to Ignite · ${code}`
            : "Submitted to Ignite."
          : editingId
            ? "Plan updated."
            : "Saved to the plan.",
      );
      reloadShowing(savedMarket);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function pushToIgnite(ids: string[]) {
    if (!ids.length) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    const codes: string[] = [];
    let lastMarket: string | null = null;
    let done = 0;
    try {
      for (const eventId of ids) {
        const data = await postGql<{ submitFieldMarketing: { event: MutatedEvent | null } }>(
          SUBMIT,
          { input: { eventId, tenantId: tenantId || null } },
        );
        const ev = data.submitFieldMarketing.event;
        if (ev?.requestCode) codes.push(ev.requestCode);
        if (ev?.market) lastMarket = ev.market;
        done += 1;
      }
      setNotice(
        codes.length
          ? `Pushed to Ignite · ${codes.join(", ")}`
          : `Pushed ${ids.length} to Ignite.`,
      );
      reloadShowing(lastMarket);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Could not submit.";
      setError(done ? `${done} of ${ids.length} booked. Then: ${reason}` : reason);
      reload();
    } finally {
      setSubmitting(false);
    }
  }

  async function logEvent(row: FmEvent) {
    setError("");
    setNotice("");
    const optional = (raw: string): number | null => {
      const trimmed = raw.trim();
      if (!trimmed) return null;
      const value = Number(trimmed);
      if (!Number.isFinite(value)) throw new Error("Use whole numbers.");
      return Math.round(value);
    };
    try {
      await postGql(LOG, {
        input: {
          eventId: row.id,
          loggedFullCans: showsCans(row.activity, row.samplingFormat)
            ? optional(logDraft.cans)
            : null,
          loggedPourSamples: showsPours(row.activity, row.samplingFormat)
            ? optional(logDraft.pours)
            : null,
          loggedEmails: optional(logDraft.emails),
          loggedDays: showsDays(row.activity) ? optional(logDraft.days) : null,
          loggedCases:
            row.activity === "product_seeding" ? optional(logDraft.cases) : null,
          tenantId: tenantId || null,
        },
      });
      setLoggingId(null);
      setNotice("Logged. Scorecard logged totals update from this.");
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log.");
    }
  }

  function dropRows(ids: string[]) {
    const gone = new Set(ids);
    setBoard((prev) =>
      prev ? { ...prev, events: prev.events.filter((row) => !gone.has(row.id)) } : prev,
    );
    setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))));
    if (loggingId && gone.has(loggingId)) setLoggingId(null);
    if (editingId && gone.has(editingId)) closeForm();
  }

  async function deleteRow(row: FmEvent) {
    setDeleting(true);
    setError("");
    setNotice("");
    const snapshot = board;
    dropRows([row.id]);
    setConfirmRow(null);
    try {
      const data = await postGql<DeletePayload>(DELETE, {
        input: { eventId: row.id, tenantId: tenantId || null },
      });
      const res = data.deleteFieldMarketing;
      setToast({
        message: res.canUndo && res.requestCancelled
          ? `${res.message} Undo brings back the plan only.`
          : res.message,
        undoId: res.canUndo ? row.id : null,
      });
      reload();
    } catch (err) {
      setBoard(snapshot);
      setError(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleting(false);
    }
  }

  async function deleteSelectedDrafts() {
    const ids = selectedDraftIds;
    if (!ids.length) return;
    setDeleting(true);
    setError("");
    setNotice("");
    setConfirmBulk(false);
    dropRows(ids);
    let done = 0;
    try {
      for (const eventId of ids) {
        await postGql<DeletePayload>(DELETE, {
          input: { eventId, tenantId: tenantId || null },
        });
        done += 1;
      }
      setToast({ message: `Deleted ${done} draft${done === 1 ? "" : "s"}.`, undoId: null });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Could not delete.";
      setError(done ? `${done} of ${ids.length} deleted. Then: ${reason}` : reason);
    } finally {
      setDeleting(false);
      reload();
    }
  }

  async function restore(id: string) {
    setRestoringId(id);
    setError("");
    try {
      const data = await postGql<{ restoreFieldMarketing: { message: string } }>(RESTORE, {
        input: { eventId: id, tenantId: tenantId || null },
      });
      setToast(null);
      setNotice(data.restoreFieldMarketing.message);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore.");
    } finally {
      setRestoringId(null);
    }
  }

  function toggleAllDrafts() {
    if (selectedDraftIds.length === draftRows.length && draftRows.length > 0) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(draftRows.map((row) => row.id)));
  }

  async function exportPlan() {
    setExporting(true);
    setError("");
    try {
      const quarter = exportQuarter.trim();
      const data = await postGql<{ fieldMarketing: Board }>(BOARD, {
        month: quarter ? null : month || null,
        quarter: quarter || null,
        tenantId: tenantId || null,
        market: marketFilter || null,
        activity: tactic || null,
        includeDeleted: false,
      });
      const rows = (data.fieldMarketing.events ?? []).filter((row) =>
        matchesTactic(row.activity, tactic),
      );
      const stamp = quarter || month || "all";
      downloadCsv(`torch-field-marketing-${stamp}.csv`, fieldMarketingCsv(rows));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export.");
    } finally {
      setExporting(false);
    }
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const confirmCopy = confirmRow ? deleteConfirmCopy(confirmRow) : null;

  return (
    <Layout>
      <div className="space-y-5 max-w-[1400px] spark-fade-in">
        <SparkPageHeader
          eyebrow="TORCH THC · PLANS"
          title="Plans."
          support="All field marketing plans for Torch — filter by market/RMM or month, see projected results, and push rows to Ignite to execute. Retail sampling stays on Master Tracker."
        />
        <ProgramSwitch active="field" />

        <ActivationPlansPipelineCard tenantId={tenantId} />

        {board && !board.available ? (
          <p className="spark-support">
            Plans (field marketing) is the Torch THC program. Switch to that brand.
          </p>
        ) : null}

        {error ? (
          <p className="text-sm" role="alert" style={{ color: ORANGE }}>
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="text-sm" style={{ color: "var(--spark-lime, #c5f546)" }}>
            {notice}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="spark-title text-lg">
              {month ? board?.monthLabel || month : "All plans"}
            </p>
            <label className="text-sm flex items-center gap-2">
              <span className="opacity-60">Month</span>
              <select
                className="select select-bordered select-sm"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                <option value="">All months</option>
                {Array.from({ length: 18 }, (_, i) => {
                  const cursor = new Date();
                  cursor.setDate(1);
                  cursor.setMonth(cursor.getMonth() - 6 + i);
                  const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
                  const label = cursor.toLocaleDateString(undefined, {
                    month: "short",
                    year: "numeric",
                  });
                  return (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="spark-support">{loading ? "Loading…" : summaryLine}</p>
            <div className="flex rounded-full border border-white/10 p-0.5" role="tablist" aria-label="Plan view">
              <button
                type="button"
                role="tab"
                aria-selected={view === "list"}
                className={`pill-btn ${view === "list" ? "on" : ""}`}
                onClick={() => setView("list")}
              >
                List
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "calendar"}
                className={`pill-btn ${view === "calendar" ? "on" : ""}`}
                onClick={() => {
                  setView("calendar");
                  if (!month) setMonth(currentMonthKey());
                }}
              >
                Calendar
              </button>
            </div>
            <label className="text-sm flex items-center gap-2">
              <span className="opacity-60">Export</span>
              <select
                className="select select-bordered select-sm"
                value={exportQuarter}
                onChange={(e) => setExportQuarter(e.target.value)}
                aria-label="Export range"
              >
                <option value="">
                  {month ? "Selected month" : "All dates"}
                </option>
                {[0, 1].flatMap((offset) => {
                  const year = new Date().getFullYear() + offset;
                  return [1, 2, 3, 4].map((q) => (
                    <option key={`${year}-Q${q}`} value={`${year}-Q${q}`}>
                      {year} Q{q}
                    </option>
                  ));
                })}
              </select>
            </label>
            <button
              type="button"
              className="spark-btn-ghost"
              disabled={exporting}
              onClick={() => void exportPlan()}
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <button type="button" className="spark-btn-ghost" onClick={openNewForm}>
              {showPlanForm && !editingId ? "Close form" : "Add to plan"}
            </button>
            {selectedDraftIds.length ? (
              <button
                type="button"
                className="spark-btn-ghost"
                style={{ color: ORANGE, borderColor: "rgba(239,90,42,0.45)" }}
                disabled={deleting}
                onClick={() => setConfirmBulk(true)}
              >
                Delete {selectedDraftIds.length}
              </button>
            ) : null}
            <button
              type="button"
              className="spark-btn-primary"
              disabled={submitting || selectedDraftIds.length === 0}
              onClick={() => void pushToIgnite(selectedDraftIds)}
            >
              {submitting
                ? "Booking…"
                : selectedDraftIds.length
                  ? `Book ${selectedDraftIds.length} with Ignite`
                  : "Book with Ignite"}
            </button>
          </div>
        </div>

        {showPlanForm ? (
          <div ref={formRef}>
            <FieldMarketingPlanForm
              form={form}
              onChange={setForm}
              managers={managers}
              skuOptions={skuOptions}
              editing={Boolean(editingId)}
              saving={saving}
              error={formError}
              onSave={(submit) => void save(submit)}
              onCancel={closeForm}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 items-center" role="tablist" aria-label="Market">
          <button
            type="button"
            role="tab"
            aria-selected={!marketFilter}
            className={`pill-btn ${!marketFilter ? "on" : ""}`}
            onClick={() => setMarketFilter("")}
          >
            All markets
          </button>
          {managers.map((manager) => (
            <button
              key={manager.market}
              type="button"
              role="tab"
              aria-selected={marketFilter === manager.market}
              className={`pill-btn ${marketFilter === manager.market ? "on" : ""}`}
              onClick={() => setMarketFilter(manager.market)}
              title={`${manager.name} · ${manager.email}`}
            >
              {manager.marketLabel}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center" role="tablist" aria-label="Tactic">
          {TACTICS.map((row) => (
            <button
              key={row.id || "all"}
              type="button"
              role="tab"
              aria-selected={tactic === row.id}
              className={`pill-btn ${tactic === row.id ? "on" : ""}`}
              onClick={() => setTactic(row.id)}
            >
              {row.label}
            </button>
          ))}
        </div>
        {activeManager ? (
          <p className="text-sm opacity-70">
            RMM · {activeManager.name} · {activeManager.phone} ·{" "}
            <a href={`mailto:${activeManager.email}`}>{activeManager.email}</a>
          </p>
        ) : (
          <p className="text-xs opacity-55">
            Filter by market to scope the plan and projected totals to that RMM.
          </p>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {kpis.map((kpi) => (
            <article
              key={kpi.key}
              className="rounded-xl border border-white/10 p-3.5"
              style={{ background: "#0A0B0D" }}
            >
              <p className="label-mini mb-2">{kpi.label}</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: "#c5f546" }}>
                {fmtNum(kpi.planned)}
                {month && !tactic ? (
                  <span className="text-sm font-normal opacity-55 text-white">
                    {" "}
                    / {kpi.target.toLocaleString()}
                  </span>
                ) : null}
              </p>
              <p className="mt-1.5 text-xs opacity-70">
                Projected (planned) {kpi.unit}
                {!month ? " · all dates" : ""}
              </p>
              <p className="mt-1 text-xs opacity-55">
                Logged {fmtNum(kpi.logged)} {kpi.unit}
              </p>
              <p className="mt-2 text-[11px] leading-snug opacity-50">{kpi.detail}</p>
            </article>
          ))}
        </section>
        <p className="text-xs opacity-55">
          Lime number is projected (planned) for the current filter
          {marketFilter ? " and market" : ""}
          {tactic ? " and tactic" : ""}.
          {month && !tactic
            ? " Targets are the monthly scorecard for the selected month."
            : tactic
              ? " One tactic isn't scored against the whole monthly target."
              : " All months shows planned sums only — monthly targets (1,152 cans / 3,456 pours / …) are not scored against a multi-month rollup."}{" "}
          Logged is the manual log, else approved recaps pushed to the plan, and
          stays a dash until one of those comes in. 4oz pours are not added into
          full cans. Deleted plans never count.
        </p>

        {view === "calendar" ? (
          <FieldMarketingCalendar
            month={month || currentMonthKey()}
            events={events}
            onMonth={setMonth}
          />
        ) : (
        <section className="rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider opacity-60">
                  <th className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      checked={
                        draftRows.length > 0 &&
                        selectedDraftIds.length === draftRows.length
                      }
                      onChange={toggleAllDrafts}
                      aria-label="Select all drafts"
                    />
                  </th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Market</th>
                  <th className="px-2 py-2 hidden 2xl:table-cell">RMM</th>
                  <th className="px-2 py-2">Activity</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2 text-right">Days</th>
                  <th className="px-2 py-2 text-right">Cans</th>
                  <th className="px-2 py-2 text-right">Pours</th>
                  <th className="px-2 py-2 text-right">Cases</th>
                  <th className="px-2 py-2 text-right">Emails</th>
                  <th className="px-2 py-2">Status</th>
                  <th className={`px-2 py-2 text-right ${STICKY_ACTIONS}`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={13} className="px-3 py-8 text-center opacity-55 text-sm">
                      No plan rows
                      {month ? " for this month" : ""}
                      {marketFilter ? " and market" : ""}
                      {tactic ? " and tactic" : ""}. Add to plan to start.
                    </td>
                  </tr>
                ) : null}
                {events.map((row) => {
                  const isDraft = row.status !== "submitted";
                  const booked = isBooked(row);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-white/5 hover:bg-white/[0.03]"
                    >
                      <td className="px-3 py-2">
                        {isDraft ? (
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs"
                            checked={selected.has(row.id)}
                            onChange={() => toggleRow(row.id)}
                            aria-label={`Select ${row.name}`}
                          />
                        ) : null}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap tabular-nums text-sm">
                        {fmtDay(row.startsOn)}
                        {row.supportTimes ? (
                          <span className="block text-[11px] opacity-50">{row.supportTimes}</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-sm">
                        {row.marketLabel}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-sm opacity-70 hidden 2xl:table-cell">
                        {row.managerName}
                      </td>
                      <td className="px-2 py-2 text-sm opacity-80 max-w-[130px]">
                        <span className="block truncate">{row.activityLabel}</span>
                        {row.supportLabel ? (
                          <span className="block text-[11px] opacity-50 truncate">
                            {row.supportOther
                              ? `${row.supportLabel}: ${row.supportOther}`
                              : row.supportLabel}
                          </span>
                        ) : null}
                        {row.samplingLabel ? (
                          <span className="block text-[11px] opacity-50 truncate">
                            {row.samplingLabel}
                          </span>
                        ) : null}
                        {row.skuNames?.length ? (
                          <span className="block text-[11px] opacity-50 truncate">
                            {row.skuNames.join(", ")}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-sm font-medium max-w-[160px]">
                        <span className="truncate block" title={row.name}>
                          {row.name}
                        </span>
                        {row.address ? (
                          <span
                            className="block text-[11px] opacity-45 truncate"
                            title={row.address}
                          >
                            {row.address}
                          </span>
                        ) : booksWithIgnite(row) ? (
                          <span className="block text-[11px]" style={{ color: ORANGE }}>
                            Needs address
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-sm">
                        {showsDays(row.activity) ? row.days : "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-sm">
                        {fmtNum(row.loggedFullCans ?? (row.plannedFullCans || null))}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-sm">
                        {fmtNum(row.loggedPourSamples ?? (row.plannedPourSamples || null))}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-sm">
                        {fmtNum(row.loggedCases)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-sm">
                        {fmtNum(row.loggedEmails ?? (row.plannedEmails || null))}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs">
                        {booked && row.requestUuid ? (
                          <Link
                            to={`/request/view/${row.requestUuid}`}
                            className="inline-block px-2 py-0.5 rounded border border-white/10 hover:border-white/30"
                            style={{ color: "#c5f546" }}
                            title="Open the request"
                          >
                            {rowStatus(row)} ↗
                          </Link>
                        ) : (
                          <span
                            className="inline-block px-2 py-0.5 rounded border border-white/10"
                            style={{
                              color: row.requestCancelled
                                ? ORANGE
                                : row.status === "submitted"
                                  ? "#c5f546"
                                  : hasLogged(row)
                                    ? "rgba(255,255,255,0.7)"
                                    : "rgba(255,255,255,0.55)",
                            }}
                          >
                            {rowStatus(row)}
                          </span>
                        )}
                        {resultsBadge(
                          row.resultsCounted,
                          isClient ? 0 : row.resultsPending,
                        ) ? (
                          <button
                            type="button"
                            className="block mt-1 mono text-[10px] px-2 py-0.5 rounded-full"
                            style={{
                              letterSpacing: "0.08em",
                              color: row.resultsCounted ? "#c5f546" : "#ef5a2a",
                              background: row.resultsCounted
                                ? "rgba(197,245,70,0.10)"
                                : "rgba(239,90,42,0.10)",
                              border: row.resultsCounted
                                ? "1px solid rgba(197,245,70,0.3)"
                                : "1px solid rgba(239,90,42,0.3)",
                            }}
                            onClick={() => setResultsFor(row)}
                            title="Planned vs actual from the recaps pushed to this plan"
                          >
                            {resultsBadge(
                              row.resultsCounted,
                              isClient ? 0 : row.resultsPending,
                            )}
                          </button>
                        ) : null}
                      </td>
                      <td className={`px-2 py-2 text-right ${STICKY_ACTIONS}`}>
                        <div className="flex flex-wrap gap-1 justify-end w-[150px] ml-auto">
                          {row.canBook ? (
                            <button
                              type="button"
                              className="spark-btn-ghost !px-2 !py-1 text-xs"
                              disabled={submitting}
                              onClick={() => void pushToIgnite([row.id])}
                              title={
                                booksWithIgnite(row)
                                  ? "Book as Event Activation on the tracker"
                                  : "Confirm on the plan (no Ignite request for this tactic)"
                              }
                            >
                              {booksWithIgnite(row)
                                ? row.requestCancelled
                                  ? "Book again"
                                  : "Book Ignite"
                                : "Confirm"}
                            </button>
                          ) : null}
                          {row.canBook && booksWithIgnite(row) ? (
                            <a
                              className="spark-btn-ghost !px-2 !py-1 text-xs inline-flex items-center"
                              href={requestFormHref(row)}
                              title="Open the full Event Activation request form, prefilled from this plan row"
                            >
                              Full form
                            </a>
                          ) : null}
                          {!booked ? (
                            <button
                              type="button"
                              className="spark-btn-ghost !px-2 !py-1 text-xs"
                              onClick={() => openEdit(row)}
                            >
                              Edit
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="spark-btn-ghost !px-2 !py-1 text-xs"
                            onClick={() => {
                              setLoggingId(loggingId === row.id ? null : row.id);
                              setLogDraft({
                                cans: "",
                                pours: "",
                                emails: "",
                                days: "",
                                cases: "",
                              });
                            }}
                          >
                            Log
                          </button>
                          <button
                            type="button"
                            className="spark-btn-ghost !px-2 !py-1 text-xs"
                            style={{ color: ORANGE }}
                            disabled={deleting}
                            onClick={() => setConfirmRow(row)}
                            aria-label={`Delete ${row.name}`}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {loggingId ? (
            <div className="border-t border-white/10 p-3 flex flex-wrap gap-2 items-end bg-black/30">
              {(() => {
                const row = events.find((r) => r.id === loggingId);
                if (!row) return null;
                return (
                  <>
                    <p className="text-xs opacity-60 w-full">
                      Log results · {row.name}
                    </p>
                    {showsCans(row.activity, row.samplingFormat) ? (
                      <input
                        className="input input-bordered input-sm"
                        inputMode="numeric"
                        placeholder="Cans logged"
                        value={logDraft.cans}
                        onChange={(e) =>
                          setLogDraft({ ...logDraft, cans: e.target.value })
                        }
                      />
                    ) : null}
                    {showsPours(row.activity, row.samplingFormat) ? (
                      <input
                        className="input input-bordered input-sm"
                        inputMode="numeric"
                        placeholder="Pours logged"
                        value={logDraft.pours}
                        onChange={(e) =>
                          setLogDraft({ ...logDraft, pours: e.target.value })
                        }
                      />
                    ) : null}
                    {row.activity === "product_seeding" ? (
                      <input
                        className="input input-bordered input-sm"
                        inputMode="numeric"
                        placeholder="Cases seeded"
                        value={logDraft.cases}
                        onChange={(e) =>
                          setLogDraft({ ...logDraft, cases: e.target.value })
                        }
                      />
                    ) : null}
                    {showsDays(row.activity) ? (
                      <input
                        className="input input-bordered input-sm"
                        inputMode="numeric"
                        placeholder="Days logged"
                        value={logDraft.days}
                        onChange={(e) =>
                          setLogDraft({ ...logDraft, days: e.target.value })
                        }
                      />
                    ) : null}
                    <input
                      className="input input-bordered input-sm"
                      inputMode="numeric"
                      placeholder="Emails logged"
                      value={logDraft.emails}
                      onChange={(e) =>
                        setLogDraft({ ...logDraft, emails: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="spark-btn-primary"
                      onClick={() => void logEvent(row)}
                    >
                      {row.activity === "retail_support" || row.activity === "sales_support"
                        ? "Save / mark done"
                        : "Save logged"}
                    </button>
                    <button
                      type="button"
                      className="spark-btn-ghost"
                      onClick={() => setLoggingId(null)}
                    >
                      Cancel
                    </button>
                  </>
                );
              })()}
            </div>
          ) : null}
        </section>
        )}

        {board?.canRestore ? (
          <div className="space-y-2">
            <label className="text-xs inline-flex items-center gap-2 opacity-70">
              <input
                type="checkbox"
                className="checkbox checkbox-xs"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
              />
              Show deleted plans (Ignite admins)
            </label>
            {showDeleted ? (
              <section className="rounded-xl border border-white/10 overflow-hidden">
                <p className="px-3 pt-3 text-xs opacity-60">
                  Restoring brings the plan back. A request the delete cancelled stays
                  cancelled — book the plan again if it's back on.
                </p>
                <div className="overflow-x-auto">
                  <table className="table table-sm w-full">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider opacity-60">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-2 py-2">Market</th>
                        <th className="px-2 py-2">Name</th>
                        <th className="px-2 py-2">Deleted</th>
                        <th className="px-2 py-2">Request</th>
                        <th className="px-2 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deletedEvents.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center opacity-55 text-sm">
                            No deleted plans for this filter.
                          </td>
                        </tr>
                      ) : null}
                      {deletedEvents.map((row) => (
                        <tr key={row.id} className="border-b border-white/5 opacity-80">
                          <td className="px-3 py-2 whitespace-nowrap tabular-nums text-sm">
                            {fmtDay(row.startsOn)}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-sm">{row.marketLabel}</td>
                          <td className="px-2 py-2 text-sm">
                            <span className="block truncate max-w-[240px]">{row.name}</span>
                            <span className="block text-[11px] opacity-50">{row.activityLabel}</span>
                          </td>
                          <td className="px-2 py-2 text-xs opacity-70 whitespace-nowrap">
                            {row.deletedAt ? new Date(row.deletedAt).toLocaleString() : ""}
                            {row.deletedByName ? ` · ${row.deletedByName}` : ""}
                          </td>
                          <td className="px-2 py-2 text-xs whitespace-nowrap">
                            {row.requestCode
                              ? row.deleteCancelledRequest
                                ? `${row.requestCode} cancelled`
                                : row.requestUuid
                                  ? `${row.requestCode} kept`
                                  : `${row.requestCode} cancelled`
                              : "—"}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              className="spark-btn-ghost !px-2 !py-1 text-xs"
                              disabled={restoringId === row.id}
                              onClick={() => void restore(row.id)}
                            >
                              {restoringId === row.id ? "Restoring…" : "Restore"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {!marketFilter && managers.length ? (
          <details className="text-sm opacity-70">
            <summary className="cursor-pointer label-mini mb-2">RMM directory</summary>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 mt-2">
              {managers.map((manager) => (
                <div key={manager.market} className="rounded-lg border border-white/10 p-3">
                  <p className="font-medium">{manager.marketLabel}</p>
                  <p>{manager.name}</p>
                  <p className="opacity-60">{manager.phone}</p>
                  <a href={`mailto:${manager.email}`}>{manager.email}</a>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      {confirmRow && confirmCopy ? (
        <SparkConfirm
          tone="danger"
          kicker="Delete plan"
          title={confirmCopy.title}
          body={confirmCopy.body}
          confirmLabel={confirmCopy.confirmLabel}
          busy={deleting}
          onConfirm={() => void deleteRow(confirmRow)}
          onCancel={() => setConfirmRow(null)}
        />
      ) : null}
      {confirmBulk ? (
        <SparkConfirm
          tone="danger"
          kicker="Delete plans"
          title={`Delete ${selectedDraftIds.length} draft${selectedDraftIds.length === 1 ? "" : "s"}?`}
          body="Drafts aren't booked, so no request changes. They come off the board and out of the projected totals."
          confirmLabel={`Delete ${selectedDraftIds.length}`}
          busy={deleting}
          onConfirm={() => void deleteSelectedDrafts()}
          onCancel={() => setConfirmBulk(false)}
        />
      ) : null}
      {toast ? (
        <div
          className="spark-toast fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 flex items-center gap-3 max-w-[min(92vw,520px)]"
          role="status"
        >
          <p className="text-sm">{toast.message}</p>
          {toast.undoId ? (
            <button
              type="button"
              className="spark-btn-ghost !px-2.5 !py-1 text-xs shrink-0"
              disabled={restoringId === toast.undoId}
              onClick={() => toast.undoId && void restore(toast.undoId)}
            >
              Undo
            </button>
          ) : null}
          <button
            type="button"
            className="text-xs opacity-55 shrink-0"
            aria-label="Dismiss"
            onClick={() => setToast(null)}
          >
            ✕
          </button>
        </div>
      ) : null}
      {resultsFor ? (
        <PlanResultsSheet
          planId={resultsFor.id}
          planName={resultsFor.name}
          open
          onOpenChange={(next) => {
            if (!next) setResultsFor(null);
          }}
          isClient={isClient}
        />
      ) : null}
    </Layout>
  );
}
