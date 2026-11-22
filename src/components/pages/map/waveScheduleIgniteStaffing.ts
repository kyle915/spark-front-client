import type { WavePreviewRow } from "./waveSchedule";

export type IgniteStaffingWaveSource = {
  tenantId: string;
  activationTypeName: string;
  notes: string;
  activeRows: ReadonlyArray<Pick<WavePreviewRow, "storeName" | "date">>;
};

export type RequestIgniteStaffingWaveInput = {
  tenantId: string;
  source: "wave_sheet";
  activationType: string;
  requestedShiftCount: number;
  requestedBaCount: number;
  requestedDates: string[];
  requestedStores: string[];
  notes?: string;
  title?: string;
};

/** Pure builder for the wave-sheet → Ignite staffing handoff mutation. */
export function buildIgniteStaffingRequestFromWave(
  src: IgniteStaffingWaveSource,
): RequestIgniteStaffingWaveInput {
  const uniqueDates = Array.from(
    new Set(src.activeRows.map((r) => r.date).filter(Boolean)),
  ).sort();
  const storeNames = Array.from(
    new Set(src.activeRows.map((r) => r.storeName.trim()).filter(Boolean)),
  );

  const trimmedNotes = src.notes.trim();
  const activation = src.activationTypeName.trim();

  return {
    tenantId: src.tenantId,
    source: "wave_sheet",
    activationType: activation,
    requestedShiftCount: Math.max(1, src.activeRows.length),
    requestedBaCount: Math.max(1, src.activeRows.length),
    requestedDates: uniqueDates,
    requestedStores: storeNames,
    ...(trimmedNotes ? { notes: trimmedNotes } : {}),
    title: activation
      ? `Ignite staffing · ${activation} wave (${src.activeRows.length} shifts)`
      : `Ignite staffing · ${src.activeRows.length} shifts`,
  };
}