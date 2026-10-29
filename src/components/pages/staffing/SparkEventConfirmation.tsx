import { Suspense, useMemo, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { EventConfirmationFormQuery } from "@/api/queries/EventConfirmationFormQuery";
import type { EventConfirmationFormQuery as EventConfirmationFormQueryType } from "@api/queries/__generated__/EventConfirmationFormQuery.graphql";
import { SendEventConfirmationMutation } from "@/api/mutations/SendEventConfirmationMutation";
import type { SendEventConfirmationMutation as SendEventConfirmationMutationType } from "@api/mutations/__generated__/SendEventConfirmationMutation.graphql";
import { CancelEventConfirmationRemindersMutation } from "@/api/mutations/CancelEventConfirmationRemindersMutation";
import type { CancelEventConfirmationRemindersMutation as CancelType } from "@api/mutations/__generated__/CancelEventConfirmationRemindersMutation.graphql";
import { useAuthStore } from "@/store/authStore";

/**
 * "Send Event Confirmation" — emails a BA their event details from
 * staffing@igniteproductions.co, and (opt-in, default on) re-sends the same
 * email 24 hours and 3 hours before the shift.
 *
 * Sending saves a confirmation record and NOTHING else — no Event, no roster
 * booking. That's deliberate: creating a booking would fire the "New shift
 * offered" push, sync Google Calendar and move dashboard KPIs, which is three
 * loud side effects for a tab whose job is to send one email. The reminders
 * key off the saved row's own start instant instead.
 *
 * The shift picker at the top is a convenience for the case where the shift
 * DOES already exist in Spark; it prefills every field (including the SKUs
 * recorded on the request) and everything stays editable. Empty is normal.
 */

type Data = EventConfirmationFormQueryType["response"];
type Shift = Data["upcomingShiftsForConfirmation"][number];
type Confirmation = Data["eventConfirmations"][number];

const panel: React.CSSProperties = {
  background: "var(--spark-panel, rgba(255,255,255,0.03))",
  border: "1px solid var(--spark-border)",
  borderRadius: 16,
};

const labelMini: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.45)",
};

const field: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--spark-border)",
  borderRadius: 10,
  padding: "9px 11px",
  fontSize: 14,
  color: "var(--spark-text)",
  width: "100%",
};

const STAGE_LABEL: Record<string, string> = {
  booked: "Booked",
  t24: "24h before",
  t3: "3h before",
};

/** "Sparkling Water — Squeezed-to-Death" → ["Sparkling Water", "Squeezed-to-Death"] */
const splitOption = (raw: string): [string, string] => {
  const i = raw.indexOf(" — ");
  return i === -1 ? ["Other", raw] : [raw.slice(0, i), raw.slice(i + 3)];
};

/**
 * An ISO instant → the `<input type="date">` / `<input type="time">` pair,
 * rendered in the VENUE's timezone rather than the browser's.
 *
 * This has to be explicit. The date and time boxes are submitted as local
 * wall-clock alongside a timezone field, so formatting a 1pm Chicago shift
 * with the browser's clock would prefill "11:00" for an admin sitting in
 * Pacific and then send it back labelled America/Chicago — a two-hour error,
 * silent, and only in the direction of whoever happens to be staffing.
 */
const isoToParts = (
  iso: string | null | undefined,
  timeZone?: string | null,
): [string, string] => {
  if (!iso) return ["", ""];
  const d = new Date(iso);
  if (isNaN(d.getTime())) return ["", ""];
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const [y, mo, da, h, mi] = [
      get("year"),
      get("month"),
      get("day"),
      get("hour"),
      get("minute"),
    ];
    if (y && mo && da && h && mi) {
      // Intl renders midnight as "24" in some engines under hour12:false.
      return [`${y}-${mo}-${da}`, `${h === "24" ? "00" : h}:${mi}`];
    }
  } catch {
    /* unknown IANA name — fall through to the browser's clock */
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  ];
};

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  hint?: string;
}> = ({ label, children, hint }) => (
  <label className="block">
    <span style={labelMini}>{label}</span>
    <div className="mt-1.5">{children}</div>
    {hint ? (
      <span
        className="block mt-1 text-[11px]"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        {hint}
      </span>
    ) : null}
  </label>
);

