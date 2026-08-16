import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router";
import {
  jumpOriginCss,
  jumpOriginFromEvent,
  type JumpOrigin,
} from "@/motion/opsMotion";
import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { AmbassadorsListQuery } from "@/api/queries/AmbassadorsListQuery";
import type { AmbassadorsListQuery as AmbassadorsListQueryType } from "@api/queries/__generated__/AmbassadorsListQuery.graphql";
import { RequestSearchQuery } from "@/api/queries/RequestSearchQuery";
import type { RequestSearchQuery as RequestSearchQueryType } from "@api/queries/__generated__/RequestSearchQuery.graphql";
import { RecapsSearchQuery } from "@/api/queries/RecapsSearchQuery";
import type { RecapsSearchQuery as RecapsSearchQueryType } from "@api/queries/__generated__/RecapsSearchQuery.graphql";
import {
  LayoutDashboard,
  ListChecks,
  Calendar,
  MapPin,
  CheckCircle2,
  Hammer,
  Users,
  FileText,
  BarChart3,
  Mail,
  Bell,
  Settings,
  Plus,
  Star,
  CalendarClock,
  Clock,
  AlertCircle,
  Sun,
} from "lucide-react";
import useSparkRole from "@/hooks/useSparkRole";

/**
 * Spark v2 — Command Palette (⌘K).
 *
 * Apple Spotlight pattern. Press ⌘K (or Ctrl+K) anywhere to open a fuzzy
 * search modal that jumps to any route.
 *
 * Entries are static for v1; we'll layer in dynamic entries (tenant
 * switcher, recent recaps, specific requests by ID) as follow-ups.
 */

type CommandEntry = {
  id: string;
  label: string;
  hint: string;
  to: string;
  clientTo?: string;
  adminOnly?: boolean;
  Icon: React.ComponentType<{
    size?: number;
    className?: string;
    style?: React.CSSProperties;
  }>;
  keywords?: string;
};

const ENTRIES: CommandEntry[] = [
  { id: "dashboard", label: "Dashboard", hint: "Today · due recaps · clock", to: "/", clientTo: "/client-dashboard", Icon: LayoutDashboard, keywords: "home overview work" },
  { id: "recaps-due", label: "Recaps due", hint: "Events with no recap filed", to: "/recaps/missing", Icon: FileText, keywords: "due inbox review queue missing", adminOnly: true },
  { id: "recaps-missing", label: "Missing recaps", hint: "Events with no recap filed", to: "/recaps/missing", Icon: AlertCircle, keywords: "missing due file", adminOnly: true },
  { id: "today", label: "Today", hint: "On the ground", to: "/today", Icon: Sun, keywords: "today map live field" },
  { id: "clock", label: "On the clock", hint: "Who's working now", to: "/live-board", Icon: Clock, keywords: "clock timesheet live board", adminOnly: true },
  { id: "tracker", label: "Master Tracker", hint: "All events, every status", to: "/requests/list", Icon: ListChecks, keywords: "events list table due" },
  { id: "calendar", label: "Calendar", hint: "Shifts board", to: "/connect-calendar", Icon: Calendar, keywords: "schedule shifts" },
  { id: "map", label: "Account Map", hint: "Venues by status", to: "/account-map", Icon: MapPin, keywords: "map accounts retailers" },
  { id: "approvals", label: "Approvals", hint: "Review pending requests", to: "/approvals", clientTo: "/my-approvals", Icon: CheckCircle2, keywords: "pending review approve" },
  { id: "jobs", label: "Jobs", hint: "Open + filling roles", to: "/jobs", Icon: Hammer, keywords: "ba shifts hire", adminOnly: true },
  { id: "talent", label: "Search Talent", hint: "BA roster", to: "/talent", Icon: Users, keywords: "ba ambassador roster", adminOnly: true },
  { id: "recaps", label: "Recaps", hint: "Jump to a recap", to: "/recaps/list", Icon: FileText, keywords: "reports recap photos jump" },
  { id: "recaps-needs-review", label: "Needs review", hint: "Recaps awaiting approval", to: "/recaps/list?status=needs_review", Icon: FileText, keywords: "needs review recaps filter", adminOnly: true },
  { id: "recaps-this-week", label: "This week", hint: "Recaps from the last 7 days", to: "/recaps/list?range=week", Icon: Calendar, keywords: "this week recaps filter" },
  { id: "templates", label: "Recap Templates", hint: "Custom recap shapes", to: "/recaps/templates", Icon: Star, keywords: "templates", adminOnly: true },
  { id: "reports", label: "Reports", hint: "Analytics dashboards", to: "/reports", Icon: BarChart3, keywords: "analytics charts" },
  { id: "inbox", label: "Inbox", hint: "Messages with BAs", to: "/inbox", Icon: Mail, keywords: "messages chat" },
  { id: "alerts", label: "Alerts", hint: "Notifications feed", to: "/alerts", Icon: Bell, keywords: "notifications" },
  { id: "settings", label: "Settings", hint: "Workspace + integrations", to: "/settings", Icon: Settings, keywords: "preferences workspace" },
  { id: "cal-sync", label: "Calendar Sync", hint: "Google Calendar integration", to: "/settings/calendar", Icon: CalendarClock, keywords: "google sync" },
  { id: "create", label: "Create Request", hint: "Submit a new request", to: "/requests/create", Icon: Plus, keywords: "new request submit", adminOnly: true },
];

