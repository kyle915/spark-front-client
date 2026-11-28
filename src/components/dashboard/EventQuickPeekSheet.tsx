import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import { MessageSquare, UserPlus } from "lucide-react";
import SparkSheet from "@/shared/SparkSheet";
import { CopyMorphButton } from "@/motion/CopyMorphButton";
import { useAuthStore } from "@/store/authStore";
import { checkinUrl } from "@/utils/publicHosts";
import {
  fetchEventPeekDetail,
  getCachedEventPeekDetail,
  type EventPeekDetail,
} from "./eventPeekClient";
import { punchTime, shiftTime, type BoardShift } from "./todayAttention";

export type { EventPeekDetail };

export const EventQuickPeekSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: BoardShift | null;
  eventUuid: string | null;
  onNudgeBa: (ambassadorUuid: string, name?: string) => void;
  onAssignBa: (detail: EventPeekDetail) => void;
}> = ({
  open,
  onOpenChange,
  shift,
  eventUuid,
  onNudgeBa,
  onAssignBa,
}) => {
  const tenantMeta = useAuthStore((s) => s.tenantMeta);
  const [detail, setDetail] = useState<EventPeekDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const activeUuid = shift?.eventUuid ?? eventUuid ?? "";

  useEffect(() => {
    if (!open || !activeUuid) return;
    let cancelled = false;
    const cached = getCachedEventPeekDetail(activeUuid);
    if (cached) {
      setDetail(cached);
      return;
    }
    setLoading(true);
    fetchEventPeekDetail(activeUuid)
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, activeUuid]);

  if (!activeUuid) return null;

  const title =
    shift?.store ||
    detail?.retailerName ||
    shift?.eventName ||
    detail?.name ||
    "Shift preview";
  const hours = [
    shiftTime(shift?.startTime ?? detail?.startTime),
    shiftTime(shift?.endTime ?? detail?.endTime),
  ]
    .filter(Boolean)
    .join(" – ");
  const standingCheckin = tenantMeta?.checkinCode
    ? checkinUrl(tenantMeta.checkinCode)
    : null;
  const assigned = shift?.assigned ?? [];

  return (
    <SparkSheet
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      eyebrow={
        shift?.brandName
          ? `Ops quick peek · ${shift.brandName}`
          : "Ops quick peek"
      }
      title={title}
    >
      <div className="flex flex-col h-full min-h-[60dvh] justify-between gap-5">
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {assigned.length === 0 ? (
              <span className="chip chip-orange">Unstaffed</span>
            ) : assigned.some(
                (a) => a.status === "no_show" || a.status === "missed",
              ) ? (
              <span className="chip chip-orange">No-show flagged</span>
            ) : assigned.some((a) => a.clockInAt && !a.clockOutAt) ? (
              <span className="chip chip-lime">On the clock</span>
            ) : (
              <span className="chip chip-muted">
                {assigned.length} booked
              </span>
            )}
            {hours ? (
              <span className="chip chip-muted tab-num">{hours}</span>
            ) : null}
          </div>

          <div className="spark-inset-group">
            {detail?.address ? (
              <div className="spark-inset-row justify-between gap-3 text-sm">
                <span style={{ color: "var(--spark-text-meta)" }}>Address</span>
                <span className="text-right font-medium">{detail.address}</span>
              </div>
            ) : null}
            {detail?.onsitePoc || detail?.storeManagerName ? (
              <div className="spark-inset-row justify-between gap-3 text-sm">
                <span style={{ color: "var(--spark-text-meta)" }}>
                  Store contact
                </span>
                <span className="text-right font-medium">
                  {[
                    detail.onsitePoc || detail.storeManagerName,
                    detail.storeManagerPhone,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            ) : null}
            {detail?.requestUuid ? (
              <div className="spark-inset-row justify-between gap-3 text-sm">
                <span style={{ color: "var(--spark-text-meta)" }}>Request</span>
                <Link
                  to={`/request/view/${detail.requestUuid}`}
                  className="font-medium underline underline-offset-2"
                  style={{ color: "var(--spark-text)" }}
                >
                  Open request ↗
                </Link>
              </div>
            ) : null}
          </div>

          <div>
            <p className="spark-inset-label mb-1.5">
              Assigned ambassadors ({assigned.length})
            </p>
            {assigned.length === 0 ? (
              <div
                className="rounded-xl p-3.5 text-xs flex items-center justify-between gap-3"
                style={{
                  border: "1px dashed var(--spark-border)",
                  color: "var(--spark-text-meta)",
                }}
              >
                <span>Nobody is booked on this shift yet.</span>
                {detail ? (
                  <button
                    type="button"
                    onClick={() => onAssignBa(detail)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer"
                    style={{
                      background: "var(--spark-lime)",
                      color: "var(--spark-on-accent)",
                    }}
                  >
                    + Assign BA
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="spark-inset-group">
                {assigned.map((a) => {
                  const inTime = punchTime(a.clockInAt);
                  const outTime = punchTime(a.clockOutAt);
                  const stateLabel =
                    a.clockInAt && !a.clockOutAt
                      ? `Clocked in ${inTime}`
                      : a.clockOutAt
                        ? `${inTime}–${outTime}`
                        : a.status === "no_show" || a.status === "missed"
                          ? "No-show"
                          : "Not clocked in";
                  const flagged =
                    a.status === "no_show" ||
                    a.status === "missed" ||
                    (!a.clockInAt && Boolean(a.registeredAt));
                  return (
                    <div
                      key={a.ambassadorUuid}
                      className="spark-inset-row justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {a.name || "Unnamed ambassador"}
                        </p>
                        <p
                          className="text-xs tab-num"
                          style={{
                            color: flagged
                              ? "var(--spark-orange)"
                              : "var(--spark-text-meta)",
                          }}
                        >
                          {stateLabel}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onNudgeBa(
                            a.ambassadorUuid,
                            a.name || "Ambassador",
                          )
                        }
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition hover:opacity-90 shrink-0"
                        style={{
                          border: "1px solid var(--spark-border)",
                          background: "var(--spark-surface-2)",
                          color: "var(--spark-text)",
                        }}
                      >
                        <MessageSquare size={12} strokeWidth={1.9} />
                        Nudge BA
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {detail?.notes ? (
            <div
              className="rounded-xl p-3.5 text-xs space-y-1"
              style={{
                background: "var(--spark-surface-2)",
                border: "1px solid var(--spark-border)",
              }}
            >
              <p
                className="font-semibold uppercase tracking-wider text-[10px]"
                style={{ color: "var(--spark-text-meta)" }}
              >
                Shift notes
              </p>
              <p className="leading-relaxed whitespace-pre-wrap">
                {detail.notes}
              </p>
            </div>
          ) : loading ? (
            <p className="text-xs" style={{ color: "var(--spark-text-meta)" }}>
              Loading venue details…
            </p>
          ) : null}
        </div>

        <div
          className="pt-3 flex flex-wrap items-center gap-2"
          style={{
            borderTop: "1px solid var(--spark-hairline, var(--spark-border))",
          }}
        >
          {detail ? (
            <button
              type="button"
              onClick={() => onAssignBa(detail)}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition hover:opacity-90"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
              }}
            >
              <UserPlus size={13.5} strokeWidth={2} />
              Assign BA
            </button>
          ) : null}
          {standingCheckin ? (
            <CopyMorphButton
              text={standingCheckin}
              label="Copy check-in link"
              copiedLabel="Copied"
              className="px-3 py-2 rounded-lg text-xs font-semibold"
              style={{
                border: "1px solid var(--spark-border)",
                background: "transparent",
                color: "var(--spark-text)",
              }}
            />
          ) : null}
          <Link
            to={`/event/view/${activeUuid}`}
            onClick={() => onOpenChange(false)}
            className="ml-auto px-3.5 py-2 rounded-lg text-xs font-semibold no-underline"
            style={{
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              background: "rgba(var(--spark-ink-rgb),0.04)",
            }}
          >
            Open full event ↗
          </Link>
        </div>
      </div>
    </SparkSheet>
  );
};

export default EventQuickPeekSheet;
