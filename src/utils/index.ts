export { themes } from "@/theme/themes";

/**
 * Parse a user-entered number tolerant of both US and European
 * decimal/grouping conventions, returning a JS number or null.
 *
 * BAs and clients enter values with whatever separators their keyboard
 * defaults to — a plain Number("96,63") yields NaN, which then saved as
 * null and silently wiped Account Spend. This normalizes first:
 *   "96,63"      → 96.63    (comma decimal — the reported LD case)
 *   "1.234,56"   → 1234.56  (European: dot grouping, comma decimal)
 *   "1,234.56"   → 1234.56  (US: comma grouping, dot decimal)
 *   "1,234"      → 1234     (lone comma + 3-digit tail → US thousands)
 *   "1,234,567"  → 1234567  (multiple commas → grouping)
 *   "12,5" / "96.63" / "1234" → 12.5 / 96.63 / 1234 (unchanged intent)
 *
 * Strips currency symbols and spaces. Returns null for blank/unparseable
 * input so a deliberately cleared field stays cleared (not NaN→null
 * masquerading as an edit).
 */
export const parseLocaleNumber = (
  raw: string | null | undefined,
): number | null => {
  if (raw == null) return null;
  // Keep only digits, the two separators, and a leading sign.
  let s = String(raw).trim().replace(/[^0-9.,-]/g, "");
  if (s === "" || s === "-") return null;

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    // Whichever separator appears LAST is the decimal point; the other
    // is a thousands separator and gets stripped.
    const decimalSep = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const groupSep = decimalSep === "," ? "." : ",";
    s = s.split(groupSep).join("").replace(decimalSep, ".");
  } else if (hasComma) {
    const parts = s.split(",");
    if (parts.length > 2) {
      // 1,234,567 → grouping only.
      s = parts.join("");
    } else {
      const [intPart, fracPart] = parts;
      // A lone comma with a 3-digit tail on a short integer reads as US
      // thousands (1,234 → 1234). Anything else is a decimal comma
      // (96,63 → 96.63 ; 12,5 → 12.5).
      if (
        fracPart.length === 3 &&
        intPart.replace("-", "").length >= 1 &&
        intPart.replace("-", "").length <= 3
      ) {
        s = intPart + fracPart;
      } else {
        s = `${intPart}.${fracPart}`;
      }
    }
  }
  // Dot-only or no separator: leave as-is (native US decimal/integer).

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export const formatDate = (value: string | null) => {
  if (!value) return "-";
  const datePart = extractDatePart(value);
  if (datePart) {
    const date = new Date(`${datePart}T00:00:00`);
    return isNaN(date.getTime()) ? datePart : date.toLocaleDateString();
  }
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

export const formatTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const formatLocalDateTime = (
  value: string | null,
  options?: { timeZone?: string; hour12?: boolean },
) => {
  if (!value) return "-";
  const dateObj = new Date(value);
  if (Number.isNaN(dateObj.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    timeZone: options?.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: options?.hour12,
  }).format(dateObj);
};

export const formatTimeWithOffset = (
  value: string | null,
  offsetMinutes?: number | null,
) => {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  if (offsetMinutes === null || offsetMinutes === undefined) {
    return formatTime(value);
  }
  const utcMs = date.getTime();
  const shifted = new Date(utcMs + offsetMinutes * 60 * 1000);
  return shifted.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
};

export const formatTimeLiteral = (value: string | null) => {
  if (!value) return "-";
  const match = value.match(/(?:T|\s)(\d{2}):(\d{2})/);
  if (!match) return value;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0",
  )} ${period}`;
};

const DATE_REGEX = /(\d{4}-\d{2}-\d{2})/;
const TIME_REGEX = /(\d{1,2}:\d{2})(?::\d{2})?/;

export const extractDatePart = (value: string | null | undefined) => {
  if (!value) return null;
  const match = value.match(DATE_REGEX);
  if (match) return match[1];

  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const extractTimePart = (value: string | null | undefined) => {
  if (!value) return null;
  const match = value.match(TIME_REGEX);
  if (match) {
    const [hour, minute] = match[1].split(":");
    return `${String(Number(hour)).padStart(2, "0")}:${minute}`;
  }
  return null;
};

export const combineDateAndTime = (
  dateValue: string | null | undefined,
  timeValue: string | null | undefined,
) => {
  const datePart = extractDatePart(dateValue) ?? (dateValue ?? "").trim();
  const timePart = extractTimePart(timeValue);

  if (!timePart) return "";
  if (!datePart) return timePart;

  return `${datePart} ${timePart}`;
};

export const buildDateTimeWithOffset = (
  dateValue: string | null | undefined,
  timeValue: string | null | undefined,
  offsetMinutes: number | null | undefined,
) => {
  const combined = combineDateAndTime(dateValue, timeValue);
  if (!combined) return "";
  if (offsetMinutes === undefined || offsetMinutes === null) {
    return combined.includes("T") ? combined : combined.replace(" ", "T");
  }
  if (!combined.includes("T") && !combined.includes(" ")) {
    return combined;
  }

  const [datePart, timePartRaw] = combined.includes("T")
    ? combined.split("T")
    : combined.split(" ");
  const timePart = timePartRaw.includes(":")
    ? timePartRaw
    : `${timePartRaw}:00`;
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (abs % 60).toString().padStart(2, "0");

  return `${datePart}T${timePart}${sign}${hours}:${minutes}`;
};

// --- TIPOS NECESARIOS ---

export type TimezoneLike = {
    id: string;
    name?: string | null;
    code?: string | null;
    offset: number;
};

type TimezoneGroup = "eastern" | "central" | "mountain" | "pacific" | "alaska" | "hawaii";

type PhotonSearchFeature = {
    geometry?: {
        coordinates?: [number, number];
    };
};

type PhotonSearchResponse = {
    features?: PhotonSearchFeature[];
};

type OpenMeteoTimezoneResponse = {
    timezone?: string;
    timezone_abbreviation?: string;
    utc_offset_seconds?: number;
};

// --- CONFIGURACIÓN DE ZONAS HORARIAS PARA DST (HORARIO DE VERANO) ---

const normalizeTimezoneToken = (value?: string | null) =>
    value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

const TIMEZONE_PROFILE_BY_GROUP: Record<
    TimezoneGroup,
    { stdCode: string; dstCode: string; stdOffset: number; dstOffset: number; observesDst: boolean }
> = {
    eastern: { stdCode: "est", dstCode: "edt", stdOffset: -300, dstOffset: -240, observesDst: true },
    central: { stdCode: "cst", dstCode: "cdt", stdOffset: -360, dstOffset: -300, observesDst: true },
    mountain: { stdCode: "mst", dstCode: "mdt", stdOffset: -420, dstOffset: -360, observesDst: true },
    pacific: { stdCode: "pst", dstCode: "pdt", stdOffset: -480, dstOffset: -420, observesDst: true },
    alaska: { stdCode: "akst", dstCode: "akdt", stdOffset: -540, dstOffset: -480, observesDst: true },
    hawaii: { stdCode: "hst", dstCode: "hdt", stdOffset: -600, dstOffset: -540, observesDst: false },
};

const getNthWeekdayOfMonth = (year: number, monthIndex: number, weekday: number, occurrence: number) => {
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const delta = (weekday - firstDay + 7) % 7;
    return 1 + delta + (occurrence - 1) * 7;
};

const parseDateForUsDst = (value?: string | null) => {
    if (!value) return null;
    const raw = value.trim();
    let year: number | null = null;
    let month: number | null = null;
    let day: number | null = null;

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        year = Number(isoMatch[1]);
        month = Number(isoMatch[2]);
        day = Number(isoMatch[3]);
    } else {
        const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (usMatch) {
            month = Number(usMatch[1]);
            day = Number(usMatch[2]);
            year = Number(usMatch[3]);
        } else {
            const extractedIso = extractDatePart(raw);
            if (extractedIso) {
                const match = extractedIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (match) {
                    year = Number(match[1]);
                    month = Number(match[2]);
                    day = Number(match[3]);
                }
            }
        }
    }

    if (!year || !month || !day) return null;
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    return { year, month, day };
};

// --- LÓGICA PRINCIPAL ---

export const resolveTimezoneIdByDate = (
    timezones: TimezoneLike[],
    dateValue?: string | null,
    sourceTimezoneId?: string | null
) => {
    const parsed = parseDateForUsDst(dateValue);
    if (!parsed || !timezones.length) return null;

    const sourceTimezone =
        (sourceTimezoneId ? timezones.find((tz) => tz.id === sourceTimezoneId) : null)
        ?? timezones.find((tz) => {
            const code = normalizeTimezoneToken(tz.code).replace(/\./g, "");
            const name = normalizeTimezoneToken(tz.name);
            return code === "pst" || code === "pdt" || name.includes("pacific") || name.includes("los angeles");
        })
        ?? null;
    if (!sourceTimezone) return null;

    const { year, month, day } = parsed;
    const secondSundayInMarch = getNthWeekdayOfMonth(year, 2, 0, 2);
    const firstSundayInNovember = getNthWeekdayOfMonth(year, 10, 0, 1);
    const currentDateUtc = Date.UTC(year, month - 1, day);
    const dstStartUtc = Date.UTC(year, 2, secondSundayInMarch);
    const dstEndUtc = Date.UTC(year, 10, firstSundayInNovember);
    const isDst = currentDateUtc >= dstStartUtc && currentDateUtc < dstEndUtc;

    const code = normalizeTimezoneToken(sourceTimezone.code).replace(/\./g, "");
    const name = normalizeTimezoneToken(sourceTimezone.name);
    const group = (() => {
        if (["est", "edt"].includes(code) || name.includes("eastern")) return "eastern";
        if (["cst", "cdt"].includes(code) || name.includes("central")) return "central";
        if (["mst", "mdt"].includes(code) || name.includes("mountain")) return "mountain";
        if (["pst", "pdt"].includes(code) || name.includes("pacific") || name.includes("los angeles")) return "pacific";
        if (["akst", "akdt"].includes(code) || name.includes("alaska")) return "alaska";
        if (["hst", "hdt"].includes(code) || name.includes("hawaii")) return "hawaii";
        return null;
    })();
    if (!group) return null;

    const profile = TIMEZONE_PROFILE_BY_GROUP[group];
    const shouldUseDst = profile.observesDst && isDst;
    const targetCode = shouldUseDst ? profile.dstCode : profile.stdCode;
    const targetOffset = shouldUseDst ? profile.dstOffset : profile.stdOffset;

    return (
        timezones.find((tz) => normalizeTimezoneToken(tz.code) === targetCode && tz.offset === targetOffset)?.id
        ?? timezones.find((tz) => normalizeTimezoneToken(tz.code) === targetCode)?.id
        ?? timezones.find((tz) => tz.offset === targetOffset)?.id
        ?? null
    );
};

export const getCoordinatesByCity = async (city: string, state?: string | null) => {
    const trimmedCity = city.trim();
    if (!trimmedCity) return null;

    const buildResult = (feature?: PhotonSearchFeature) => {
        const lng = feature?.geometry?.coordinates?.[0] ?? NaN;
        const lat = feature?.geometry?.coordinates?.[1] ?? NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
    };

    const primaryParams = new URLSearchParams({
        q: state?.trim() ? `${trimmedCity}, ${state.trim()}, United States` : `${trimmedCity}, United States`,
        limit: "1",
    });
    const primaryResponse = await fetch(`https://photon.komoot.io/api/?${primaryParams.toString()}`);
    if (primaryResponse.ok) {
        const primaryData = (await primaryResponse.json()) as PhotonSearchResponse;
        const primaryMatch = buildResult(primaryData.features?.[0]);
        if (primaryMatch) return primaryMatch;
    }

    const fallbackParams = new URLSearchParams({
        q: trimmedCity,
        limit: "1",
    });
    const fallbackResponse = await fetch(`https://photon.komoot.io/api/?${fallbackParams.toString()}`);
    if (!fallbackResponse.ok) return null;
    const fallbackData = (await fallbackResponse.json()) as PhotonSearchResponse;
    return buildResult(fallbackData.features?.[0]);
};

