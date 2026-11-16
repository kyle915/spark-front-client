import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import { fetchQuery, useRelayEnvironment } from "react-relay";
import FilterChips from "@/components/filters/FilterChips";
import { StaffingSearchQuery } from "@/api/queries/StaffingSearchQuery";
import type {
  StaffingSearchQuery as StaffingSearchQueryType,
  StaffingSearchQuery$variables,
} from "@api/queries/__generated__/StaffingSearchQuery.graphql";
import {
  EMPTY_FILTER,
  filterChips,
  filterFromServer,
  freeLabel,
  isEmptyFilter,
  matchReasons,
  toFilterInput,
  withoutChip,
  type FilterKey,
  type SearchFilter,
} from "./staffingSearch";

type Result = NonNullable<StaffingSearchQueryType["response"]["staffingSearch"]>;

const fieldStyle: CSSProperties = {
  background: "transparent",
  color: "var(--spark-text)",
  border: "1px solid var(--spark-border)",
};
const quietButton: CSSProperties = { ...fieldStyle };
const mainButton: CSSProperties = {
  background: "var(--spark-text)",
  color: "var(--spark-surface)",
  border: "1px solid var(--spark-text)",
};
const meta: CSSProperties = { color: "var(--spark-text-meta)" };

const BOX_FOR_CHIP: Record<FilterKey, string> = {
  retailer: "find-ba-store",
  city: "find-ba-city",
  state: "find-ba-state",
  brand: "find-ba-brand",
  date: "find-ba-from",
  minShifts: "find-ba-min",
};

/**
 * "Find ambassadors" on the Staffing Board.
 *
 * Type a question, or fill the boxes. A question is read into the same
 * filter the boxes hold, and that filter is shown as chips so a wrong
 * reading can be seen and fixed. "Worked" means clocked in; a booking
 * nobody clocked in to does not count. The list only suggests people: booking
 * someone is still done from a slot on the board.
 */
