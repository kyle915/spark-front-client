/** CSV for the Torch field-marketing plan. Not scored against a monthly target. */

export const TACTIC_ACTIVITIES: Record<string, string[]> = {
  event_activation: ["event_activation", "sponsorship"],
  guerilla: ["guerilla", "full_can", "pour"],
  product_seeding: ["product_seeding"],
  sales_support: ["sales_support", "retail_support"],
};

export type PlanExportRow = {
  startsOn: string;
  marketLabel: string;
  managerName: string;
  activity: string;
  activityLabel: string;
  supportLabel: string;
  supportOther: string;
  samplingLabel: string;
  skuNames: string[];
  name: string;
  days: number;
  loggedFullCans: number | null;
  loggedPourSamples: number | null;
  loggedCases: number | null;
  loggedEmails: number | null;
  ambassadorCount: number;
  status: string;
  requestCode: string | null;
};

export function matchesTactic(activity: string, tactic: string): boolean {
  if (!tactic) return true;
  const keys = TACTIC_ACTIVITIES[tactic];
  return keys ? keys.includes(activity) : activity === tactic;
}

function cell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function fieldMarketingCsv(rows: PlanExportRow[]): string {
  const header = [
    "Date",
    "Market",
    "RMM",
    "Activity",
    "Sales support",
    "Sampling format",
    "SKUs",
    "Name",
    "Days",
    "Logged cans",
    "Logged pours",
    "Cases seeded",
    "Emails",
    "BA count",
    "Status",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    const support = row.supportOther
      ? `${row.supportLabel}: ${row.supportOther}`
      : row.supportLabel;
    const status =
      row.status === "submitted"
        ? row.requestCode
          ? `Booked · ${row.requestCode}`
          : "Booked"
        : "Draft";
    lines.push(
      [
        row.startsOn,
        row.marketLabel,
        row.managerName,
        row.activityLabel,
        support,
        row.samplingLabel,
        row.skuNames.join("; "),
        row.name,
        row.activity === "event_activation" || row.activity === "sponsorship"
          ? row.days
          : "",
        row.loggedFullCans,
        row.loggedPourSamples,
        row.loggedCases,
        row.loggedEmails,
        row.ambassadorCount || "",
        status,
      ]
        .map(cell)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
