import {
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { RecapBaRosterQuery } from "@/api/queries/RecapBaRosterQuery";
import type { RecapBaRosterQuery as RecapBaRosterQueryType } from "@/api/queries/__generated__/RecapBaRosterQuery.graphql";

const filterStyle: React.CSSProperties = {
  padding: "0.75rem 0.95rem",
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  color: "var(--spark-text)",
  outline: "none",
};

function rosterLabel(row: { name: string; email: string }): string {
  return (row.name || row.email || "").trim();
}

const BaNameSuggestions: React.FC<{
  tenantId: string;
  q: string;
  knownNames: string[];
  onPick: (name: string) => void;
}> = ({ tenantId, q, knownNames, onPick }) => {
  const deferredQ = useDeferredValue(q);
  const data = useLazyLoadQuery<RecapBaRosterQueryType>(
    RecapBaRosterQuery,
    { tenantId, q: deferredQ || null },
    { fetchPolicy: "store-or-network" },
  );
  const names = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const fromRoster = (data?.chatRecipientAmbassadors ?? [])
      .map((row) => (row ? rosterLabel(row) : ""))
      .filter(Boolean);
    const fromKnown = knownNames.filter((n) =>
      n.toLowerCase().includes(needle),
    );
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of [...fromRoster, ...fromKnown]) {
      const key = n.toLowerCase();
      if (!needle || !key.includes(needle) || seen.has(key)) continue;
      seen.add(key);
      out.push(n);
      if (out.length >= 8) break;
    }
    return out;
  }, [data, knownNames, q]);

  if (names.length === 0) return null;
  return (
    <div
      className="absolute left-0 top-full mt-1 z-40 max-h-64 overflow-y-auto rounded-xl py-1"
      style={{
        background: "rgba(10,13,9,0.98)",
        border: "1px solid var(--spark-border)",
        boxShadow: "0 14px 40px rgba(0,0,0,0.55)",
        minWidth: "100%",
      }}
      role="listbox"
    >
      {names.map((n) => (
        <button
          key={n}
          type="button"
          role="option"
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(n);
          }}
          className="w-full text-left px-3 py-2 text-sm"
          style={{ color: "var(--spark-text)" }}
        >
          {n}
        </button>
      ))}
    </div>
  );
};

/**
 * Recaps list BA filter — type the ambassador's name instead of picking
 * from the 50-cap ambassadors dropdown (which omitted most of the roster).
 */
export const BaNameFilter: React.FC<{
  tenantId: string | null;
  value: string;
  knownNames: string[];
  onChange: (name: string) => void;
}> = ({ tenantId, value, knownNames, onChange }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = value.trim();
  const showSuggestions = open && q.length > 0 && Boolean(tenantId);

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search BA name…"
        autoComplete="off"
        aria-label="Search brand ambassador by name"
        className="rounded-xl text-sm"
        style={{
          ...filterStyle,
          maxWidth: 220,
          paddingRight: value ? 28 : undefined,
        }}
        title="Filter recaps by Brand Ambassador name"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear ambassador filter"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          ×
        </button>
      ) : null}
      {showSuggestions ? (
        <Suspense fallback={null}>
          <BaNameSuggestions
            tenantId={tenantId!}
            q={q}
            knownNames={knownNames}
            onPick={(name) => {
              onChange(name);
              setOpen(false);
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
};

export default BaNameFilter;
