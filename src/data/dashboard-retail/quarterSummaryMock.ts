export interface QuarterSummary {
  quarter: string;
  months: string;
  consumers: number;
  purchases: number;
  conversion: number;
  color: string; // fondo suave
  border: string; // borde principal
}

export const quarterSummaryMock: QuarterSummary[] = [
  {
    quarter: "Q1 2025 Summary",
    months: "Jan - Mar",
    consumers: 5283,
    purchases: 1146,
    conversion: 21.7,
    color: "bg-blue-50 dark:bg-blue-900/10",
    border: "border-blue-300",
  },
  {
    quarter: "Q2 2025 Summary",
    months: "Apr - Jun",
    consumers: 8618,
    purchases: 1729,
    conversion: 20.1,
    color: "bg-green-50 dark:bg-green-900/10",
    border: "border-green-300",
  },
  {
    quarter: "Q3 2025 Summary",
    months: "Jul - Sep",
    consumers: 7944,
    purchases: 1488,
    conversion: 18.7,
    color: "bg-yellow-50 dark:bg-yellow-900/10",
    border: "border-yellow-300",
  },
  {
    quarter: "Q4 2025 Summary",
    months: "Oct - Dec",
    consumers: 6210,
    purchases: 1109,
    conversion: 17.9,
    color: "bg-pink-50 dark:bg-pink-900/10",
    border: "border-pink-300",
  },
];
