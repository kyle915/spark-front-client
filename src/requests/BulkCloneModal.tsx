import { useMemo, useState } from "react";
import { useMutation } from "react-relay/hooks";
import { BulkCloneRequestMutation } from "@/api/mutations/BulkCloneRequestMutation";
import type { BulkCloneRequestMutation as BulkCloneRequestMutationType } from "@api/mutations/__generated__/BulkCloneRequestMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

/**
 * Compose-style modal for the "⎘ Clone ×N" action on Master Tracker.
 *
 * Scope this UI: dates-only MVP. Multi-venue (per-copy retailer override)
 * is supported by the backend mutation but adds picker complexity the
 * UI side; ships in a follow-up. For now: enter N dates, one per line,
 * each clone reuses the source's venue.
 *
 * Layout choices:
 *   - Textarea for dates so kyle can paste from a spreadsheet column
 *     without rewrapping
 *   - Live preview chip: "Cloning to 4 dates · same venue, BAs, RMM"
 *   - 50-copy soft cap matches the backend ceiling
 */

type Props = {
  sourceRequestId: string;
  sourceLabel: string;
  onClose: () => void;
  onCloned: (uuids: string[]) => void;
};

// Parse a free-form date blob into ISO strings. Accepts:
//   - YYYY-MM-DD
//   - MM/DD/YYYY (US format kyle's clients use)
//   - Comma, newline, semicolon, tab separators
const DATE_RES = [
  // YYYY-MM-DD
  /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
  // MM/DD/YYYY
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
];

const parseDates = (raw: string): { ok: string[]; bad: string[] } => {
  const tokens = raw
    .split(/[,;\n\r\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const ok: string[] = [];
  const bad: string[] = [];
  for (const t of tokens) {
    let iso: string | null = null;
    const ymd = DATE_RES[0].exec(t);
    if (ymd) {
      const [, y, m, d] = ymd;
      iso = `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    } else {
      const mdy = DATE_RES[1].exec(t);
      if (mdy) {
        const [, m, d, y] = mdy;
        iso = `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
    }
    // Sanity check the parsed date round-trips through the JS Date
    // parser. Catches things like "2026-13-45" that match the regex
    // but aren't real dates.
    if (iso) {
      const t = new Date(iso + "T00:00:00Z");
      if (!isNaN(t.getTime()) && t.toISOString().slice(0, 10) === iso) {
        ok.push(iso);
        continue;
      }
    }
    bad.push(t);
  }
  return { ok, bad };
};

const MAX_COPIES = 50;

export default function BulkCloneModal({
  sourceRequestId,
  sourceLabel,
  onClose,
  onCloned,
}: Props) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [datesText, setDatesText] = useState("");
  const [commitClone, isCloning] =
    useMutation<BulkCloneRequestMutationType>(BulkCloneRequestMutation);

  const { ok, bad } = useMemo(() => parseDates(datesText), [datesText]);
  const overCap = ok.length > MAX_COPIES;
  const ready = ok.length > 0 && bad.length === 0 && !overCap && !isCloning;

  const clone = () => {
    if (!ready) return;
    commitClone({
      variables: {
        input: {
          sourceRequestId,
          copies: ok.map((dateIso) => ({ dateIso })),
        },
      },
      onCompleted: (res) => {
        const r = res.bulkCloneRequest;
        if (r?.success) {
          showAlert(r.message || `Cloned ${r.createdCount} requests.`, "success");
          onCloned([...r.createdUuids]);
          onClose();
        } else {
          showAlert(r?.message ?? "Clone failed.", "error");
        }
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
        className="w-full max-w-lg spark-card overflow-hidden"
        style={{
          borderRadius: 20,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div className="p-5" style={{ borderBottom: "1px solid var(--spark-border)" }}>
          <p
            className="mono text-[10px] mb-1"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            CLONE REQUEST
          </p>
          <h2 className="display text-xl font-bold">Clone to new dates</h2>
          <p
            className="text-xs mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Source:{" "}
            <span style={{ color: "var(--spark-text)" }}>{sourceLabel}</span>
          </p>
        </div>

        <div className="overflow-y-auto" style={{ flex: 1 }}>
          <div className="p-5 space-y-4">
            <div>
              <label
                className="mono text-[10px] block mb-1.5"
                style={{
                  letterSpacing: "0.16em",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                DATES *
              </label>
              <textarea
                value={datesText}
                onChange={(e) => setDatesText(e.target.value)}
                placeholder={"2026-06-10\n2026-06-17\n06/24/2026"}
                rows={6}
                autoFocus
                className="w-full rounded-xl text-sm font-mono"
                style={{
                  padding: "0.6rem 0.85rem",
                  background: "var(--spark-bg)",
                  border: "1px solid var(--spark-border)",
                  color: "var(--spark-text)",
                  outline: "none",
                  resize: "vertical",
                }}
              />
              <div
                className="mono text-[10px] mt-1 flex items-center gap-2 flex-wrap"
                style={{
                  letterSpacing: "0.14em",
                }}
              >
                {ok.length > 0 ? (
                  <span style={{ color: "var(--spark-lime)" }}>
                    {ok.length} VALID
                  </span>
                ) : (
                  <span style={{ color: "rgba(255,255,255,0.40)" }}>
                    ONE PER LINE · YYYY-MM-DD OR MM/DD/YYYY
                  </span>
                )}
                {bad.length > 0 && (
                  <span style={{ color: "var(--spark-orange)" }}>
                    · {bad.length} INVALID: {bad.slice(0, 3).join(", ")}
                    {bad.length > 3 ? "…" : ""}
                  </span>
                )}
                {overCap && (
                  <span style={{ color: "var(--spark-orange)" }}>
                    · MAX {MAX_COPIES} PER CLONE
                  </span>
                )}
              </div>
            </div>

            <div
              className="rounded-xl px-3 py-2 text-xs"
              style={{
                background: "rgba(242,243,238,0.06)",
                border: "1px solid rgba(242,243,238,0.20)",
                color: "rgba(255,255,255,0.65)",
              }}
            >
              Each clone keeps the source's venue, activation type,
              distributor, BA count, notes, and RMM routing. You can
              edit any clone after creation. Clones do not inherit the
              source's Activation Plan — add them via Tracker
              multi-select after creation.
            </div>
          </div>
        </div>

        <div
          className="p-4 flex items-center justify-between gap-3"
          style={{ borderTop: "1px solid var(--spark-border)" }}
        >
          <span
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color:
                ok.length > 0
                  ? "var(--spark-lime)"
                  : "rgba(255,255,255,0.40)",
            }}
          >
            {ok.length === 0
              ? "ADD AT LEAST ONE DATE"
              : `WILL CREATE ${ok.length} REQUEST${ok.length === 1 ? "" : "S"}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCloning}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{
                background: "transparent",
                color: "var(--spark-text)",
                border: "1px solid var(--spark-border)",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={clone}
              disabled={!ready}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                boxShadow: ready ? "0 0 16px rgba(242,243,238,0.4)" : "none",
              }}
            >
              {isCloning
                ? `Cloning ${ok.length}…`
                : ok.length > 0
                  ? `Clone ×${ok.length}`
                  : "Clone"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
