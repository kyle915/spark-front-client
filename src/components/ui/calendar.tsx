import * as React from "react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker";
import { cn } from "../../lib/utils";
import { Button } from "../../components/ui/button";
import { buttonVariants } from "./button-variants";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "group/calendar p-3 bg-base-100 text-base-content [--cell-size:var(--spacing-8,2rem)]",
        className
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "flex gap-4 flex-col md:flex-row relative",
          defaultClassNames.months
        ),
        month: cn("flex flex-col w-full gap-4", defaultClassNames.month),
        nav: cn(
          "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-[var(--cell-size)] p-0",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-[var(--cell-size)] p-0",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex items-center justify-center h-[var(--cell-size)] w-full px-[var(--cell-size)] font-semibold",
          defaultClassNames.month_caption
        ),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-base-content/60 rounded-md flex-1 font-normal text-[0.8rem]",
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-2", defaultClassNames.week),
        day: cn(
          "relative w-full h-full p-0 text-center aspect-square group/day",
          defaultClassNames.day
        ),

        // RANGE COLORS DaisyUI
        range_start: cn(
          "rounded-l-md bg-primary text-primary-content",
          defaultClassNames.range_start
        ),
        range_middle: cn(
          "rounded-none bg-primary/40 text-base-content",
          defaultClassNames.range_middle
        ),
        range_end: cn(
          "rounded-r-md bg-primary text-primary-content",
          defaultClassNames.range_end
        ),

        today: cn("font-semibold text-primary", defaultClassNames.today),
        outside: cn(
          "text-base-content/40 aria-selected:text-base-content/40",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-base-content/30 opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),

        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => (
          <div
            data-slot="calendar"
            ref={rootRef}
            className={cn(className)}
            {...props}
          />
        ),
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left")
            return (
              <ChevronLeftIcon className={cn("size-4", className)} {...props} />
            );
          if (orientation === "right")
            return (
              <ChevronRightIcon
                className={cn("size-4", className)}
                {...props}
              />
            );
          return (
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          );
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => (
          <td {...props}>
            <div className="flex size-[--cell-size] items-center justify-center text-center">
              {children}
            </div>
          </td>
        ),
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        // SELECTED SINGLE DAY
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-content",

        // RANGE MIDDLE
        "data-[range-middle=true]:bg-primary/40 data-[range-middle=true]:text-base-content",

        // RANGE START & END
        "data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-content",
        "data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-content",

        // FOCUS RING
        "group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-primary/50",

        // BASE
        "flex aspect-square w-full min-w-[--cell-size] items-center justify-center rounded-md font-medium text-sm",

        className
      )}
      {...props}
    >
      {day.date.getDate()}
    </Button>
  );
}

export { Calendar, CalendarDayButton };
