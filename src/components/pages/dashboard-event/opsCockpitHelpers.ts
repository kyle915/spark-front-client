export const OPS_ANALYTICS_COLLAPSED_KEY =
  "@spark.adminDash.analyticsCollapsed.v1";

export type OpsJumpSectionId = "ops-triage" | "live-clock" | "performance";

export const OPS_JUMP_SECTIONS: ReadonlyArray<{
  id: OpsJumpSectionId;
  label: string;
}> = [
  { id: "ops-triage", label: "Ops Triage" },
  { id: "live-clock", label: "Live Clock" },
  { id: "performance", label: "Program Analytics" },
];

export function readOpsAnalyticsCollapsed(
  storage: Pick<Storage, "getItem"> | null | undefined = typeof localStorage !==
  "undefined"
    ? localStorage
    : null,
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(OPS_ANALYTICS_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeOpsAnalyticsCollapsed(
  collapsed: boolean,
  storage: Pick<Storage, "setItem"> | null | undefined = typeof localStorage !==
  "undefined"
    ? localStorage
    : null,
): void {
  if (!storage) return;
  try {
    storage.setItem(OPS_ANALYTICS_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // Ignore private-mode storage quota errors.
  }
}
