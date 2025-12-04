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
