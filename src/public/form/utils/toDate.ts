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
