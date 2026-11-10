import { useCallback } from "react";
import useSparkRole from "@/hooks/useSparkRole";
import { clientSafeBaName } from "@/utils/clientSafeBaName";

/**
 * Formatter for an ambassador's display name. Ignite staff see the full
 * name; brand (client) users see "First L." and never an email.
 */
export function useBaLabel(): (name: string | null | undefined) => string {
  const { isClient } = useSparkRole();
  return useCallback(
    (name: string | null | undefined) =>
      isClient ? clientSafeBaName(name) : (name ?? ""),
    [isClient],
  );
}

export default useBaLabel;
