import { useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useAlertStore } from "@/store/alertStore";
import { parseRowsToAccounts, type UploadedAccount } from "@/lib/accounts";
import type { AccountListState } from "./useAccountList";
import { listSummary, storesWord, toListInput } from "./accountStores";

/**
 * The brand's account list: upload a CSV or Excel file of stores. The list
 * is saved on the server for the brand, so it is there on any device and for
 * everyone who can see the brand. Rows already on the list are skipped;
 * nothing is removed.
 */

/** Read a file into rows. Rejects with a sentence a person can act on. */
function readFile(file: File): Promise<UploadedAccount[]> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) =>
          resolve(parseRowsToAccounts(res.data, res.meta.fields ?? [])),
        error: (e) => reject(new Error(e.message)),
      });
    });
  }
  return file.arrayBuffer().then((buf) => {
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, {
      defval: "",
    });
    return parseRowsToAccounts(rows, Object.keys(rows[0] ?? {}));
  });
}

// A ready-to-fill CSV whose headers match what parseRowsToAccounts detects.
// Header row only: no made-up stores in a file people will send back to us.
function downloadTemplate() {
  const csv = ["Name", "Address", "City", "State", "Zip", "Chain"]
    .map((c) => `"${c}"`)
    .join(",");
  // UTF-8 BOM so Excel opens it with the right encoding.
  const blob = new Blob(["﻿" + csv + "\r\n"], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "spark-account-list-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function statusLine(list: AccountListState): string {
  if (list.status === "off") return "Choose a brand to see or upload its account list.";
  if (list.status === "loading") return "Loading the saved list.";
  if (list.status === "error") return "The saved account list could not be loaded.";
  const s = listSummary(list.entries);
  if (s.total === 0) return "No account list has been uploaded for this brand.";
  const parts = [`${storesWord(s.total)} on the list`, `${s.placed.toLocaleString("en-US")} on the map`];
  if (list.placing) {
    const done = list.placing.total - list.placing.remaining;
    parts.push(
      `looking up addresses: ${done.toLocaleString("en-US")} of ${list.placing.total.toLocaleString("en-US")}`,
    );
  } else if (s.pending > 0) {
    parts.push(
      list.lookupOff
        ? `${s.pending.toLocaleString("en-US")} waiting: address lookup is not available right now`
        : `${s.pending.toLocaleString("en-US")} waiting for an address lookup`,
    );
  }
  if (s.unplaceable > 0) {
    parts.push(`${s.unplaceable.toLocaleString("en-US")} without a findable address`);
  }
  return `${parts.join(" · ")}.`;
}

export function AccountUploader({
  list,
  quiet = false,
}: {
  list: AccountListState;
  /** A secondary action under the map, not the page hero. */
  quiet?: boolean;
}) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const canUpload = list.status === "ready" && !busy;

  const onFile = async (file: File) => {
    if (list.status !== "ready") return;
    setBusy(true);
    try {
      const rows = await readFile(file);
      if (rows.length === 0) {
        showAlert("That file has no rows with a store name.", "warning");
        return;
      }
      const res = await list.upload(rows.map(toListInput));
      const skipped = res.duplicates + res.skipped;
      showAlert(
        skipped > 0
          ? `Added ${storesWord(res.added)}. ${skipped.toLocaleString("en-US")} were already on the list or had no name.`
          : `Added ${storesWord(res.added)}.`,
        "success",
      );
    } catch (e) {
      showAlert(`The file was not saved: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`${quiet ? "px-1 py-2" : "spark-card px-4 py-3"} flex items-center justify-between flex-wrap gap-3`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f && canUpload) void onFile(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">Account list</h3>
        <p
          className="text-xs mt-1"
          style={{ color: "var(--spark-text-secondary)" }}
          role="status"
        >
          {statusLine(list)}
        </p>
        {quiet ? null : (
          <p className="text-xs mt-1" style={{ color: "var(--spark-text-meta)" }}>
            Upload a CSV or Excel file with the columns name, address, city,
            state, zip and chain. The list is saved for this brand.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={downloadTemplate} className="spark-btn-ghost">
          Download template
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!canUpload}
          className={quiet ? "spark-btn-ghost" : "spark-btn-primary"}
        >
          {busy ? "Saving" : "Choose file"}
        </button>
      </div>
    </div>
  );
}

export default AccountUploader;
