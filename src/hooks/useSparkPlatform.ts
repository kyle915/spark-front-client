import { useEffect, useState } from "react";

/**
 * Desktop / Mobile preview toggle. Persists to localStorage and notifies
 * the layout so the chrome actually changes — the topbar used to write
 * `@spark.platform` and nothing read it.
 */

export type SparkPlatform = "desktop" | "mobile";

const KEY = "@spark.platform";

const readPlatform = (): SparkPlatform =>
  (localStorage.getItem(KEY) as SparkPlatform | null) ?? "desktop";

export function useSparkPlatform(): {
  platform: SparkPlatform;
  isMobile: boolean;
  setPlatform: (p: SparkPlatform) => void;
} {
  const [platform, setPlatformState] = useState<SparkPlatform>(readPlatform);

  useEffect(() => {
    const sync = () => setPlatformState(readPlatform());
    window.addEventListener("spark:platform-changed", sync);
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) sync();
    });
    return () => {
      window.removeEventListener("spark:platform-changed", sync);
    };
  }, []);

  const setPlatform = (p: SparkPlatform) => {
    localStorage.setItem(KEY, p);
    setPlatformState(p);
    window.dispatchEvent(new Event("spark:platform-changed"));
  };

  return {
    platform,
    isMobile: platform === "mobile",
    setPlatform,
  };
}

export default useSparkPlatform;
