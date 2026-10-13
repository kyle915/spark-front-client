import { useCallback, useEffect, useState } from "react";

export type BrandView = "brand" | "compare";

const readView = (): BrandView =>
  typeof window !== "undefined" &&
  window.location.hash.replace(/^#/, "").toLowerCase() === "compare"
    ? "compare"
    : "brand";

/** "This brand" vs "Compare brands", mirrored in the URL hash (#compare). */
export function useBrandView() {
  const [view, setView] = useState<BrandView>(readView);
  useEffect(() => {
    const onHash = () => setView(readView());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const choose = useCallback((next: BrandView) => {
    setView(next);
    const url = new URL(window.location.href);
    url.hash = next === "compare" ? "compare" : "";
    window.history.replaceState(null, "", url.toString());
  }, []);
  return { view, choose };
}