export default function FindAmbassadors() {
  const environment = useRelayEnvironment();
  const [question, setQuestion] = useState("");
  const [filter, setFilter] = useState<SearchFilter>(EMPTY_FILTER);
  const [boxesOpen, setBoxesOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const latest = useRef(0);

  const run = async (
    variables: StaffingSearchQuery$variables,
  ): Promise<Result | null | undefined> => {
    const mine = ++latest.current;
    setLoading(true);
    setNotice("");
    try {
      const data = await fetchQuery<StaffingSearchQueryType>(
        environment,
        StaffingSearchQuery,
        variables,
        { fetchPolicy: "network-only" },
      ).toPromise();
      if (mine !== latest.current) return undefined;
      return data?.staffingSearch ?? null;
    } catch {
      if (mine === latest.current) {
        setNotice("The search did not go through. Try again.");
      }
      return undefined;
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  };

  const searchWith = async (next: SearchFilter) => {
    setFilter(next);
    if (isEmptyFilter(next)) {
      latest.current += 1;
      setLoading(false);
      setResult(null);
      setNotice("Add a store, city, state, brand or day to search.");
      return;
    }
    const found = await run({ question: null, filter: toFilterInput(next) });
    if (found === undefined) return;
    if (found === null) {
      setResult(null);
      setNotice("This search is for Ignite staff.");
      return;
    }
    setResult(found);
    setFilter(filterFromServer(found.filter));
  };

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (!text) {
      setBoxesOpen(true);
      return;
    }
    const found = await run({ question: text, filter: null });
    if (found === undefined) return;
    if (found === null) {
      setResult(null);
      setNotice("This search is for Ignite staff.");
      return;
    }
    if (!found.modelAvailable) {
      setResult(null);
      setBoxesOpen(true);
      setNotice("That question could not be read right now. Use the boxes below instead.");
      return;
    }
    const read = filterFromServer(found.filter);
    setFilter(read);
    if (isEmptyFilter(read)) {
      setResult(null);
      setBoxesOpen(true);
      setNotice("No store, city, brand or day was found in that. Use the boxes below instead.");
      return;
    }
    setResult(found);
  };

  const editChip = (key: FilterKey) => {
    setBoxesOpen(true);
    window.setTimeout(() => document.getElementById(BOX_FOR_CHIP[key])?.focus(), 0);
  };

  const set = <K extends keyof SearchFilter>(key: K, value: SearchFilter[K]) =>
    setFilter((prev) => ({ ...prev, [key]: value }));

  const chips = filterChips(filter);
  const inputClass = "w-full text-sm rounded-xl px-3 py-2";
  const labelClass = "block text-[12px] font-semibold mb-1";

  return (
    <section
      aria-label="Find ambassadors"
      className="mb-5 rounded-2xl p-4"
      style={{ border: "1px solid var(--spark-border)", background: "var(--spark-surface)" }}
    >
      <form onSubmit={ask}>
        <label htmlFor="find-ba-question" className="block text-sm font-semibold mb-1">
          Find ambassadors
        </label>
        <div className="flex gap-2 flex-wrap">
          <input
            id="find-ba-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={300}
            autoComplete="off"
            placeholder="Who has worked Total Wine in Houston and is free Saturday?"
            className="text-sm rounded-xl px-3 py-2 min-w-0"
            style={{ ...fieldStyle, flex: "1 1 16rem" }}
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ ...mainButton, opacity: loading ? 0.6 : 1 }}
          >
            Search
          </button>
          <button
            type="button"
            aria-expanded={boxesOpen}
            aria-controls="find-ba-boxes"
            onClick={() => setBoxesOpen((open) => !open)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={quietButton}
          >
            {boxesOpen ? "Hide filters" : "Filters"}
          </button>
        </div>
      </form>

      <FilterChips
        chips={chips}
        disabled={loading}
        onEdit={editChip}
        onRemove={(key) => void searchWith(withoutChip(filter, key))}
      />

      {boxesOpen ? (
        <form
          id="find-ba-boxes"
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void searchWith(filter);
          }}
        >
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="find-ba-store" className={labelClass}>
                Store they have clocked in at
              </label>
              <input
                id="find-ba-store"
                value={filter.retailer}
                onChange={(e) => set("retailer", e.target.value)}
                className={inputClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <label htmlFor="find-ba-city" className={labelClass}>
                City
              </label>
              <input
                id="find-ba-city"
                value={filter.city}
                onChange={(e) => set("city", e.target.value)}
                className={inputClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <label htmlFor="find-ba-state" className={labelClass}>
                State
              </label>
              <input
                id="find-ba-state"
                value={filter.state}
                onChange={(e) => set("state", e.target.value)}
                maxLength={2}
                placeholder="TX"
                className={inputClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <label htmlFor="find-ba-brand" className={labelClass}>
                Brand they have worked for
              </label>
              <input
                id="find-ba-brand"
                value={filter.brand}
                onChange={(e) => set("brand", e.target.value)}
                className={inputClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <label htmlFor="find-ba-from" className={labelClass}>
                Day needed
              </label>
              <input
                id="find-ba-from"
                type="date"
                value={filter.dateFrom}
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    dateFrom: e.target.value,
                    dateTo:
                      !prev.dateTo || prev.dateTo < e.target.value ? e.target.value : prev.dateTo,
                  }))
                }
                className={inputClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <label htmlFor="find-ba-to" className={labelClass}>
                Through (optional)
              </label>
              <input
                id="find-ba-to"
                type="date"
                value={filter.dateTo}
                min={filter.dateFrom || undefined}
                onChange={(e) => set("dateTo", e.target.value)}
                className={inputClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <label htmlFor="find-ba-min" className={labelClass}>
                Shifts clocked in to, at least
              </label>
              <input
                id="find-ba-min"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={filter.minShifts}
                onChange={(e) => set("minShifts", Math.max(1, Number(e.target.value) || 1))}
                className={inputClass}
                style={fieldStyle}
              />
            </div>
            <label className="flex items-center gap-2 text-sm self-end py-2">
              <input
                type="checkbox"
                checked={filter.mustBeFree}
                disabled={!filter.dateFrom}
                onChange={(e) => set("mustBeFree", e.target.checked)}
              />
              Only people free that day
            </label>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ ...mainButton, opacity: loading ? 0.6 : 1 }}
            >
              Search with these
            </button>
            <button
              type="button"
              onClick={() => {
                latest.current += 1;
                setLoading(false);
                setFilter(EMPTY_FILTER);
                setResult(null);
                setNotice("");
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={quietButton}
            >
              Clear
            </button>
          </div>
        </form>
      ) : null}

      <p className="text-[13px] mt-3" style={{ ...meta, minHeight: "1.25rem" }} aria-live="polite">
        {loading
          ? "Searching…"
          : notice ||
            (result
              ? result.total === 0
                ? "No one matches. Remove a filter to widen the search."
                : `${result.total} ${result.total === 1 ? "person" : "people"}${
                    result.total > result.matches.length
                      ? `, showing the first ${result.matches.length}`
                      : ""
                  }. To book someone, tap a slot on the board.`
              : "")}
      </p>

      {result && result.matches.length > 0 && !notice ? (
        <ol className="mt-1" style={{ opacity: loading ? 0.5 : 1 }}>
          {result.matches.map((m) => {
            const status = freeLabel(m);
            return (
              <li
                key={m.ambassadorUuid}
                className="py-3 flex gap-3 items-start justify-between"
                style={{ borderTop: "1px solid var(--spark-border)" }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--spark-text)" }}>
                    {m.name}
                  </p>
                  {matchReasons(m).map((line) => (
                    <p key={line} className="text-[13px] break-words" style={meta}>
                      {line}
                    </p>
                  ))}
                </div>
                {status ? (
                  <span
                    className="text-[13px] font-semibold shrink-0"
                    style={{
                      color: m.isFree ? "var(--spark-text)" : "var(--spark-orange)",
                    }}
                  >
                    {status}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