export const resolveTimezoneIdByCoordinates = async (timezones: TimezoneLike[], lat: number, lng: number) => {
    const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&timezone=auto`
    );
    if (!response.ok) return null;

    const data = (await response.json()) as OpenMeteoTimezoneResponse;
    const timezoneName = typeof data.timezone === "string" ? data.timezone : null;
    const timezoneAbbr = typeof data.timezone_abbreviation === "string" ? data.timezone_abbreviation : null;
    const utcOffsetSeconds = typeof data.utc_offset_seconds === "number" ? data.utc_offset_seconds : null;

    const normalizeToken = (value?: string | null) =>
        value ? value.toLowerCase().replace(/\s+/g, "").replace(/_/g, "") : null;

    const resolveRegionName = (iana?: string | null): string | null => {
        if (!iana) return null;
        const normalized = iana.toLowerCase();
        if (
            normalized.startsWith("america/new_york")
            || normalized.startsWith("america/detroit")
            || normalized.startsWith("america/indiana")
        ) return "eastern";
        if (normalized.startsWith("america/chicago")) return "central";
        if (normalized.startsWith("america/denver") || normalized.startsWith("america/boise")) return "mountain";
        if (normalized.startsWith("america/los_angeles")) return "pacific";
        if (normalized.startsWith("america/anchorage") || normalized.startsWith("america/juneau")) return "alaska";
        if (normalized.startsWith("pacific/honolulu")) return "hawaii-aleutian";
        return null;
    };

    const normalizedToken = normalizeToken(timezoneName);
    const normalizedAbbrToken = normalizeToken(timezoneAbbr);
    const offsetMinutes = utcOffsetSeconds !== null ? Math.round(utcOffsetSeconds / 60) : null;
    const regionName = resolveRegionName(timezoneName);

    const resolvedTimezone =
        (normalizedAbbrToken && offsetMinutes !== null
            ? timezones.find((tz) => normalizeToken(tz.code) === normalizedAbbrToken && tz.offset === offsetMinutes)
            : null)
        ?? (normalizedAbbrToken ? timezones.find((tz) => normalizeToken(tz.code) === normalizedAbbrToken) : null)
        ?? (normalizedToken ? timezones.find((tz) => normalizeToken(tz.name) === normalizedToken) : null)
        ?? (normalizedToken ? timezones.find((tz) => normalizeToken(tz.code) === normalizedToken) : null)
        ?? (
            regionName && offsetMinutes !== null
                ? timezones.find((tz) => normalizeToken(tz.name)?.startsWith(normalizeToken(regionName) || "") && tz.offset === offsetMinutes)
                : null
        )
        ?? (regionName ? timezones.find((tz) => normalizeToken(tz.name)?.startsWith(normalizeToken(regionName) || "")) : null)
        ?? (offsetMinutes !== null ? timezones.find((tz) => tz.offset === offsetMinutes) : null);

    return resolvedTimezone?.id ?? null;
};

// >>> ESTA ES LA FUNCIÓN PRINCIPAL EXPORTADA <<<
export const resolveTimezoneIdByCityAndDate = async (
    timezones: TimezoneLike[],
    city?: string | null,
    state?: string | null,
    dateValue?: string | null,
    sourceTimezoneId?: string | null
) => {
    if (!timezones.length) return null;
    if (!city?.trim()) return null;

    try {
        const coordinates = await getCoordinatesByCity(city, state);
        if (!coordinates) return null;
        
        const timezoneId = await resolveTimezoneIdByCoordinates(timezones, coordinates.lat, coordinates.lng);
        if (!timezoneId) return null;
        
        return resolveTimezoneIdByDate(timezones, dateValue, timezoneId ?? sourceTimezoneId ?? null);
    } catch {
        return null;
    }
};
