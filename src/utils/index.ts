export const themes: Record<"light" | "dark", string> = {
  light: "fantajia",
  dark: "bijinesu",
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
