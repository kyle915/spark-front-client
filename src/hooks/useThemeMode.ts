import { useLayoutEffect, useState } from "react";

const LIGHT = "fantajia";
const DARK = "bijinesu";

export function useThemeMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === DARK) return true;
      if (saved === LIGHT) return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  // effect to sync theme changes for charts (dashboard)
  useLayoutEffect(() => {
    const theme = isDark ? DARK : LIGHT;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [isDark]);

  useLayoutEffect(() => {
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute("data-theme");
      const currentlyDark = theme === DARK;
      setIsDark(currentlyDark);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => setIsDark((prev) => !prev);

  return [isDark, toggleTheme] as const;
}
