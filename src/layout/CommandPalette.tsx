import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router";
import {
  SPARK_SPRING_DURATION_S,
  SPARK_SPRING_EASE,
  jumpOriginCss,
  jumpOriginFromEvent,
  type JumpOrigin,
} from "@/motion/opsMotion";
import { fetchQuery } from "relay-runtime";
import environment from "@/api/relay/environment";
import { JumpSearchQuery } from "@/api/queries/JumpSearchQuery";
import type { JumpSearchQuery as JumpSearchQueryType } from "@api/queries/__generated__/JumpSearchQuery.graphql";
import {
  ArrowLeftRight,
  Building2,
  LayoutDashboard,
  Link2,
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
  QrCode,
  Star,
  CalendarClock,
  Clock,
  AlertCircle,
  Sun,
  Store,
} from "lucide-react";
import { showsMissingRecaps } from "@/field/missingRecaps";
import { fetchSwitchableTenants } from "@/hooks/useAdoptRecordTenant";
import useSparkRole from "@/hooks/useSparkRole";
import type { SwitchableTenant } from "@/lib/tenantDeepLink";
import { storeHref } from "@/lib/storeProfile";
import { padIndex } from "@/shared/sparkStat";
import { useAlertStore } from "@/store/alertStore";
import { useAuthStore } from "@/store/authStore";
import { checkinUrl, sparkFormUrl } from "@/utils/publicHosts";
import {
  JUMP_GROUP_LABEL,
  JUMP_GROUP_ORDER,
  jumpGroupOf,
  loadJumpRecents,
  rememberJumpRecent,
  type JumpRecent,
} from "./jumpRecents";
import { tenantMatchesQuery } from "./tenantPickerPrefs";
import { switchWorkspace } from "./workspaceSwitch";