const score = (entry: CommandEntry, q: string) => {
  if (!q) return 1;
  const target = `${entry.label} ${entry.hint} ${entry.keywords ?? ""}`.toLowerCase();
  if (target.includes(q)) return 2;
  // basic letter-by-letter fuzzy
  let i = 0;
  for (const c of target) {
    if (c === q[i]) i++;
    if (i === q.length) return 1;
  }
  return 0;
};

export const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const { isClient } = useSparkRole();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [origin, setOrigin] = useState<JumpOrigin | null>(null);
  const [ghostQuery, setGhostQuery] = useState("");
  const prevQuery = useRef("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOrigin(jumpOriginFromEvent(e));
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = (e: Event) => {
      setOrigin(jumpOriginFromEvent(e));
      setOpen(true);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("spark:open-jump", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("spark:open-jump", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Live ambassador search — fires for 2+ chars, debounced, best-effort
  // (a failed fetch just means no BA rows; page entries still work).
  // Results become ordinary CommandEntry rows appended after the page
  // matches, so the existing keyboard navigation needs no changes.
  const [baEntries, setBaEntries] = useState<CommandEntry[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setBaEntries([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      fetchQuery<AmbassadorsListQueryType>(
        environment,
        AmbassadorsListQuery,
        { filters: { name: q }, first: 6 },
      )
        .toPromise()
        .then((data) => {
          if (cancelled) return;
          const rows = (data?.ambassadors?.edges ?? [])
            .map((e) => e?.node)
            .filter((n): n is NonNullable<typeof n> => Boolean(n))
            .map((n) => {
              const name = [n.user?.firstName, n.user?.lastName]
                .filter(Boolean)
                .join(" ")
                .trim();
              return {
                id: `ba-${n.uuid}`,
                label: name || n.user?.email || "Ambassador",
                hint: `Ambassador · ${n.user?.email ?? ""}`,
                to: `/ba/${n.uuid}`,
                Icon: Users,
              } as CommandEntry;
            });
          setBaEntries(rows);
        })
        .catch(() => {
          if (!cancelled) setBaEntries([]);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, query]);

  // Live request search — same debounce contract as the BA search above.
  // filters.name matches the request's name OR its retailer server-side.
  const [requestEntries, setRequestEntries] = useState<CommandEntry[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setRequestEntries([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      fetchQuery<RequestSearchQueryType>(environment, RequestSearchQuery, {
        filters: { name: q },
        first: 6,
      })
        .toPromise()
        .then((data) => {
          if (cancelled) return;
          const rows = (data?.requests?.edges ?? [])
            .map((e) => e?.node)
            .filter((n): n is NonNullable<typeof n> => Boolean(n))
            .map((n) => {
              const when = n.date
                ? new Date(n.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                : "";
              return {
                id: `req-${n.uuid}`,
                label: n.name || "Request",
                hint: ["Request", n.retailer?.name, when]
                  .filter(Boolean)
                  .join(" · "),
                to: `/request/view/${n.uuid}`,
                Icon: FileText,
              } as CommandEntry;
            });
          setRequestEntries(rows);
        })
        .catch(() => {
          if (!cancelled) setRequestEntries([]);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, query]);

  // Live recap search — covers BOTH recap families (legacy fixed-form
  // and per-tenant custom templates) in one round trip, so a Borjomi
  // custom recap is as findable as a Liquid Death legacy one. Same
  // debounce/best-effort contract as the searches above.
  const [recapEntries, setRecapEntries] = useState<CommandEntry[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setRecapEntries([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      fetchQuery<RecapsSearchQueryType>(environment, RecapsSearchQuery, {
        q,
        first: 4,
      })
        .toPromise()
        .then((data) => {
          if (cancelled) return;
          const fmt = (d: string | null | undefined) =>
            d
              ? new Date(d).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "";
          const legacy = (data?.recaps?.edges ?? [])
            .map((e) => e?.node)
            .filter((n): n is NonNullable<typeof n> => Boolean(n))
            .map(
              (n) =>
                ({
                  id: `recap-${n.uuid}`,
                  label: n.name || "Recap",
                  hint: [
                    "Recap",
                    n.approved ? "APPROVED" : "DRAFT",
                    fmt(n.event?.date),
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  to: `/recap/view/${n.uuid}`,
                  Icon: CheckCircle2,
                }) as CommandEntry,
            );
          const custom = (data?.customRecaps?.edges ?? [])
            .map((e) => e?.node)
            .filter((n): n is NonNullable<typeof n> => Boolean(n))
            .map(
              (n) =>
                ({
                  id: `crecap-${n.uuid}`,
                  label: n.name || "Recap",
                  hint: [
                    "Recap",
                    n.approved ? "APPROVED" : "DRAFT",
                    fmt(n.event?.date),
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  to: `/recap/view-custom/${n.uuid}`,
                  Icon: CheckCircle2,
                }) as CommandEntry,
            );
          setRecapEntries([...legacy, ...custom]);
        })
        .catch(() => {
          if (!cancelled) setRecapEntries([]);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, query]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const visible = ENTRIES.filter((e) => !(isClient && e.adminOnly)).map(
      (e) =>
        isClient && e.clientTo
          ? { ...e, to: e.clientTo }
          : e,
    );
    const pages = visible
      .map((e) => ({ entry: e, s: score(e, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.entry);
    return [...pages, ...requestEntries, ...recapEntries, ...baEntries];
  }, [query, baEntries, requestEntries, recapEntries, isClient]);

  const select = (entry: CommandEntry) => {
    navigate(entry.to);
    setOpen(false);
  };

  const onKey: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) select(filtered[active]);
    }
  };

  useEffect(() => {
    if (query === "" && prevQuery.current) {
      setGhostQuery(prevQuery.current);
      const t = window.setTimeout(() => setGhostQuery(""), 220);
      prevQuery.current = query;
      return () => window.clearTimeout(t);
    }
    prevQuery.current = query;
    if (query) setGhostQuery("");
  }, [query]);

  return (
    <AnimatePresence>
      {open ? (
    <motion.div
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
      style={{
        background: "rgba(10,13,9,0.55)",
        backdropFilter: "blur(8px)",
        transformOrigin: jumpOriginCss(origin),
      }}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl overflow-hidden relative"
        style={{
          background:
            "linear-gradient(180deg, var(--spark-surface), var(--spark-surface-2))",
          border: "1px solid var(--spark-border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          placeholder="Jump to a recap, a screen, or search…"
          className="w-full text-base"
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--spark-text)",
            padding: "1rem 1.25rem",
            fontFamily: "Space Grotesk, sans-serif",
          }}
        />
        {ghostQuery ? (
          <span className="spark-ops-query-ghost" aria-hidden>
            {ghostQuery}
          </span>
        ) : null}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        />
        <div
          className="max-h-[60vh] overflow-y-auto p-2 hide-scroll"
          style={{ scrollbarWidth: "none" }}
        >
          {filtered.length === 0 && (
            <p
              className="px-4 py-6 text-center text-sm"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              No matches.
            </p>
          )}
          {filtered.map((entry, i) => {
            const on = i === active;
            const Icon = entry.Icon;
            return (
              <motion.button
                key={entry.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => select(entry)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.16,
                  delay: Math.min(i * 0.028, 0.16),
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{
                  background: on
                    ? "rgba(197,245,70,0.08)"
                    : "transparent",
                  color: on ? "var(--spark-lime)" : "var(--spark-text)",
                }}
              >
                <Icon
                  size={16}
                  className="shrink-0"
                  style={{
                    color: on
                      ? "var(--spark-lime)"
                      : "rgba(255,255,255,0.55)",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {entry.label}
                  </p>
                  <p
                    className="mono text-[10px] truncate"
                    style={{
                      letterSpacing: "0.14em",
                      color: on
                        ? "rgba(197,245,70,0.65)"
                        : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {entry.hint.toUpperCase()}
                  </p>
                </div>
                {on && (
                  <span
                    className="mono text-[10px] shrink-0"
                    style={{
                      letterSpacing: "0.14em",
                      color: "var(--spark-lime)",
                    }}
                  >
                    ↵ OPEN
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            ↑↓ NAVIGATE · ↵ OPEN · ESC CLOSE
          </p>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.14em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            ⌘K
          </p>
        </div>
      </div>
    </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default CommandPalette;
