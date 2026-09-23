import { useEffect, useState } from "react";

const KEY = "spark.dashboard.program";
const EVENT = "spark-dashboard-program";

export type DashboardProgram = "retail" | "field";

function readProgram(): DashboardProgram {
  try {
    return sessionStorage.getItem(KEY) === "field" ? "field" : "retail";
  } catch {
    return "retail";
  }
}

/** Shared Retail sampling / Field marketing choice for Torch dashboards. */
export function useDashboardProgram(enabled: boolean): {
  program: DashboardProgram;
  choose: (next: DashboardProgram) => void;
} {
  const [program, setProgram] = useState<DashboardProgram>("retail");

  useEffect(() => {
    if (!enabled) return;
    setProgram(readProgram());
    const sync = () => setProgram(readProgram());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, [enabled]);

  const choose = (next: DashboardProgram) => {
    setProgram(next);
    try {
      sessionStorage.setItem(KEY, next);
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return { program: enabled ? program : "retail", choose };
}
