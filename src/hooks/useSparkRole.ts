import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/authStore";

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
 *
 * Auth-bound: non-Ignite users are forced into Client mode and cannot
 * toggle Admin. Ignite staff (@igniteproductions.co / spark-admin /
 * is_staff) keep the preview toggle.
 */

export type SparkRole = "admin" | "client";

const KEY = "@spark.role";

const IGNITE_EMAIL_RE = /@igniteproductions\.co$/i;

function emailGrantsIgniteAdmin(email: string | null | undefined): boolean {
  return Boolean(email && IGNITE_EMAIL_RE.test(email.trim()));
}

const readRole = (): SparkRole =>
  (localStorage.getItem(KEY) as SparkRole | null) ?? "admin";

export function useSparkRole(): {
  role: SparkRole;
  isAdmin: boolean;
  isClient: boolean;
  /** Ignite staff may preview Client mode; brand users may not toggle. */
  canToggleRole: boolean;
  setRole: (r: SparkRole) => void;
} {
  const user = useAuthStore((s) => s.user);
  const canToggleRole = useMemo(() => {
    const email = user?.email ?? "";
    const roleName = (user?.role?.name ?? "").toString().toLowerCase();
    if (emailGrantsIgniteAdmin(email)) return true;
    if (roleName.includes("spark") || roleName.includes("admin")) return true;
    return false;
  }, [user]);

  const [role, setRoleState] = useState<SparkRole>(() => {
    if (typeof window === "undefined") return "admin";
    // Brand users always start (and stay) in client chrome.
    const u = useAuthStore.getState().user;
    const email = u?.email;
    if (email && !emailGrantsIgniteAdmin(email)) {
      const roleName = (u?.role?.name ?? "").toString().toLowerCase();
      if (!roleName.includes("spark") && !roleName.includes("admin")) {
        return "client";
      }
    }
    return readRole();
  });

  useEffect(() => {
    if (!canToggleRole && role !== "client") {
      localStorage.setItem(KEY, "client");
      setRoleState("client");
      window.dispatchEvent(new Event("spark:role-changed"));
    }
  }, [canToggleRole, role]);

  useEffect(() => {
    const sync = () => {
      if (!canToggleRole) {
        setRoleState("client");
        return;
      }
      setRoleState(readRole());
    };
    window.addEventListener("spark:role-changed", sync);
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) sync();
    });
    return () => {
      window.removeEventListener("spark:role-changed", sync);
    };
  }, [canToggleRole]);

  const setRole = (r: SparkRole) => {
    if (!canToggleRole && r !== "client") return;
    localStorage.setItem(KEY, r);
    setRoleState(r);
    window.dispatchEvent(new Event("spark:role-changed"));
  };

  const effective: SparkRole = canToggleRole ? role : "client";

  return {
    role: effective,
    isAdmin: effective === "admin",
    isClient: effective === "client",
    canToggleRole,
    setRole,
  };
}

export default useSparkRole;
