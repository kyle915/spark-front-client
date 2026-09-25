import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/layout/Layout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import { useAuthStore } from "@/store/authStore";
import FieldMarketingCalendar from "./FieldMarketingCalendar";
import ProgramSwitch from "./ProgramSwitch";
import {
  downloadCsv,
  fieldMarketingCsv,
  matchesTactic,
} from "./fieldMarketingExport";
import type { Board, FmEvent, Manager } from "./fieldMarketingTypes";

/**
 * Torch Plans = field marketing planner (merged with Activation Plans nav).
 * Dense month table, filter by market/RMM, projected KPI rollups, push to Ignite.
 */

type SubmitPayload = {
  submitFieldMarketing: {
    success: boolean;
    message: string;
    event: {
      requestCode: string | null;
      status: string;
      market?: string | null;
      startsOn?: string | null;
    } | null;
  };
};

const EVENT_FIELDS = `
  id market marketLabel managerName activity activityLabel name startsOn days
  address notes samplingFormat samplingLabel supportType supportLabel supportOther
  skuNames needsFieldSupport ambassadorCount supportTimes supportScope
  plannedFullCans plannedPourSamples plannedEmails
  loggedFullCans loggedPourSamples loggedEmails loggedDays loggedCases
  status requestCode
`;

const BOARD = `
  query FieldMarketingBoard($month: String, $tenantId: ID, $market: String, $quarter: String, $activity: String) {
    fieldMarketing(month: $month, tenantId: $tenantId, market: $market, quarter: $quarter, activity: $activity) {
      available
      month
      monthLabel
      managers { market marketLabel name email phone }
      kpis { key label detail target planned logged unit }
      skus
      events { ${EVENT_FIELDS} }
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

const ACTIVITIES = [
  { id: "event_activation", label: "Event activation / sponsorship" },
  { id: "guerilla", label: "Guerilla event" },
  { id: "product_seeding", label: "Product seeding" },
  { id: "sales_support", label: "Sales support" },
];

const SUPPORT_TYPES = [
  { id: "distributor_meeting", label: "Distributor meeting" },
  { id: "retail_visit", label: "Retail visit" },
  { id: "other", label: "Other" },
];

const TACTICS = [{ id: "", label: "All tactics" }, ...ACTIVITIES];

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

async function postGql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || "Request failed");
  }
  return json.data as T;
}

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

function hasLogged(row: FmEvent): boolean {
  return (
    row.loggedFullCans != null ||
    row.loggedPourSamples != null ||
    row.loggedEmails != null ||
    row.loggedDays != null ||
    row.loggedCases != null
  );
}

function showsCans(activity: string, sampling: string): boolean {
  if (activity === "full_can") return true;
  if (activity === "sponsorship" || activity === "event_activation") {
    return sampling !== "pour";
  }
  return activity === "guerilla" && sampling === "full_can";
}

function showsPours(activity: string, sampling: string): boolean {
  if (activity === "pour") return true;
  if (activity === "sponsorship" || activity === "event_activation") {
    return sampling !== "full_can";
  }
  return activity === "guerilla" && sampling === "pour";
}

function showsDays(activity: string): boolean {
  return activity === "sponsorship" || activity === "event_activation";
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function rowStatus(row: FmEvent): string {
  if (row.status === "submitted") {
    return row.requestCode ? `Ignite · ${row.requestCode}` : "On plan";
  }
  if (hasLogged(row)) return "Logged results";
  return "Draft";
}

/** Matches API `_should_create_request` — staffed activation / guerilla book Ignite. */
function booksWithIgnite(row: FmEvent): boolean {
  if (row.activity === "event_activation" || row.activity === "sponsorship") {
    return true;
  }
  if (
    row.activity === "guerilla" ||
    row.activity === "full_can" ||
    row.activity === "pour"
  ) {
    return Boolean(row.needsFieldSupport);
  }
  return false;
}

function requestFormHref(row: FmEvent): string {
  const params = new URLSearchParams();
  params.set("venue", row.name || "");
  if (row.address) params.set("address", row.address);
  if (row.startsOn) params.set("date", row.startsOn.slice(0, 10));
  params.set("requestTypeName", "Event Activation");
  params.set("schedulingStatus", "needs_scheduling");
  if (row.ambassadorCount) params.set("baCount", String(row.ambassadorCount));
  if (row.supportTimes) params.set("loadInTime", row.supportTimes);
  if (row.managerName) params.set("onsitePoc", row.managerName);
  const teamParts: string[] = [];
  if (row.supportScope) teamParts.push(row.supportScope);
  if (row.samplingLabel) teamParts.push(`Sampling: ${row.samplingLabel}`);
  if (row.days > 1) teamParts.push(`${row.days} days`);
  if (row.skuNames?.length) teamParts.push(`SKUs: ${row.skuNames.join(", ")}`);
  if (teamParts.length) params.set("additionalTeamDetails", teamParts.join(" · "));
  const noteBits = [
    row.marketLabel ? `Market: ${row.marketLabel}` : "",
    row.activityLabel ? `Tactic: ${row.activityLabel}` : "",
    row.notes || "",
  ].filter(Boolean);
  if (noteBits.length) params.set("notes", noteBits.join("\n"));
  return `/requests/create?${params.toString()}`;
}

const emptyForm = {
  market: "miami",
  activity: "event_activation",
  name: "",
  startsOn: "",
  days: "1",
  address: "",
  notes: "",
  plannedEmails: "",
  samplingFormat: "",
  supportType: "distributor_meeting",
  supportOther: "",
  skuNames: [] as string[],
  needsFieldSupport: false,
  ambassadorCount: "",
  supportTimes: "",
  supportScope: "",
};

export default function FieldMarketing() {
  const { tenantId } = useAuthStore();
  // Default: all plans (no date filter). Optional month narrows the table + KPIs.
  const [month, setMonth] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [tactic, setTactic] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [exportQuarter, setExportQuarter] = useState("");
  const [exporting, setExporting] = useState(false);
  const [logDraft, setLogDraft] = useState({
    cans: "",
    pours: "",
    emails: "",
    days: "",
    cases: "",
  });

  const load = useCallback(
    async (nextMonth: string, nextMarket: string) => {
      setLoading(true);
      setError("");
      try {
        const data = await postGql<{ fieldMarketing: Board }>(BOARD, {
          month: nextMonth || null,
          tenantId: tenantId || null,
          market: nextMarket || null,
        });
        setBoard(data.fieldMarketing);
        // Keep local filter state — server returns "all" when unscoped.
        const serverMonth = data.fieldMarketing.month || "";
        setMonth(serverMonth === "all" ? "" : serverMonth || nextMonth);
        setSelected(new Set());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the plan.");
      } finally {
        setLoading(false);
      }
    },
    [tenantId],
  );

  useEffect(() => {
    void load(month, marketFilter);
    // month changes go through the Month select onChange (calls load).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, marketFilter]);

  const activity = form.activity;
  const staffed = activity === "event_activation" || activity === "guerilla";
  const showDays = showsDays(activity);
  const showSampling = activity === "event_activation" || activity === "guerilla";
  const showSkus =
    activity === "event_activation" ||
    activity === "guerilla" ||
    activity === "product_seeding";
  const skuOptions = board?.skus ?? [];

  const managers = board?.managers?.length ? board.managers : FALLBACK_MANAGERS;
  const events = useMemo(() => {
    const rows = board?.events ?? [];
    return rows.filter((row) => matchesTactic(row.activity, tactic));
  }, [board?.events, tactic]);
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
    const submitted = events.filter((row) => row.status === "submitted").length;
    const drafts = events.length - submitted;
    return `${events.length} in plan · ${drafts} draft · ${submitted} with Ignite`;
  }, [events]);

  const activeManager = marketFilter
    ? managers.find((m) => m.market === marketFilter)
    : null;


  async function reloadAfterMutate(opts?: {
    rowMarket?: string | null;
    rowStartsOn?: string | null;
  }) {
    // Always show the new row: clear optional month filter so all-plans lists it.
    const nextMonth = "";
    let nextMarket = marketFilter;
    if (opts?.rowMarket && marketFilter && opts.rowMarket !== marketFilter) {
      nextMarket = opts.rowMarket;
    }
    setMonth(nextMonth);
    setMarketFilter(nextMarket);
    await load(nextMonth, nextMarket);
  }

  async function save(submit: boolean) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const num = (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return 0;
        const value = Number(trimmed);
        if (!Number.isFinite(value)) throw new Error("Use whole numbers.");
        return Math.round(value);
      };
      const data = await postGql<{
        planFieldMarketing: {
          success: boolean;
          message: string;
          event: {
            requestCode: string | null;
            market?: string | null;
            startsOn?: string | null;
          } | null;
        };
      }>(PLAN, {
        input: {
          market: form.market,
          activity: form.activity,
          name: form.name.trim(),
          startsOn: form.startsOn,
          days: showDays ? num(form.days || "1") : 1,
          address: form.address.trim(),
          notes: form.notes.trim(),
          plannedFullCans: 0,
          plannedPourSamples: 0,
          plannedEmails: num(form.plannedEmails),
          samplingFormat: showSampling ? form.samplingFormat : "",
          supportType: activity === "sales_support" ? form.supportType : "",
          supportOther:
            activity === "sales_support" && form.supportType === "other"
              ? form.supportOther.trim()
              : "",
          skuNames: showSkus ? form.skuNames : [],
          needsFieldSupport: staffed && form.needsFieldSupport,
          ambassadorCount:
            staffed && form.needsFieldSupport ? num(form.ambassadorCount || "0") : 0,
          supportTimes:
            staffed && form.needsFieldSupport ? form.supportTimes.trim() : "",
          supportScope:
            staffed && form.needsFieldSupport ? form.supportScope.trim() : "",
          submit,
          tenantId: tenantId || null,
        },
      });
      const ev = data.planFieldMarketing.event;
      const code = ev?.requestCode;
      setForm({
        ...emptyForm,
        market: marketFilter || form.market,
        activity: form.activity,
      });
      setShowPlanForm(false);
      setNotice(
        submit
          ? code
            ? `Submitted to Ignite · ${code}`
            : "Submitted to Ignite."
          : "Saved to the plan.",
      );
      await reloadAfterMutate({
        rowMarket: form.market,
        rowStartsOn: form.startsOn,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
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
    try {
      for (const eventId of ids) {
        const data = await postGql<SubmitPayload>(SUBMIT, {
          input: { eventId, tenantId: tenantId || null },
        });
        const ev = data.submitFieldMarketing.event;
        const code = ev?.requestCode;
        if (code) codes.push(code);
        if (ev?.market) lastMarket = ev.market;
      }
      setNotice(
        codes.length
          ? `Pushed to Ignite · ${codes.join(", ")}`
          : `Pushed ${ids.length} to Ignite.`,
      );
      await reloadAfterMutate({ rowMarket: lastMarket });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit.");
      await reloadAfterMutate();
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
      await load(month, marketFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log.");
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

  return (
    <Layout>
      <div className="space-y-5 max-w-[1400px] spark-fade-in">
        <SparkPageHeader
          eyebrow="TORCH THC · PLANS"
          title="Plans."
          support="All field marketing plans for Torch — filter by market/RMM or month, see projected results, and push rows to Ignite to execute. Retail sampling stays on Master Tracker."
        />
        <ProgramSwitch active="field" />

        {board && !board.available ? (
          <p className="spark-support">
            Plans (field marketing) is the Torch THC program. Switch to that brand.
          </p>
        ) : null}

        {error ? (
          <p className="text-sm" style={{ color: "var(--spark-orange, #ef5a2a)" }}>
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
                onChange={(e) => {
                  const next = e.target.value;
                  setMonth(next);
                  void load(next, marketFilter);
                }}
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
                  if (!month) {
                    const next = currentMonthKey();
                    setMonth(next);
                    void load(next, marketFilter);
                  }
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
            <button
              type="button"
              className="spark-btn-ghost"
              onClick={() => setShowPlanForm((v) => !v)}
            >
              {showPlanForm ? "Close form" : "Add to plan"}
            </button>
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
                {month ? (
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
          {marketFilter ? " and market" : ""}.
          {month
            ? " Targets are the monthly scorecard for the selected month."
            : " All months shows planned sums only — monthly targets (1,152 cans / 3,456 pours / …) are not scored against a multi-month rollup."}{" "}
          Logged stays a dash until someone reports a result. 4oz pours are not
          added into full cans.
        </p>

        {showPlanForm ? (
          <section className="rounded-xl border border-white/10 p-4 space-y-3">
            <p className="label-mini">Add to plan</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm space-y-1">
                <span className="opacity-70">Market / RMM</span>
                <select
                  className="input input-bordered w-full input-sm"
                  value={form.market}
                  onChange={(e) => setForm({ ...form, market: e.target.value })}
                >
                  {managers.map((manager) => (
                    <option key={manager.market} value={manager.market}>
                      {manager.marketLabel} · {manager.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm space-y-1">
                <span className="opacity-70">Activity</span>
                <select
                  className="input input-bordered w-full input-sm"
                  value={form.activity}
                  onChange={(e) => setForm({ ...form, activity: e.target.value })}
                >
                  {ACTIVITIES.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm space-y-1">
                <span className="opacity-70">Name</span>
                <input
                  className="input input-bordered w-full input-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Wynwood product drop"
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="opacity-70">Date</span>
                <input
                  type="date"
                  className="input input-bordered w-full input-sm"
                  value={form.startsOn}
                  onChange={(e) => setForm({ ...form, startsOn: e.target.value })}
                />
              </label>
              {showDays ? (
                <label className="text-sm space-y-1">
                  <span className="opacity-70">Days</span>
                  <input
                    inputMode="numeric"
                    className="input input-bordered w-full input-sm"
                    value={form.days}
                    onChange={(e) => setForm({ ...form, days: e.target.value })}
                  />
                </label>
              ) : null}
              {showSampling ? (
                <label className="text-sm space-y-1">
                  <span className="opacity-70">
                    Sampling format{activity === "guerilla" ? "" : " (optional)"}
                  </span>
                  <select
                    className="input input-bordered w-full input-sm"
                    value={form.samplingFormat}
                    onChange={(e) =>
                      setForm({ ...form, samplingFormat: e.target.value })
                    }
                  >
                    <option value="">{activity === "guerilla" ? "Pick one" : "Not set"}</option>
                    <option value="full_can">Full can</option>
                    <option value="pour">4oz pour</option>
                  </select>
                </label>
              ) : null}
              {activity === "sales_support" ? (
                <label className="text-sm space-y-1">
                  <span className="opacity-70">Sales support</span>
                  <select
                    className="input input-bordered w-full input-sm"
                    value={form.supportType}
                    onChange={(e) => setForm({ ...form, supportType: e.target.value })}
                  >
                    {SUPPORT_TYPES.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {activity === "sales_support" && form.supportType === "other" ? (
                <label className="text-sm space-y-1">
                  <span className="opacity-70">What kind</span>
                  <input
                    className="input input-bordered w-full input-sm"
                    value={form.supportOther}
                    onChange={(e) => setForm({ ...form, supportOther: e.target.value })}
                  />
                </label>
              ) : null}
              <label className="text-sm space-y-1 md:col-span-2">
                <span className="opacity-70">Address</span>
                <input
                  className="input input-bordered w-full input-sm"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Required before Ignite can execute"
                />
              </label>
              {showSkus ? (
                <fieldset className="text-sm space-y-1 md:col-span-2">
                  <legend className="opacity-70">SKUs</legend>
                  {skuOptions.length === 0 ? (
                    <p className="text-xs opacity-60">
                      Black Cherry 10mg, Strawberry Lemonade 10mg, Watermelon Limeade 10mg,
                      and Nonactive are not in the Torch catalog yet.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {skuOptions.map((name) => {
                        const on = form.skuNames.includes(name);
                        return (
                          <label key={name} className="inline-flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-xs"
                              checked={on}
                              onChange={() =>
                                setForm({
                                  ...form,
                                  skuNames: on
                                    ? form.skuNames.filter((sku) => sku !== name)
                                    : [...form.skuNames, name],
                                })
                              }
                            />
                            {name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              ) : null}
              {staffed ? (
                <label className="text-sm space-y-1">
                  <span className="opacity-70">Need field support?</span>
                  <select
                    className="input input-bordered w-full input-sm"
                    value={form.needsFieldSupport ? "yes" : "no"}
                    onChange={(e) =>
                      setForm({ ...form, needsFieldSupport: e.target.value === "yes" })
                    }
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>
              ) : null}
              {staffed && form.needsFieldSupport ? (
                <>
                  <label className="text-sm space-y-1">
                    <span className="opacity-70">Brand ambassadors</span>
                    <input
                      inputMode="numeric"
                      className="input input-bordered w-full input-sm"
                      value={form.ambassadorCount}
                      onChange={(e) =>
                        setForm({ ...form, ambassadorCount: e.target.value })
                      }
                    />
                  </label>
                  <label className="text-sm space-y-1">
                    <span className="opacity-70">Times</span>
                    <input
                      className="input input-bordered w-full input-sm"
                      value={form.supportTimes}
                      onChange={(e) => setForm({ ...form, supportTimes: e.target.value })}
                      placeholder="4–8pm"
                    />
                  </label>
                  <label className="text-sm space-y-1 md:col-span-2">
                    <span className="opacity-70">Scope</span>
                    <input
                      className="input input-bordered w-full input-sm"
                      value={form.supportScope}
                      onChange={(e) => setForm({ ...form, supportScope: e.target.value })}
                      placeholder="What you need on site"
                    />
                  </label>
                </>
              ) : null}
              <label className="text-sm space-y-1">
                <span className="opacity-70">Emails to capture</span>
                <input
                  inputMode="numeric"
                  className="input input-bordered w-full input-sm"
                  value={form.plannedEmails}
                  onChange={(e) => setForm({ ...form, plannedEmails: e.target.value })}
                />
              </label>
              <label className="text-sm space-y-1 md:col-span-2 xl:col-span-4">
                <span className="opacity-70">Notes</span>
                <textarea
                  className="textarea textarea-bordered w-full textarea-sm"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="spark-btn-ghost"
                disabled={saving}
                onClick={() => void save(false)}
              >
                Save draft
              </button>
              <button
                type="button"
                className="spark-btn-primary"
                disabled={saving}
                onClick={() => void save(true)}
              >
                Save + book with Ignite
              </button>
            </div>
          </section>
        ) : null}

        {view === "calendar" ? (
          <FieldMarketingCalendar
            month={month || currentMonthKey()}
            events={events}
            onMonth={(next) => {
              setMonth(next);
              void load(next, marketFilter);
            }}
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
                  <th className="px-2 py-2">RMM</th>
                  <th className="px-2 py-2">Activity</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2 text-right">Days</th>
                  <th className="px-2 py-2 text-right">Cans</th>
                  <th className="px-2 py-2 text-right">Pours</th>
                  <th className="px-2 py-2 text-right">Cases</th>
                  <th className="px-2 py-2 text-right">Emails</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={13} className="px-3 py-8 text-center opacity-55 text-sm">
                      No plan rows
                      {month ? " for this month" : ""}
                      {marketFilter ? " and market" : ""}. Add to plan to start.
                    </td>
                  </tr>
                ) : null}
                {events.map((row) => {
                  const isDraft = row.status !== "submitted";
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
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-sm">
                        {row.marketLabel}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-sm opacity-70">
                        {row.managerName}
                      </td>
                      <td className="px-2 py-2 text-sm opacity-80 max-w-[160px]">
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
                      <td className="px-2 py-2 text-sm font-medium max-w-[220px]">
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
                        ) : (
                          <span className="block text-[11px]" style={{ color: "#ef5a2a" }}>
                            Needs address
                          </span>
                        )}
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
                        <span
                          className="inline-block px-2 py-0.5 rounded border border-white/10"
                          style={{
                            color:
                              row.status === "submitted"
                                ? "#c5f546"
                                : hasLogged(row)
                                  ? "rgba(255,255,255,0.7)"
                                  : "rgba(255,255,255,0.55)",
                          }}
                        >
                          {rowStatus(row)}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        <div className="inline-flex gap-1 justify-end">
                          {isDraft ? (
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
                              {booksWithIgnite(row) ? "Book Ignite" : "Confirm"}
                            </button>
                          ) : null}
                          {booksWithIgnite(row) ? (
                            <a
                              className="spark-btn-ghost !px-2 !py-1 text-xs inline-flex items-center"
                              href={requestFormHref(row)}
                              title="Open the full Event Activation request form, prefilled from this plan row"
                            >
                              Full form
                            </a>
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
    </Layout>
  );
}
