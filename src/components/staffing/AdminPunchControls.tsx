import { useState } from "react";
import { useMutation } from "react-relay/hooks";
import {
  AdminManualClockInMutation,
  AdminManualClockOutMutation,
  AdminEditPunchMutation,
} from "@/api/mutations/AdminAttendanceMutations";
import type { AdminAttendanceMutationsClockInMutation as ClockInType } from "@api/mutations/__generated__/AdminAttendanceMutationsClockInMutation.graphql";
import type { AdminAttendanceMutationsClockOutMutation as ClockOutType } from "@api/mutations/__generated__/AdminAttendanceMutationsClockOutMutation.graphql";
import type { AdminAttendanceMutationsEditPunchMutation as EditType } from "@api/mutations/__generated__/AdminAttendanceMutationsEditPunchMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

/**
 * Compact ops controls for TIME CLOCK / Attendance — manual clock-in,
 * clock-out of open punches, and edit punch times when a BA's check-in fails.
 */

type Mode = "in" | "out" | "edit_in" | "edit_out" | null;

type Props = {
  eventUuid: string;
  ambassadorUuid: string;
  /** Live-board status when present; omit on Attendance table. */
  status?: string | null;
  clockInAt?: string | null;
  clockOutAt?: string | null;
  clockInAttendanceUuid?: string | null;
  clockOutAttendanceUuid?: string | null;
  onDone?: () => void;
};

const toLocalInput = (iso: string | null | undefined): string => {
  const d = iso ? new Date(iso) : new Date();
  const src = isNaN(d.getTime()) ? new Date() : d;
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${src.getFullYear()}-${pad(src.getMonth() + 1)}-${pad(src.getDate())}T${pad(src.getHours())}:${pad(src.getMinutes())}`;
};

const fromLocalInput = (local: string): string => new Date(local).toISOString();

const btnStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  padding: "3px 8px",
  borderRadius: 6,
  border: "1px solid var(--spark-border)",
  background: "transparent",
  color: "var(--spark-text-secondary)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const AdminPunchControls: React.FC<Props> = ({
  eventUuid,
  ambassadorUuid,
  status,
  clockInAt,
  clockOutAt,
  clockInAttendanceUuid,
  clockOutAttendanceUuid,
  onDone,
}) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [mode, setMode] = useState<Mode>(null);
  const [clockTime, setClockTime] = useState("");
  const [note, setNote] = useState("");

  const [commitIn, inFlight] = useMutation<ClockInType>(AdminManualClockInMutation);
  const [commitOut, outFlight] = useMutation<ClockOutType>(
    AdminManualClockOutMutation,
  );
  const [commitEdit, editFlight] = useMutation<EditType>(AdminEditPunchMutation);
  const busy = inFlight || outFlight || editFlight;

  const open = (m: Mode) => {
    const seed =
      m === "edit_in" ? clockInAt : m === "edit_out" ? clockOutAt : null;
    setClockTime(toLocalInput(seed));
    setNote("");
    setMode(m);
  };

  const close = () => {
    setMode(null);
    setNote("");
  };

  const finish = (ok: boolean, message: string) => {
    showAlert(message || (ok ? "Done." : "Failed."), ok ? "success" : "error");
    if (ok) {
      close();
      onDone?.();
    }
  };

  const submit = () => {
    if (!mode || busy) return;
    const iso = fromLocalInput(clockTime);
    if (!iso || Number.isNaN(Date.parse(iso))) {
      showAlert("Enter a valid date/time.", "error");
      return;
    }

    if (mode === "in") {
      commitIn({
        variables: {
          input: {
            eventUuid,
            ambassadorUuid,
            clockTime: iso,
            note: note.trim() || null,
          },
        },
        onCompleted: (r) =>
          finish(
            !!r.adminManualClockIn?.success,
            r.adminManualClockIn?.message || "",
          ),
        onError: (e) => showAlert(e.message, "error"),
      });
      return;
    }

    if (mode === "out") {
      commitOut({
        variables: {
          input: {
            eventUuid,
            ambassadorUuid,
            clockTime: iso,
            note: note.trim() || null,
          },
        },
        onCompleted: (r) =>
          finish(
            !!r.adminManualClockOut?.success,
            r.adminManualClockOut?.message || "",
          ),
        onError: (e) => showAlert(e.message, "error"),
      });
      return;
    }

    const kind = mode === "edit_in" ? "clock_in" : "clock_out";
    const attendanceUuid =
      mode === "edit_in" ? clockInAttendanceUuid : clockOutAttendanceUuid;
    commitEdit({
      variables: {
        input: {
          clockTime: iso,
          note: note.trim() || null,
          ...(attendanceUuid
            ? { attendanceUuid }
            : { eventUuid, ambassadorUuid, kind }),
        },
      },
      onCompleted: (r) =>
        finish(!!r.adminEditPunch?.success, r.adminEditPunch?.message || ""),
      onError: (e) => showAlert(e.message, "error"),
    });
  };

  // Live board uses status; Attendance table uses punch presence.
  const showClockIn =
    status != null
      ? ["awaiting", "upcoming", "no_show", "missed", "clocked_out"].includes(
          status,
        )
      : !clockInAt;
  const showClockOut =
    status != null ? status === "clocked_in" : !!clockInAt && !clockOutAt;
  const showEditIn = !!clockInAt;
  const showEditOut = !!clockOutAt;

  if (mode) {
    const title =
      mode === "in"
        ? "Clock in"
        : mode === "out"
          ? "Clock out"
          : mode === "edit_in"
            ? "Edit clock-in"
            : "Edit clock-out";
    return (
      <div
        className="flex flex-col gap-1.5 mt-1"
        style={{
          minWidth: 220,
          padding: 8,
          borderRadius: 8,
          border: "1px solid var(--spark-border)",
          background: "rgba(0,0,0,0.35)",
        }}
      >
        <span
          className="mono text-[10px]"
          style={{ letterSpacing: "0.1em", color: "var(--spark-text-meta)" }}
        >
          {title.toUpperCase()}
        </span>
        <input
          type="datetime-local"
          value={clockTime}
          onChange={(e) => setClockTime(e.target.value)}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: "rgba(var(--spark-ink-rgb),0.06)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
          }}
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="text-xs px-2 py-1 rounded"
          style={{
            background: "rgba(var(--spark-ink-rgb),0.06)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
          }}
        />
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            style={{
              ...btnStyle,
              background: "var(--spark-lime)",
              color: "var(--spark-on-accent)",
              border: "none",
              fontWeight: 600,
            }}
          >
            {busy ? "…" : "Save"}
          </button>
          <button type="button" disabled={busy} onClick={close} style={btnStyle}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {showClockIn && (
        <button type="button" style={btnStyle} onClick={() => open("in")}>
          Clock in
        </button>
      )}
      {showClockOut && (
        <button type="button" style={btnStyle} onClick={() => open("out")}>
          Clock out
        </button>
      )}
      {showEditIn && (
        <button type="button" style={btnStyle} onClick={() => open("edit_in")}>
          Edit in
        </button>
      )}
      {showEditOut && (
        <button type="button" style={btnStyle} onClick={() => open("edit_out")}>
          Edit out
        </button>
      )}
    </div>
  );
};

export default AdminPunchControls;
