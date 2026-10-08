import type { RecapActivationFilter } from "@/lib/activationBucket";
import type { RecapTypeChip } from "./recapListFilters";

export function RecapTypeChips({
  chips,
  active,
  onChange,
  compact = false,
}: {
  chips: RecapTypeChip[];
  active: RecapActivationFilter;
  onChange: (next: RecapActivationFilter) => void;
  compact?: boolean;
}) {
  if (chips.length === 0) return null;
  return (
    <div
      className={
        compact
          ? "flex md:hidden basis-full overflow-x-auto rounded-xl"
          : "hidden md:flex rounded-xl overflow-x-auto max-w-full"
      }
      style={{ border: "1px solid var(--spark-border)" }}
      role="group"
      aria-label="Recap type"
    >
      {chips.map(({ key, label, count }) => {
        const on = active === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(key)}
            className={`${
              compact ? "flex-1 px-2 py-2 text-[11px]" : "px-2.5 py-2 text-xs"
            } font-semibold whitespace-nowrap inline-flex items-center justify-center gap-1.5`}
            style={{
              background: on ? "rgba(197,245,70,0.16)" : "transparent",
              color: on ? "var(--spark-lime)" : "rgba(255,255,255,0.65)",
            }}
          >
            {label}
            {count != null ? (
              <span
                className="mono tab-num text-[10px]"
                style={{ opacity: on ? 0.85 : 0.5 }}
              >
                {count.toLocaleString()}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
