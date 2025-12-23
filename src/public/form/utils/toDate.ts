export function dateFormat(value: string) {
  if (!value) return "";

  // ISO: YYYY-MM-DDTHH:mm:ss
  if (value.includes("T")) {
    return value.split("T")[0];
  }

  // Django: YYYY-MM-DD HH:mm:ss+TZ
  if (value.includes(" ")) {
    return value.split(" ")[0];
  }

  // Ya es YYYY-MM-DD
  return value;
}

const extractTime = (value?: string | null) => {
  if (!value) return undefined;

  // ISO datetime → YYYY-MM-DDTHH:mm:ss
  if (value.includes("T")) {
    return value.split("T")[1]?.slice(0, 5);
  }

  // Datetime con espacio → YYYY-MM-DD HH:mm:ss
  if (value.includes(" ")) {
    return value.split(" ")[1]?.slice(0, 5);
  }

  // HH:mm
  return value.slice(0, 5);
};

export const normalizeDateTime = (
  date?: string,
  time?: string | null
): string | undefined => {
  if (!date || !time) return undefined;

  const cleanTime = extractTime(time);
  if (!cleanTime) return undefined;

  return `${dateFormat(date)} ${cleanTime}:00`;
};
