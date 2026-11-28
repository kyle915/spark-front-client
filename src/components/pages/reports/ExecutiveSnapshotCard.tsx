/**
 * Automated 1st-of-the-Month Executive Snapshot Card.
 *
 * One-toggle monthly email + PDF brief for brand stakeholders featuring:
 * - Headline KPIs vs. prior complete calendar month
 * - Top 5 converting doors
 * - Shelf OSA & MSRP price-drift callouts
 * - Top 3 shopper themes
 * - Up to 4 best approved field photos
 */

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Download,
  Mail,
  MessageSquareQuote,
  Send,
  Settings2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { ExecutiveSnapshotQuery } from "@/api/queries/RetentionAutomationQueries";
import {
  ExportExecutiveSnapshotPdfMutation,
  SendExecutiveSnapshotNowMutation,
  UpdateExecutiveSnapshotConfigMutation,
} from "@/api/mutations/RetentionAutomationMutations";
import type { RetentionAutomationQueriesExecutiveSnapshotQuery as QueryType } from "@/api/queries/__generated__/RetentionAutomationQueriesExecutiveSnapshotQuery.graphql";
import type { RetentionAutomationMutationsUpdateExecutiveSnapshotConfigMutation as UpdateType } from "@/api/mutations/__generated__/RetentionAutomationMutationsUpdateExecutiveSnapshotConfigMutation.graphql";
import type { RetentionAutomationMutationsSendExecutiveSnapshotNowMutation as SendNowType } from "@/api/mutations/__generated__/RetentionAutomationMutationsSendExecutiveSnapshotNowMutation.graphql";
import type { RetentionAutomationMutationsExportExecutiveSnapshotPdfMutation as ExportPdfType } from "@/api/mutations/__generated__/RetentionAutomationMutationsExportExecutiveSnapshotPdfMutation.graphql";
import {
  parseSnapshotMonthKey,
  recentSnapshotMonths,
} from "./executiveSnapshotHelpers";

const TEXT = { color: "var(--spark-text)" } as const;
const META = { color: "var(--spark-text-meta)" } as const;
const SECONDARY = { color: "var(--spark-text-secondary)" } as const;
const BORDER = { border: "1px solid var(--spark-border)" } as const;
const FIELD = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-field-bg, var(--spark-surface))",
  color: "var(--spark-text)",
} as const;

