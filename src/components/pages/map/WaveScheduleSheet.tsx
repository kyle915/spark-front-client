import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import SparkSheet from "@/shared/SparkSheet";
import TimeSlotSelect from "@/components/inputs/TimeSlotSelect";
import { RequestTypesQuery } from "@/api/queries/RequestTypesQuery";
import type { RequestTypesQuery as RequestTypesQueryType } from "@api/queries/__generated__/RequestTypesQuery.graphql";
import { TimezonesQuery } from "@/api/queries/TimezonesQuery";
import type { TimezonesQuery as TimezonesQueryType } from "@api/queries/__generated__/TimezonesQuery.graphql";
import { CreateRequestsWaveMutation } from "@/api/mutations/CreateRequestsWaveMutation";
import type { CreateRequestsWaveMutation as CreateRequestsWaveMutationType } from "@api/mutations/__generated__/CreateRequestsWaveMutation.graphql";
import { useTenantProducts } from "@/hooks/useTenantProducts";
import { useAlertStore } from "@/store/alertStore";
import { PanelSkeleton } from "@/layout/PageSkeletons";
import {
  WAVE_WEEKDAYS,
  buildWavePreviewRows,
  defaultWaveWindow,
  isOvernightShift,
  partitionWaveOutcome,
  type WaveDateMode,
  type WaveTargetStore,
  type WaveTimezoneOption,
  type WaveWindowAssignMode,
} from "./waveSchedule";

export interface WaveCreatedSummary {
  createdCount: number;
  retainStoreKeys: string[];
}

interface WaveScheduleSheetProps {
  open: boolean;
  onClose: () => void;
  tenantId: string | null;
  stores: ReadonlyArray<WaveTargetStore>;
  onWaveCreated: (summary: WaveCreatedSummary) => void;
}

const META = { color: "var(--spark-text-meta)" } as const;
const LABEL = "block text-xs font-semibold uppercase tracking-wider mb-1.5";

