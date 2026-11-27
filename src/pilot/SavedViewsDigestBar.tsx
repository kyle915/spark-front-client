/**
 * Saved Report Views & Scheduled Custom Digest Bar.
 *
 * Lets regional managers and brand admins save filtered slices (e.g.
 * "Texas Whole Foods · Last 90d"), re-apply them in 1 click, schedule
 * automated Friday (or custom-day) CSV + summary email digests to
 * distributors/brokers, and trigger an immediate test send.
 */

import React, { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { Bookmark, CalendarClock, Mail, Plus, Send, Trash2, X } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { SavedReportViewsQuery } from "@/api/queries/SavedViewsWebhooksQueries";
import {
  DeleteSavedReportViewMutation,
  SendSavedReportViewNowMutation,
  UpsertSavedReportViewMutation,
} from "@/api/mutations/SavedViewsWebhooksMutations";
import type { SavedViewsWebhooksQueriesSavedReportViewsQuery as ViewsQueryType } from "@/api/queries/__generated__/SavedViewsWebhooksQueriesSavedReportViewsQuery.graphql";
import type { SavedViewsWebhooksMutationsUpsertSavedReportViewMutation as UpsertType } from "@/api/mutations/__generated__/SavedViewsWebhooksMutationsUpsertSavedReportViewMutation.graphql";
import type { SavedViewsWebhooksMutationsDeleteSavedReportViewMutation as DeleteType } from "@/api/mutations/__generated__/SavedViewsWebhooksMutationsDeleteSavedReportViewMutation.graphql";
import type { SavedViewsWebhooksMutationsSendSavedReportViewNowMutation as SendNowType } from "@/api/mutations/__generated__/SavedViewsWebhooksMutationsSendSavedReportViewNowMutation.graphql";

export type SavedViewFilters = Record<string, string>;

const DAYS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
] as const;

const META = { color: "var(--spark-text-meta)" } as const;
const BORDER = { border: "1px solid var(--spark-border)" } as const;
const FIELD = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-field-bg, var(--spark-surface))",
  color: "var(--spark-text)",
} as const;

