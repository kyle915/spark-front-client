import { useEffect, useState } from "react";

/**
 * Spark v2 role mode — admin (Ignite team) vs client (brand stakeholder).
 *
 * Persists to localStorage so reloads stick. Listens for changes from
 * other tabs and from the SparkTopbar toggle. The mode gates:
 *  - Sidebar items: clients see Dashboard / My Requests / My Recaps /
 *    Reports / Inbox; admins see everything.
 *  - Internal-only UI: notes panel, "Routes to RMM" detail, asset
 *    shipping, etc. all hidden in client mode.
 *  - Page CTAs: "Bulk upload" / "Log event" / "Auto-rules" hidden for
 *    clients; "+ Submit a request" is the only admin-y action they see.
 */

export type SparkRole = "admin" | "client";

const KEY = "@spark.role";

const readRole = (): SparkRole =>
  (localStorage.getItem(KEY) as SparkRole | null) ?? "admin";

export function useSparkRole(): {
  role: SparkRole;
  isAdmin: boolean;
  isClient: boolean;
  setRole: (r: SparkRole) => void;
} {
  const [role, setRoleState] = useState<SparkRole>(readRole);

  useEffect(() => {
    const sync = () => setRoleState(readRole());
    // Same-tab listener — SparkTopbar dispatches this when toggled.
    window.addEventListener("spark:role-changed", sync);
    // Cross-tab listener.
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) sync();
    });
    return () => {
      window.removeEventListener("spark:role-changed", sync);
    };
  }, []);

  const setRole = (r: SparkRole) => {
    localStorage.setItem(KEY, r);
    setRoleState(r);
    window.dispatchEvent(new Event("spark:role-changed"));
  };

  return {
    role,
    isAdmin: role === "admin",
    isClient: role === "client",
    setRole,
  };
}

export default useSparkRole;
