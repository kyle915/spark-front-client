import { useEffect, useState } from "react";
import SparkOverlay from "@/shared/SparkOverlay";
import TimeSlotSelect from "@/components/inputs/TimeSlotSelect";
import { useAlertStore } from "@/store/alertStore";
import { pickHourMinute, pickYmd } from "@/utils/venueTimezone";

/**
 * Change date — lets a brand user move one of their events to a new day
 * and new start / end times. Only the date and times change; staffing,
 * address and products stay as they are.
 *
 * Posts `rescheduleEvent`, which moves the event and its request together,
 * refuses cancelled / clocked-in / recapped events and past dates, and
 * emails Ignite so they can confirm the booked team can make the new time.
 * Times are wall clock at the venue (the backend reads them in the
 * venue's own timezone), so we prefill from the naive venue-local strings
 * the API returns and never route them through `new Date()`.
 */

const RESCHEDULE = `
  mutation RescheduleEvent($input: RescheduleEventInput!) {
    rescheduleEvent(input: $input) {
      success
      message
    }
  }
`;

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
    throw new Error(json.errors[0]?.message || "Request failed");
  }
  return json.data as T;
}

function todayYmd(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

export type ChangeEventDateDialogProps = {
  open: boolean;
  onClose: () => void;
  eventUuid: string;
  /** Venue-local naive ISO strings as the API returns them. */
  startTime?: string | null;
  endTime?: string | null;
  date?: string | null;
  storeName?: string | null;
  timezoneLabel?: string | null;
  onChanged?: () => void;
};

const fieldStyle = {
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  color: "var(--spark-text)",
};

export default function ChangeEventDateDialog({
  open,
  onClose,
  eventUuid,
  startTime,
  endTime,
  date,
  storeName,
  timezoneLabel,
  onChanged,
}: ChangeEventDateDialogProps) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [day, setDay] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDay(pickYmd(startTime ?? date ?? null));
    setStart(startTime ? pickHourMinute(startTime) : "");
    setEnd(endTime ? pickHourMinute(endTime) : "");
    setBusy(false);
    setError(null);
  }, [open, startTime, endTime, date]);

  const submit = async () => {
    if (!day || !start || !end) {
      setError("Pick a date, a start time and an end time.");
      return;
    }
    if (end <= start) {
      setError("The end time has to be after the start time.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await postGql<{
        rescheduleEvent: { success: boolean; message: string };
      }>(RESCHEDULE, {
        input: { eventId: eventUuid, date: day, startTime: start, endTime: end },
      });
      const result = data.rescheduleEvent;
      if (!result?.success) {
        setError(result?.message || "Could not change the date.");
        return;
      }
      showAlert(result.message || "Date changed.", "success");
      onChanged?.();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not change the date.",
      );
    } finally {
      setBusy(false);
    }
  };

  const labelStyle = { color: "var(--spark-text-meta)" };

  return (
    <SparkOverlay
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      size="md"
      label="Change date"
    >
      <p className="spark-overlay-kicker" style={labelStyle}>
        Change date
      </p>
      <h2 className="spark-overlay-title">
        {storeName ? `Move ${storeName}` : "Move this event"}
      </h2>
      <p className="spark-overlay-copy">
        Pick the new day and times
        {timezoneLabel ? ` (${timezoneLabel}, the store's local time)` : " at the store"}.
        Ignite gets an email right away and will confirm the team can make
        the new time.
      </p>
      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        <label className="block">
          <span className="block text-xs font-semibold mb-1" style={labelStyle}>
            Date
          </span>
          <input
            type="date"
            value={day}
            min={todayYmd()}
            onChange={(e) => {
              setDay(e.target.value);
              setError(null);
            }}
            className="w-full rounded-lg px-3 py-2 text-sm spark-input"
            style={fieldStyle}
            autoFocus
          />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold mb-1" style={labelStyle}>
            Start time
          </span>
          <TimeSlotSelect
            value={start}
            onChange={(v) => {
              setStart(v);
              setError(null);
            }}
            placeholder="Pick a time"
            aria-label="Start time"
            className="w-full rounded-lg px-3 py-2 text-sm spark-input"
            style={fieldStyle}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold mb-1" style={labelStyle}>
            End time
          </span>
          <TimeSlotSelect
            value={end}
            onChange={(v) => {
              setEnd(v);
              setError(null);
            }}
            placeholder="Pick a time"
            aria-label="End time"
            className="w-full rounded-lg px-3 py-2 text-sm spark-input"
            style={fieldStyle}
          />
        </label>
      </div>
      {error ? (
        <p className="mt-3 text-sm" style={{ color: "var(--spark-orange)" }}>
          {error}
        </p>
      ) : null}
      <div className="spark-overlay-actions">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="spark-overlay-action spark-overlay-action-primary"
        >
          {busy ? "Saving…" : "Save new date"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="spark-overlay-action spark-overlay-action-cancel"
        >
          Close
        </button>
      </div>
    </SparkOverlay>
  );
}
