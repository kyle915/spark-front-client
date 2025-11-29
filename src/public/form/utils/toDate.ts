function dateFormat(isoString: string) {
  if (!isoString) return "";
  return isoString.split("T")[0];
}

export { dateFormat };
