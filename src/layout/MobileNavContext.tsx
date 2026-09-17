import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";

const COLLAPSE_KEY = "spark-sidebar-collapsed";

type MobileNavContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** Desktop icon-rail collapse (md+). Independent of mobile drawer. */
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
};

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsedState] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setCollapsedState(readCollapsed());
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle,
      collapsed,
      setCollapsed,
      toggleCollapsed,
    }),
    [open, toggle, collapsed, setCollapsed, toggleCollapsed],
  );

  return (
    <MobileNavContext.Provider value={value}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav(): MobileNavContextValue {
  const ctx = useContext(MobileNavContext);
  if (!ctx) {
    return {
      open: false,
      setOpen: () => undefined,
      toggle: () => undefined,
      collapsed: false,
      setCollapsed: () => undefined,
      toggleCollapsed: () => undefined,
    };
  }
  return ctx;
}
