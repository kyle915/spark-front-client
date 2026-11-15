import { useCallback, useEffect, useState } from "react";
import { fetchQuery, useMutation, useRelayEnvironment } from "react-relay/hooks";
import SparkEmptyState from "@/shared/SparkEmptyState";
import { useAlertStore } from "@/store/alertStore";
import { isWalkupPlaceholderEmail, walkupPhoneFromEmail } from "@/utils/clientSafeBaName";
import { DismissedMissingRecapsQuery } from "@/api/queries/DismissedMissingRecapsQuery";
import type {
  DismissedMissingRecapsQuery as DismissedQueryType,
  DismissedMissingRecapsQuery$data,
} from "@api/queries/__generated__/DismissedMissingRecapsQuery.graphql";
import { RestoreMissingRecapsMutation } from "@/api/mutations/RestoreMissingRecapsMutation";
import type { RestoreMissingRecapsMutation as RestoreMutationType } from "@api/mutations/__generated__/RestoreMissingRecapsMutation.graphql";
import { dismissedByLine } from "./missingRecapDismiss";

type Row = DismissedMissingRecapsQuery$data["dismissedMissingRecaps"][number];

const fmtDate = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/**
 * The "Dismissed" tab on /recaps/missing: rows staff said owe no recap,
 * with who dismissed them, when and why, and a Restore button that puts a
 * row back on the list (and back into every count and reminder).
 *
 * Fetched on demand rather than suspended, so a refusal (the list is for
 * Ignite staff) shows as a plain line instead of an error screen.
 */
export default function DismissedRecapsList({
  tenantId,
  lookbackDays,
  onRestored,
}: {
  tenantId: string | null;
  lookbackDays: number;
  /** A row went back on Missing Recaps: refresh the list and the badge. */
  onRestored: () => void;
}) {
  const environment = useRelayEnvironment();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [rows, setRows] = useState<ReadonlyArray<Row> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [commitRestore] = useMutation<RestoreMutationType>(
    RestoreMissingRecapsMutation,
  );

  const load = useCallback(() => {
    let live = true;
    fetchQuery<DismissedQueryType>(
      environment,
      DismissedMissingRecapsQuery,
      { tenantId, lookbackDays },
      { fetchPolicy: "network-only" },
    )
      .toPromise()
      .then((data) => {
        if (!live) return;
        setRows(data?.dismissedMissingRecaps ?? []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!live) return;
        const text = err instanceof Error ? err.message : "";
        setError(
          /staff/i.test(text)
            ? "Only Ignite staff can see dismissed recaps."
            : "Dismissed recaps could not be loaded. Try again.",
        );
      });
    return () => {
      live = false;
    };
  }, [environment, tenantId, lookbackDays]);

  useEffect(() => load(), [load]);

  const restore = (row: Row) => {
    if (restoringId) return;
    setRestoringId(row.dismissalUuid);
    commitRestore({
      variables: { input: { dismissalUuids: [row.dismissalUuid] } },
      onCompleted: (res) => {
        setRestoringId(null);
        const out = res.restoreMissingRecaps;
        if (out?.success) {
          setRows((prev) =>
            (prev ?? []).filter((r) => r.dismissalUuid !== row.dismissalUuid),
          );
          showAlert(
            row.recapFiled
              ? "Restored."
              : "Restored. It is back on Missing recaps.",
            "success",
          );
          onRestored();
        } else {
          showAlert(out?.message ?? "Could not restore that row.", "warning");
        }
      },
      onError: (err) => {
        setRestoringId(null);
        showAlert(err.message || "Could not restore that row.", "error");
      },
    });
  };

  if (error) {
    return (
      <div
        className="spark-card p-6 text-sm"
        style={{ color: "var(--spark-text-secondary)" }}
        role="alert"
      >
        {error}
      </div>
    );
  }
  if (rows === null) {
    return (
      <div
        className="spark-card p-8 text-center text-sm"
        style={{ color: "var(--spark-text-meta)" }}
      >
        Loading dismissed recaps…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <SparkEmptyState
        title="Nothing dismissed"
        body={`No missing recap from the last ${lookbackDays} days has been dismissed.`}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
        {rows.length.toLocaleString()} dismissed. These are left out of the
        list, the counts and the reminders. Hours and pay are not affected.
      </p>
      {rows.map((row) => {
        const who = row.ambassadorName ?? "Whole shift (nobody assigned)";
        const contact = row.ambassadorEmail
          ? isWalkupPlaceholderEmail(row.ambassadorEmail)
            ? `Walk-up · ${walkupPhoneFromEmail(row.ambassadorEmail) || "no phone on file"}`
            : row.ambassadorEmail
          : null;
        const when = fmtDate(row.date ?? row.endTime ?? null);
        return (
          <div key={row.dismissalUuid} className="spark-card p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1" style={{ minWidth: "12rem" }}>
                <p className="font-bold truncate" title={row.eventName}>
                  {row.eventName}
                </p>
                <p
                  className="text-xs mt-0.5 truncate"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  {[when, row.stateCode, row.address].filter(Boolean).join(" · ")}
                </p>
                <p className="text-sm mt-2">
                  {who}
                  {contact ? (
                    <span
                      className="text-xs ml-2"
                      style={{ color: "var(--spark-text-meta)" }}
                    >
                      {contact}
                    </span>
                  ) : null}
                </p>
                <p className="text-sm mt-1">
                  {row.reasonLabel}
                  {row.note ? (
                    <span style={{ color: "var(--spark-text-secondary)" }}>
                      {" "}
                      — {row.note}
                    </span>
                  ) : null}
                </p>
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--spark-text-meta)" }}
                >
                  Dismissed by {dismissedByLine(row.dismissedByName, row.dismissedAt)}
                  {row.recapFiled
                    ? ". A recap has since been filed for this shift."
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => restore(row)}
                disabled={restoringId !== null}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 shrink-0"
                style={{
                  background: "transparent",
                  color: "var(--spark-text)",
                  border: "1px solid var(--spark-border)",
                }}
                title="Put this row back on Missing recaps"
              >
                {restoringId === row.dismissalUuid ? "Restoring…" : "Restore"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
