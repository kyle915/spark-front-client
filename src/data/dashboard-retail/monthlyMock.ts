export interface MonthlyTrend {
  month: string;
  consumers: number;
  purchases: number;
  conversion: number;
}

export const mockMonthlyTrendsAlt: MonthlyTrend[] = [
  {
    month: "Jan",
    consumers: 1780,
    purchases: 390,
    conversion: 21.9,
  },
  {
    month: "Feb",
    consumers: 2250,
    purchases: 520,
    conversion: 23.1,
  },
  {
    month: "Mar",
    consumers: 2550,
    purchases: 610,
    conversion: 23.9,
  },
  {
    month: "Apr",
    consumers: 2900,
    purchases: 700,
    conversion: 24.1,
  },
  {
    month: "May",
    consumers: 3400,
    purchases: 860,
    conversion: 25.3,
  },
  {
    month: "Jun",
    consumers: 3200,
    purchases: 740,
    conversion: 23.1,
  },
  {
    month: "Jul",
    consumers: 3100,
    purchases: 710,
    conversion: 22.9,
  },
  {
    month: "Aug",
    consumers: 3600,
    purchases: 880,
    conversion: 24.4,
  },
  {
    month: "Sep",
    consumers: 3300,
    purchases: 760,
    conversion: 23.0,
  },
  {
    month: "Oct",
    consumers: 3500,
    purchases: 810,
    conversion: 23.1,
  },
  {
    month: "Nov",
    consumers: 1998,
    purchases: 900,
    conversion: 19,
  },
  {
    month: "Dec",
    consumers: 4000,
    purchases: 3000,
    conversion: 25.5,
  },
];
