import TimeSlotSelect from "@/components/inputs/TimeSlotSelect";
import {
  BA_COUNT_MAX,
  BA_COUNT_MIN,
  blankVisitSlot,
  clampBaCount,
  type VisitSlot,
} from "../eventActivationSchedule";

type Props = {
  slots: VisitSlot[];
  onChange: (slots: VisitSlot[]) => void;
  baCount: number;
  onBaCount: (next: number) => void;
  inputStyle?: React.CSSProperties;
  inputClassName?: string;
};

const labelClass = "label-mini block mb-1.5";

/**
 * Date + start + end rows for brand-group Event Activation.
 * Time zone stays on the parent form — one venue, one zone.
 */
export default function EventActivationSchedule({
  slots,
  onChange,
  baCount,
  onBaCount,
  inputStyle,
  inputClassName,
}: Props) {
  const update = (index: number, patch: Partial<VisitSlot>) => {
    onChange(
      slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)),
    );
  };

  return (
    <div className="space-y-3">
      <p className={labelClass}>Dates & times *</p>
      {slots.map((slot, index) => (
        <div
          key={index}
          className="rounded-xl p-3 space-y-3"
          style={{
            border: "1px solid var(--spark-border)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="mono text-[10px]"
              style={{
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              {slots.length > 1 ? `VISIT ${index + 1}` : "VISIT"}
            </span>
            {index > 0 && (
              <button
                type="button"
                onClick={() => onChange(slots.filter((_, i) => i !== index))}
                className="mono text-[10px]"
                style={{
                  letterSpacing: "0.14em",
                  color: "var(--spark-orange, #ef5a2a)",
                }}
              >
                Remove
              </button>
            )}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass} htmlFor={`visit-date-${index}`}>
                Visit date *
              </label>
              <input
                id={`visit-date-${index}`}
                style={inputStyle}
                className={inputClassName}
                type="date"
                value={slot.date}
                onChange={(e) => update(index, { date: e.target.value })}
                required={index === 0}
              />
            </div>
            <div>
              <label className={labelClass}>Start time *</label>
              <TimeSlotSelect
                value={slot.startTime}
                onChange={(startTime) => update(index, { startTime })}
                style={inputStyle}
                className={inputClassName}
                aria-label={`Start time for visit ${index + 1}`}
              />
            </div>
            <div>
              <label className={labelClass}>End time *</label>
              <TimeSlotSelect
                value={slot.endTime}
                onChange={(endTime) => update(index, { endTime })}
                style={inputStyle}
                className={inputClassName}
                aria-label={`End time for visit ${index + 1}`}
              />
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([...slots, blankVisitSlot(slots[slots.length - 1])])
        }
        className="mono text-[10px]"
        style={{ letterSpacing: "0.14em", color: "var(--spark-lime, #c5f546)" }}
      >
        + Add another date
      </button>
      <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
        <span className="label-mini">BAs needed onsite *</span>
        <div
          className="inline-flex items-center rounded-full"
          style={{
            background: "var(--spark-bg, #0A0B0D)",
            border: "1px solid var(--spark-border)",
          }}
        >
          <button
            type="button"
            aria-label="Fewer brand ambassadors"
            onClick={() => onBaCount(clampBaCount(baCount - 1))}
            className="w-9 h-9 grid place-items-center"
            style={{ color: "var(--spark-text)" }}
          >
            −
          </button>
          <span
            className="tab-num px-3 text-base font-semibold"
            style={{ minWidth: 28, textAlign: "center" }}
          >
            {clampBaCount(baCount)}
          </span>
          <button
            type="button"
            aria-label="More brand ambassadors"
            onClick={() => onBaCount(clampBaCount(baCount + 1))}
            disabled={baCount >= BA_COUNT_MAX}
            className="w-9 h-9 grid place-items-center disabled:opacity-40"
            style={{ color: "var(--spark-lime, #c5f546)" }}
          >
            +
          </button>
        </div>
      </div>
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
        Each date is its own request at this venue. {BA_COUNT_MIN}–{BA_COUNT_MAX}{" "}
        brand ambassadors.
      </p>
    </div>
  );
}
