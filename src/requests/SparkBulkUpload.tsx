import { Suspense, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { fetchQuery } from "relay-runtime";
import * as XLSX from "xlsx";
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
  skipped: boolean | null;
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
  skippedCount: number | null;
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
          fileBase64: string | null;
          fileName: string | null;
        };
      }>(
        `
          mutation BatchTemplate($input: RequestBatchTemplateInput!) {
            requestBatchTemplateDownloadUrl(input: $input) {
              success
              message
              fileUrl
              fileBase64
              fileName
            }
          }
        `,
        { input: tenantId ? { tenantId } : {} },
      );
      const r = data.requestBatchTemplateDownloadUrl;
      if (!r?.success) {
        throw new Error(r?.message || "Couldn't generate template.");
      }

      const filename = r.fileName || "spark-bulk-template.xlsx";

      // Inline path (new, preferred). Avoids GCS entirely so an IAM
      // gap on the service account doesn't break downloads. ~30 kB
      // of base64 over the wire — trivial.
      let downloadHref: string;
      let blobUrlToRevoke: string | null = null;
      if (r.fileBase64) {
        const byteString = atob(r.fileBase64);
        const bytes = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
          bytes[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type:
            "application/vnd.openxmlformats-officedocument." +
            "spreadsheetml.sheet",
        });
        downloadHref = URL.createObjectURL(blob);
        blobUrlToRevoke = downloadHref;
      } else if (r.fileUrl) {
        downloadHref = r.fileUrl;
      } else {
        throw new Error("Template response was empty.");
      }

      // Trigger a download in a hidden anchor so we don't navigate.
      const a = document.createElement("a");
      a.href = downloadHref;
      a.download = filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (blobUrlToRevoke) {
        // Free the blob after the browser has had a chance to start
        // the download. 30 s is plenty.
        window.setTimeout(() => URL.revokeObjectURL(blobUrlToRevoke!), 30_000);
      }
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
              skippedCount
              rolledBack
              errors
              rows {
                rowNumber
                success
                message
                requestId
                requestUuid
                skipped
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
              skippedCount
              rolledBack
              errors
              rows {
                rowNumber
                success
                message
                requestId
                requestUuid
                skipped
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

  // Convert a CSV File into an XLSX File client-side so the backend
  // import_requests_batch mutation (which only accepts XLSX) can parse
  // it. We use the same `xlsx` library that's already shipping in the
  // bundle, so no new dep. We aim for a sheet named "Requests" to
  // match the template default the backend expects when sheet_name=0.
  const csvToXlsx = async (csvFile: File): Promise<File> => {
    const text = await csvFile.text();
    const wb = XLSX.read(text, { type: "string" });
    // Rename the first sheet to "Requests" so it matches the backend
    // template convention regardless of what the source CSV calls it.
    if (wb.SheetNames.length > 0 && wb.SheetNames[0] !== "Requests") {
      const sheet = wb.Sheets[wb.SheetNames[0]];
      delete wb.Sheets[wb.SheetNames[0]];
      wb.Sheets["Requests"] = sheet;
      wb.SheetNames[0] = "Requests";
    }
    const xlsxArray = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const xlsxBlob = new Blob([xlsxArray], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const newName = csvFile.name.replace(/\.csv$/i, ".xlsx");
    return new File([xlsxBlob], newName, { type: xlsxBlob.type });
  };

  const onPick = async (f: File | null | undefined) => {
    if (!f) return;
    if (/\.csv$/i.test(f.name)) {
      // Convert CSV → XLSX in-browser, then send through the normal flow.
      try {
        const converted = await csvToXlsx(f);
        showAlert(
          `Converted ${f.name} to XLSX in your browser — running validation now…`,
          "info",
        );
        uploadAndValidate(converted);
      } catch (e) {
        showAlert(
          `Couldn't read CSV: ${(e as Error).message}`,
          "error",
        );
      }
      return;
    }
    if (!/\.xlsx?$/i.test(f.name)) {
      showAlert("Pick a .xlsx, .xls, or .csv file.", "warning");
      return;
    }
    uploadAndValidate(f);
  };

  const totalRows = dryResult?.totalRows ?? commitResult?.totalRows ?? 0;
  const successCount =
    commitResult?.successCount ?? dryResult?.successCount ?? 0;
  const failedCount = commitResult?.failedCount ?? dryResult?.failedCount ?? 0;
  const skippedCount =
    commitResult?.skippedCount ?? dryResult?.skippedCount ?? 0;
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

  const committed = commitResult !== null;
  // "Clean" means the backend actually validated rows AND none failed — not
  // merely failedCount===0, which is ALSO true for a pre-flight failure that
  // produced zero rows (e.g. tenant misconfig). Requiring success===true and
  // totalRows>0 stops a 0-row error from masquerading as "ready to import".
  const allClean =
    dryResult !== null &&
    dryResult.success === true &&
    (dryResult.totalRows ?? 0) > 0 &&
    (dryResult.failedCount ?? 0) === 0;
  // The dry-run came back unsuccessful but produced no per-row results — a
  // pre-flight failure (unreadable file, no matching tab, tenant not set up,
  // etc.). The real reason lives in message/errors; surface it rather than
  // pretend the file passed.
  const preflightError =
    !committed &&
    dryResult !== null &&
    !allClean &&
    failedRows.length === 0;
  const backendMessage = (commitResult ?? dryResult)?.message ?? null;

  // Lets users debug rejected rows offline. We export the row numbers
  // + error messages so kyle can paste them next to his original sheet
  // and fix in bulk.
  const esc = (raw: string) => {
    const s = (raw ?? "").toString();
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const triggerCsvDownload = (filename: string, body: string) => {
    const blob = new Blob([body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportFailedRows = () => {
    if (failedRows.length === 0) return;
    const lines = ["row,error_message"];
    for (const r of failedRows) {
      lines.push(`${r.rowNumber},${esc(r.message ?? "Unspecified error")}`);
    }
    triggerCsvDownload(
      `spark-bulk-failed-rows-${new Date().toISOString().slice(0, 10)}.csv`,
      lines.join("\n"),
    );
  };

  // After a commit, kyle's clients want to paste the new REQ-IDs +
  // UUIDs back into their tracking sheets. Exports row number from
  // their original file plus the REQ-id and UUID we assigned.
  const exportImportedRows = () => {
    if (successRows.length === 0) return;
    const lines = ["row,req_id,request_uuid"];
    for (const r of successRows) {
      const reqId = r.requestId
        ? `REQ-${r.requestId.slice(-4).toUpperCase()}`
        : "";
      lines.push(
        `${r.rowNumber},${esc(reqId)},${esc(r.requestUuid ?? "")}`,
      );
    }
    triggerCsvDownload(
      `spark-bulk-imported-${new Date().toISOString().slice(0, 10)}.csv`,
      lines.join("\n"),
    );
  };

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
              background: "rgba(242,243,238,0.12)",
              border: "1px solid rgba(242,243,238,0.3)",
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
              opacity: busy !== "idle" ? 0.5 : 1,
            }}
          >
            {busy === "template" ? "Generating…" : "↓ Download template"}
          </button>
        </div>
      </div>

      {/* Quick column reference — so kyle's clients know what they're
          looking at before they crack open the XLSX. Required columns
          flagged with a lime *. */}
      <details
        className="spark-card p-5"
        style={{ borderRadius: 20 }}
      >
        <summary
          className="cursor-pointer flex items-center gap-3"
          style={{ listStyle: "none" }}
        >
          <span
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-gold)",
            }}
          >
            COLUMN REFERENCE
          </span>
          <span
            className="text-sm font-semibold"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            What goes in each column
          </span>
          <span
            className="ml-auto mono text-[10px]"
            style={{
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            TAP TO EXPAND
          </span>
        </summary>
        <div
          className="mt-4 overflow-x-auto rounded-xl"
          style={{ border: "1px solid var(--spark-border)" }}
        >
          <table className="w-full text-xs" style={{ minWidth: 640 }}>
            <thead
              style={{
                background: "var(--spark-surface-2)",
                borderBottom: "1px solid var(--spark-border)",
              }}
            >
              <tr
                className="text-left mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                <th className="px-3 py-2">COLUMN</th>
                <th className="px-3 py-2">REQ?</th>
                <th className="px-3 py-2">DESCRIPTION</th>
                <th className="px-3 py-2">EXAMPLE</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  // [column, required, description, example]
                  ["date", true, "Activation date (MM/DD/YYYY)", "02/20/2026"],
                  ["start_time", true, "24h start (HH:MM)", "10:00"],
                  ["end_time", true, "24h end (HH:MM)", "14:00"],
                  ["address", true, "Full venue address", "123 Main St"],
                  ["store_number", true, "Retailer store # / identifier", "102"],
                  ["name", false, "Friendly label", "LD Sampling — Whole Foods Lamar"],
                  ["retailer_name", false, "Retailer/chain name", "Whole Foods"],
                  ["city", false, "City", "Austin"],
                  ["state", false, "2-letter state code", "TX"],
                  ["latitude", false, "Decimal latitude (optional)", "30.2672"],
                  ["longitude", false, "Decimal longitude (optional)", "-97.7431"],
                  ["notes", false, "Anything ops needs to know", "Park behind dumpster"],
                  ["requestor_email", false, "Who's submitting", "you@distributor.com"],
                  ["distributor_name", false, "Distributor (free text or template ID)", "RNDC"],
                  ["store_manager_name", false, "Store contact", "John Smith"],
                  ["store_manager_phone", false, "Store contact phone", "+1-555-0101"],
                  ["timezone_code", false, "TZ code (see TimeZones sheet)", "EST"],
                  ["request_type_id", false, "ID from RequestTypes sheet", "1"],
                  ["event_type_id", false, "ID from EventTypes sheet", "1"],
                  ["billing_entity_id", false, "ID from BillingEntities sheet", ""],
                  ["table_size", false, "BA count", "1"],
                  ["product_ids", false, "Comma-sep IDs from Products sheet", "3,7,10"],
                ] as Array<[string, boolean, string, string]>
              ).map(([col, required, desc, example]) => (
                <tr
                  key={col}
                  style={{ borderBottom: "1px solid var(--spark-border)" }}
                >
                  <td
                    className="px-3 py-2 mono"
                    style={{
                      letterSpacing: "0.04em",
                      color: required
                        ? "var(--spark-lime)"
                        : "rgba(255,255,255,0.75)",
                    }}
                  >
                    {col}
                    {required && (
                      <span style={{ color: "var(--spark-lime)" }}> *</span>
                    )}
                  </td>
                  <td
                    className="px-3 py-2 mono text-[10px]"
                    style={{
                      letterSpacing: "0.14em",
                      color: required
                        ? "var(--spark-lime)"
                        : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {required ? "REQ" : "OPT"}
                  </td>
                  <td
                    className="px-3 py-2"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  >
                    {desc}
                  </td>
                  <td
                    className="px-3 py-2 mono text-[11px]"
                    style={{
                      letterSpacing: "0.04em",
                      color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    {example}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p
          className="text-xs mt-3"
          style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}
        >
          The downloaded template has companion sheets (TimeZones,
          RequestTypes, EventTypes, BillingEntities, Cities, Products)
          with the correct IDs for your tenant — keep the file open
          alongside your data so you can look up values without
          guessing.
        </p>
      </details>

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
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
                Drop XLSX or CSV here
              </p>
              <p
                className="mono text-[10px] mt-2"
                style={{
                  letterSpacing: "0.18em",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                OR CLICK TO PICK · .xlsx, .xls, .csv
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
                  ? "rgba(242,243,238,0.12)"
                  : "rgba(239,90,42,0.12)",
                border: `1px solid ${
                  allClean
                    ? "rgba(242,243,238,0.3)"
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
                    : preflightError
                      ? "COULDN'T VALIDATE"
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
                {skippedCount > 0 && (
                  <>
                    {" "}·{" "}
                    <span style={{ color: "var(--spark-sky, #6ab7ff)" }}>
                      {skippedCount} duplicate
                      {skippedCount === 1 ? "" : "s"} skipped
                    </span>
                  </>
                )}
              </p>
              <p
                className="text-sm mt-1"
                style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}
              >
                {committed
                  ? "Successful rows are now real requests in the queue. Failed rows weren't written."
                  : allClean
                    ? "Every row passed validation. Click 'Import all' to commit."
                    : preflightError
                      ? backendMessage ||
                        "The file couldn't be validated. Check the file and try again."
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
                className="px-4 py-2 flex items-center justify-between"
                style={{
                  background: "rgba(239,90,42,0.06)",
                  borderBottom: "1px solid var(--spark-border)",
                }}
              >
                <span
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-orange)",
                  }}
                >
                  ROWS TO FIX · {failedRows.length}
                </span>
                <button
                  onClick={exportFailedRows}
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.14em",
                    color: "var(--spark-orange)",
                  }}
                  title="Download a CSV of the failed rows + error messages so you can fix them in your sheet."
                >
                  ↓ DOWNLOAD CSV
                </button>
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
                className="px-4 py-2 flex items-center justify-between"
                style={{
                  background: "rgba(242,243,238,0.06)",
                  borderBottom: "1px solid var(--spark-border)",
                }}
              >
                <span
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.18em",
                    color: "var(--spark-lime)",
                  }}
                >
                  IMPORTED · {successRows.length}
                </span>
                <button
                  onClick={exportImportedRows}
                  className="mono text-[10px]"
                  style={{
                    letterSpacing: "0.14em",
                    color: "var(--spark-lime)",
                  }}
                  title="Download a CSV of the imported rows + new REQ-IDs so you can paste back into your tracking sheet"
                >
                  ↓ DOWNLOAD CSV
                </button>
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
                        background: "rgba(242,243,238,0.12)",
                        border: "1px solid rgba(242,243,238,0.3)",
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
