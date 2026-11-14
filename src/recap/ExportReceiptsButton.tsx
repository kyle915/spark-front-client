import { useState } from "react";
import { ReceiptPercentIcon } from "@heroicons/react/24/outline";
import { useMutation } from "react-relay/hooks";
import { ExportExpenseReceiptsMutation } from "@/api/mutations/ExportExpenseReceiptsMutation";
import type { ExportExpenseReceiptsMutation as ExportExpenseReceiptsMutationType } from "@api/mutations/__generated__/ExportExpenseReceiptsMutation.graphql";
import useSparkRole from "@/hooks/useSparkRole";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";

/**
 * Month-end expense receipts export — drop-in button + modal, mirroring
 * ImportConnecteamButton's pattern (admin-gated, self-contained).
 *
 * Pick a date range (defaults to the last full calendar month), hit
 * Export, and two artifacts come back in one round trip:
 *   - the bookkeeping CSV (BA · event · date · amount · corpo card ·
 *     receipt links, with a TOTAL row) — saved immediately as a file
 *   - a PDF bundle of every receipt image, captioned, hosted on GCS —
 *     opened in a new tab
 *
 * Server collects BOTH recap families (custom receipt-category files /
 * "Account Spend Amount"-style fields + legacy accountSpendAmount).
 */

const pad = (n: number) => String(n).padStart(2, "0");
const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Last full calendar month — the month-end bookkeeping default.
const lastFullMonth = (): { start: string; end: string } => {
  const now = new Date();
  const endOfPrev = new Date(now.getFullYear(), now.getMonth(), 0);
  const startOfPrev = new Date(
    endOfPrev.getFullYear(),
    endOfPrev.getMonth(),
    1,
  );
  return { start: isoLocal(startOfPrev), end: isoLocal(endOfPrev) };
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgba(var(--spark-ink-rgb),0.04)",
  border: "1px solid rgba(var(--spark-ink-rgb),0.12)",
  color: "var(--spark-text)",
  colorScheme: "dark",
};

type Props = {
  variant?: "primary" | "ghost";
};

export const ExportReceiptsButton: React.FC<Props> = ({
  variant = "ghost",
}) => {
  const { isAdmin } = useSparkRole();
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);

  const defaults = lastFullMonth();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);

  const [commit, isExporting] =
    useMutation<ExportExpenseReceiptsMutationType>(
      ExportExpenseReceiptsMutation,
    );

  if (!isAdmin) return null;

  const onExport = () => {
    if (!start || !end) {
      showAlert("Pick a start and end date.", "warning");
      return;
    }
    if (isExporting) return;
    commit({
      variables: {
        input: { startDate: start, endDate: end, tenantId: tenantId ?? null },
      },
      onCompleted: (res) => {
        const r = res.exportExpenseReceipts;
        if (!r?.success) {
          showAlert(r?.message ?? "Export failed.", "error");
          return;
        }
        if (r.csvText) {
          const blob = new Blob([r.csvText], {
            type: "text/csv;charset=utf-8",
          });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `expense-receipts_${start}_${end}.csv`;
          a.click();
          URL.revokeObjectURL(a.href);
        }
        if (r.pdfUrl) {
          window.open(r.pdfUrl, "_blank", "noopener");
        }
        showAlert(r.message, "success");
        setOpen(false);
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  const buttonStyle: React.CSSProperties =
    variant === "primary"
      ? {
          background: "var(--spark-lime, #f2f3ee)",
          color: "var(--spark-on-accent)",
        }
      : {
          background: "rgba(var(--spark-ink-rgb),0.04)",
          border: "1px solid rgba(var(--spark-ink-rgb),0.14)",
          color: "var(--spark-text)",
        };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-xl text-sm font-semibold transition inline-flex items-center gap-1.5"
        style={buttonStyle}
      >
        <ReceiptPercentIcon className="w-4 h-4" />
        Receipts export
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[16vh]"
          style={{
            background: "rgba(10,11,13,0.7)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md spark-card"
            style={{ borderRadius: 20 }}
          >
            <div
              className="p-4 border-b"
              style={{ borderColor: "var(--spark-border, #1f2418)" }}
            >
              <h2 className="text-lg font-semibold">
                Month-end receipts export
              </h2>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--spark-text-secondary)" }}
              >
                Bookkeeping CSV (every BA spend with links + total) and a
                PDF bundle of the receipt photos, captioned per shift.
              </p>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label-mini block mb-1.5">From</label>
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="label-mini block mb-1.5">To</label>
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full"
                    style={inputStyle}
                  />
                </div>
              </div>
              <p
                className="text-xs"
                style={{ color: "var(--spark-text-meta)" }}
              >
                Defaults to the last full month. Scoped to the active
                tenant; dates follow the event's date.
              </p>
            </div>
            <div
              className="p-4 border-t flex items-center justify-end gap-2"
              style={{ borderColor: "var(--spark-border, #1f2418)" }}
            >
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-sm"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(var(--spark-ink-rgb),0.18)",
                  color: "var(--spark-text-secondary)",
                }}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isExporting}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{
                  background: "var(--spark-lime, #f2f3ee)",
                  color: "var(--spark-on-accent)",
                }}
                onClick={onExport}
              >
                {isExporting ? "Exporting…" : "Export CSV + PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ExportReceiptsButton;
