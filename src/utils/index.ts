export const themes: Record<"light" | "dark", string> = {
  light: "fantajia",
  dark: "bijinesu",
};

export const formatDate = (value: string | null) => {
  if (!value) return "-";
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