/**
 * Spark v2 — Command Palette (⌘K).
 *
 * Batched single-query Jump search (`JumpSearchQuery`) + executable workspace
 * actions (zero-reload client switch, copy standing check-in link, copy public
 * request link, new request at store) + direct `/store/:storeKey` and
 * `/talent?ba=:uuid` routing.
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
  state?: { clientName?: string; clientEmail?: string };
  actionBadge?: string;
  run?: () => void | Promise<void>;
};

const ENTRIES: CommandEntry[] = [
  { id: "dashboard", label: "Dashboard", hint: "Ops pulse · pace · program KPIs", to: "/", clientTo: "/client-dashboard", Icon: LayoutDashboard, keywords: "home overview work insights kpis analytics" },
  { id: "recaps-missing", label: "Missing recaps", hint: "Events with no recap filed", to: "/recaps/missing", Icon: AlertCircle, keywords: "missing due file recaps due", adminOnly: true },
  { id: "today", label: "Today", hint: "On the ground", to: "/today", Icon: Sun, keywords: "today map live field" },
  { id: "clock", label: "On the clock", hint: "Who's working now", to: "/live-board", Icon: Clock, keywords: "clock timesheet live board", adminOnly: true },
  { id: "tracker", label: "Master Tracker", hint: "All events, every status", to: "/requests/list", Icon: ListChecks, keywords: "events list table due" },
  { id: "calendar", label: "Calendar", hint: "Shifts board", to: "/connect-calendar", Icon: Calendar, keywords: "schedule shifts" },
  { id: "map", label: "Account Map", hint: "Venues by status", to: "/account-map", Icon: MapPin, keywords: "map accounts retailers" },
  { id: "store-names", label: "Store names", hint: "Combine spellings of one store", to: "/catalogs/store-names", Icon: Store, keywords: "store names retailers duplicates spelling alias combine", adminOnly: true },
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
  { id: "upcoming", label: "Upcoming", hint: "Next 7 days of events", to: "/upcoming", Icon: Calendar, keywords: "upcoming next week schedule events" },
  { id: "staffing", label: "Staffing Board", hint: "Who's on which shift this week", to: "/schedule", Icon: Users, keywords: "staffing board schedule assign shifts unstaffed", adminOnly: true },
  { id: "timesheet", label: "Timesheet", hint: "Approve hours · mark paid", to: "/timesheet", Icon: Clock, keywords: "timesheet payroll hours approve pay period", adminOnly: true },
  { id: "payroll", label: "Payroll · Hours", hint: "Wingspan pay cycles", to: "/payroll", Icon: Clock, keywords: "payroll wingspan pay cycles", adminOnly: true },
  { id: "receipts", label: "Receipts", hint: "Product spend + receipts", to: "/receipts", Icon: FileText, keywords: "receipts spend expenses reimbursements", adminOnly: true },
  { id: "walkups", label: "Walk-ups", hint: "Walk-up clock-ins to confirm", to: "/walkups", Icon: CheckCircle2, keywords: "walk-ups walkups check-in links confirm", adminOnly: true },
  { id: "people", label: "People", hint: "Admins, clients, ambassadors", to: "/people", Icon: Users, keywords: "people team users invite", adminOnly: true },
  { id: "chat", label: "Chat", hint: "Team chat", to: "/chat", Icon: Mail, keywords: "chat messages", adminOnly: true },
  { id: "clients", label: "Clients", hint: "Brand workspaces", to: "/clients", Icon: Building2, keywords: "clients brands tenants workspaces", adminOnly: true },
  { id: "plans", label: "Plans", hint: "Program plans", to: "/plans", Icon: ListChecks, keywords: "plans programs" },
  { id: "create", label: "Create Request", hint: "Submit a new request for the current tenant", to: "/requests/create", Icon: Plus, keywords: "new request submit" },
];

const score = (entry: CommandEntry, q: string) => {
  if (!q) return 1;
  const target = `${entry.label} ${entry.hint} ${entry.keywords ?? ""}`.toLowerCase();
  if (target.includes(q)) return 2;
  let i = 0;
  for (const c of target) {
    if (c === q[i]) i++;
    if (i === q.length) return 1;
  }
  return 0;
};

const formatShortDate = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const parsed = new Date(raw.length === 10 ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

async function copyLinkToClipboard(url: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    useAlertStore.getState().showAlert(successMessage, "success");
  } catch {
    useAlertStore.getState().showAlert(url, "info");
  }
}

type SearchBuckets = {
  recaps: CommandEntry[];
  events: CommandEntry[];
  stores: CommandEntry[];
  storeRequestActions: CommandEntry[];
  requests: CommandEntry[];
  clients: CommandEntry[];
  people: CommandEntry[];
};

const EMPTY_BUCKETS: SearchBuckets = {
  recaps: [],
  events: [],
  stores: [],
  storeRequestActions: [],
  requests: [],
  clients: [],
  people: [],
};

export const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isClient } = useSparkRole();
  const { user, tenantId, tenantUuid, tenantSlug, tenantMeta } = useAuthStore();
  const missingRecapsOn = showsMissingRecaps(
    tenantSlug,
    tenantMeta?.requestUrlName,
  );
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

  const [recents, setRecents] = useState<JumpRecent[]>([]);
  useEffect(() => {
    if (open) setRecents(loadJumpRecents());
  }, [open]);

  // Switchable tenants (served from Relay store when TenantPicker already loaded).
  const [tenants, setTenants] = useState<SwitchableTenant[]>([]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchSwitchableTenants(environment, user?.uuid)
      .then((list) => {
        if (!cancelled) setTenants(list);
      })
      .catch(() => {
        if (!cancelled) setTenants([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, user?.uuid]);

  // Single composite GraphQL search replacing 6 parallel queries per keystroke.
  const [searchBuckets, setSearchBuckets] = useState<SearchBuckets>(EMPTY_BUCKETS);
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setSearchBuckets(EMPTY_BUCKETS);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchQuery<JumpSearchQueryType>(environment, JumpSearchQuery, {
        q,
        tenantId: tenantId || null,
        first: 6,
      })
        .toPromise()
        .then((data) => {
          if (cancelled) return;
          const payload = data?.jumpSearch;
          if (!payload) {
            setSearchBuckets(EMPTY_BUCKETS);
            return;
          }

          const recaps: CommandEntry[] = payload.recaps.map((r) => ({
            id: r.kind === "custom" ? `crecap-${r.uuid}` : `recap-${r.uuid}`,
            label: r.name || "Recap",
            hint: [
              "Recap",
              r.approved ? "APPROVED" : "DRAFT",
              formatShortDate(r.eventDate),
            ]
              .filter(Boolean)
              .join(" · "),
            to:
              r.kind === "custom"
                ? `/recap/view-custom/${r.uuid}`
                : `/recap/view/${r.uuid}`,
            Icon: CheckCircle2,
          }));

          const events: CommandEntry[] = payload.events.map((ev) => ({
            id: `event-${ev.uuid}`,
            label: ev.name || "Event",
            hint: [
              "Event",
              (ev.address || ev.retailerName || "").trim(),
              formatShortDate(ev.date),
            ]
              .filter(Boolean)
              .join(" · "),
            to: `/event/view/${ev.uuid}`,
            Icon: Calendar,
          }));

          const stores: CommandEntry[] = payload.stores.map((s) => {
            const directHref = storeHref(s.storeKey);
            const fallbackParams = new URLSearchParams({ q: s.name || "" });
            const where =
              s.address || [s.city, s.state].filter(Boolean).join(", ");
            return {
              id: `store-${s.key}`,
              label: s.name || "Store",
              hint: [directHref ? "Store profile" : "Store", where]
                .filter(Boolean)
                .join(" · "),
              to: directHref ?? `/account-map?${fallbackParams.toString()}`,
              Icon: Store,
            };
          });

          const storeRequestActions: CommandEntry[] = payload.stores
            .slice(0, 3)
            .map((s) => {
              const reqParams = new URLSearchParams({ venue: s.name });
              if (s.address) reqParams.set("address", s.address);
              const where =
                s.address || [s.city, s.state].filter(Boolean).join(", ");
              return {
                id: `action-new-req-${s.key}`,
                label: `New request at ${s.name}`,
                hint: ["Action · Prefill request", where]
                  .filter(Boolean)
                  .join(" · "),
                to: `/requests/create?${reqParams.toString()}`,
                Icon: Plus,
                actionBadge: "↵ CREATE",
              };
            });

          const requests: CommandEntry[] = payload.requests.map((req) => ({
            id: `req-${req.uuid}`,
            label: req.name || "Request",
            hint: ["Request", req.retailerName, formatShortDate(req.date)]
              .filter(Boolean)
              .join(" · "),
            to: `/request/view/${req.uuid}`,
            Icon: FileText,
          }));

          const clients: CommandEntry[] = isClient
            ? []
            : payload.clients.map((c) => ({
                id: `client-${c.uuid}`,
                label: c.name || "Client",
                hint: ["Client", c.tenantName, c.email]
                  .filter(Boolean)
                  .join(" · "),
                to: c.tenantUuid ? `/clients/${c.tenantUuid}` : "/clients",
                state: {
                  clientName: c.name ?? "",
                  clientEmail: c.email ?? "",
                },
                Icon: Building2,
              }));

          const people: CommandEntry[] = isClient
            ? []
            : payload.ambassadors.map((ba) => ({
                id: `ba-${ba.uuid}`,
                label: ba.name || ba.email || "Ambassador",
                hint: ["Ambassador", ba.email].filter(Boolean).join(" · "),
                to: `/talent?ba=${encodeURIComponent(ba.uuid)}`,
                Icon: Users,
              }));

          setSearchBuckets({
            recaps,
            events,
            stores,
            storeRequestActions,
            requests,
            clients,
            people,
          });
        })
        .catch(() => {
          if (!cancelled) setSearchBuckets(EMPTY_BUCKETS);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query, tenantId, isClient]);

  const activeTenantNode = useMemo(
    () => tenants.find((t) => t.uuid === tenantUuid) ?? null,
    [tenants, tenantUuid],
  );
  const activeCheckinCode = (
    tenantMeta?.checkinCode ??
    activeTenantNode?.checkinCode ??
    ""
  ).trim();
  const activeRequestSlug = (
    tenantMeta?.requestUrlName ??
    activeTenantNode?.requestUrlName ??
    ""
  ).trim();

  const actionEntries = useMemo(() => {
    const q = query.toLowerCase().trim();
    const out: CommandEntry[] = [];

    if (activeCheckinCode) {
      const url = checkinUrl(activeCheckinCode);
      const entry: CommandEntry = {
        id: "action-copy-checkin-link",
        label: "Copy standing check-in link",
        hint: `Action · ${url}`,
        to: "",
        Icon: QrCode,
        keywords: "copy standing check-in checkin link walkup qr ba",
        actionBadge: "↵ COPY",
        run: () => copyLinkToClipboard(url, "Copied standing check-in link."),
      };
      if (!q || score(entry, q) > 0) out.push(entry);
    }

    if (activeRequestSlug) {
      const url = sparkFormUrl(activeRequestSlug);
      const entry: CommandEntry = {
        id: "action-copy-public-request-link",
        label: "Copy public request link",
        hint: `Action · ${url}`,
        to: "",
        Icon: Link2,
        keywords: "copy public request link spark-form external form url",
        actionBadge: "↵ COPY",
        run: () => copyLinkToClipboard(url, "Copied public request link."),
      };
      if (!q || score(entry, q) > 0) out.push(entry);
    }

    if (q.length >= 2 && tenants.length > 1) {
      const strippedSwitchQuery = q
        .replace(/^(switch(?:\s+client|\s+to)?|client:?|workspace:?)\s*/i, "")
        .trim();
      const matchedTenants = tenants
        .filter((t) => t.uuid !== tenantUuid && Boolean(t.name))
        .filter((t) => {
          if (strippedSwitchQuery && tenantMatchesQuery(t, strippedSwitchQuery)) {
            return true;
          }
          return tenantMatchesQuery(t, q);
        })
        .slice(0, 5);

      for (const t of matchedTenants) {
        out.push({
          id: `action-switch-client-${t.uuid}`,
          label: `Switch client: ${t.name}`,
          hint: [
            "Action · Instant workspace switch",
            t.tenantSlug || t.requestUrlName,
          ]
            .filter(Boolean)
            .join(" · "),
          to: "",
          Icon: ArrowLeftRight,
          keywords: `switch client workspace ${t.name ?? ""} ${t.tenantSlug ?? ""}`,
          actionBadge: "↵ SWITCH",
          run: () => {
            switchWorkspace(t, {
              pathname: location.pathname,
              search: location.search,
              hash: location.hash,
              isClient,
              navigate,
            });
          },
        });
      }
    }

    return [...out, ...searchBuckets.storeRequestActions];
  }, [
    query,
    activeCheckinCode,
    activeRequestSlug,
    tenants,
    tenantUuid,
    location.pathname,
    location.search,
    location.hash,
    isClient,
    navigate,
    searchBuckets.storeRequestActions,
  ]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const visible = ENTRIES.filter(
      (e) =>
        !(isClient && e.adminOnly) &&
        !(e.id === "recaps-missing" && !missingRecapsOn),
    ).map((e) =>
      isClient && e.clientTo ? { ...e, to: e.clientTo } : e,
    );
    const pages = visible
      .map((e) => ({ entry: e, s: score(e, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.entry);
    const recentEntries: CommandEntry[] = recents
      .filter((row) => {
        if (!q) return true;
        return `${row.label} ${row.hint} ${row.to}`.toLowerCase().includes(q);
      })
      .map((row) => ({
        id: row.id.startsWith("recent-") ? row.id : `recent-${row.id}`,
        label: row.label,
        hint: row.hint,
        to: row.to,
        Icon: Clock,
      }));
    return [
      ...recentEntries,
      ...actionEntries,
      ...searchBuckets.recaps,
      ...searchBuckets.events,
      ...searchBuckets.stores,
      ...searchBuckets.requests,
      ...searchBuckets.clients,
      ...searchBuckets.people,
      ...pages,
    ];
  }, [
    query,
    actionEntries,
    searchBuckets,
    recents,
    isClient,
    missingRecapsOn,
  ]);

  const grouped = useMemo(
    () =>
      JUMP_GROUP_ORDER.map((id) => ({
        id,
        label: JUMP_GROUP_LABEL[id],
        items: filtered.filter((entry) => jumpGroupOf(entry.id) === id),
      })).filter((group) => group.items.length > 0),
    [filtered],
  );

  const select = (entry: CommandEntry) => {
    if (entry.run) {
      void entry.run();
      setOpen(false);
      return;
    }
    if (!entry.id.startsWith("action-")) {
      rememberJumpRecent({
        id: entry.id.replace(/^recent-/, ""),
        label: entry.label,
        hint: entry.hint,
        to: entry.to,
      });
    }
    navigate(entry.to, entry.state ? { state: entry.state } : undefined);
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
      className="spark-overlay-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: SPARK_SPRING_EASE }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden relative spark-overlay-panel"
        style={{
          maxWidth: "36rem",
          padding: 0,
          transformOrigin: jumpOriginCss(origin),
        }}
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 4 }}
        transition={{
          duration: SPARK_SPRING_DURATION_S,
          ease: SPARK_SPRING_EASE,
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
          placeholder="Jump to a recap, store, event, action, or screen…"
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
            borderTop: "1px solid rgba(var(--spark-ink-rgb),0.06)",
          }}
        />
        <div
          className="max-h-[60vh] overflow-y-auto p-2 hide-scroll space-y-3"
          style={{ scrollbarWidth: "none" }}
        >
          {filtered.length === 0 && (
            <p
              className="px-4 py-6 text-center text-sm"
              style={{ color: "var(--spark-text-meta)" }}
            >
              No matches.
            </p>
          )}
          {grouped.map((group) => (
            <div key={group.id}>
              <p className="spark-inset-label">{group.label}</p>
              <div className="spark-inset-group">
                {group.items.map((entry) => {
                  const i = filtered.indexOf(entry);
                  const on = i === active;
                  const Icon = entry.Icon;
                  return (
                    <Fragment key={entry.id}>
                      <motion.button
                        onMouseEnter={() => setActive(i)}
                        onClick={() => select(entry)}
                        className="spark-inset-row w-full text-left transition"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.2,
                          delay: Math.min(i * 0.028, 0.16),
                          ease: SPARK_SPRING_EASE,
                        }}
                        style={{
                          background: on
                            ? "rgba(239,90,42,0.10)"
                            : "transparent",
                          color: "var(--spark-text)",
                          borderRadius: 0,
                        }}
                      >
                        <span
                          className="spark-idx"
                          aria-hidden
                          style={{
                            color: on
                              ? "rgba(239,90,42,0.85)"
                              : "rgba(var(--spark-ink-rgb),0.28)",
                          }}
                        >
                          {padIndex(i + 1)}
                        </span>
                        <Icon
                          size={16}
                          className="shrink-0"
                          style={{
                            color: on
                              ? "var(--spark-orange)"
                              : "rgba(var(--spark-ink-rgb),0.55)",
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
                                ? "rgba(var(--spark-accent-rgb),0.65)"
                                : "rgba(var(--spark-ink-rgb),0.4)",
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
                              color: "var(--spark-orange)",
                            }}
                          >
                            {entry.actionBadge ?? "↵ OPEN"}
                          </span>
                        )}
                      </motion.button>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{
            borderTop: "1px solid rgba(var(--spark-ink-rgb),0.06)",
            background: "rgba(var(--spark-ink-rgb),0.02)",
          }}
        >
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.14em",
              color: "var(--spark-text-meta)",
            }}
          >
            ↑↓ NAVIGATE · ↵ OPEN · ESC CLOSE
          </p>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.14em",
              color: "var(--spark-text-meta)",
            }}
          >
            ⌘K
          </p>
        </div>
      </motion.div>
    </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default CommandPalette;
