import { useState } from "react";
import { Calendar } from "./calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../..//components/ui/popover";

export function DateRangePicker() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  });

  const formattedLabel = () => {
    if (!date?.from) return "Select Date Range";
    if (!date.to) return `${format(date.from, "MMM dd, yyyy")}`;

    return `${format(date.from, "MMM dd, yyyy")} - ${format(
      date.to,
      "MMM dd, yyyy"
    )}`;
  };

  return (
    <div className="form-control w-full">
      {/* Label */}
      <label className="label text-sm font-medium">Date Range</label>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="select select-bordered select-sm w-full"
          >
            <div className="flex items-center gap-2 text-base-content/80">
              <CalendarIcon className="h-4 w-4" />
              {formattedLabel()}
            </div>
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={date}
            onSelect={setDate}
            defaultMonth={date?.from}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