function formatShortTime(hhmm: string): string {
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return hhmm;
  const h24 = Number(m[1]);
  const min = m[2];
  const h12 = ((h24 + 11) % 12) + 1;
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${h12}:${min} ${ampm}`;
}

const WaveScheduleSheetBody: React.FC<{
  tenantId: string;
  stores: ReadonlyArray<WaveTargetStore>;
  onClose: () => void;
  onWaveCreated: (summary: WaveCreatedSummary) => void;
}> = ({ tenantId, stores, onClose, onWaveCreated }) => {
  const showAlert = useAlertStore((s) => s.showAlert);

  const requestTypesData = useLazyLoadQuery<RequestTypesQueryType>(
    RequestTypesQuery,
    { filters: { tenantId }, first: 100 },
    { fetchPolicy: "store-or-network" },
  );
  const timezonesData = useLazyLoadQuery<TimezonesQueryType>(
    TimezonesQuery,
    {},
    { fetchPolicy: "store-or-network" },
  );
  const products = useTenantProducts(tenantId);

  const [commitWave, isSubmitting] = useMutation<CreateRequestsWaveMutationType>(
    CreateRequestsWaveMutation,
  );

  const requestTypes = useMemo(
    () =>
      (requestTypesData.requestTypes?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [requestTypesData],
  );

  const timezones: WaveTimezoneOption[] = useMemo(
    () =>
      (timezonesData.timezones?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n))
        .map((n) => ({
          id: n.id,
          code: n.code,
          name: n.name,
          offset: n.offset,
        })),
    [timezonesData],
  );

  const initialDates = useMemo(() => defaultWaveWindow(), []);

  const [requestTypeId, setRequestTypeId] = useState<string>("");
  const [dateMode, setDateMode] = useState<WaveDateMode>("window");
  const [singleDate, setSingleDate] = useState<string>(initialDates.singleDate);
  const [windowStart, setWindowStart] = useState<string>(initialDates.windowStart);
  const [windowEnd, setWindowEnd] = useState<string>(initialDates.windowEnd);
  const [weekdays, setWeekdays] = useState<number[]>([5, 6]);
  const [assignMode, setAssignMode] = useState<WaveWindowAssignMode>("spread");
  const [startTime, setStartTime] = useState<string>("12:00");
  const [endTime, setEndTime] = useState<string>("16:00");
  const [schedulingStatus, setSchedulingStatus] = useState<
    "needs_scheduling" | "already_scheduled"
  >("needs_scheduling");
  const [fallbackTimezoneId, setFallbackTimezoneId] = useState<string>("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => new Set());
  const [skuSearch, setSkuSearch] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [excludedRowKeys, setExcludedRowKeys] = useState<Set<string>>(() => new Set());
  const [lastDryRunSummary, setLastDryRunSummary] = useState<{
    wouldCreate: number;
    duplicates: number;
    errors: string[];
  } | null>(null);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!requestTypeId && requestTypes.length > 0) {
      const preferred =
        requestTypes.find((rt) => /retail/i.test(rt.name)) ?? requestTypes[0];
      setRequestTypeId(preferred.id);
    }
  }, [requestTypeId, requestTypes]);

  const previewRows = useMemo(
    () =>
      buildWavePreviewRows({
        stores,
        dateMode,
        singleDate,
        windowStart,
        windowEnd,
        weekdays,
        assignMode,
        startTime,
        endTime,
        timezones,
        fallbackTimezoneId: fallbackTimezoneId || null,
      }),
    [
      stores,
      dateMode,
      singleDate,
      windowStart,
      windowEnd,
      weekdays,
      assignMode,
      startTime,
      endTime,
      timezones,
      fallbackTimezoneId,
    ],
  );

  useEffect(() => {
    setLastDryRunSummary(null);
    setSubmitErrors([]);
  }, [
    requestTypeId,
    dateMode,
    singleDate,
    windowStart,
    windowEnd,
    weekdays,
    assignMode,
    startTime,
    endTime,
    fallbackTimezoneId,
    schedulingStatus,
    selectedProductIds,
    notes,
  ]);

  const activeRows = useMemo(
    () =>
      previewRows.filter(
        (r) => !r.missingAddress && !excludedRowKeys.has(r.rowKey),
      ),
    [previewRows, excludedRowKeys],
  );

  const missingAddressCount = useMemo(
    () => previewRows.filter((r) => r.missingAddress).length,
    [previewRows],
  );

  const distinctDatesCount = useMemo(
    () => new Set(activeRows.map((r) => r.date)).size,
    [activeRows],
  );

  const filteredProducts = useMemo(() => {
    const q = skuSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, skuSearch]);

  const toggleWeekday = (day: number) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRow = (rowKey: string) => {
    setExcludedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };

  const overnight = isOvernightShift(startTime, endTime);

  const runWaveMutation = (dryRun: boolean) => {
    if (!requestTypeId) {
      showAlert("Choose an activation type first.", "warning");
      return;
    }
    if (activeRows.length === 0) {
      showAlert("No schedulable visits in the preview.", "warning");
      return;
    }

    setSubmitErrors([]);
    const trimmedNotes = notes.trim();
    commitWave({
      variables: {
        input: {
          tenantId,
          requestTypeId,
          defaultTimezoneId: fallbackTimezoneId || null,
          productIds: Array.from(selectedProductIds),
          schedulingStatus,
          ...(trimmedNotes ? { notes: trimmedNotes } : {}),
          dryRun,
          rollbackOnError: false,
          items: activeRows.map((r) => ({
            storeName: r.storeName,
            address: r.address,
            ...(r.city ? { city: r.city } : {}),
            ...(r.stateCode ? { state: r.stateCode } : {}),
            latitude: r.lat,
            longitude: r.lng,
            date: r.date,
            startTime: r.startTime,
            endTime: r.endTime,
            timezoneId: r.timezoneId,
            timezoneCode:
              r.timezoneCode && r.timezoneCode !== "Auto TZ"
                ? r.timezoneCode
                : null,
          })),
        },
      },
      onCompleted: (resp, payloadErrors) => {
        if (payloadErrors && payloadErrors.length > 0) {
          const msg = payloadErrors.map((e) => e.message).join("; ");
          setSubmitErrors([msg]);
          showAlert(msg, "error");
          return;
        }
        const result = resp.createRequestsWave;
        if (!result) return;

        const rowErrs = [
          ...(result.errors ?? []),
          ...(result.rows ?? [])
            .filter((r) => !r.success && !r.skipped && r.message)
            .map((r) => `Row ${r.rowNumber}: ${r.message}`),
        ];
        // Deduplicate messages
        const uniqueErrs = Array.from(new Set(rowErrs));

        if (dryRun) {
          setLastDryRunSummary({
            wouldCreate: result.successCount,
            duplicates: result.skippedCount,
            errors: uniqueErrs,
          });
          showAlert(
            `Dry-run passed: ${result.successCount} ready, ${result.skippedCount} already scheduled${
              uniqueErrs.length > 0 ? `, ${uniqueErrs.length} issues` : ""
            }.`,
            uniqueErrs.length > 0 ? "warning" : "info",
          );
          return;
        }

        if (uniqueErrs.length > 0) {
          setSubmitErrors(uniqueErrs);
        }

        const { retainStoreKeys, completedRowKeys } = partitionWaveOutcome(
          activeRows,
          result.rows,
          result.rolledBack,
        );

        if (uniqueErrs.length > 0 && completedRowKeys.length > 0) {
          setExcludedRowKeys((prev) => {
            const next = new Set(prev);
            for (const rk of completedRowKeys) next.add(rk);
            return next;
          });
        }

        if (result.successCount > 0) {
          const dupNote =
            result.skippedCount > 0
              ? ` (${result.skippedCount} duplicate${
                  result.skippedCount === 1 ? "" : "s"
                } skipped)`
              : "";
          const hasFailed = uniqueErrs.length > 0 || retainStoreKeys.length > 0;
          showAlert(
            `Scheduled ${result.successCount} wave request${
              result.successCount === 1 ? "" : "s"
            }${dupNote}${
              hasFailed ? ` · ${retainStoreKeys.length} store(s) retained to retry` : ""
            }.`,
            hasFailed ? "warning" : "success",
          );
          onWaveCreated({
            createdCount: result.successCount,
            retainStoreKeys: hasFailed ? retainStoreKeys : [],
          });
          if (!hasFailed) {
            onClose();
          }
        } else if (result.skippedCount > 0 && uniqueErrs.length === 0) {
          showAlert(
            `All ${result.skippedCount} visits already exist for those stores and dates.`,
            "info",
          );
        } else if (uniqueErrs.length > 0) {
          showAlert(uniqueErrs[0], "error");
        }
      },
      onError: (err) => {
        const msg = err.message || "Could not schedule wave.";
        setSubmitErrors([msg]);
        showAlert(msg, "error");
      },
    });
  };

  return (
    <div className="space-y-5">
      {/* 1. Activation Type + Scheduling Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label className={LABEL} style={META} htmlFor="wave-request-type">
            Activation type
          </label>
          <select
            id="wave-request-type"
            value={requestTypeId}
            onChange={(e) => setRequestTypeId(e.target.value)}
            className="w-full"
          >
            {requestTypes.length === 0 ? (
              <option value="">No activation types configured</option>
            ) : (
              requestTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className={LABEL} style={META} htmlFor="wave-sched-status">
            Staffing flow
          </label>
          <select
            id="wave-sched-status"
            value={schedulingStatus}
            onChange={(e) =>
              setSchedulingStatus(
                e.target.value === "already_scheduled"
                  ? "already_scheduled"
                  : "needs_scheduling",
              )
            }
            className="w-full"
          >
            <option value="needs_scheduling">Needs BA scheduling</option>
            <option value="already_scheduled">Already staffed / scheduled</option>
          </select>
        </div>
      </div>

      {/* 2. Date Window vs Single Date */}
      <div
        className="rounded-xl p-3.5 space-y-3.5"
        style={{
          border: "1px solid var(--spark-border)",
          background: "rgba(var(--spark-ink-rgb), 0.02)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider" style={META}>
            Date cadence
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setDateMode("window")}
              aria-pressed={dateMode === "window"}
              className="chip chip-muted text-xs"
              style={
                dateMode === "window"
                  ? {
                      color: "var(--spark-text)",
                      outline: "1.5px solid var(--spark-text)",
                    }
                  : undefined
              }
            >
              Date window + days
            </button>
            <button
              type="button"
              onClick={() => setDateMode("single")}
              aria-pressed={dateMode === "single"}
              className="chip chip-muted text-xs"
              style={
                dateMode === "single"
                  ? {
                      color: "var(--spark-text)",
                      outline: "1.5px solid var(--spark-text)",
                    }
                  : undefined
              }
            >
              Single date
            </button>
          </div>
        </div>

        {dateMode === "single" ? (
          <div>
            <label className={LABEL} style={META} htmlFor="wave-single-date">
              Visit date
            </label>
            <input
              id="wave-single-date"
              type="date"
              value={singleDate}
              onChange={(e) => setSingleDate(e.target.value)}
              className="w-full sm:max-w-[220px]"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL} style={META} htmlFor="wave-window-start">
                  Window start
                </label>
                <input
                  id="wave-window-start"
                  type="date"
                  value={windowStart}
                  onChange={(e) => setWindowStart(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className={LABEL} style={META} htmlFor="wave-window-end">
                  Window end
                </label>
                <input
                  id="wave-window-end"
                  type="date"
                  value={windowEnd}
                  min={windowStart}
                  onChange={(e) => setWindowEnd(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <span className={LABEL} style={META}>
                Preferred days of week
              </span>
              <div className="flex flex-wrap gap-1.5">
                {WAVE_WEEKDAYS.map((w) => {
                  const active = weekdays.includes(w.day);
                  return (
                    <button
                      key={w.day}
                      type="button"
                      onClick={() => toggleWeekday(w.day)}
                      aria-pressed={active}
                      className="chip chip-muted text-xs"
                      style={
                        active
                          ? {
                              color: "var(--spark-text)",
                              outline: "1.5px solid var(--spark-text)",
                            }
                          : undefined
                      }
                    >
                      {w.short}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="wave-assign-mode"
                  checked={assignMode === "spread"}
                  onChange={() => setAssignMode("spread")}
                />
                <span>1 visit per store (spread across matching dates)</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="wave-assign-mode"
                  checked={assignMode === "every"}
                  onChange={() => setAssignMode("every")}
                />
                <span>Every matching day per store</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* 3. Shift Start / End Time + Fallback Timezone */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={LABEL} style={META}>
            Start time
          </label>
          <TimeSlotSelect
            value={startTime}
            onChange={setStartTime}
            aria-label="Wave start time"
            className="w-full"
          />
        </div>
        <div>
          <label className={LABEL} style={META}>
            End time
          </label>
          <TimeSlotSelect
            value={endTime}
            onChange={setEndTime}
            aria-label="Wave end time"
            className="w-full"
          />
          {overnight ? (
            <p className="text-[11px] mt-1" style={{ color: "#c5f546" }}>
              Overnight shift (ends next calendar day)
            </p>
          ) : null}
        </div>
        <div>
          <label className={LABEL} style={META} htmlFor="wave-fallback-tz">
            Fallback timezone
          </label>
          <select
            id="wave-fallback-tz"
            value={fallbackTimezoneId}
            onChange={(e) => setFallbackTimezoneId(e.target.value)}
            className="w-full"
          >
            <option value="">Auto by store state / GPS</option>
            {timezones.map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.code} — {tz.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Catalog SKUs */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider" style={META}>
            SKUs ({selectedProductIds.size} selected)
          </span>
          {products.length > 0 ? (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedProductIds(new Set(products.map((p) => p.id)))}
                className="underline cursor-pointer"
                style={{
                  color: "var(--spark-text-secondary)",
                  background: "none",
                  border: 0,
                  padding: 0,
                }}
              >
                Select all
              </button>
              {selectedProductIds.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedProductIds(new Set())}
                  className="underline cursor-pointer"
                  style={{
                    color: "var(--spark-text-meta)",
                    background: "none",
                    border: 0,
                    padding: 0,
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {products.length === 0 ? (
          <p className="text-xs" style={META}>
            No catalog SKUs configured for this brand yet (optional).
          </p>
        ) : (
          <div
            className="rounded-xl p-3 space-y-2.5"
            style={{ border: "1px solid var(--spark-border)" }}
          >
            {products.length > 8 ? (
              <input
                type="search"
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
                placeholder="Filter SKUs..."
                aria-label="Filter SKUs"
                className="spark-filter-search w-full text-xs"
              />
            ) : null}
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {filteredProducts.map((p) => {
                const on = selectedProductIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProduct(p.id)}
                    aria-pressed={on}
                    className="chip chip-muted text-xs"
                    style={
                      on
                        ? {
                            color: "var(--spark-text)",
                            outline: "1.5px solid var(--spark-text)",
                          }
                        : undefined
                    }
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. Wave Notes */}
      <div>
        <label className={LABEL} style={META} htmlFor="wave-notes">
          Shift notes &amp; instructions (optional)
        </label>
        <textarea
          id="wave-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Table setup guidance, target buyer contact, promo callouts..."
          className="w-full text-sm rounded-lg p-2.5"
          style={{
            background: "var(--spark-surface)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
          }}
        />
      </div>

      {/* 6. Inline Preview */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--spark-border)" }}
      >
        <div
          className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
          style={{
            borderBottom: "1px solid var(--spark-border)",
            background: "rgba(var(--spark-ink-rgb), 0.03)",
          }}
        >
          <span className="text-xs font-semibold">
            Inline wave preview ·{" "}
            <span className="tab-num">{activeRows.length}</span>{" "}
            {activeRows.length === 1 ? "visit" : "visits"} across{" "}
            <span className="tab-num">{distinctDatesCount}</span>{" "}
            {distinctDatesCount === 1 ? "date" : "dates"}
          </span>
          {missingAddressCount > 0 ? (
            <span className="text-xs" style={{ color: "#ef5a2a" }}>
              {missingAddressCount} skipped (no street address)
            </span>
          ) : null}
        </div>

        {previewRows.length === 0 ? (
          <p className="p-4 text-xs" style={META}>
            No matching dates in the selected window. Adjust your window dates or preferred
            days of week.
          </p>
        ) : (
          <ul className="max-h-56 overflow-y-auto divide-y m-0 p-0 list-none" style={{ borderColor: "var(--spark-border)" }}>
            {previewRows.slice(0, 150).map((row) => {
              const included = !row.missingAddress && !excludedRowKeys.has(row.rowKey);
              return (
                <li
                  key={row.rowKey}
                  className="px-3.5 py-2 flex items-start gap-2.5 text-xs"
                  style={{ opacity: included ? 1 : 0.5 }}
                >
                  <input
                    type="checkbox"
                    checked={included}
                    disabled={row.missingAddress}
                    onChange={() => toggleRow(row.rowKey)}
                    aria-label={`Include ${row.storeName} on ${row.date}`}
                    className="mt-0.5 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: "var(--spark-text)" }}>
                      {row.storeName}
                      {row.stateCode ? (
                        <span className="font-normal" style={META}>
                          {" "}
                          · {row.city ? `${row.city}, ${row.stateCode}` : row.stateCode}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate mt-0.5" style={META}>
                      {row.missingAddress
                        ? "Missing street address — add address on account list first"
                        : row.address}
                    </p>
                  </div>
                  <div className="text-right shrink-0 mono text-[11px]">
                    <div style={{ color: "var(--spark-text)" }}>
                      {row.weekdayLabel} {row.date}
                    </div>
                    <div style={META}>
                      {formatShortTime(row.startTime)}–{formatShortTime(row.endTime)}{" "}
                      <span className="font-semibold">{row.timezoneCode}</span>
                    </div>
                  </div>
                </li>
              );
            })}
            {previewRows.length > 150 ? (
              <li className="px-3.5 py-2 text-xs" style={META}>
                + {(previewRows.length - 150).toLocaleString("en-US")} more visits in wave
              </li>
            ) : null}
          </ul>
        )}
      </div>

      {/* Dry-run or validation feedback */}
      {lastDryRunSummary ? (
        <div
          className="rounded-lg px-3.5 py-2.5 text-xs space-y-1"
          style={{
            border: "1px solid var(--spark-border)",
            background: "rgba(var(--spark-ink-rgb), 0.03)",
          }}
        >
          <p className="font-semibold">
            Dry-run check: {lastDryRunSummary.wouldCreate} ready to create ·{" "}
            {lastDryRunSummary.duplicates} existing duplicate
            {lastDryRunSummary.duplicates === 1 ? "" : "s"} will skip
          </p>
          {lastDryRunSummary.errors.slice(0, 5).map((e, idx) => (
            <p key={idx} style={{ color: "#ef5a2a" }}>
              {e}
            </p>
          ))}
        </div>
      ) : null}

      {submitErrors.length > 0 ? (
        <div
          role="alert"
          className="rounded-lg px-3.5 py-2.5 text-xs space-y-1"
          style={{
            border: "1px solid rgba(239, 90, 42, 0.45)",
            background: "rgba(239, 90, 42, 0.08)",
            color: "#ef5a2a",
          }}
        >
          {submitErrors.slice(0, 6).map((err, idx) => (
            <p key={idx}>{err}</p>
          ))}
        </div>
      ) : null}

      {/* Footer CTAs */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 pt-3"
        style={{ borderTop: "1px solid var(--spark-border)" }}
      >
        <button
          type="button"
          disabled={isSubmitting || activeRows.length === 0}
          onClick={() => runWaveMutation(true)}
          className="spark-btn-ghost text-xs"
        >
          Validate wave
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="spark-btn-ghost text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || activeRows.length === 0 || !requestTypeId}
            onClick={() => runWaveMutation(false)}
            className="btn btn-sm font-semibold"
            style={{
              background: "#c5f546",
              color: "#0A0B0D",
              border: "none",
            }}
          >
            {isSubmitting
              ? "Scheduling..."
              : `Create ${activeRows.length} request${activeRows.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export const WaveScheduleSheet: React.FC<WaveScheduleSheetProps> = ({
  open,
  onClose,
  tenantId,
  stores,
  onWaveCreated,
}) => {
  return (
    <SparkSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      side="right"
      size="lg"
      eyebrow={`${stores.length.toLocaleString("en-US")} ${
        stores.length === 1 ? "store" : "stores"
      } selected · DST-aware local timezones`}
      title="Schedule multi-store wave"
    >
      {!tenantId ? (
        <p className="text-sm py-6" style={META}>
          Select a client workspace in the top bar first to schedule a multi-store wave.
        </p>
      ) : stores.length === 0 ? (
        <p className="text-sm py-6" style={META}>
          Select one or more stores on the Account Map to build a wave.
        </p>
      ) : (
        <Suspense fallback={<PanelSkeleton label="Loading wave options" />}>
          <WaveScheduleSheetBody
            tenantId={tenantId}
            stores={stores}
            onClose={onClose}
            onWaveCreated={onWaveCreated}
          />
        </Suspense>
      )}
    </SparkSheet>
  );
};

export default WaveScheduleSheet;