function downloadBase64Pdf(base64: string, filename: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "executive-snapshot.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const ExecutiveSnapshotCard: React.FC<{ tenantId: string }> = ({
  tenantId,
}) => {
  const monthOptions = useMemo(() => recentSnapshotMonths(6), []);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(
    () => monthOptions[0]?.key ?? "",
  );
  const [isSwitchingMonth, startMonthTransition] = useTransition();
  const selectedPeriod = useMemo(
    () => parseSnapshotMonthKey(selectedMonthKey),
    [selectedMonthKey],
  );
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<QueryType>(
    ExecutiveSnapshotQuery,
    {
      tenantId,
      year: selectedPeriod?.year ?? null,
      month: selectedPeriod?.month ?? null,
    },
    {
      fetchPolicy: "store-and-network",
      fetchKey: `exec-snap:${tenantId}:${selectedMonthKey}:${fetchKey}`,
    },
  );

  const snap = data?.executiveSnapshot;

  const [enabled, setEnabled] = useState<boolean>(Boolean(snap?.config.enabled));
  const [recipients, setRecipients] = useState<string>(
    snap?.config.recipientEmails ?? "",
  );
  const [targetMsrp, setTargetMsrp] = useState<string>(
    snap?.config.targetMsrp ?? "",
  );
  const [includePhotos, setIncludePhotos] = useState<boolean>(
    snap?.config.includePhotos ?? true,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (!snap) return;
    setEnabled(Boolean(snap.config.enabled));
    setRecipients(snap.config.recipientEmails ?? "");
    setTargetMsrp(snap.config.targetMsrp ?? "");
    setIncludePhotos(Boolean(snap.config.includePhotos));
  }, [snap]);

  const [commitUpdate, saving] = useMutation<UpdateType>(
    UpdateExecutiveSnapshotConfigMutation,
  );
  const [commitSendNow, sendingNow] = useMutation<SendNowType>(
    SendExecutiveSnapshotNowMutation,
  );
  const [commitPdf, exportingPdf] = useMutation<ExportPdfType>(
    ExportExecutiveSnapshotPdfMutation,
  );

  if (!snap) return null;

  const toggleEnabled = () => {
    if (saving || !snap.canManage) return;
    const next = !enabled;
    setEnabled(next);
    setNotice(null);
    commitUpdate({
      variables: {
        tenantId,
        enabled: next,
        recipientEmails: null,
        targetMsrp: null,
        includePhotos: null,
      },
      onCompleted: (res) => {
        const out = res.updateExecutiveSnapshotConfig;
        if (out.ok) {
          setEnabled(out.enabled);
          setNotice({
            ok: true,
            text: out.enabled
              ? "Auto-send enabled — delivers on the 1st of every month."
              : "1st-of-month auto-send paused.",
          });
          setFetchKey((k) => k + 1);
        } else {
          setEnabled(!next);
          setNotice({
            ok: false,
            text: out.error || "Could not update schedule setting.",
          });
        }
      },
      onError: () => {
        setEnabled(!next);
        setNotice({ ok: false, text: "Could not reach Spark to save setting." });
      },
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !snap.canManage) return;
    setNotice(null);
    commitUpdate({
      variables: {
        tenantId,
        enabled,
        recipientEmails: recipients.trim(),
        targetMsrp: targetMsrp.trim(),
        includePhotos,
      },
      onCompleted: (res) => {
        const out = res.updateExecutiveSnapshotConfig;
        if (out.ok) {
          setNotice({
            ok: true,
            text: "Executive Snapshot settings saved.",
          });
          setSettingsOpen(false);
          setFetchKey((k) => k + 1);
        } else {
          setNotice({
            ok: false,
            text: out.error || "Could not save settings.",
          });
        }
      },
      onError: () =>
        setNotice({ ok: false, text: "Could not reach Spark to save settings." }),
    });
  };

  const handleSendNow = () => {
    if (sendingNow) return;
    setNotice(null);
    commitSendNow({
      variables: {
        tenantId,
        testEmail: null,
        year: snap.year,
        month: snap.month,
      },
      onCompleted: (res) => {
        const out = res.sendExecutiveSnapshotNow;
        if (out.ok) {
          setNotice({
            ok: true,
            text: `Sent ${out.monthLabel || snap.monthLabel} Executive Snapshot${out.pdfAttached ? " + PDF" : ""} to ${out.recipients.join(", ")}.`,
          });
          setFetchKey((k) => k + 1);
        } else {
          setNotice({
            ok: false,
            text: out.error || "Could not send Executive Snapshot email.",
          });
        }
      },
      onError: () =>
        setNotice({ ok: false, text: "Could not send Executive Snapshot email." }),
    });
  };

  const handleDownloadPdf = () => {
    if (exportingPdf) return;
    setNotice(null);
    commitPdf({
      variables: {
        tenantId,
        year: snap.year,
        month: snap.month,
      },
      onCompleted: (res) => {
        const out = res.exportExecutiveSnapshotPdf;
        if (out.ok && out.pdfBase64) {
          downloadBase64Pdf(out.pdfBase64, out.filename);
          setNotice({
            ok: true,
            text: `Downloaded ${out.filename}.`,
          });
        } else {
          setNotice({
            ok: false,
            text: out.error || "Could not generate Executive Snapshot PDF.",
          });
        }
      },
      onError: () =>
        setNotice({ ok: false, text: "Could not export Executive Snapshot PDF." }),
    });
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextKey = e.target.value;
    startMonthTransition(() => {
      setSelectedMonthKey(nextKey);
      setNotice(null);
    });
  };

  const recipientSummary =
    snap.config.effectiveRecipients.length > 0
      ? snap.config.effectiveRecipients.join(", ")
      : "Defaults to your email on Send now";

  return (
    <section
      id="report-executive-snapshot"
      aria-label="Automated 1st-of-the-Month Executive Snapshot"
      aria-busy={isSwitchingMonth}
      className={`spark-card p-5 sm:p-6 space-y-4 print:hidden transition-opacity ${isSwitchingMonth ? "opacity-75" : ""}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{
                background: enabled
                  ? "var(--spark-ok-bg)"
                  : "var(--spark-surface-2)",
                color: enabled ? "var(--spark-ok-ink)" : "var(--spark-text-meta)",
                border: enabled
                  ? "1px solid var(--spark-ok-border)"
                  : "1px solid var(--spark-border)",
              }}
            >
              <CalendarClock size={11} strokeWidth={2} />
              {enabled ? "Auto-sends on the 1st" : "1st-of-month brief · Off"}
            </span>
            <span className="text-xs" style={META}>
              {isSwitchingMonth
                ? "Loading month…"
                : `${snap.monthLabel} vs. ${snap.priorMonthLabel}`}
            </span>
          </div>
          <h3
            className="display font-semibold text-base"
            style={{ ...TEXT, letterSpacing: "-0.02em" }}
          >
            Monthly Executive Snapshot
          </h3>
          <p className="text-xs max-w-2xl" style={META}>
            Email + PDF brief with headline KPIs vs. prior month, top 5 converting
            doors, Shelf OSA &amp; price-drift callouts, top 3 shopper themes, and
            4 best field photos.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium"
            style={FIELD}
            title="Preview, download PDF, or re-send any of the last 6 months"
          >
            <Calendar size={12.5} strokeWidth={1.9} style={META} />
            <span className="sr-only">Snapshot month</span>
            <select
              aria-label="Snapshot month"
              value={selectedMonthKey}
              onChange={handleMonthChange}
              disabled={isSwitchingMonth}
              className="bg-transparent outline-none text-xs font-semibold cursor-pointer pr-1"
              style={{ color: "var(--spark-text)" }}
            >
              {monthOptions.map((opt) => (
                <option
                  key={opt.key}
                  value={opt.key}
                  style={{
                    background: "var(--spark-surface)",
                    color: "var(--spark-text)",
                  }}
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {snap.canManage ? (
            <label
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer select-none"
              style={{
                ...BORDER,
                background: enabled
                  ? "rgba(var(--spark-ink-rgb),0.04)"
                  : "transparent",
                color: "var(--spark-text)",
              }}
              title="Automatically email this brief + PDF on the 1st of every month"
            >
              <input
                type="checkbox"
                role="switch"
                checked={enabled}
                onChange={toggleEnabled}
                disabled={saving}
                className="w-3.5 h-3.5"
                style={{ accentColor: "var(--spark-lime)" }}
              />
              <span>Auto-send 1st of month</span>
            </label>
          ) : null}

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={exportingPdf}
            className="spark-btn-ghost text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download size={13} strokeWidth={1.9} />
            {exportingPdf ? "Building PDF…" : "Download PDF"}
          </button>

          <button
            type="button"
            onClick={handleSendNow}
            disabled={sendingNow}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition hover:opacity-90 disabled:opacity-50"
            style={{
              background: "var(--spark-lime)",
              color: "var(--spark-on-accent)",
            }}
          >
            <Send size={12.5} strokeWidth={2} />
            {sendingNow ? "Sending…" : "Send now"}
          </button>

          {snap.canManage ? (
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="spark-btn-ghost text-xs px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 cursor-pointer"
              aria-expanded={settingsOpen}
              title="Configure recipients, target MSRP, and photo inclusion"
            >
              <Settings2 size={13} strokeWidth={1.85} />
              <span className="hidden sm:inline">Settings</span>
            </button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div
          className="rounded-xl px-3.5 py-2 text-xs font-medium"
          style={{
            background: notice.ok
              ? "var(--spark-ok-bg)"
              : "rgba(239, 90, 42, 0.12)",
            color: notice.ok
              ? "var(--spark-ok-ink)"
              : "var(--spark-flag-ink, #a8340f)",
            border: notice.ok
              ? "1px solid var(--spark-ok-border)"
              : "1px solid rgba(239, 90, 42, 0.34)",
          }}
        >
          {notice.text}
        </div>
      ) : null}

      {/* Inline Settings Form */}
      {settingsOpen && snap.canManage ? (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-xl p-4 space-y-3"
          style={{
            background: "var(--spark-surface-2)",
            ...BORDER,
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="md:col-span-2 block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={META}>
                Stakeholder recipients (comma-separated)
              </span>
              <input
                type="text"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="vp-sales@brand.com, founder@brand.com"
                className="w-full rounded-lg px-3 py-1.5 text-xs outline-none"
                style={FIELD}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={META}>
                Target MSRP ($) for price-drift callouts
              </span>
              <input
                type="text"
                value={targetMsrp}
                onChange={(e) => setTargetMsrp(e.target.value)}
                placeholder="4.99"
                className="w-full rounded-lg px-3 py-1.5 text-xs outline-none"
                style={FIELD}
              />
            </label>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <label className="inline-flex items-center gap-2 text-xs cursor-pointer" style={SECONDARY}>
              <input
                type="checkbox"
                checked={includePhotos}
                onChange={(e) => setIncludePhotos(e.target.checked)}
                style={{ accentColor: "var(--spark-lime)" }}
              />
              <span>Include up to 4 best approved field photos</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="spark-btn-ghost text-xs px-3 py-1.5 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="text-xs font-semibold px-3.5 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                style={{
                  background: "var(--spark-lime)",
                  color: "var(--spark-on-accent)",
                }}
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {/* Compact Headline KPIs Strip (vs Prior Month) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {snap.kpis.map((kpi) => {
          const isUp = kpi.direction === "up";
          const isDown = kpi.direction === "down";
          return (
            <div
              key={kpi.key}
              className="rounded-xl p-3 space-y-1"
              style={{
                background: "var(--spark-surface-2)",
                ...BORDER,
              }}
            >
              <span className="text-[11px] font-medium block truncate" style={META}>
                {kpi.label}
              </span>
              <p className="display text-lg font-bold tab-num" style={TEXT}>
                {kpi.formattedValue}
              </p>
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium tab-num"
                style={{
                  color: isUp
                    ? "var(--spark-ok-ink)"
                    : isDown
                      ? "var(--spark-flag-ink, #a8340f)"
                      : "var(--spark-text-meta)",
                }}
              >
                {isUp ? <TrendingUp size={11} /> : null}
                {isDown ? <TrendingDown size={11} /> : null}
                {kpi.deltaLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer metadata & Full Brief Preview toggle */}
      <div
        className="flex items-center justify-between gap-3 flex-wrap pt-2 text-xs"
        style={{ borderTop: "1px solid var(--spark-hairline, var(--spark-border))" }}
      >
        <div className="flex items-center gap-3 flex-wrap" style={META}>
          <span className="inline-flex items-center gap-1.5">
            <Mail size={12} />
            <span className="truncate max-w-xs sm:max-w-md">{recipientSummary}</span>
          </span>
          {snap.config.lastSentAt ? (
            <span>
              · Last sent {snap.config.lastSentMonth || ""}{" "}
              ({snap.config.lastSendStatus || "sent"})
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setPreviewOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-semibold cursor-pointer transition hover:opacity-80"
          style={{ color: "var(--spark-text)", background: "transparent", border: "none", padding: 0 }}
          aria-expanded={previewOpen}
        >
          <span>{previewOpen ? "Hide full brief preview" : "Preview full brief"}</span>
          {previewOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expandable Full Brief Preview */}
      {previewOpen ? (
        <div
          className="rounded-xl p-4 sm:p-5 space-y-5"
          style={{
            background: "var(--spark-surface-2)",
            ...BORDER,
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top 5 Converting Doors */}
            <div className="space-y-2.5">
              <h4
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={META}
              >
                Top 5 Converting Doors · {snap.monthLabel}
              </h4>
              {snap.topDoors.length > 0 ? (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ background: "var(--spark-surface)", ...BORDER }}
                >
                  <table className="w-full text-xs">
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid var(--spark-border)",
                          color: "var(--spark-text-meta)",
                        }}
                      >
                        <th className="text-left font-medium px-3 py-2">Store</th>
                        <th className="text-right font-medium px-2.5 py-2">Sampled</th>
                        <th className="text-right font-medium px-2.5 py-2">Sold</th>
                        <th className="text-right font-medium px-3 py-2">Conv.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snap.topDoors.map((d) => (
                        <tr
                          key={`${d.storeName}-${d.stateCode}`}
                          style={{
                            borderBottom:
                              "1px solid var(--spark-hairline, var(--spark-border))",
                          }}
                        >
                          <td className="px-3 py-2">
                            <p className="font-medium truncate max-w-[190px]" style={TEXT}>
                              {d.storeName}
                            </p>
                            {d.market ? (
                              <p className="text-[11px]" style={META}>
                                {d.market}
                              </p>
                            ) : null}
                          </td>
                          <td className="text-right tab-num px-2.5 py-2" style={SECONDARY}>
                            {d.consumersSampled.toLocaleString()}
                          </td>
                          <td className="text-right tab-num px-2.5 py-2" style={SECONDARY}>
                            {d.unitsSold.toLocaleString()}
                          </td>
                          <td className="text-right tab-num font-semibold px-3 py-2" style={TEXT}>
                            {d.conversionLabel}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs" style={META}>
                  No approved retail conversions logged in {snap.monthLabel} yet.
                </p>
              )}
            </div>

            {/* Shelf OSA & Price-Drift Callouts + Top 3 Themes */}
            <div className="space-y-4">
              <div className="space-y-2">
                <h4
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={META}
                >
                  Shelf OSA &amp; Price-Drift Callouts
                </h4>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span
                    className="rounded-lg px-2.5 py-1 font-medium tab-num"
                    style={{ background: "var(--spark-surface)", ...BORDER, ...TEXT }}
                  >
                    OSA: {snap.shelf.osaRatePct != null ? `${snap.shelf.osaRatePct}%` : "—"}
                  </span>
                  <span
                    className="rounded-lg px-2.5 py-1 font-medium tab-num"
                    style={{ background: "var(--spark-surface)", ...BORDER, ...TEXT }}
                  >
                    Price tags:{" "}
                    {snap.shelf.priceTagRatePct != null
                      ? `${snap.shelf.priceTagRatePct}%`
                      : "—"}
                  </span>
                  {snap.shelf.medianPrice ? (
                    <span
                      className="rounded-lg px-2.5 py-1 font-medium tab-num"
                      style={{ background: "var(--spark-surface)", ...BORDER, ...TEXT }}
                    >
                      Median: ${snap.shelf.medianPrice}
                    </span>
                  ) : null}
                </div>
                {snap.shelf.callouts.length > 0 ? (
                  <ul className="space-y-1.5">
                    {snap.shelf.callouts.map((c, idx) => (
                      <li
                        key={`${c.storeName}-${idx}`}
                        className="rounded-lg px-3 py-2 text-xs flex items-start gap-2"
                        style={{
                          background: "var(--spark-surface)",
                          border:
                            c.severity === "alert"
                              ? "1px solid rgba(239, 90, 42, 0.35)"
                              : "1px solid var(--spark-border)",
                        }}
                      >
                        <AlertTriangle
                          size={13}
                          className="shrink-0 mt-0.5"
                          style={{
                            color:
                              c.severity === "alert"
                                ? "var(--spark-flag-ink, #a8340f)"
                                : "var(--spark-text-meta)",
                          }}
                        />
                        <div className="min-w-0">
                          <span className="font-semibold" style={TEXT}>
                            {c.storeName}
                          </span>
                          {c.market ? (
                            <span style={META}> ({c.market})</span>
                          ) : null}
                          <p className="text-[11.5px] mt-0.5" style={SECONDARY}>
                            {c.detail}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs" style={META}>
                    No out-of-stock gaps or &gt;5% price-drift flags in {snap.monthLabel}.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <h4
                  className="text-[11px] font-semibold uppercase tracking-wider"
                  style={META}
                >
                  Top 3 Shopper Themes
                </h4>
                {snap.themes.length > 0 ? (
                  <ul className="space-y-1.5">
                    {snap.themes.map((t, idx) => (
                      <li
                        key={`${t.title}-${idx}`}
                        className="rounded-lg px-3 py-2 text-xs flex items-start gap-2"
                        style={{ background: "var(--spark-surface)", ...BORDER }}
                      >
                        <MessageSquareQuote
                          size={13}
                          className="shrink-0 mt-0.5"
                          style={META}
                        />
                        <div className="min-w-0">
                          <span className="font-semibold" style={TEXT}>
                            {t.title}
                          </span>
                          {t.mentions > 1 ? (
                            <span className="ml-1.5 text-[11px]" style={META}>
                              · {t.mentions} mentions
                            </span>
                          ) : null}
                          {t.summary ? (
                            <p className="text-[11.5px] mt-0.5" style={SECONDARY}>
                              {t.summary}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs" style={META}>
                    Not enough shopper comments logged in {snap.monthLabel} yet.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 4 Best Field Photos */}
          {snap.photos.length > 0 ? (
            <div className="space-y-2">
              <h4
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={META}
              >
                Featured Field Photos ({snap.photos.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {snap.photos.map((p) => (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-xl overflow-hidden block no-underline"
                    style={{ background: "var(--spark-surface)", ...BORDER }}
                  >
                    <img
                      src={p.url}
                      alt={p.store}
                      loading="lazy"
                      className="w-full h-28 object-cover transition group-hover:scale-[1.02]"
                    />
                    <div className="px-2.5 py-2">
                      <p className="text-[11.5px] font-semibold truncate" style={TEXT}>
                        {p.store}
                      </p>
                      <p className="text-[10.5px] truncate" style={META}>
                        {[p.state, p.eventDate].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default ExecutiveSnapshotCard;
