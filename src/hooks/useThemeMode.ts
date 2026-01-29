import { useLayoutEffect, useState } from "react";

const LIGHT = "fantajia";
const DARK = "bijinesu";

const getIsDark = () => {
  if (typeof window === "undefined") return false;
  const root = document.documentElement;
  const dataTheme = root.getAttribute("data-theme");
  if (dataTheme) {
    if (dataTheme === "dark") return true;
    if (dataTheme === "light") return false;
    return dataTheme === DARK;
  }

  const stored = localStorage.getItem("@theme");
  if (stored) return stored === DARK;

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

export function useThemeMode() {
  const [isDark, setIsDark] = useState(getIsDark);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!root.getAttribute("data-theme")) {
      const stored = localStorage.getItem("@theme");
      if (stored === DARK || stored === LIGHT) {
        root.setAttribute("data-theme", stored);
      }
    }

    const observer = new MutationObserver(() => {
      setIsDark(getIsDark());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const nextIsDark = !isDark;
    const nextTheme = nextIsDark ? DARK : LIGHT;
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("@theme", nextTheme);
    setIsDark(nextIsDark);
  };

  return [isDark, toggleTheme] as const;
}
