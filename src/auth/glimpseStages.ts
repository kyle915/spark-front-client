/**
 * The small "Today" board on the sign-in page's brand panel. It is an
 * illustration of what Spark does, with made-up stores, and it moves for one
 * reason: to show a shift going from booked, to on the clock, to recapped.
 */
export type GlimpseStage = "booked" | "on_clock" | "recapped";

export type GlimpseRow = {
  store: string;
  place: string;
  starts: string;
  sampled: number;
};

export const GLIMPSE_ROWS: ReadonlyArray<GlimpseRow> = [
  { store: "Harbor Market", place: "Austin, TX", starts: "2:00 PM", sampled: 84 },
  { store: "Northside Grocery", place: "Tampa, FL", starts: "3:00 PM", sampled: 61 },
  { store: "Corner Wine & Spirits", place: "Denver, CO", starts: "4:00 PM", sampled: 112 },
];

const ORDER: ReadonlyArray<GlimpseStage> = ["booked", "on_clock", "recapped"];

/** Stage of each row at a given tick. Rows advance one at a time, top first,
 *  hold when all are recapped, then start over. */
export const glimpseStages = (tick: number, rows = GLIMPSE_ROWS.length): GlimpseStage[] => {
  const steps = rows * 2; // two advances per row
  const cycle = steps + 3; // hold the finished board for three ticks
  const t = ((tick % cycle) + cycle) % cycle;
  const done = Math.min(t, steps);
  return Array.from({ length: rows }, (_, i) => {
    // Row i takes its first step at tick i+1 and its second at rows+i+1.
    const first = done >= i + 1 ? 1 : 0;
    const second = done >= rows + i + 1 ? 1 : 0;
    return ORDER[first + second];
  });
};

export const glimpseLabel = (stage: GlimpseStage, row: GlimpseRow): string => {
  if (stage === "booked") return `Starts ${row.starts}`;
  if (stage === "on_clock") return "On the clock";
  return `Recap in · ${row.sampled} sampled`;
};
