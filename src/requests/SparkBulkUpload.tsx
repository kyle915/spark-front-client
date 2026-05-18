import { Suspense, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { fetchQuery } from "relay-runtime";
import environment from "@api/relay/environment";
import Layout from "@/layout/Layout";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { GetUploadUrlQuery } from "@/api/queries/GetUploadUrlQuery";
import type { GetUploadUrlQuery as GetUploadUrlQueryType } from "@api/queries/__generated__/GetUploadUrlQuery.graphql";

/**
 * Spark v2 — Bulk request upload.
 *
 * Drop-in replacement for the placeholder Master Tracker "Bulk upload"
 * button that used to navigate to /requests/create. This page wires the
 * backend's request_batch_template_download_url + import_requests_batch
 * mutations into a 3-step UX:
 *
 *   1. Download the per-tenant XLSX template (pre-populated columns +
 *      validation rules).
 *   2. Drop or pick the filled file. We run a dry-run validation first
 *      and surface row-level errors before any DB writes happen.
 *   3. Once dry-run is clean (or kyle explicitly accepts partial
 *      success), commit the import. Success rows show with their new
 *      Request IDs so the team can audit.
 *
 * Works for both admins (logged in as Ignite/Spark admin) and clients
 * (RMM viewing their own tenant). Backend permission checks gate which
 * rows get accepted.
 */

type RowResult = {
  rowNumber: number;
  success: boolean;
  message: string | null;
  requestId: string | null;
  requestUuid: string | null;
};

type ImportResponse = {
  success: boolean;
  message: string;
  totalRows: number | null;
  successCount: number | null;
  failedCount: number | null;
  rolledBack: boolean | null;
  errors: string[] | null;
  rows: RowResult[] | null;
};

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
    throw new Error(
      json.errors.map((e: { message: string }) => e.message).join("; "),
    );
  }
  return json.data as T;
}

