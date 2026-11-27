import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { commitMutation } from "relay-runtime";
import { useMutation } from "react-relay/hooks";
import environment from "@/api/relay/environment";
import TimeSlotSelect from "@/components/inputs/TimeSlotSelect";
import { useAlertStore } from "@/store/alertStore";
import { ParseBulkSchedulePromptMutation } from "@/api/mutations/ParseBulkSchedulePromptMutation";
import type { ParseBulkSchedulePromptMutation as ParseBulkSchedulePromptMutationType } from "@api/mutations/__generated__/ParseBulkSchedulePromptMutation.graphql";
import { CreateRequestsWaveMutation } from "@/api/mutations/CreateRequestsWaveMutation";
import type { CreateRequestsWaveMutation as CreateRequestsWaveMutationType } from "@api/mutations/__generated__/CreateRequestsWaveMutation.graphql";
import { formatDraftTime } from "./pasteDetails";
import {
  matchPromptProductIds,
  resolveBulkRowTimezone,
  type BulkScheduleRow,
  type BulkTimezoneOption,
} from "./bulkSchedulePrompt";

interface NaturalLanguageBulkPanelProps {
  tenantId: string;
  requestTypeId: string;
  defaultTimezoneId: string;
  timezones: ReadonlyArray<BulkTimezoneOption>;
  catalogProducts: ReadonlyArray<{ id: string; uuid?: string | null; name?: string | null }>;
  selectedProductIds: ReadonlySet<string>;
  formNotes: string;
  isClient: boolean;
  initialPrompt?: string;
}

const META = { color: "var(--spark-text-meta)" } as const;
const TEXT = { color: "var(--spark-text)" } as const;
const FLAG = { color: "var(--spark-flag-ink, var(--spark-orange))" } as const;

const EXAMPLE_PROMPTS = [
  "Every Fri & Sat next month from 12pm to 4pm at our top 5 stores",
  "Next 3 Saturdays 11am to 3pm at our overdue stores",
] as const;

