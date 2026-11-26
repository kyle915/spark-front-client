import type { WaveTargetStore } from "./waveSchedule";

export interface AiWavePrefill {
  storeKeys: string[];
  storeNames: string[];
  windowStart?: string;
  windowEnd?: string;
  weekdays?: number[];
  startTime?: string;
  endTime?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RANGE_RE = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;

export function parseAiWaveParams(searchParams: URLSearchParams): AiWavePrefill | null {
  if (searchParams.get("wave") !== "1") return null;

  const rawKeys = searchParams.get("waveStores") ?? "";
  const storeKeys = rawKeys
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^s\d{1,18}$/.test(s));

  const rawNames = searchParams.get("waveNames") ?? "";
  const storeNames = rawNames
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  if (storeKeys.length === 0 && storeNames.length === 0) return null;

  const prefill: AiWavePrefill = { storeKeys, storeNames };

  const ws = (searchParams.get("waveStart") ?? "").trim();
  const we = (searchParams.get("waveEnd") ?? "").trim();
  if (ISO_DATE_RE.test(ws) && ISO_DATE_RE.test(we) && ws <= we) {
    prefill.windowStart = ws;
    prefill.windowEnd = we;
  }

  const rawDays = (searchParams.get("waveDays") ?? "").trim();
  if (rawDays) {
    const parsedDays = Array.from(
      new Set(
        rawDays
          .split(",")
          .map((d) => Number(d.trim()))
          .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
      ),
    ).sort();
    if (parsedDays.length > 0) {
      prefill.weekdays = parsedDays;
    }
  }

  const rawHours = (searchParams.get("waveHours") ?? "").trim();
  const hm = rawHours.match(HHMM_RANGE_RE);
  if (hm) {
    prefill.startTime = `${hm[1]}:${hm[2]}`;
    prefill.endTime = `${hm[3]}:${hm[4]}`;
  }

  return prefill;
}

export function matchWaveTargetStores(
  prefill: AiWavePrefill,
  stores: ReadonlyArray<WaveTargetStore>,
): WaveTargetStore[] {
  const byKey = new Map<string, WaveTargetStore>();
  const byName = new Map<string, WaveTargetStore>();
  for (const s of stores) {
    byKey.set(s.key, s);
    const norm = s.name.trim().toLowerCase();
    if (norm && !byName.has(norm)) {
      byName.set(norm, s);
    }
  }

  const picked = new Map<string, WaveTargetStore>();
  for (const key of prefill.storeKeys) {
    const hit = byKey.get(key);
    if (hit) picked.set(hit.key, hit);
  }
  for (const name of prefill.storeNames) {
    const hit = byName.get(name.trim().toLowerCase());
    if (hit && !picked.has(hit.key)) {
      picked.set(hit.key, hit);
    }
  }
  return Array.from(picked.values());
}

export function stripAiWaveSearchParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete("wave");
  next.delete("waveStores");
  next.delete("waveNames");
  next.delete("waveStart");
  next.delete("waveEnd");
  next.delete("waveDays");
  next.delete("waveHours");
  return next;
}
