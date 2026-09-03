import { createContext, useContext } from "react";

/**
 * True when the authenticated router already mounts the Spark chrome
 * (sidebar / topbar / PageTransition). Page-level `<Layout>` becomes a
 * passthrough so nav does not remount chrome or restart chat polling.
 */
export const LayoutShellContext = createContext(false);

export function useInLayoutShell(): boolean {
  return useContext(LayoutShellContext);
}