export const NaturalLanguageBulkPanel: React.FC<NaturalLanguageBulkPanelProps> = ({
  tenantId,
  requestTypeId,
  defaultTimezoneId,
  timezones,
  catalogProducts,
  selectedProductIds,
  formNotes,
  isClient,
  initialPrompt,
}) => {
  const inputId = useId();
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [commitWave, isSubmitting] = useMutation<CreateRequestsWaveMutationType>(
    CreateRequestsWaveMutation,
  );

  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const consumedInitialRef = useRef<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [summary, setSummary] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [timeDefaulted, setTimeDefaulted] = useState(false);
  const [rows, setRows] = useState<BulkScheduleRow[]>([]);
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(() => new Set());
  const [matchedProducts, setMatchedProducts] = useState<Array<{ uuid: string; name: string }>>([]);
  const [sharedStart, setSharedStart] = useState("12:00");
  const [sharedEnd, setSharedEnd] = useState("16:00");

  const runParse = (rawPrompt?: string) => {
    const q = (rawPrompt ?? prompt).trim();
    if (!q || parsing) return;
    if (rawPrompt) setPrompt(rawPrompt);
    setParsing(true);
    setErrorMsg("");
    commitMutation<ParseBulkSchedulePromptMutationType>(environment, {
      mutation: ParseBulkSchedulePromptMutation,
      variables: { tenantId, prompt: q },
      onCompleted: (resp, errors) => {
        setParsing(false);
        if (errors && errors.length > 0) {
          setErrorMsg(errors[0]?.message ?? "Could not parse scheduling prompt.");
          return;
        }
        const out = resp.parseBulkSchedulePrompt;
        if (!out.ok || out.rows.length === 0) {
          setRows([]);
          setErrorMsg(out.message || "No matching stores or dates found.");
          return;
        }
        const nextRows: BulkScheduleRow[] = out.rows.map((r) => ({
          rowKey: r.rowKey,
          storeKey: r.storeKey,
          storeName: r.storeName,
          storeNumber: r.storeNumber,
          address: r.address,
          city: r.city,
          state: r.state,
          lat: r.lat ?? null,
          lng: r.lng ?? null,
          date: r.date,
          weekdayLabel: r.weekdayLabel,
          startTime: r.startTime,
          endTime: r.endTime,
          notes: r.notes,
        }));
        setRows(nextRows);
        setExcludedKeys(new Set());
        setSummary(out.summary);
        setTruncated(out.truncated);
        setTimeDefaulted(out.timeDefaulted);
        setMatchedProducts(out.products.map((p) => ({ uuid: String(p.uuid), name: p.name })));
        if (nextRows[0]) {
          setSharedStart(nextRows[0].startTime || "12:00");
          setSharedEnd(nextRows[0].endTime || "16:00");
        }
      },
      onError: (err) => {
        setParsing(false);
        setErrorMsg(err.message || "Could not reach Spark AI right now.");
      },
    });
  };

  useEffect(() => {
    const seeded = (initialPrompt ?? "").trim();
    if (!seeded || !tenantId || consumedInitialRef.current === seeded) return;
    consumedInitialRef.current = seeded;
    runParse(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, tenantId]);

  const activeRows = useMemo(
    () => rows.filter((r) => !excludedKeys.has(r.rowKey)),
    [rows, excludedKeys],
  );

  const toggleRow = (rowKey: string) => {
    setExcludedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  const updateAllTimes = (nextStart: string, nextEnd: string) => {
    setSharedStart(nextStart);
    setSharedEnd(nextEnd);
    setTimeDefaulted(false);
    setRows((prev) =>
      prev.map((r) => ({ ...r, startTime: nextStart, endTime: nextEnd })),
    );
  };

  const submitBulkWave = () => {
    if (!requestTypeId) {
      showAlert("Select an Activation type in the form below first.", "warning");
      return;
    }
    if (activeRows.length === 0) {
      showAlert("Keep at least one visit checked in the preview.", "warning");
      return;
    }
    const promptProductIds = matchPromptProductIds(matchedProducts, catalogProducts);
    const mergedProducts =
      promptProductIds.length > 0 ? promptProductIds : Array.from(selectedProductIds);
    const combinedNotes = (activeRows[0]?.notes || formNotes || "").trim();

    commitWave({
      variables: {
        input: {
          tenantId,
          requestTypeId,
          defaultTimezoneId: defaultTimezoneId || null,
          productIds: mergedProducts,
          schedulingStatus: "needs_scheduling",
          ...(combinedNotes ? { notes: combinedNotes } : {}),
          dryRun: false,
          rollbackOnError: false,
          items: activeRows.map((r) => {
            const tz = resolveBulkRowTimezone(
              r.state,
              r.date,
              timezones,
              defaultTimezoneId || null,
            );
            return {
              storeName: r.storeName,
              ...(r.storeNumber ? { storeNumber: r.storeNumber } : {}),
              address: r.address,
              ...(r.city ? { city: r.city } : {}),
              ...(r.state ? { state: r.state } : {}),
              latitude: r.lat,
              longitude: r.lng,
              date: r.date,
              startTime: r.startTime,
              endTime: r.endTime,
              timezoneId: tz.timezoneId,
              timezoneCode: tz.timezoneCode !== "Local TZ" ? tz.timezoneCode : null,
            };
          }),
        },
      },
      onCompleted: (resp, errors) => {
        if (errors && errors.length > 0) {
          showAlert(errors[0]?.message ?? "Could not submit bulk visits.", "error");
          return;
        }
        const res = resp.createRequestsWave;
        if (!res) return;
        if (res.successCount > 0) {
          showAlert(
            `Scheduled ${res.successCount} ${res.successCount === 1 ? "visit" : "visits"}${
              res.skippedCount > 0 ? ` (${res.skippedCount} already scheduled skipped)` : ""
            }.`,
            "success",
          );
          setRows([]);
          setPrompt("");
          navigate(isClient ? "/upcoming" : "/requests");
          return;
        }
        const firstErr =
          res.errors?.[0] ??
          res.rows?.find((row) => !row.success && row.message)?.message ??
          res.message ??
          "No visits could be created.";
        setErrorMsg(firstErr);
      },
      onError: (err) => {
        showAlert(err.message || "Bulk request submission failed.", "error");
      },
    });
  };

  return (
    <section className="spark-card p-5 spark-scale space-y-3" aria-label="Schedule in plain English">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-sm" style={TEXT}>
            Schedule in plain English
          </h2>
          <p className="text-sm mt-0.5" style={META}>
            Describe a multi-store schedule — Spark matches stores from your Account Map roster and previews every visit before anything is created.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <label htmlFor={inputId} className="sr-only">
          Natural-language bulk schedule prompt
        </label>
        <input
          id={inputId}
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runParse();
            }
          }}
          placeholder='e.g. "Every Fri & Sat in June from 12pm to 4pm at our top 5 Austin HEBs"'
          disabled={parsing || isSubmitting}
          className="spark-input flex-1 rounded-lg px-3 py-2 text-sm"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => runParse()}
          disabled={parsing || isSubmitting || !prompt.trim()}
          className="rounded-lg px-4 py-2 text-xs font-semibold shrink-0 transition disabled:opacity-50"
          style={{
            background: "var(--spark-lime)",
            color: "var(--spark-on-accent)",
          }}
        >
          {parsing ? "Matching stores…" : "Preview visits"}
        </button>
      </div>

      {rows.length === 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs" style={META}>
            Try:
          </span>
          {EXAMPLE_PROMPTS.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => runParse(ex)}
              disabled={parsing}
              className="chip chip-muted text-xs"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {errorMsg && (
        <p role="status" className="text-sm" style={FLAG}>
          {errorMsg}
        </p>
      )}

      {rows.length > 0 && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            border: "1px solid var(--spark-border)",
            background: "rgba(var(--spark-ink-rgb), 0.02)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={TEXT}>
                {summary}
              </p>
              {timeDefaulted && (
                <p className="text-xs mt-0.5" style={META}>
                  No shift hours were in your prompt, so 12:00 PM – 4:00 PM was pre-filled. Adjust below if needed.
                </p>
              )}
              {truncated && (
                <p className="text-xs mt-0.5" style={FLAG}>
                  Showing the first 25 matched visits so you can review and submit in clean waves.
                </p>
              )}
              {matchedProducts.length > 0 && (
                <p className="text-xs mt-0.5" style={META}>
                  Matched products: {matchedProducts.map((p) => p.name).join(", ")}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="w-32">
                <TimeSlotSelect
                  value={sharedStart}
                  onChange={(v) => updateAllTimes(v, sharedEnd)}
                  placeholder="Start"
                />
              </div>
              <span className="text-xs" style={META}>
                to
              </span>
              <div className="w-32">
                <TimeSlotSelect
                  value={sharedEnd}
                  onChange={(v) => updateAllTimes(sharedStart, v)}
                  placeholder="End"
                />
              </div>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-[var(--spark-border)]">
            {rows.map((r) => {
              const checked = !excludedKeys.has(r.rowKey);
              const tz = resolveBulkRowTimezone(
                r.state,
                r.date,
                timezones,
                defaultTimezoneId || null,
              );
              return (
                <label
                  key={r.rowKey}
                  className="py-2 flex items-center gap-3 text-xs cursor-pointer"
                  style={{ opacity: checked ? 1 : 0.5 }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRow(r.rowKey)}
                  />
                  <span className="font-semibold min-w-[9rem]" style={TEXT}>
                    {r.storeName}
                  </span>
                  <span className="flex-1 truncate" style={META} title={r.address}>
                    {r.address}
                  </span>
                  <span className="mono whitespace-nowrap" style={TEXT}>
                    {r.weekdayLabel.slice(0, 3)} {r.date}
                  </span>
                  <span className="mono whitespace-nowrap" style={META}>
                    {formatDraftTime(r.startTime)}–{formatDraftTime(r.endTime)} {tz.timezoneCode}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setRows([]);
                setSummary("");
                setErrorMsg("");
              }}
              disabled={isSubmitting}
              className="text-xs underline"
              style={META}
            >
              Clear preview
            </button>
            <button
              type="button"
              onClick={submitBulkWave}
              disabled={isSubmitting || activeRows.length === 0}
              className="rounded-lg px-4 py-2 text-xs font-semibold transition disabled:opacity-50"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
              }}
            >
              {isSubmitting
                ? "Scheduling…"
                : `Submit ${activeRows.length} ${activeRows.length === 1 ? "visit" : "visits"} →`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default NaturalLanguageBulkPanel;
