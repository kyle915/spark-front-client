import { useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import {
  loadUploadedAccounts,
  saveUploadedAccounts,
  parseRowsToAccounts,
  type UploadedAccount,
} from "@/lib/accounts";

/**
 * Drop-zone uploader for an account list. Accepts CSV or XLSX, parses,
 * deduplicates against existing uploads (by name + address), persists
 * to localStorage, and calls onImported with the merged list.
 */
export const AccountUploader: React.FC<{
  onImported: (accounts: UploadedAccount[]) => void;
}> = ({ onImported }) => {
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const merge = (parsed: UploadedAccount[]) => {
    if (!tenantId) return;
    const existing = loadUploadedAccounts(tenantId);
    const key = (a: UploadedAccount) =>
      `${a.name.toLowerCase()}|${a.address.toLowerCase()}`;
    const seen = new Map(existing.map((a) => [key(a), a]));
    let added = 0;
    for (const a of parsed) {
      if (!seen.has(key(a))) {
        seen.set(key(a), a);
        added += 1;
      }
    }
    const merged = Array.from(seen.values());
    saveUploadedAccounts(tenantId, merged);
    onImported(merged);
    showAlert(
      `Imported ${added} new accounts (${parsed.length} parsed, ${parsed.length - added} duplicates).`,
      "success",
    );
  };

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        Papa.parse<Record<string, string>>(file, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => {
            const headers = res.meta.fields ?? [];
            const accounts = parseRowsToAccounts(res.data, headers);
            merge(accounts);
            setBusy(false);
          },
          error: (e) => {
            showAlert(`Parse failed: ${e.message}`, "error");
            setBusy(false);
          },
        });
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(
          sheet,
          { defval: "" },
        );
        const headers = Object.keys(rows[0] ?? {});
        const accounts = parseRowsToAccounts(rows, headers);
        merge(accounts);
        setBusy(false);
      }
    } catch (e) {
      showAlert(`Couldn't parse file: ${(e as Error).message}`, "error");
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-5 transition"
      style={{
        background:
          "linear-gradient(180deg, rgba(197,245,70,0.06), transparent)",
        border: "1px dashed rgba(197,245,70,0.35)",
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "var(--spark-lime)",
            }}
          >
            ⤴ UPLOAD ACCOUNT LIST
          </p>
          <p
            className="text-sm mt-1"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            Drag a CSV or XLSX, or click to browse. Columns auto-detected:
            <span
              className="mono text-[11px] ml-1"
              style={{ color: "var(--spark-lime)" }}
            >
              Name · Address · City · State · Zip · Chain
            </span>
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            boxShadow: "0 0 18px rgba(197,245,70,0.35)",
            opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? "Parsing…" : "Choose file"}
        </button>
      </div>
    </div>
  );
};

export default AccountUploader;