const Inner: React.FC = () => {
  const navigate = useNavigate();
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"idle" | "template" | "dry" | "commit">(
    "idle",
  );
  const [dryResult, setDryResult] = useState<ImportResponse | null>(null);
  const [commitResult, setCommitResult] = useState<ImportResponse | null>(null);
  const [uploadedBlobName, setUploadedBlobName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dropping, setDropping] = useState(false);

  const resetFlow = () => {
    setFile(null);
    setDryResult(null);
    setCommitResult(null);
    setUploadedBlobName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadTemplate = async () => {
    if (busy !== "idle") return;
    setBusy("template");
    try {
      const data = await postGql<{
        requestBatchTemplateDownloadUrl: {
          success: boolean;
          message: string;
          fileUrl: string | null;
        };
      }>(
        `
          mutation BatchTemplate($input: RequestBatchTemplateInput!) {
            requestBatchTemplateDownloadUrl(input: $input) {
              success
              message
              fileUrl
            }
          }
        `,
        { input: tenantId ? { tenantId } : {} },
      );
      const r = data.requestBatchTemplateDownloadUrl;
      if (!r?.success || !r.fileUrl) {
        throw new Error(r?.message || "Couldn't generate template.");
      }
      // Trigger a download in a hidden anchor so we don't navigate.
      const a = document.createElement("a");
      a.href = r.fileUrl;
      a.download = "spark-bulk-template.xlsx";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showAlert("Template downloaded. Fill it in then drop it back here.", "success");
    } catch (e) {
      showAlert(`Couldn't download template: ${(e as Error).message}`, "error");
    } finally {
      setBusy("idle");
    }
  };

  const uploadAndValidate = async (selected: File) => {
    if (busy !== "idle" || !tenantId) return;
    setFile(selected);
    setDryResult(null);
    setCommitResult(null);
    setUploadedBlobName(null);
    setBusy("dry");
    try {
      // 1. Get signed upload URL
      const timestamp = Date.now();
      const safeName = selected.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `requests/batch-uploads/tenant-${tenantId}/${timestamp}_${safeName}`;
      const uploadData = await fetchQuery<GetUploadUrlQueryType>(
        environment,
        GetUploadUrlQuery,
        {
          filePath,
          contentType:
            selected.type ||
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ).toPromise();
      const uploadUrl = uploadData?.getUploadUrl?.uploadUrl;
      const blobName = uploadData?.getUploadUrl?.blobName;
      if (!uploadUrl || !blobName) {
        throw new Error("Couldn't get upload URL.");
      }

      // 2. PUT the file to GCS
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type":
            selected.type ||
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        body: selected,
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed: ${putRes.statusText}`);
      }
      setUploadedBlobName(blobName);

      // 3. Dry-run import to surface errors before committing
      const data = await postGql<{ importRequestsBatch: ImportResponse }>(
        `
          mutation DryImport($input: ImportRequestsBatchInput!) {
            importRequestsBatch(input: $input) {
              success
              message
              totalRows
              successCount
              failedCount
              rolledBack
              errors
              rows {
                rowNumber
                success
                message
                requestId
                requestUuid
              }
            }
          }
        `,
        {
          input: {
            tenantId,
            file: blobName,
            sheetName: "0",
            dryRun: true,
            rollbackOnError: true,
          },
        },
      );
      setDryResult(data.importRequestsBatch);
    } catch (e) {
      showAlert(`Validation failed: ${(e as Error).message}`, "error");
    } finally {
      setBusy("idle");
    }
  };

  const commitImport = async () => {
    if (busy !== "idle" || !uploadedBlobName || !tenantId) return;
    setBusy("commit");
    try {
      const data = await postGql<{ importRequestsBatch: ImportResponse }>(
        `
          mutation CommitImport($input: ImportRequestsBatchInput!) {
            importRequestsBatch(input: $input) {
              success
              message
              totalRows
              successCount
              failedCount
              rolledBack
              errors
              rows {
                rowNumber
                success
                message
                requestId
                requestUuid
              }
            }
          }
        `,
        {
          input: {
            tenantId,
            file: uploadedBlobName,
            sheetName: "0",
            dryRun: false,
            rollbackOnError: false,
          },
        },
      );
      setCommitResult(data.importRequestsBatch);
      const r = data.importRequestsBatch;
      if (r.success) {
        showAlert(
          `Imported ${r.successCount ?? 0} request${
            (r.successCount ?? 0) === 1 ? "" : "s"
          }.`,
          "success",
        );
      } else if ((r.successCount ?? 0) > 0) {
        showAlert(
          `Imported ${r.successCount} of ${r.totalRows}, ${r.failedCount} failed.`,
          "warning",
        );
      } else {
        showAlert(r.message || "Import failed.", "error");
      }
    } catch (e) {
      showAlert(`Import failed: ${(e as Error).message}`, "error");
    } finally {
      setBusy("idle");
    }
  };

  const onPick = (f: File | null | undefined) => {
    if (!f) return;
    // Accept .xlsx/.xls only — anything else likely won't parse
    if (!/\.xlsx?$/i.test(f.name)) {
      showAlert("Pick a .xlsx or .xls file.", "warning");
      return;
    }
    uploadAndValidate(f);
  };

  const totalRows = dryResult?.totalRows ?? commitResult?.totalRows ?? 0;
  const successCount =
    commitResult?.successCount ?? dryResult?.successCount ?? 0;
  const failedCount = commitResult?.failedCount ?? dryResult?.failedCount ?? 0;
  const allRows = useMemo(
    () => commitResult?.rows ?? dryResult?.rows ?? [],
    [commitResult, dryResult],
  );
  const failedRows = useMemo(
    () => allRows.filter((r) => !r.success),
    [allRows],
  );
  const successRows = useMemo(
    () => allRows.filter((r) => r.success),
    [allRows],
  );

  const allClean = dryResult !== null && (dryResult.failedCount ?? 0) === 0;
  const committed = commitResult !== null;

  return (
    <div className="space-y-6 max-w-4xl">
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
            BULK UPLOAD
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Drop in a spreadsheet.
          </h1>
          <p
            className="mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Schedule dozens of activations at once. We validate every row
            before anything writes — so a typo on row 7 doesn't break
            rows 1-6.
          </p>
        </div>
        <button
          onClick={() => navigate("/requests/list")}
          className="mono text-[10px] px-3 py-2 rounded-xl"
          style={{
            letterSpacing: "0.18em",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.7)",
            border: "1px solid var(--spark-border)",
          }}
        >
          ← BACK TO TRACKER
        </button>
      </div>

      {/* Step 1: template */}
      <div className="spark-card p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 display text-xl font-bold"
            style={{
              background: "rgba(197,245,70,0.12)",
              border: "1px solid rgba(197,245,70,0.3)",
              color: "var(--spark-lime)",
            }}
          >
            1
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-lime)",
              }}
            >
              GET THE TEMPLATE
            </p>
            <p className="font-bold">Download the per-tenant XLSX</p>
            <p
              className="text-sm mt-1"
              style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}
            >
              Pre-populated columns with dropdowns for activation type
              and tenant. Fill one row per activation, drop the file
              back here when done.
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            disabled={busy !== "idle"}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--spark-lime)",
              color: "#0a0d09",
              boxShadow: "0 0 18px rgba(197,245,70,0.35)",
              opacity: busy !== "idle" ? 0.5 : 1,
            }}
          >
            {busy === "template" ? "Generating…" : "↓ Download template"}
          </button>
        </div>
      </div>

      {/* Step 2: drop file */}
      <div className="spark-card p-5">
        <div className="flex items-start gap-4 flex-wrap mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 display text-xl font-bold"
            style={{
              background: "rgba(95,184,239,0.12)",
              border: "1px solid rgba(95,184,239,0.3)",
              color: "var(--spark-sky)",
            }}
          >
            2
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="mono text-[10px] mb-1"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-sky)",
              }}
            >
              UPLOAD + VALIDATE
            </p>
            <p className="font-bold">Drop your filled file</p>
            <p
              className="text-sm mt-1"
              style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}
            >
              We run a dry-run first — no rows are written until you
              confirm in step 3.
            </p>
          </div>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDropping(true);
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDropping(false);
            onPick(e.dataTransfer.files?.[0]);
          }}
          className="rounded-2xl p-8 cursor-pointer text-center transition"
          style={{
            background: dropping
              ? "rgba(95,184,239,0.10)"
              : "rgba(255,255,255,0.025)",
            border: `2px dashed ${
              dropping
                ? "var(--spark-sky)"
                : "rgba(255,255,255,0.15)"
            }`,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          {busy === "dry" ? (
            <p
              className="mono text-[11px]"
              style={{
                letterSpacing: "0.18em",
                color: "var(--spark-sky)",
              }}
            >
              UPLOADING + VALIDATING…
            </p>
          ) : file ? (
            <>
              <p className="font-bold text-sm">{file.name}</p>
              <p
                className="mono text-[10px] mt-1"
                style={{
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                {(file.size / 1024).toFixed(1)} KB · CLICK TO REPLACE
              </p>
            </>
          ) : (
            <>
              <p
                className="display text-lg font-bold"
                style={{ letterSpacing: "-0.02em" }}
              >
                Drop XLSX here
              </p>
              <p
                className="mono text-[10px] mt-2"
                style={{
                  letterSpacing: "0.18em",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                OR CLICK TO PICK
              </p>
            </>
          )}
        </div>
      </div>

      {/* Validation result */}
      {dryResult && (
        <div className="spark-card p-5">
          <div className="flex items-start gap-4 flex-wrap mb-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 display text-xl font-bold"
              style={{
                background: allClean
                  ? "rgba(197,245,70,0.12)"
                  : "rgba(239,90,42,0.12)",
                border: `1px solid ${
                  allClean
                    ? "rgba(197,245,70,0.3)"
                    : "rgba(239,90,42,0.3)"
                }`,
                color: allClean
                  ? "var(--spark-lime)"
                  : "var(--spark-orange)",
              }}
            >
              3
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="mono text-[10px] mb-1"
                style={{
                  letterSpacing: "0.18em",
                  color: allClean
                    ? "var(--spark-lime)"
                    : "var(--spark-orange)",
                }}
              >
                {committed
                  ? "IMPORT COMPLETE"
                  : allClean
                    ? "READY TO IMPORT"
                    : "FIX THESE ROWS"}
              </p>
              <p className="font-bold">
                {totalRows} row{totalRows === 1 ? "" : "s"} parsed ·{" "}
                <span style={{ color: "var(--spark-lime)" }}>
                  {successCount} clean
                </span>{" "}
                ·{" "}
                <span style={{ color: "var(--spark-orange)" }}>
                  {failedCount} error{failedCount === 1 ? "" : "s"}
                </span>
              </p>
              <p
                className="text-sm mt-1"
                style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}
              >
                {committed
                  ? "Successful rows are now real requests in the queue. Failed rows weren't written."
                  : allClean
                    ? "Every row passed validation. Click 'Import all' to commit."
                    : "Fix the rows below in your spreadsheet, then drop the corrected file back in step 2."}
              </p>
            </div>
            {!committed && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={commitImport}
                  disabled={busy !== "idle" || successCount === 0}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{
                    background: "var(--spark-lime)",
                    color: "#0a0d09",
                    boxShadow: "0 0 18px rgba(197,245,70,0.35)",
                    opacity:
                      busy !== "idle" || successCount === 0 ? 0.5 : 1,
                  }}
                >
                  {busy === "commit"
                    ? "Importing…"
                    : allClean
                      ? `✓ Import all (${successCount})`
                      : `Import ${successCount} clean rows`}
                </button>
                <button
                  onClick={resetFlow}
                  disabled={busy !== "idle"}
                  className="mono text-[10px] px-3 py-1.5"
                  style={{
                    letterSpacing: "0.14em",
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  START OVER
                </button>
              </div>
            )}
            {committed && (
              <button
                onClick={() => navigate("/requests/list")}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-sky)",
                  color: "#0a0d09",
                  boxShadow: "0 0 18px rgba(95,184,239,0.35)",
                }}
              >
                View tracker →
              </button>
            )}
          </div>

          {/* Errored rows */}
          {failedRows.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--spark-border)" }}
            >
              <div
                className="px-4 py-2 mono text-[10px]"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--spark-orange)",
                  background: "rgba(239,90,42,0.06)",
                  borderBottom: "1px solid var(--spark-border)",
                }}
              >
                ROWS TO FIX
              </div>
              <ul>
                {failedRows.slice(0, 50).map((r) => (
                  <li
                    key={r.rowNumber}
                    className="px-4 py-2 text-sm flex items-start gap-3"
                    style={{
                      borderBottom: "1px solid var(--spark-border)",
                    }}
                  >
                    <span
                      className="mono text-[10px] shrink-0 px-2 py-0.5 rounded-md mt-0.5"
                      style={{
                        letterSpacing: "0.12em",
                        background: "rgba(239,90,42,0.12)",
                        border: "1px solid rgba(239,90,42,0.3)",
                        color: "var(--spark-orange)",
                      }}
                    >
                      ROW {r.rowNumber}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.75)" }}>
                      {r.message ?? "Unspecified error"}
                    </span>
                  </li>
                ))}
                {failedRows.length > 50 && (
                  <li
                    className="px-4 py-2 text-xs"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    …and {failedRows.length - 50} more — fix in spreadsheet, then re-upload.
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Imported rows (after commit) */}
          {committed && successRows.length > 0 && (
            <div
              className="rounded-xl overflow-hidden mt-3"
              style={{ border: "1px solid var(--spark-border)" }}
            >
              <div
                className="px-4 py-2 mono text-[10px]"
                style={{
                  letterSpacing: "0.18em",
                  color: "var(--spark-lime)",
                  background: "rgba(197,245,70,0.06)",
                  borderBottom: "1px solid var(--spark-border)",
                }}
              >
                IMPORTED · {successRows.length}
              </div>
              <ul>
                {successRows.slice(0, 30).map((r) => (
                  <li
                    key={r.rowNumber}
                    className="px-4 py-2 text-sm flex items-center gap-3"
                    style={{
                      borderBottom: "1px solid var(--spark-border)",
                    }}
                  >
                    <span
                      className="mono text-[10px] shrink-0 px-2 py-0.5 rounded-md"
                      style={{
                        letterSpacing: "0.12em",
                        background: "rgba(197,245,70,0.12)",
                        border: "1px solid rgba(197,245,70,0.3)",
                        color: "var(--spark-lime)",
                      }}
                    >
                      ROW {r.rowNumber}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.75)" }}>
                      {r.requestId
                        ? `REQ-${r.requestId.slice(-4).toUpperCase()}`
                        : "Imported"}
                    </span>
                    {r.requestUuid && (
                      <button
                        onClick={() =>
                          navigate(`/request/view/${r.requestUuid}`)
                        }
                        className="mono text-[10px] ml-auto"
                        style={{
                          letterSpacing: "0.14em",
                          color: "rgba(95,184,239,0.85)",
                        }}
                      >
                        VIEW →
                      </button>
                    )}
                  </li>
                ))}
                {successRows.length > 30 && (
                  <li
                    className="px-4 py-2 text-xs"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    …and {successRows.length - 30} more.
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function SparkBulkUpload() {
  return (
    <Layout>
      <Suspense
        fallback={
          <div
            className="spark-card p-8 text-center text-sm max-w-4xl"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Loading bulk upload…
          </div>
        }
      >
        <Inner />
      </Suspense>
    </Layout>
  );
}
