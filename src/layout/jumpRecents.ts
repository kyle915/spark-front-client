const STORAGE_KEY = "spark-jump-recents";
const MAX_RECENTS = 8;

export type JumpRecent = {
  id: string;
  label: string;
  hint: string;
  to: string;
};

let memory: JumpRecent[] = [];

function normalizeRecentHref(to: string): string {
  return to.replace(/^\/ba\/([^/?#]+)$/, (_m, uuid: string) => {
    return `/talent?ba=${encodeURIComponent(uuid)}`;
  });
}

function readStore(): JumpRecent[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return memory;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return memory;
    memory = parsed
      .filter(
        (row): row is JumpRecent =>
          Boolean(
            row &&
              typeof row === "object" &&
              typeof (row as JumpRecent).id === "string" &&
              typeof (row as JumpRecent).to === "string" &&
              typeof (row as JumpRecent).label === "string",
          ),
      )
      .map((row) => ({ ...row, to: normalizeRecentHref(row.to) }))
      .slice(0, MAX_RECENTS);
    return memory;
  } catch {
    return memory;
  }
}

export function loadJumpRecents(): JumpRecent[] {
  return readStore();
}

export function rememberJumpRecent(entry: JumpRecent): JumpRecent[] {
  const normalized: JumpRecent = {
    ...entry,
    to: normalizeRecentHref(entry.to),
  };
  const next = [
    normalized,
    ...readStore().filter(
      (row) => row.id !== normalized.id && row.to !== normalized.to,
    ),
  ].slice(0, MAX_RECENTS);
  memory = next;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota / private mode — Jump still works from memory
  }
  return next;
}

export function clearJumpRecents(): void {
  memory = [];
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export type JumpGroupId =
  | "recents"
  | "actions"
  | "recaps"
  | "events"
  | "stores"
  | "requests"
  | "clients"
  | "people"
  | "pages";

export const JUMP_GROUP_LABEL: Record<JumpGroupId, string> = {
  recents: "Recents",
  actions: "Actions",
  recaps: "Recaps",
  events: "Events",
  stores: "Stores",
  requests: "Requests",
  clients: "Clients",
  people: "People",
  pages: "Pages",
};

export const JUMP_GROUP_ORDER: JumpGroupId[] = [
  "recents",
  "actions",
  "recaps",
  "events",
  "stores",
  "requests",
  "clients",
  "people",
  "pages",
];

export function jumpGroupOf(id: string): JumpGroupId {
  if (id.startsWith("recent-")) return "recents";
  if (id.startsWith("action-")) return "actions";
  if (id.startsWith("recap-") || id.startsWith("crecap-")) return "recaps";
  if (id.startsWith("event-")) return "events";
  if (id.startsWith("store-")) return "stores";
  if (id.startsWith("req-")) return "requests";
  if (id.startsWith("client-")) return "clients";
  if (id.startsWith("ba-")) return "people";
  return "pages";
}