/** Grouped, searchable SKU checklist. 31 options is too many for a raw list. */
const ProductPicker: React.FC<{
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
}> = ({ options, selected, onChange }) => {
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = new Map<string, string[]>();
    for (const opt of options) {
      if (q && !opt.toLowerCase().includes(q)) continue;
      const [category] = splitOption(opt);
      const list = out.get(category) ?? [];
      list.push(opt);
      out.set(category, list);
    }
    return [...out.entries()];
  }, [options, search]);

  const toggle = (opt: string) =>
    onChange(
      selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt],
    );

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <span style={labelMini}>Products to sample</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px]" style={{ color: "var(--spark-lime)" }}>
            {selected.length} selected
          </span>
          {selected.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] underline"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              clear
            </button>
          ) : null}
        </div>
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter SKUs…"
        style={{ ...field, marginBottom: 8 }}
      />
      <div
        className="overflow-y-auto"
        style={{
          maxHeight: 260,
          border: "1px solid var(--spark-border)",
          borderRadius: 10,
          padding: 10,
        }}
      >
        {groups.length === 0 ? (
          <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.4)" }}>
            Nothing matches “{search}”.
          </p>
        ) : (
          groups.map(([category, opts]) => (
            <div key={category} className="mb-3 last:mb-0">
              <p style={{ ...labelMini, marginBottom: 4 }}>{category}</p>
              <div className="grid gap-1" style={{ gridTemplateColumns: "1fr" }}>
                {opts.map((opt) => {
                  const [, name] = splitOption(opt);
                  const on = selected.includes(opt);
                  return (
                    <label
                      key={opt}
                      className="flex items-center gap-2 cursor-pointer text-[13px] py-0.5"
                      style={{ color: on ? "var(--spark-text)" : "rgba(255,255,255,0.65)" }}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(opt)}
                        style={{ accentColor: "var(--spark-lime)" }}
                      />
                      {name}
                    </label>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const ConfirmationStatusChip: React.FC<{
  status: "Sent" | "Queued" | "Error";
}> = ({ status }) => {
  const tone =
    status === "Sent"
      ? {
          background: "rgba(242,243,238,0.14)",
          border: "1px solid rgba(242,243,238,0.4)",
          color: "var(--spark-lime)",
        }
      : status === "Error"
        ? {
            background: "rgba(239,90,42,0.12)",
            border: "1px solid rgba(239,90,42,0.4)",
            color: "var(--spark-orange)",
          }
        : {
            background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--spark-border)",
            color: "rgba(255,255,255,0.7)",
          };
  return (
    <span
      className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
      style={tone}
    >
      {status}
    </span>
  );
};

const StageBadge: React.FC<{ stage: string; sentAt: string | null }> = ({
  stage,
  sentAt,
}) => (
  <span
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px]"
    style={{
      background: sentAt ? "rgba(190,242,100,0.12)" : "rgba(255,255,255,0.05)",
      border: `1px solid ${sentAt ? "rgba(190,242,100,0.4)" : "var(--spark-border)"}`,
      color: sentAt ? "var(--spark-lime)" : "rgba(255,255,255,0.5)",
    }}
  >
    {STAGE_LABEL[stage] ?? stage} {sentAt ? "✓" : "·"}
  </span>
);

const confirmationChip = (
  sends: ReadonlyArray<{
    stage: string;
    sentAt?: string | null;
    lastError?: string | null;
  }>,
): "Sent" | "Queued" | "Error" => {
  if (sends.some((send) => (send.lastError || "").trim())) return "Error";
  const booked = sends.find((send) => send.stage === "booked");
  if (booked?.sentAt) return "Sent";
  return "Queued";
};

const HistoryRow: React.FC<{
  row: Confirmation;
  onCancel: (uuid: string) => void;
  busy: boolean;
}> = ({ row, onCancel, busy }) => {
  const cancelled = !!row.cancelledAt;
  const sentStages = new Set(
    row.sends.filter((s) => s.sentAt).map((s) => s.stage),
  );
  const failed = row.sends.filter((s) => !s.sentAt && s.attempts > 0);
  const fromSheet = (row.source || "").trim().toLowerCase() === "sheet";
  const stampRaw = (row.sheetStampStatus || "").trim();
  const stampIsError = stampRaw.toLowerCase().includes("error");
  let stampWhen = "";
  if (row.sheetStampedAt) {
    try {
      stampWhen = new Date(row.sheetStampedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      stampWhen = row.sheetStampedAt;
    }
  }
  const stampBit = stampRaw
    ? `stamp ${stampRaw}${stampWhen ? ` · ${stampWhen}` : ""}`
    : null;
  const sheetBits = [
    fromSheet ? "Sheet" : "Admin tab",
    row.sheetRow != null ? `row ${row.sheetRow}` : null,
    stampBit,
    row.brandSlugs?.length ? row.brandSlugs.join(", ") : null,
  ].filter(Boolean);

  return (
    <div
      className="py-3"
      style={{ borderTop: "1px solid var(--spark-border)" }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold">
            {row.baName}{" "}
            <span
              className="font-normal"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              {row.baEmail}
            </span>
          </p>
          <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.55)" }}>
            {[row.storeName, row.dateLabel, row.timeLabel]
              .filter(Boolean)
              .join(" | ")}
          </p>
          {sheetBits.length > 0 ? (
            <p
              className="text-[11px] mt-0.5"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {sheetBits.join(" · ")}
            </p>
          ) : null}
          {row.products.length > 0 ? (
            <p
              className="text-[11px] mt-0.5"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {row.products.length} SKU{row.products.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <ConfirmationStatusChip status={confirmationChip(row.sends)} />
          {stampRaw ? (
            <span
              className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
              style={
                stampIsError
                  ? {
                      background: "rgba(239,90,42,0.12)",
                      border: "1px solid rgba(239,90,42,0.4)",
                      color: "var(--spark-orange)",
                    }
                  : {
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid var(--spark-border)",
                      color: "rgba(255,255,255,0.75)",
                    }
              }
            >
              Sheet {stampRaw}
            </span>
          ) : null}
          {["booked", "t24", "t3"].map((stage) => (
            <StageBadge
              key={stage}
              stage={stage}
              sentAt={sentStages.has(stage) ? "1" : null}
            />
          ))}
          {cancelled ? (
            <span
              className="px-2 py-0.5 rounded-md text-[11px]"
              style={{
                background: "rgba(239,90,42,0.12)",
                border: "1px solid rgba(239,90,42,0.4)",
                color: "var(--spark-orange)",
              }}
            >
              Cancelled
            </span>
          ) : row.sendReminders ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onCancel(row.uuid)}
              className="text-[11px] underline"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              stop reminders
            </button>
          ) : (
            <span
              className="text-[11px]"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              reminders off
            </span>
          )}
        </div>
      </div>
      {failed.length > 0 ? (
        <p className="text-[11px] mt-1" style={{ color: "var(--spark-orange)" }}>
          {failed
            .map(
              (f) =>
                `${STAGE_LABEL[f.stage] ?? f.stage} failed ×${f.attempts}${
                  f.lastError ? ` — ${f.lastError}` : ""
                }`,
            )
            .join("; ")}
        </p>
      ) : null}
      {stampRaw.toLowerCase().includes("error") ? (
        <p className="text-[11px] mt-1" style={{ color: "var(--spark-orange)" }}>
          Sheet stamp Error — check Confirmation Error on the workbook row.
        </p>
      ) : null}
    </div>
  );
};

const Inner: React.FC<{ tenantId: string; refreshKey: number }> = ({
  tenantId,
  refreshKey,
}) => {
  // Bumped after a send or a cancel. The mutation returns the changed row but
  // it isn't part of the `eventConfirmations` list the history renders, so
  // without this the row an admin just sent doesn't appear until they think to
  // press Refresh — which reads as "did that work?".
  const [localRefresh, setLocalRefresh] = useState(0);
  const data = useLazyLoadQuery<EventConfirmationFormQueryType>(
    EventConfirmationFormQuery,
    { tenantId },
    { fetchPolicy: "network-only", fetchKey: refreshKey + localRefresh },
  );

  const opts = data.eventConfirmationFormOptions;
  const shifts = data.upcomingShiftsForConfirmation;

  const [pickedShift, setPickedShift] = useState("");
  const [baName, setBaName] = useState("");
  const [baEmail, setBaEmail] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timezoneName, setTimezoneName] = useState(opts.defaultTimezoneName);
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  // Pre-filled from the tenant's own default program (Tenant.checkin_event_type
  // — Retail Sampling for LD) so this isn't retyped on every send. Still
  // editable, and the datalist offers the tenant's other programs.
  const [eventTypeLabel, setEventTypeLabel] = useState(
    opts.defaultEventTypeLabel,
  );
  const [products, setProducts] = useState<string[]>([]);
  const [sendReminders, setSendReminders] = useState(true);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const [commitSend, sending] =
    useMutation<SendEventConfirmationMutationType>(SendEventConfirmationMutation);
  const [commitCancel, cancelling] = useMutation<CancelType>(
    CancelEventConfirmationRemindersMutation,
  );

  const applyShift = (key: string) => {
    setPickedShift(key);
    if (!key) return;
    const shift: Shift | undefined = shifts.find(
      (s) => `${s.eventUuid}:${s.ambassadorEventUuid ?? ""}` === key,
    );
    if (!shift) return;
    // Format in the zone we're about to SUBMIT with, so the boxes and the
    // timezone field always describe the same instant — see isoToParts. A
    // shift with no timezone of its own keeps whatever is selected.
    const zone = shift.timezoneName || timezoneName;
    const [d, t] = isoToParts(shift.startsAt, zone);
    const [, endT] = isoToParts(shift.endsAt, zone);
    setBaName(shift.baName);
    setBaEmail(shift.baEmail);
    setDate(d);
    setStartTime(t);
    setEndTime(endT);
    setStoreName(shift.storeName);
    setAddress(shift.address);
    setEventTypeLabel(shift.eventTypeLabel);
    setTimezoneName(zone);
    // The picker offers category-prefixed values; a request's SKUs are bare
    // names, so match them back onto the option list rather than dropping them.
    if (shift.products.length > 0) {
      const wanted = new Set(shift.products.map((p) => p.toLowerCase()));
      setProducts(
        opts.productOptions.filter((o) =>
          wanted.has(splitOption(o)[1].toLowerCase()),
        ),
      );
    }
  };

  const missing: string[] = [];
  if (!baName.trim()) missing.push("BA name");
  if (!baEmail.trim() || !baEmail.includes("@")) missing.push("a valid BA email");
  if (!date) missing.push("date");
  if (!startTime) missing.push("start time");
  const canSend = missing.length === 0 && !sending;

  const submit = (sendNow: boolean) => {
    if (!canSend) return;
    setBanner(null);
    commitSend({
      variables: {
        input: {
          tenantId,
          baName: baName.trim(),
          baEmail: baEmail.trim(),
          date,
          startTime,
          endTime: endTime || null,
          timezoneName,
          storeName: storeName.trim(),
          address: address.trim(),
          eventTypeLabel: eventTypeLabel.trim(),
          products,
          sendReminders,
          sendNow,
        },
      },
      onCompleted: (res) => {
        const r = res?.sendEventConfirmation;
        setBanner({ ok: !!r?.success, text: r?.message || "Done." });
        if (r?.success) {
          // Keep the shift details — an admin usually sends several BAs for
          // the same store — but clear the person.
          setBaName("");
          setBaEmail("");
          setPickedShift("");
          setLocalRefresh((k) => k + 1);
        }
      },
      onError: (err) =>
        setBanner({ ok: false, text: err.message || "Send failed." }),
    });
  };

  const cancelReminders = (uuid: string) =>
    commitCancel({
      variables: { uuid },
      onCompleted: (res) => {
        const r = res?.cancelEventConfirmationReminders;
        setBanner({ ok: !!r?.success, text: r?.message || "Done." });
        if (r?.success) setLocalRefresh((k) => k + 1);
      },
      onError: (err) =>
        setBanner({ ok: false, text: err.message || "Couldn't cancel." }),
    });

  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
      {banner ? (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{
            background: banner.ok
              ? "rgba(190,242,100,0.1)"
              : "rgba(239,90,42,0.12)",
            border: `1px solid ${banner.ok ? "rgba(190,242,100,0.4)" : "rgba(239,90,42,0.45)"}`,
            color: banner.ok ? "var(--spark-lime)" : "var(--spark-orange)",
          }}
        >
          {banner.text}
        </div>
      ) : null}

      {!opts.hasRecapLink || !opts.hasTrainingLink ? (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{
            background: "rgba(255,196,0,0.1)",
            border: "1px solid rgba(255,196,0,0.4)",
            color: "var(--spark-gold, #ffc400)",
          }}
        >
          {!opts.hasRecapLink && !opts.hasTrainingLink
            ? "This client has no check-in code and no training site set, so the email will go out without either button."
            : !opts.hasRecapLink
              ? "This client has no check-in code yet, so the email will go out without the Open Recap Form button."
              : "This client has no training site set, so the email will go out without the Review Training Site button."}
        </div>
      ) : null}

      {opts.sheetAutomation ? (
        <div
          className="px-4 py-3 rounded-xl text-sm"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--spark-border)",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <p className="mb-1" style={{ color: "var(--spark-text)" }}>
            Sheet confirmations: {opts.sheetAutomation.label}
          </p>
          <p className="mb-1 text-[12px]">
            Apps Script Send / stamp status lives on this workbook, not the
            Settings linked-sheet (request append).
          </p>
          <a
            href={opts.sheetAutomation.sheetUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-semibold underline"
            style={{ color: "var(--spark-lime)" }}
          >
            Open confirmation sheet →
          </a>
        </div>
      ) : null}

      <div style={panel} className="p-5">
        <div className="mb-4">
          <span style={labelMini}>Prefill from a booked shift — optional</span>
          <select
            value={pickedShift}
            onChange={(e) => applyShift(e.target.value)}
            style={{ ...field, marginTop: 6 }}
          >
            <option value="">
              {shifts.length === 0
                ? "No upcoming shifts in Spark — type the details below"
                : "Type the details below, or pick a shift…"}
            </option>
            {shifts.map((s) => {
              const key = `${s.eventUuid}:${s.ambassadorEventUuid ?? ""}`;
              const [d] = isoToParts(s.startsAt, s.timezoneName || timezoneName);
              return (
                <option key={key} value={key}>
                  {[s.storeName || s.eventName, d, s.baName || "unstaffed"]
                    .filter(Boolean)
                    .join(" | ")}
                </option>
              );
            })}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="BA name">
            <input
              value={baName}
              onChange={(e) => setBaName(e.target.value)}
              placeholder="Deond Thomas"
              style={field}
            />
          </Field>
          <Field label="BA email">
            <input
              type="email"
              value={baEmail}
              onChange={(e) => setBaEmail(e.target.value)}
              placeholder="ba@example.com"
              style={field}
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={field}
            />
          </Field>
          <Field
            label="Timezone"
            hint="The venue's timezone — this is what the 24h/3h reminders are measured against."
          >
            <select
              value={timezoneName}
              onChange={(e) => setTimezoneName(e.target.value)}
              style={field}
            >
              {opts.timezones.some((z) => z.name === timezoneName) ? null : (
                <option value={timezoneName}>{timezoneName}</option>
              )}
              {opts.timezones.map((z) => (
                <option key={z.id} value={z.name}>
                  {z.name}
                  {z.code ? ` (${z.code})` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start time">
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={field}
            />
          </Field>
          <Field label="End time">
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={field}
            />
          </Field>
          <Field label="Store name">
            <input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Jewel Osco"
              style={field}
            />
          </Field>
          <Field
            label="Event type"
            hint={`Reads as “a ${[opts.brandName, eventTypeLabel.toLowerCase()].filter(Boolean).join(" ") || "shift"}”.`}
          >
            <input
              value={eventTypeLabel}
              onChange={(e) => setEventTypeLabel(e.target.value)}
              placeholder={opts.defaultEventTypeLabel || "Retail Sampling"}
              list="event-confirmation-event-types"
              style={field}
            />
            {opts.eventTypeOptions.length > 1 ? (
              <datalist id="event-confirmation-event-types">
                {opts.eventTypeOptions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            ) : null}
          </Field>
          <div className="md:col-span-2">
            <Field label="Address">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="4042 W Foster Ave, Chicago, IL 60630, USA"
                style={field}
              />
            </Field>
          </div>
        </div>

        <div className="mt-5">
          <ProductPicker
            options={opts.productOptions}
            selected={products}
            onChange={setProducts}
          />
        </div>

        <div
          className="mt-5 p-3 rounded-xl text-[12px]"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--spark-border)",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          <p className="mb-1">
            Sends from{" "}
            <span style={{ color: "var(--spark-text)" }}>{opts.fromEmail}</span>
          </p>
          {opts.hasTrainingLink ? (
            <p className="mb-0.5">Training site: {opts.trainingUrl}</p>
          ) : null}
          {opts.hasRecapLink ? <p>Recap form: {opts.recapUrl}</p> : null}
        </div>

        <label className="flex items-center gap-2 mt-4 cursor-pointer text-[13px]">
          <input
            type="checkbox"
            checked={sendReminders}
            onChange={(e) => setSendReminders(e.target.checked)}
            style={{ accentColor: "var(--spark-lime)" }}
          />
          Also re-send this automatically 24 hours and 3 hours before the shift
        </label>

        <div className="flex items-center gap-2 mt-5 flex-wrap">
          <button
            type="button"
            disabled={!canSend}
            onClick={() => submit(true)}
            className="px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{
              background: canSend ? "var(--spark-lime)" : "rgba(255,255,255,0.08)",
              color: canSend ? "#0a0d09" : "rgba(255,255,255,0.35)",
              border: "none",
              cursor: canSend ? "pointer" : "not-allowed",
            }}
          >
            {sending ? "Sending…" : "Send confirmation"}
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => submit(false)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
              cursor: canSend ? "pointer" : "not-allowed",
            }}
          >
            Save without emailing
          </button>
          {missing.length > 0 ? (
            <span
              className="text-[12px]"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Still need {missing.join(", ")}.
            </span>
          ) : null}
        </div>
      </div>

      <div style={panel} className="p-5">
        <h2 className="display text-lg font-bold mb-1">Sent confirmations</h2>
        <p className="text-[12px] mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
          A tick means that stage has gone out. The 24h and 3h re-sends fire on
          their own. Sheet rows show workbook provenance and the last stamp.
        </p>
        {data.eventConfirmations.length === 0 ? (
          <p
            className="py-6 text-center text-sm"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            Nothing sent yet.
          </p>
        ) : (
          data.eventConfirmations.map((row) => (
            <HistoryRow
              key={row.uuid}
              row={row}
              onCancel={cancelReminders}
              busy={cancelling}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default function SparkEventConfirmation() {
  const { tenantId } = useAuthStore();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="p-5 md:p-8">
      <p
        className="mono text-[10px] mb-1"
        style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
      >
        WORKSPACE
      </p>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="display text-2xl font-bold">Send event confirmation</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            Email a BA their event details, then again 24 hours and 3 hours
            before the shift.
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="px-3 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "transparent",
            color: "var(--spark-text)",
            border: "1px solid var(--spark-border)",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {!tenantId ? (
        <p
          className="p-10 text-center text-sm"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Pick a client to send a confirmation.
        </p>
      ) : (
        <Suspense
          fallback={
            <p
              className="p-10 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              Loading…
            </p>
          }
        >
          <Inner tenantId={tenantId} refreshKey={refreshKey} />
        </Suspense>
      )}
    </div>
  );
}
