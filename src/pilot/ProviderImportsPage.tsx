import React, { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { useAuthStore } from "@/store/authStore";
import { PilotQueriesImportsPageQuery } from "@/api/queries/PilotQueries";
import {
  PilotMutationsCommitCsvImportMutation,
  PilotMutationsPreviewCsvImportMutation,
  PilotMutationsResolveImportRowMutation,
} from "@/api/mutations/PilotMutations";
import type { PilotQueriesImportsPageQuery as ImportsQueryType } from "@/api/queries/__generated__/PilotQueriesImportsPageQuery.graphql";
import type {
  PilotMutationsPreviewCsvImportMutation as PreviewMutationType,
  PilotMutationsPreviewCsvImportMutation$data as PreviewDataType,
} from "@/api/mutations/__generated__/PilotMutationsPreviewCsvImportMutation.graphql";
import type { PilotMutationsCommitCsvImportMutation as CommitMutationType } from "@/api/mutations/__generated__/PilotMutationsCommitCsvImportMutation.graphql";
import type { PilotMutationsResolveImportRowMutation as ResolveRowType } from "@/api/mutations/__generated__/PilotMutationsResolveImportRowMutation.graphql";
import {
  ColumnConfirmPanel,
  StoreMatchNote,
} from "./ImportConfirmPanel";
import {
  confirmedColumnMap,
  duplicateColumnFields,
  parseColumnGuessPayload,
  setGuessField,
  setGuessIncluded,
  storeMatchFromNormalized,
  type ColumnGuess,
  type FieldChoice,
} from "./importConfirm";

const META = { color: "var(--spark-text-meta)" } as const;
const BORDER = { border: "1px solid var(--spark-border)" } as const;
const FIELD_STYLE = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-field-bg, var(--spark-surface))",
  color: "var(--spark-text)",
} as const;
const PRIMARY_BTN_STYLE = {
  background: "var(--spark-lime)",
  color: "var(--spark-on-accent)",
  border: "1px solid var(--spark-lime)",
} as const;
const OK_BANNER_STYLE = {
  background: "var(--spark-ok-bg)",
  color: "var(--spark-ok-ink)",
  border: "1px solid var(--spark-ok-border)",
} as const;

type PreviewPayload = PreviewDataType["previewProviderCsvImport"];