const SavedViewsInner: React.FC<{
  surface: "buyer_report" | "shelf_voice" | "program_report" | "retailer_pos";
  tenantId: string | null;
  currentFilters: SavedViewFilters;
  onApply: (filters: SavedViewFilters) => void;
  defaultPlaceholder?: string;
}> = ({ surface, tenantId, currentFilters, onApply, defaultPlaceholder }) => {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<ViewsQueryType>(
    SavedReportViewsQuery,
    { surface, tenantId },
    { fetchPolicy: "store-and-network", fetchKey: `${tenantId ?? "none"}:${fetchKey}` },
  );

  const views = data?.savedReportViews ?? [];

  const [commitUpsert, saving] = useMutation<UpsertType>(UpsertSavedReportViewMutation);
  const [commitDelete, deleting] = useMutation<DeleteType>(DeleteSavedReportViewMutation);
  const [commitSendNow, sendingNow] = useMutation<SendNowType>(SendSavedReportViewNowMutation);

  const [activeUuid, setActiveUuid] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [cadence, setCadence] = useState("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(4); // Friday default
  const [exportFormat, setExportFormat] = useState("csv");
  const [recipients, setRecipients] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const openCreate = () => {
    setEditingUuid(null);
    setName("");
    setScheduleEnabled(false);
    setCadence("weekly");
    setDayOfWeek(4);
    setExportFormat("csv");
    setRecipients("");
    setNotice(null);
    setEditorOpen(true);
  };

  const openEdit = (v: (typeof views)[number]) => {
    setEditingUuid(v.uuid);
    setName(v.name);
    setScheduleEnabled(v.scheduleEnabled);
    setCadence(v.scheduleCadence || "weekly");
    setDayOfWeek(v.scheduleDayOfWeek ?? 4);
    setExportFormat(v.exportFormat || "csv");
    setRecipients(v.recipientEmails || "");
    setNotice(null);
    setEditorOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    commitUpsert({
      variables: {
        viewUuid: editingUuid,
        name: name.trim(),
        surface,
        filtersJson: JSON.stringify(currentFilters),
        scheduleEnabled,
        scheduleCadence: cadence,
        scheduleDayOfWeek: dayOfWeek,
        exportFormat,
        recipientEmails: recipients.trim(),
        tenantId,
      },
      onCompleted: (res) => {
        const out = res.upsertSavedReportView;
        if (out.ok && out.view) {
          setNotice({
            ok: true,
            text: out.view.scheduleEnabled
              ? `Saved “${out.view.name}” · scheduled every ${out.view.scheduleDayLabel}.`
              : `Saved view “${out.view.name}”.`,
          });
          setActiveUuid(out.view.uuid);
          setEditorOpen(false);
          setFetchKey((k) => k + 1);
        } else {
          setNotice({ ok: false, text: out.error || "Could not save view." });
        }
      },
      onError: (err) => setNotice({ ok: false, text: err.message }),
    });
  };

  const handleApply = (v: (typeof views)[number]) => {
    try {
      const parsed = JSON.parse(v.filtersJson || "{}") as SavedViewFilters;
      onApply(parsed);
      setActiveUuid(v.uuid);
      setNotice({ ok: true, text: `Applied saved view “${v.name}”.` });
    } catch {
      setNotice({ ok: false, text: "Saved filter format could not be read." });
    }
  };

  const handleSendNow = (v: (typeof views)[number]) => {
    setNotice(null);
    commitSendNow({
      variables: { viewUuid: v.uuid, testEmail: null, tenantId },
      onCompleted: (res) => {
        const out = res.sendSavedReportViewNow;
        if (out.ok) {
          setNotice({
            ok: true,
            text: `Sent “${v.name}” (${out.rowCount} rows) to ${out.recipients.join(", ")}.`,
          });
          setFetchKey((k) => k + 1);
        } else {
          setNotice({
            ok: false,
            text: out.error || `Digest send returned status: ${out.status}`,
          });
        }
      },
      onError: (err) => setNotice({ ok: false, text: err.message }),
    });
  };

  const handleDelete = (v: (typeof views)[number]) => {
    commitDelete({
      variables: { viewUuid: v.uuid, tenantId },
      onCompleted: (res) => {
        if (res.deleteSavedReportView.ok) {
          if (activeUuid === v.uuid) setActiveUuid(null);
          setNotice({ ok: true, text: `Deleted saved view “${v.name}”.` });
          setFetchKey((k) => k + 1);
        } else {
          setNotice({
            ok: false,
            text: res.deleteSavedReportView.error || "Could not delete view.",
          });
        }
      },
    });
  };

  return (
    <section
      aria-label="Saved views and scheduled email exports"
      className="spark-card p-4 space-y-3 text-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Bookmark size={13} style={META} />
            Saved Views &amp; Scheduled Digests
          </span>
          {views.length === 0 ? (
            <span style={META}>
              — Save a filtered slice to re-apply in 1 click or email distributors every Friday.
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => (editorOpen ? setEditorOpen(false) : openCreate())}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          style={
            editorOpen
              ? FIELD
              : {
                  background: "var(--spark-lime)",
                  color: "var(--spark-on-accent)",
                }
          }
        >
          {editorOpen ? <X size={13} /> : <Plus size={13} />}
          {editorOpen ? "Close" : "Save current slice"}
        </button>
      </div>

      {views.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {views.map((v) => {
            const isSelected = activeUuid === v.uuid;
            return (
              <div
                key={v.uuid}
                className="inline-flex items-center gap-1 rounded-xl pl-3 pr-1.5 py-1"
                style={
                  isSelected
                    ? {
                        background: "var(--spark-lime)",
                        color: "var(--spark-on-accent)",
                        border: "1px solid var(--spark-lime)",
                      }
                    : {
                        background: "var(--spark-surface-2)",
                        color: "var(--spark-text)",
                        ...BORDER,
                      }
                }
              >
                <button
                  type="button"
                  onClick={() => handleApply(v)}
                  title={v.filterSummary}
                  className="text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>{v.name}</span>
                  {v.scheduleEnabled ? (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                      style={{
                        background: isSelected
                          ? "rgba(255,255,255,0.18)"
                          : "var(--spark-ok-bg)",
                        color: isSelected
                          ? "var(--spark-on-accent)"
                          : "var(--spark-ok-ink)",
                      }}
                    >
                      <CalendarClock size={10} />
                      {v.scheduleDayLabel.slice(0, 3)}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  title="Edit schedule & recipients"
                  onClick={() => openEdit(v)}
                  className="p-1 rounded-md opacity-75 hover:opacity-100 cursor-pointer"
                >
                  <Mail size={12} />
                </button>
                <button
                  type="button"
                  title="Send digest email now"
                  disabled={sendingNow}
                  onClick={() => handleSendNow(v)}
                  className="p-1 rounded-md opacity-75 hover:opacity-100 cursor-pointer disabled:opacity-40"
                >
                  <Send size={12} />
                </button>
                <button
                  type="button"
                  title="Delete saved view"
                  disabled={deleting}
                  onClick={() => handleDelete(v)}
                  className="p-1 rounded-md opacity-70 hover:opacity-100 cursor-pointer disabled:opacity-40"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {notice && (
        <div
          className="px-3 py-2 rounded-lg text-xs font-medium"
          style={
            notice.ok
              ? {
                  background: "var(--spark-ok-bg)",
                  color: "var(--spark-ok-ink)",
                  border: "1px solid var(--spark-ok-border)",
                }
              : {
                  background: "rgba(239, 90, 42, 0.12)",
                  color: "var(--spark-flag-ink, #a8340f)",
                  border: "1px solid rgba(239, 90, 42, 0.35)",
                }
          }
        >
          {notice.text}
        </div>
      )}

      {editorOpen && (
        <form
          onSubmit={handleSave}
          className="rounded-xl p-4 space-y-3"
          style={{ background: "var(--spark-surface-2)", ...BORDER }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="font-medium" style={META}>
                Saved view name *
              </span>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={defaultPlaceholder || "Texas Whole Foods · Last 90d"}
                className="w-full px-3 py-2 rounded-lg text-xs"
                style={FIELD}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={FIELD}>
              <span>
                <strong className="block text-xs">
                  Schedule automated email digest
                </strong>
                <span className="text-[11px]" style={META}>
                  Email this filtered slice &amp; CSV to distributors/brokers
                </span>
              </span>
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={(e) => setScheduleEnabled(e.target.checked)}
                className="w-4 h-4"
                style={{ accentColor: "var(--spark-lime)" }}
              />
            </label>
          </div>

          {scheduleEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="block space-y-1">
                <span className="font-medium" style={META}>
                  Cadence
                </span>
                <select
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs"
                  style={FIELD}
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="font-medium" style={META}>
                  Send day
                </span>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-xs"
                  style={FIELD}
                >
                  {DAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="font-medium" style={META}>
                  Format
                </span>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs"
                  style={FIELD}
                >
                  <option value="csv">Summary + CSV attachment</option>
                  <option value="summary">Executive summary only</option>
                </select>
              </label>

              <label className="sm:col-span-3 block space-y-1">
                <span className="font-medium" style={META}>
                  Recipients (comma-separated distributor, broker, or buyer emails) *
                </span>
                <input
                  type="text"
                  required={scheduleEnabled}
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="broker@distributor.com, regional@brand.com"
                  className="w-full px-3 py-2 rounded-lg text-xs"
                  style={FIELD}
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px]" style={META}>
              Captures your active date window &amp; filters right now.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                style={FIELD}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                style={{
                  background: "var(--spark-lime)",
                  color: "var(--spark-on-accent)",
                }}
              >
                {saving
                  ? "Saving…"
                  : editingUuid
                    ? "Update saved view"
                    : "Save view"}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
};

export const SavedViewsDigestBar: React.FC<{
  surface: "buyer_report" | "shelf_voice" | "program_report" | "retailer_pos";
  currentFilters: SavedViewFilters;
  onApply: (filters: SavedViewFilters) => void;
  defaultPlaceholder?: string;
}> = (props) => {
  const tenantId = useAuthStore((s) => s.tenantId);
  if (!tenantId) return null;
  return (
    <Suspense fallback={null}>
      <SavedViewsInner key={tenantId} tenantId={tenantId} {...props} />
    </Suspense>
  );
};

export default SavedViewsDigestBar;
