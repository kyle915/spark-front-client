import { Suspense, useMemo, useRef, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { EventsQuery } from "@/api/queries/EventsQuery";
import type { EventsQuery as EventsQueryType } from "@api/queries/__generated__/EventsQuery.graphql";
import { CustomRecapTemplatesQuery } from "@/api/queries/CustomRecapTemplatesQuery";
import type { CustomRecapTemplatesQuery as CustomRecapTemplatesQueryType } from "@api/queries/__generated__/CustomRecapTemplatesQuery.graphql";
import { ImportConnecteamRecapPdfMutation } from "@/api/mutations/ImportConnecteamRecapPdfMutation";
import type { ImportConnecteamRecapPdfMutation as ImportConnecteamRecapPdfMutationType } from "@api/mutations/__generated__/ImportConnecteamRecapPdfMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

/**
 * Drop a Connecteam-exported recap PDF onto a Spark event and turn it
 * into a draft CustomRecap with every field pre-filled. Kyle's team
 * was retyping every field by hand; this collapses that to a 30-second
 * paste-and-pick.
 *
 * Flow:
 *   1. Pick the Event the recap is for (search by name)
 *   2. Pick a CustomRecapTemplate (auto-populates with the tenant's
 *      templates — usually there's just one)
 *   3. Drop in the PDF
 *   4. Submit → backend parses, fuzzy-matches labels to template
 *      fields, creates CustomRecap + values, returns a stats report
 *   5. Modal shows matched/unmatched counts and a "View recap" CTA
 *
 * Receipt photo is intentionally NOT handled here — the admin uploads
 * that on the recap edit page afterward.
 */

type Stat = {
  pdfLabel: string;
  pdfValue: string;
  // Relay codegen returns nullable fields as `string | null | undefined`,
  // not `string | null` — match that here so the .map() below compiles
  // without coercing every field with `?? null`.
  fieldName: string | null | undefined;
  score: number | null | undefined;
  skippedReason: string | null | undefined;
};

type Props = {
  onClose: () => void;
  onImported?: (recapUuid: string) => void;
};

const Inner: React.FC<Props> = ({ onClose, onImported }) => {
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);

  const [search, setSearch] = useState("");
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventLabel, setEventLabel] = useState<string>("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  // Result state lives in the modal so the admin can review match
  // quality before closing. The recap is already saved by this point.
  const [result, setResult] = useState<{
    recapUuid: string;
    matched: number;
    unmatched: number;
    stats: Stat[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const eventsData = useLazyLoadQuery<EventsQueryType>(
    EventsQuery,
    { first: 25, q: search || null, filters: null },
    { fetchPolicy: "store-or-network" },
  );

  const templatesData = useLazyLoadQuery<CustomRecapTemplatesQueryType>(
    CustomRecapTemplatesQuery,
    { first: 50, filters: null },
    { fetchPolicy: "store-or-network" },
  );

  const events = useMemo(
    () =>
      (eventsData?.events?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [eventsData],
  );

  const templates = useMemo(
    () =>
      (templatesData?.customRecapTemplates?.edges ?? [])
        .map((e) => e?.node)
        .filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [templatesData],
  );

  // Auto-pick if there's exactly one template for the tenant — saves
  // a click in the common case (one client = one recap shape).
  useMemo(() => {
    if (!templateId && templates.length === 1) {
      setTemplateId(String(templates[0].id));
    }
  }, [templates, templateId]);

  const [commit, isImporting] =
    useMutation<ImportConnecteamRecapPdfMutationType>(
      ImportConnecteamRecapPdfMutation,
    );

  const onPickFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showAlert("File must be a PDF.", "warning");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      // data:application/pdf;base64,<...>  →  strip the prefix.
      const comma = dataUrl.indexOf(",");
      if (comma < 0) {
        showAlert("Couldn't read the PDF — try a different file.", "error");
        return;
      }
      setFileBase64(dataUrl.slice(comma + 1));
      setFileName(file.name);
    };
    reader.onerror = () =>
      showAlert("Couldn't read the PDF — try a different file.", "error");
    reader.readAsDataURL(file);
  };

  const onSubmit = () => {
    if (!eventId || !templateId || !fileBase64) {
      showAlert("Pick an event, a template, and a PDF first.", "warning");
      return;
    }
    if (isImporting) return;

    commit({
      variables: {
        input: {
          eventId,
          customRecapTemplateId: templateId,
          pdfBase64: fileBase64,
        },
      },
      onCompleted: (res) => {
        const r = res.importConnecteamRecapPdf;
        if (!r?.success) {
          showAlert(r?.message ?? "Couldn't import PDF.", "error");
          return;
        }
        const uuid = r.customRecap?.uuid;
        if (!uuid) {
          showAlert("Imported but recap UUID missing.", "warning");
          return;
        }
        setResult({
          recapUuid: String(uuid),
          matched: r.matchedCount,
          unmatched: r.unmatchedCount,
          stats: (r.stats ?? []).map((s) => ({
            pdfLabel: s.pdfLabel,
            pdfValue: s.pdfValue,
            fieldName: s.fieldName,
            score: s.score,
            skippedReason: s.skippedReason,
          })),
        });
        showAlert(
          `Imported · ${r.matchedCount} field(s) mapped, ${r.unmatchedCount} unmatched.`,
          "success",
        );
        onImported?.(String(uuid));
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[8vh]"
      style={{
        background: "rgba(10,11,13,0.7)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl spark-card overflow-hidden"
        style={{
          borderRadius: 20,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          className="p-4 border-b"
          style={{ borderColor: "var(--spark-border, #1f2418)" }}
        >
          <h2 className="text-lg font-semibold">Import Connecteam PDF</h2>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
            We'll parse the PDF and draft a recap. Upload the receipt photo
            on the next page.
          </p>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {!result && (
            <>
              {/* Event picker */}
              <div>
                <label className="label-mini block mb-1.5">
                  Event · search by name
                </label>
                <input
                  className="w-full"
                  placeholder="Albertsons Laguna Niguel · 05/22…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#fff",
                  }}
                />
                <div
                  className="mt-2 rounded-lg overflow-y-auto"
                  style={{
                    maxHeight: 220,
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {events.length === 0 ? (
                    <div
                      className="text-xs px-3 py-2"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      No matching events. Try a different search.
                    </div>
                  ) : (
                    events.map((ev) => {
                      const id = String(ev.id);
                      const picked = id === eventId;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setEventId(id);
                            setEventLabel(ev.name ?? "Untitled event");
                          }}
                          className="w-full text-left px-3 py-2 text-sm flex items-center justify-between transition"
                          style={{
                            background: picked
                              ? "rgba(197,245,70,0.12)"
                              : "transparent",
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <span>{ev.name ?? "Untitled event"}</span>
                          {picked && (
                            <span
                              className="text-xs"
                              style={{ color: "var(--spark-lime)" }}
                            >
                              selected
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Template */}
              <div>
                <label className="label-mini block mb-1.5">
                  Recap template
                </label>
                <select
                  value={templateId ?? ""}
                  onChange={(e) => setTemplateId(e.target.value || null)}
                  className="w-full"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#fff",
                  }}
                >
                  <option value="">— Select template —</option>
                  {templates.map((t) => (
                    <option key={String(t.id)} value={String(t.id)}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {templates.length === 0 && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "rgba(255,200,80,0.85)" }}
                  >
                    No templates found for this tenant. Create one in
                    Catalogs → Recap templates first.
                  </p>
                )}
              </div>

              {/* File picker */}
              <div>
                <label className="label-mini block mb-1.5">
                  Connecteam PDF
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPickFile(f);
                  }}
                  className="text-sm"
                />
                {fileName && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "rgba(197,245,70,0.85)" }}
                  >
                    {fileName} · ready to upload
                  </p>
                )}
              </div>
            </>
          )}

          {/* Result panel */}
          {result && (
            <div className="space-y-3">
              <div
                className="rounded-xl px-3 py-2 text-sm"
                style={{
                  background: "rgba(197,245,70,0.08)",
                  border: "1px solid rgba(197,245,70,0.3)",
                }}
              >
                Imported · <b>{result.matched}</b> matched ·{" "}
                <b>{result.unmatched}</b> unmatched
              </div>
              <div
                className="rounded-lg overflow-y-auto text-xs"
                style={{
                  maxHeight: 280,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <table className="w-full">
                  <thead>
                    <tr
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        color: "rgba(255,255,255,0.6)",
                      }}
                    >
                      <th className="text-left px-2 py-1 font-normal">
                        PDF label
                      </th>
                      <th className="text-left px-2 py-1 font-normal">
                        Mapped to
                      </th>
                      <th className="text-left px-2 py-1 font-normal">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.stats.map((s, i) => (
                      <tr
                        key={i}
                        style={{
                          borderTop: "1px solid rgba(255,255,255,0.05)",
                          background: !s.fieldName
                            ? "rgba(255,100,80,0.06)"
                            : undefined,
                        }}
                      >
                        <td className="px-2 py-1">{s.pdfLabel}</td>
                        <td className="px-2 py-1">
                          {s.fieldName ? (
                            <>
                              {s.fieldName}
                              {s.score != null && (
                                <span
                                  className="ml-1"
                                  style={{ color: "rgba(255,255,255,0.4)" }}
                                >
                                  · fuzzy {s.score.toFixed(2)}
                                </span>
                              )}
                            </>
                          ) : (
                            <span style={{ color: "rgba(255,100,80,0.85)" }}>
                              unmatched
                            </span>
                          )}
                        </td>
                        <td
                          className="px-2 py-1 truncate"
                          style={{ maxWidth: 200 }}
                        >
                          {s.pdfValue || (
                            <span style={{ color: "rgba(255,255,255,0.35)" }}>
                              (blank)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="p-4 border-t flex items-center justify-end gap-2"
          style={{ borderColor: "var(--spark-border, #1f2418)" }}
        >
          {result ? (
            <>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                }}
                onClick={() => {
                  // Reset to do another import.
                  setResult(null);
                  setFileBase64(null);
                  setFileName(null);
                }}
              >
                Import another
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{
                  background: "var(--spark-lime, #c5f546)",
                  color: "#0a0d09",
                }}
                onClick={() => {
                  onClose();
                  navigate(`/recap/view-custom/${result.recapUuid}`);
                }}
              >
                View recap →
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "rgba(255,255,255,0.8)",
                }}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                disabled={
                  isImporting || !eventId || !templateId || !fileBase64
                }
                style={{
                  background: "var(--spark-lime, #c5f546)",
                  color: "#0a0d09",
                }}
                onClick={onSubmit}
              >
                {isImporting
                  ? "Importing…"
                  : eventLabel
                    ? `Import → ${eventLabel.slice(0, 28)}${eventLabel.length > 28 ? "…" : ""}`
                    : "Import PDF"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ImportConnecteamPdfModal: React.FC<Props> = (props) => (
  <Suspense
    fallback={
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center"
        style={{ background: "rgba(10,11,13,0.7)" }}
      >
        <div className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
          Loading…
        </div>
      </div>
    }
  >
    <Inner {...props} />
  </Suspense>
);

export default ImportConnecteamPdfModal;