const ImportsBody: React.FC<{ fetchKey: string | number; bump: () => void }> = ({
  fetchKey,
  bump,
}) => {
  const data = useLazyLoadQuery<ImportsQueryType>(
    PilotQueriesImportsPageQuery,
    {},
    { fetchPolicy: "network-only", fetchKey },
  );
  const ws = data?.workspaceOverview;
  const imp = data?.providerImportWorkspace;

  const [commitPreview, previewing] = useMutation<PreviewMutationType>(
    PilotMutationsPreviewCsvImportMutation,
  );
  const [commitImport, committing] = useMutation<CommitMutationType>(
    PilotMutationsCommitCsvImportMutation,
  );
  const [commitResolveRow] = useMutation<ResolveRowType>(
    PilotMutationsResolveImportRowMutation,
  );

  const [providerUuid, setProviderUuid] = useState(
    ws?.viewerProviderUuid ?? ws?.providers[0]?.uuid ?? "",
  );
  const [presetKey, setPresetKey] = useState("agency_fieldpulse");
  const [savedMappingUuid, setSavedMappingUuid] = useState("");
  const [saveMappingName, setSaveMappingName] = useState("");
  const [isHistorical, setIsHistorical] = useState(false);
  const [filename, setFilename] = useState("agency_recaps.csv");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [guesses, setGuesses] = useState<ColumnGuess[]>([]);
  const [fieldChoices, setFieldChoices] = useState<FieldChoice[]>([]);
  const fieldClash = duplicateColumnFields(guesses).length > 0;
  const dropPreview = () => {
    setPreview(null);
    setGuesses([]);
    setFieldChoices([]);
  };
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Row resolution selections
  const [selectedRetailerByRow, setSelectedRetailerByRow] = useState<
    Record<string, string>
  >({});
  const [selectedProductByRow, setSelectedProductByRow] = useState<
    Record<string, string>
  >({});

  const handleFilePick = async (file: File | null) => {
    if (!file) return;
    setFilename(file.name);
    const text = await file.text();
    setCsvText(text);
    dropPreview();
  };

  if (!ws || !imp) {
    return <p className="text-sm mono">Loading CSV importer…</p>;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <header>
        <p className="text-xs uppercase tracking-wider mono" style={META}>
          Repeatable Field Ingestion · {ws.tenantName}
        </p>
        <h1
          className="display text-2xl lg:text-3xl font-bold mt-1"
          style={{ letterSpacing: "-0.02em" }}
        >
          Provider CSV Imports & Canonical Visit Alignment
        </h1>
        <p className="text-xs mt-1" style={META}>
          Zero-write preview, saved agency column templates, idempotent re-uploads, and store/SKU alias matching.
        </p>
      </header>

      {statusBanner && (
        <div
          className="p-3 rounded-xl text-xs font-medium"
          style={OK_BANNER_STYLE}
        >
          {statusBanner}
        </div>
      )}

      <section className="spark-card p-5 space-y-4">
        <h2 className="display text-lg font-bold">1. Configure & Preview Upload</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs space-y-1">
            <span style={META}>Field Provider *</span>
            <select
              value={providerUuid}
              disabled={Boolean(ws.viewerProviderUuid)}
              onChange={(e) => {
                setProviderUuid(e.target.value);
                dropPreview();
              }}
              className="w-full px-3 py-2 rounded-xl text-xs"
              style={FIELD_STYLE}
            >
              <option value="">Select agency…</option>
              {ws.providers.map((p) => (
                <option key={p.uuid} value={p.uuid}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs space-y-1">
            <span style={META}>Preset Format</span>
            <select
              value={presetKey}
              onChange={(e) => {
                setPresetKey(e.target.value);
                setSavedMappingUuid("");
                dropPreview();
              }}
              className="w-full px-3 py-2 rounded-xl text-xs"
              style={FIELD_STYLE}
            >
              {imp.presets.map((pr) => (
                <option key={pr.key} value={pr.key}>
                  {pr.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs space-y-1">
            <span style={META}>Or Saved Agency Mapping</span>
            <select
              value={savedMappingUuid}
              onChange={(e) => {
                setSavedMappingUuid(e.target.value);
                dropPreview();
              }}
              className="w-full px-3 py-2 rounded-xl text-xs"
              style={FIELD_STYLE}
            >
              <option value="">Use preset / auto-detect</option>
              {imp.savedMappings.map((m) => (
                <option key={m.uuid} value={m.uuid}>
                  {m.providerName} · {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
          <label className="text-xs space-y-1">
            <span style={META}>Upload CSV File</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void handleFilePick(e.target.files?.[0] ?? null)}
              className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-base-300 file:text-xs file:font-semibold file:bg-base-200"
              style={{ color: "var(--spark-text)" }}
            />
          </label>

          <label className="inline-flex items-center gap-2 text-xs pt-4">
            <input
              type="checkbox"
              checked={isHistorical}
              onChange={(e) => setIsHistorical(e.target.checked)}
            />
            <span>
              Historical backfill (imports recaps for record-keeping while excluding from live rollups)
            </span>
          </label>
        </div>

        <label className="block text-xs space-y-1">
          <span style={META}>CSV Content (paste or edit directly)</span>
          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              dropPreview();
            }}
            placeholder="Event_Ref,Demo_Date,Retail_Chain,Store_Num,Street,City,State,SKU_Code,Cans_Sampled,Units_Sold"
            className="w-full p-3 rounded-xl text-xs mono"
            style={FIELD_STYLE}
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={previewing || !providerUuid || !csvText.trim()}
            onClick={() => {
              commitPreview({
                variables: {
                  providerUuid,
                  csvText,
                  mappingUuid: savedMappingUuid || null,
                  presetKey: savedMappingUuid ? null : presetKey,
                  columnMapJson: null,
                  confirmColumnMap: false,
                },
                onCompleted: (r) => {
                  const next = r.previewProviderCsvImport;
                  const parsed = parseColumnGuessPayload(next?.columnGuessesJson);
                  setGuesses(parsed.guesses);
                  setFieldChoices(parsed.fields);
                  setPreview(next);
                },
              });
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold"
            style={PRIMARY_BTN_STYLE}
          >
            {previewing ? "Analyzing rows…" : "Preview Import (Zero Writes)"}
          </button>

          {preview && (
            <>
              <input
                value={saveMappingName}
                onChange={(e) => setSaveMappingName(e.target.value)}
                placeholder="Optional: save mapping as…"
                className="px-3 py-2 rounded-xl text-xs"
                style={FIELD_STYLE}
              />
              <button
                type="button"
                disabled={committing || fieldClash}
                onClick={() => {
                  const confirmed = confirmedColumnMap(guesses);
                  const useConfirm = guesses.length > 0;
                  commitImport({
                    variables: {
                      providerUuid,
                      csvText,
                      filename,
                      mappingUuid: useConfirm ? null : savedMappingUuid || null,
                      presetKey: useConfirm || savedMappingUuid ? null : presetKey,
                      columnMapJson: useConfirm ? JSON.stringify(confirmed) : null,
                      confirmColumnMap: useConfirm,
                      saveMappingName: saveMappingName.trim() || null,
                      isHistorical,
                    },
                    onCompleted: (r) => {
                      if (r.commitProviderCsvImport.ok) {
                        setStatusBanner(
                          `Committed import job ${r.commitProviderCsvImport.targetUuid ?? ""}.`,
                        );
                        setPreview(null);
                        setGuesses([]);
                        bump();
                      } else {
                        setStatusBanner(
                          r.commitProviderCsvImport.error ?? "Commit failed.",
                        );
                      }
                    },
                  });
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold"
                style={OK_BANNER_STYLE}
              >
                {committing ? "Committing…" : "Commit Valid Rows"}
              </button>
            </>
          )}
        </div>

        {preview && (
          <div className="space-y-3 pt-3" style={{ borderTop: "1px solid var(--spark-border)" }}>
            <div className="flex flex-wrap gap-3 text-xs mono">
              <span>Total: {preview.totalRows}</span>
              <span style={{ color: "var(--spark-ok-ink)" }}>
                New: {preview.createdCount}
              </span>
              <span style={{ color: "var(--spark-info-ink)" }}>
                Updated: {preview.updatedCount}
              </span>
              <span>Unchanged: {preview.unchangedCount}</span>
              <span style={{ color: "var(--spark-warn-badge-ink)" }}>
                Needs review: {preview.reviewCount}
              </span>
              <span style={{ color: "var(--spark-flag-ink, #ef5a2a)" }}>
                Errors: {preview.errorCount}
              </span>
            </div>
            <ColumnConfirmPanel
              guesses={guesses}
              fields={fieldChoices}
              onToggle={(header, included) =>
                setGuesses((current) => setGuessIncluded(current, header, included))
              }
              onField={(header, field) =>
                setGuesses((current) =>
                  setGuessField(current, header, field, fieldChoices),
                )
              }
            />
            {guesses.length > 0 ? (
              <button
                type="button"
                disabled={previewing || fieldClash}
                onClick={() => {
                  commitPreview({
                    variables: {
                      providerUuid,
                      csvText,
                      mappingUuid: null,
                      presetKey: null,
                      columnMapJson: JSON.stringify(confirmedColumnMap(guesses)),
                      confirmColumnMap: true,
                    },
                    onCompleted: (r) => setPreview(r.previewProviderCsvImport),
                  });
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={FIELD_STYLE}
              >
                {previewing ? "Updating preview…" : "Update preview with these columns"}
              </button>
            ) : null}
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr style={META}>
                    <th className="py-1.5 pr-3">Row #</th>
                    <th className="py-1.5 pr-3">Status</th>
                    <th className="py-1.5 pr-3">Code</th>
                    <th className="py-1.5">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr
                      key={r.rowNumber}
                      style={{ borderTop: "1px solid var(--spark-border)" }}
                    >
                      <td className="py-1.5 pr-3 mono">{r.rowNumber}</td>
                      <td className="py-1.5 pr-3 mono font-semibold">{r.status}</td>
                      <td className="py-1.5 pr-3 mono" style={META}>
                        {r.errorCode || "ok"}
                      </td>
                      <td className="py-1.5">
                        {r.message || "Ready to import"}
                        <StoreMatchNote
                          match={storeMatchFromNormalized(r.normalizedRowJson)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Uncertain Store / SKU Review Queue */}
      {imp.reviewQueue.length > 0 && (
        <section className="spark-card p-5 space-y-3">
          <h2
            className="display text-lg font-bold"
            style={{ color: "var(--spark-warn-badge-ink)" }}
          >
            Uncertain Store & SKU Match Queue ({imp.reviewQueue.length})
          </h2>
          <p className="text-xs" style={META}>
            Resolve once and save alias so future provider CSV uploads match automatically without re-uploading the whole file.
          </p>
          <div className="space-y-2.5">
            {imp.reviewQueue.map((row) => {
              const rowKey = row.rowUuid ?? String(row.rowNumber);
              return (
                <div
                  key={rowKey}
                  className="p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs"
                  style={BORDER}
                >
                  <div>
                    <div className="font-semibold">
                      Row #{row.rowNumber} · {row.errorCode}
                    </div>
                    <div style={META}>{row.message}</div>
                    <StoreMatchNote
                      match={storeMatchFromNormalized(row.normalizedRowJson)}
                      onPick={(retailerId) =>
                        setSelectedRetailerByRow((prev) => ({
                          ...prev,
                          [rowKey]: retailerId,
                        }))
                      }
                    />
                  </div>
                  {row.rowUuid && ws.canEditBrandOps && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={selectedRetailerByRow[rowKey] ?? ""}
                        onChange={(e) =>
                          setSelectedRetailerByRow((prev) => ({
                            ...prev,
                            [rowKey]: e.target.value,
                          }))
                        }
                        className="px-2.5 py-1.5 rounded-lg"
                        style={FIELD_STYLE}
                      >
                        <option value="">Map store (optional)…</option>
                        {ws.stores.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.subtitle})
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedProductByRow[rowKey] ?? ""}
                        onChange={(e) =>
                          setSelectedProductByRow((prev) => ({
                            ...prev,
                            [rowKey]: e.target.value,
                          }))
                        }
                        className="px-2.5 py-1.5 rounded-lg"
                        style={FIELD_STYLE}
                      >
                        <option value="">Map SKU (optional)…</option>
                        {ws.products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const rId = selectedRetailerByRow[rowKey];
                          const pId = selectedProductByRow[rowKey];
                          commitResolveRow({
                            variables: {
                              rowUuid: row.rowUuid as string,
                              retailerId: rId ? Number(rId) : null,
                              confirmedStoreNumber: null,
                              confirmedAddress: null,
                              confirmedCity: null,
                              confirmedState: null,
                              saveStoreAlias: Boolean(rId),
                              productId: pId ? Number(pId) : null,
                              saveProductAlias: Boolean(pId),
                            },
                            onCompleted: (res) => {
                              if (res.resolveProviderImportRow.ok) {
                                setStatusBanner(
                                  "Resolved uncertain row & saved alias.",
                                );
                                bump();
                              }
                            },
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg font-bold"
                        style={PRIMARY_BTN_STYLE}
                      >
                        Save Alias & Retry Row
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Import History */}
      <section className="spark-card p-5 space-y-3">
        <h2 className="display text-lg font-bold">Recent Import Runs</h2>
        {imp.recentJobs.length === 0 ? (
          <p className="text-xs" style={META}>
            No CSV import runs committed yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr style={META}>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">File</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Created / Updated / Unchanged</th>
                  <th className="py-2 pr-3">Review / Errors</th>
                  <th className="py-2 text-right">Imported</th>
                </tr>
              </thead>
              <tbody>
                {imp.recentJobs.map((j) => (
                  <tr
                    key={j.uuid}
                    style={{ borderTop: "1px solid var(--spark-border)" }}
                  >
                    <td className="py-2 pr-3 font-medium">
                      {j.providerName}
                      {j.isHistorical ? " (historical)" : ""}
                    </td>
                    <td className="py-2 pr-3 mono">{j.filename}</td>
                    <td className="py-2 pr-3 mono">{j.status}</td>
                    <td className="py-2 pr-3 mono">
                      +{j.createdCount} / ~{j.updatedCount} / ={j.unchangedCount}
                    </td>
                    <td className="py-2 pr-3 mono">
                      {j.reviewCount} / {j.errorCount}
                    </td>
                    <td className="py-2 text-right mono" style={META}>
                      {j.createdAt.slice(0, 16).replace("T", " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export const ProviderImportsPage: React.FC = () => {
  const tenantId = useAuthStore((s) => s.tenantId);
  const [fetchKey, setFetchKey] = useState(0);
  return (
    <div className="p-4 lg:p-8">
      <Suspense fallback={<p className="text-sm mono">Loading CSV importer…</p>}>
        <ImportsBody
          key={tenantId ?? "none"}
          fetchKey={`${tenantId ?? "none"}:${fetchKey}`}
          bump={() => setFetchKey((k) => k + 1)}
        />
      </Suspense>
    </div>
  );
};

export default ProviderImportsPage;
