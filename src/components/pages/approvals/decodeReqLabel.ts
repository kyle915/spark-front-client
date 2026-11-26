export const decodeReqLabel = (globalId: string): string => {
  try {
    const decoded = atob(globalId);
    const m = decoded.match(/:(\d+)$/);
    if (m) return `REQ-${m[1]}`;
  } catch {
    /* not base64 */
  }
  const cleaned = String(globalId).replace(/=+$/, "");
  return `REQ-${cleaned.slice(-4).toUpperCase()}`;
};
