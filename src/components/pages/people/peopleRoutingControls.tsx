import { useMemo, useState } from "react";

export type PeopleTab = "people" | "routing";

export type PersonRow = {
  id: string;
  uuid: string;
  name: string;
  email: string;
  role: string;
  roleSlug: string;
  initials: string;
};

export const resolvePeopleTab = (
  raw: string | URLSearchParams | null | undefined,
): PeopleTab => {
  if (!raw) return "people";
  const value =
    typeof raw === "string"
      ? raw.startsWith("?") || raw.includes("=")
        ? new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw).get(
            "tab",
          ) ?? ""
        : raw
      : raw.get("tab") ?? "";
  const normalized = value.trim().toLowerCase();
  if (normalized === "routing" || normalized === "notifications") {
    return "routing";
  }
  return "people";
};

export const parseRecapRecipientsList = (raw: string): string[] =>
  raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

export const filterRmmCandidates = (
  rows: PersonRow[],
  query: string,
): PersonRow[] => {
  const q = query.toLowerCase().trim();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
  );
};

export const PeopleTabsSwitcher: React.FC<{
  activeTab: PeopleTab;
  onChangeTab: (tab: PeopleTab) => void;
  peopleCount?: number;
  summaryText?: string;
}> = ({ activeTab, onChangeTab, peopleCount, summaryText }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div
      role="tablist"
      aria-label="People workspace sections"
      className="inline-flex items-center gap-1 p-1 rounded-2xl"
      style={{
        background: "var(--spark-surface)",
        border: "1px solid var(--spark-border)",
      }}
    >
      {(
        [
          {
            id: "people" as const,
            label: "People",
            badge:
              typeof peopleCount === "number" && peopleCount > 0
                ? String(peopleCount)
                : null,
          },
          {
            id: "routing" as const,
            label: "Notifications & Routing",
            badge: null,
          },
        ]
      ).map((t) => {
        const isActive = activeTab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChangeTab(t.id)}
            className="px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-2 transition"
            style={{
              background: isActive ? "var(--spark-lime)" : "transparent",
              color: isActive ? "var(--spark-on-accent)" : "rgba(var(--spark-ink-rgb),0.68)",
              boxShadow: isActive
                ? "0 0 16px rgba(var(--spark-accent-rgb),0.28)"
                : "none",
            }}
          >
            <span>{t.label}</span>
            {t.badge && (
              <span
                className="mono text-[10px] px-1.5 py-0.5 rounded-md"
                style={{
                  background: isActive
                    ? "rgba(10,13,9,0.16)"
                    : "rgba(var(--spark-ink-rgb),0.08)",
                  color: isActive ? "var(--spark-on-accent)" : "rgba(var(--spark-ink-rgb),0.7)",
                }}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>

    {activeTab === "people" && summaryText && (
      <button
        type="button"
        onClick={() => onChangeTab("routing")}
        className="px-3.5 py-2 rounded-xl text-xs inline-flex items-center gap-2 transition"
        style={{
          background: "var(--spark-surface)",
          border: "1px solid var(--spark-border)",
          color: "var(--spark-text-secondary)",
        }}
        title="Open Notifications & Routing settings"
      >
        <span
          className="spark-dot"
          style={{
            background: "var(--spark-lime)",
            boxShadow: "0 0 6px var(--spark-lime)",
          }}
        />
        <span>{summaryText}</span>
        <span
          className="mono text-[10px] font-semibold"
          style={{ letterSpacing: "0.12em", color: "var(--spark-lime)" }}
        >
          Notifications &amp; Routing →
        </span>
      </button>
    )}
  </div>
);

export const DefaultRmmSelector: React.FC<{
  rows: PersonRow[];
  selectedId: string;
  disabled?: boolean;
  onSelect: (nextId: string) => void;
}> = ({ rows, selectedId, disabled = false, onSelect }) => {
  const [query, setQuery] = useState("");
  const selectedPerson = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );
  const filteredRows = useMemo(
    () => filterRmmCandidates(rows, query),
    [rows, query],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="mono text-[10px] uppercase px-2 py-1 rounded-md shrink-0"
            style={{
              letterSpacing: "0.14em",
              background: selectedPerson
                ? "rgba(var(--spark-accent-rgb),0.14)"
                : "rgba(var(--spark-ink-rgb),0.06)",
              color: selectedPerson
                ? "var(--spark-lime)"
                : "rgba(var(--spark-ink-rgb),0.6)",
            }}
          >
            {selectedPerson ? "OVERRIDE ACTIVE" : "TERRITORY ROUTING"}
          </span>
          <span className="text-sm font-medium truncate">
            {selectedPerson
              ? `${selectedPerson.name}${selectedPerson.email ? ` · ${selectedPerson.email}` : ""}`
              : "— None (territory routing) —"}
          </span>
        </div>

        {selectedId && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect("")}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition"
            style={{
              background: "transparent",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-orange)",
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? "default" : "pointer",
            }}
          >
            Clear default RMM
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search RMM by name or email…"
          aria-label="Search default RMM by name or email"
          className="rounded-xl text-sm flex-1"
          style={{
            padding: "0.55rem 0.9rem",
            background: "var(--spark-bg)",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
            minWidth: 240,
            outline: "none",
            opacity: disabled ? 0.6 : 1,
          }}
        />
        {disabled && (
          <span
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.14em",
              color: "var(--spark-text-meta)",
            }}
          >
            SAVING…
          </span>
        )}
      </div>

      <div
        role="listbox"
        aria-label="Default RMM candidates"
        className="rounded-xl overflow-y-auto divide-y"
        style={{
          maxHeight: 220,
          background: "var(--spark-bg)",
          border: "1px solid var(--spark-border)",
          borderColor: "var(--spark-border)",
        }}
      >
        {!query.trim() && (
          <button
            type="button"
            role="option"
            aria-selected={selectedId === ""}
            disabled={disabled}
            onClick={() => onSelect("")}
            className="w-full px-3.5 py-2.5 text-left text-xs flex items-center justify-between gap-2 transition"
            style={{
              background:
                selectedId === "" ? "rgba(var(--spark-accent-rgb),0.08)" : "transparent",
              color:
                selectedId === ""
                  ? "var(--spark-lime)"
                  : "rgba(var(--spark-ink-rgb),0.65)",
              borderBottom: "1px solid var(--spark-border)",
            }}
          >
            <span>— None (territory routing) —</span>
            {selectedId === "" && (
              <span
                className="mono text-[10px]"
                style={{ letterSpacing: "0.14em" }}
              >
                ACTIVE
              </span>
            )}
          </button>
        )}

        {filteredRows.length === 0 ? (
          <p
            className="px-3.5 py-4 text-xs text-center"
            style={{ color: "var(--spark-text-meta)" }}
          >
            No matching people found.
          </p>
        ) : (
          filteredRows.map((p) => {
            const isSelected = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={disabled}
                onClick={() => onSelect(p.id)}
                className="w-full px-3.5 py-2.5 text-left text-xs flex items-center justify-between gap-3 transition"
                style={{
                  background: isSelected
                    ? "rgba(var(--spark-accent-rgb),0.08)"
                    : "transparent",
                  color: "var(--spark-text)",
                  borderBottom: "1px solid var(--spark-border)",
                }}
              >
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">{p.name}</span>
                  {p.email && (
                    <span
                      className="mono ml-2"
                      style={{ color: "var(--spark-text-meta)" }}
                    >
                      {p.email}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="mono text-[10px] uppercase"
                    style={{
                      letterSpacing: "0.12em",
                      color: isSelected
                        ? "var(--spark-lime)"
                        : "rgba(var(--spark-ink-rgb),0.4)",
                    }}
                  >
                    {isSelected ? "SELECTED" : p.role}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
