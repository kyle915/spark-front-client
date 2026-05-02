import { useState, useRef, useEffect } from "react";
import {
  CalendarIcon,
  ChevronDownIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  isWithinInterval,
  isBefore,
  addMonths,
  subMonths,
  isToday,
} from "date-fns";
import type { DateRange } from "react-day-picker";

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  label?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function MonthGrid({
  month,
  selected,
  hovered,
  onDayClick,
  onDayHover,
}: {
  month: Date;
  selected: DateRange | undefined;
  hovered: Date | null;
  onDayClick: (day: Date) => void;
  onDayHover: (day: Date | null) => void;
}) {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });
  const startPad = getDay(start);

  const rangeEnd = selected?.from
    ? hovered && !selected.to
      ? hovered
      : selected.to
    : null;

  const rangeFrom = selected?.from ?? null;

  const isInRange = (day: Date) => {
    if (!rangeFrom || !rangeEnd) return false;
    const lo = isBefore(rangeFrom, rangeEnd) ? rangeFrom : rangeEnd;
    const hi = isBefore(rangeFrom, rangeEnd) ? rangeEnd : rangeFrom;
    return isWithinInterval(day, { start: lo, end: hi });
  };

  const isRangeStart = (day: Date) => !!rangeFrom && isSameDay(day, rangeFrom);

  const isRangeEnd = (day: Date) => !!rangeEnd && isSameDay(day, rangeEnd);

  return (
    <div className="min-w-[220px]">
      <p className="text-center text-base font-bold text-base-content mb-4 tracking-wide">
        {format(month, "MMMM yyyy")}
      </p>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-semibold text-base-content/40 py-1.5"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {/* Leading empty cells */}
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="h-9" />
        ))}

        {days.map((day) => {
          const inRange = isInRange(day);
          const rangeStart = isRangeStart(day);
          const rangeFinish = isRangeEnd(day);
          const today = isToday(day);
          const selected = rangeStart || rangeFinish;

          return (
            <div
              key={day.toISOString()}
              className={[
                "relative flex items-center justify-center h-9 cursor-pointer text-sm select-none transition-all duration-100",
                inRange && !selected ? "bg-primary/20 text-base-content" : "",
                rangeStart && !rangeFinish
                  ? "rounded-l-full bg-primary text-primary-content font-bold"
                  : "",
                rangeFinish && !rangeStart
                  ? "rounded-r-full bg-primary text-primary-content font-bold"
                  : "",
                rangeStart && rangeFinish
                  ? "rounded-full bg-primary text-primary-content font-bold"
                  : "",
                !selected && !inRange
                  ? "hover:bg-base-200 rounded-full text-base-content"
                  : "",
                today && !selected
                  ? "font-bold text-primary underline underline-offset-2"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onDayClick(day)}
              onMouseEnter={() => onDayHover(day)}
              onMouseLeave={() => onDayHover(null)}
            >
              {day.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({
  value,
  onChange,
  label = "Date Range",
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hovered, setHovered] = useState<Date | null>(null);
  const [viewMonth, setViewMonth] = useState<Date>(value?.from ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleDayClick = (day: Date) => {
    if (!value?.from || (value.from && value.to)) {
      // Start fresh selection
      onChange?.({ from: day, to: undefined });
    } else {
      // Complete the range
      const from = value.from;
      if (isBefore(day, from)) {
        onChange?.({ from: day, to: from });
      } else {
        onChange?.({ from, to: day });
      }
      setIsOpen(false);
    }
  };

  const clearRange = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(undefined);
  };

  const formattedLabel = () => {
    if (!value?.from) return "Select Date Range";
    if (!value.to) return format(value.from, "MMM dd, yyyy");
    return `${format(value.from, "MMM dd, yyyy")} – ${format(value.to, "MMM dd, yyyy")}`;
  };

  const nextMonth = () => setViewMonth((m) => addMonths(m, 1));
  const prevMonth = () => setViewMonth((m) => subMonths(m, 1));

  return (
    <div className="form-control w-full" ref={containerRef}>
      {/* Label */}
      <label className="label">
        <span className="label-text">{label}</span>
      </label>

      {/* Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          className="w-full min-h-11 input input-bordered rounded-full px-4 pr-12 flex items-center gap-2 text-sm text-left"
        >
          <CalendarIcon className="h-4 w-4 text-base-content/50 shrink-0" />
          <span
            className={
              value?.from ? "text-base-content" : "text-base-content/40"
            }
          >
            {formattedLabel()}
          </span>
        </button>

        {/* Right icons */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
          {value?.from && (
            <button
              type="button"
              onClick={clearRange}
              className="p-1 hover:bg-base-200 rounded-full text-base-content/50 hover:text-base-content transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
          <div className="pointer-events-none pr-1">
            <ChevronDownIcon
              className={`w-5 h-5 transition-transform opacity-70 ${isOpen ? "rotate-180" : ""}`}
            />
          </div>
        </div>

        {/* Dropdown Calendar */}
        {isOpen && (
          <div className="absolute z-50 right-0 mt-2 bg-base-100 border border-base-300 rounded-2xl shadow-2xl p-6 min-w-[580px]">
            {/* Navigation header — outside month grids */}
            <div className="flex items-center justify-between mb-6">
              <button
                type="button"
                onClick={prevMonth}
                className="p-2 rounded-full hover:bg-base-200 text-base-content/60 hover:text-base-content transition-colors"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>

              <span className="text-sm font-semibold text-base-content/50 tracking-widest uppercase">
                {format(viewMonth, "yyyy")}
              </span>

              <button
                type="button"
                onClick={nextMonth}
                className="p-2 rounded-full hover:bg-base-200 text-base-content/60 hover:text-base-content transition-colors"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Two months side by side */}
            <div className="grid grid-cols-2 divide-x divide-base-300 gap-0">
              <div className="pr-6">
                <MonthGrid
                  month={viewMonth}
                  selected={value}
                  hovered={hovered}
                  onDayClick={handleDayClick}
                  onDayHover={setHovered}
                />
              </div>
              <div className="pl-6">
                <MonthGrid
                  month={addMonths(viewMonth, 1)}
                  selected={value}
                  hovered={hovered}
                  onDayClick={handleDayClick}
                  onDayHover={setHovered}
                />
              </div>
            </div>

            {/* Footer hint */}
            <div className="mt-5 pt-4 border-t border-base-300 flex items-center justify-center gap-2">
              <span className="text-xs text-base-content/40">
                {!value?.from
                  ? "Click a day to select the start date"
                  : !value.to
                    ? "Now click to select the end date"
                    : `${format(value.from, "MMM dd, yyyy")} – ${format(value.to, "MMM dd, yyyy")}`}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
