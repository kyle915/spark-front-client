import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router";
import { fetchQuery, useRelayEnvironment } from "react-relay";
import FilterChips from "@/components/filters/FilterChips";
import { ListSearchQuery } from "@/api/queries/ListSearchQuery";
import type {
  ListSearchQuery as ListSearchQueryType,
  ListSearchQuery$variables,
} from "@api/queries/__generated__/ListSearchQuery.graphql";
import {
  ACTIVATION_TYPES,
  EMPTY_LIST_FILTER,
  METRICS,
  OPS,
  RECAP_STATUSES,
  filterChips,
  filterFromServer,
  fullListHref,
  isEmptyFilter,
  resultCountLine,
  rowFigures,
  rowHref,
  rowPlaceLine,
  rowStatusLabel,
  toFilterInput,
  withoutChip,
  type ChipKey,
  type Condition,
  type ListFilter,
  type ListName,
  type Metric,
  type Op,
} from "@/lib/listSearch";

type Result = NonNullable<ListSearchQueryType["response"]["listSearch"]>;

const fieldStyle: CSSProperties = {
  background: "transparent",
  color: "var(--spark-text)",
  border: "1px solid var(--spark-border)",
};
const mainButton: CSSProperties = {
  background: "var(--spark-text)",
  color: "var(--spark-surface)",
  border: "1px solid var(--spark-text)",
};
const meta: CSSProperties = { color: "var(--spark-text-meta)" };

const COPY: Record<ListName, { label: string; placeholder: string; nothing: string }> = {
  recaps: {
    label: "Search recaps",
    placeholder: "Texas Kroger recaps in October with conversion under 10%",
    nothing: "Add a store, place, date, type, product or figure to search.",
  },
  events: {
    label: "Search events",
    placeholder: "Texas Kroger events in October with conversion under 10%",
    nothing: "Add a store, place, date, type, product or figure to search.",
  },
};

const NEW_CONDITION: Condition = { metric: "consumers", op: "gte", value: 0 };

/**
 * Search on the Recaps list and the Master Tracker.
 *
 * Type a sentence, or fill the boxes. A sentence is read into the same
 * filter the boxes hold, and that filter is shown as chips so a wrong
 * reading can be seen and fixed. Changing a chip or a box searches with the
 * filter as it stands; it is never read again. Anything asked for that the
 * list cannot filter on is named under the chips.
 */
export default function ListSearch({
  list,
  tenantId,
  isClient,
  className = "",
}: {
  list: ListName;
  tenantId: string;
  isClient: boolean;
  className?: string;
}) {
  const environment = useRelayEnvironment();
  const copy = COPY[list];
  const id = `list-search-${list}`;
  const [question, setQuestion] = useState("");
  const [filter, setFilter] = useState<ListFilter>(EMPTY_LIST_FILTER);
  const [boxesOpen, setBoxesOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const latest = useRef(0);

  const run = async (
    variables: Pick<ListSearchQuery$variables, "question" | "filter">,
  ): Promise<Result | null | undefined> => {
    const mine = ++latest.current;
    setLoading(true);
    setNotice("");
    try {
      const data = await fetchQuery<ListSearchQueryType>(
        environment,
        ListSearchQuery,
        { tenantId, list, ...variables },
        { fetchPolicy: "network-only" },
      ).toPromise();
      if (mine !== latest.current) return undefined;
      return data?.listSearch ?? null;
    } catch {
      if (mine === latest.current) setNotice("The search did not go through. Try again.");
      return undefined;
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  };

  const clear = () => {
    latest.current += 1;
    setLoading(false);
    setFilter(EMPTY_LIST_FILTER);
    setResult(null);
    setNotice("");
    setQuestion("");
  };

  const searchWith = async (next: ListFilter) => {
    setFilter(next);
    if (isEmptyFilter(next)) {
      latest.current += 1;
      setLoading(false);
      setResult(null);
      setNotice(copy.nothing);
      return;
    }
    const found = await run({ question: null, filter: toFilterInput(next) });
    if (found === undefined) return;
    if (found === null) {
      setResult(null);
      setNotice("The search is not available for this client.");
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
      setNotice("The search is not available for this client.");
      return;
    }
    if (found.reason && !found.interpreted) {
      // Over the hourly limit: the boxes still work.
      setResult(null);
      setBoxesOpen(true);
      setNotice(found.reason);
      return;
    }
    if (!found.modelAvailable) {
      setResult(null);
      setBoxesOpen(true);
      setNotice("That could not be read right now. Use the filters below instead.");
      return;
    }
    const read = filterFromServer(found.filter);
    setFilter(read);
    setResult(found);
    if (isEmptyFilter(read)) setBoxesOpen(true);
  };

  const editChip = (key: ChipKey) => {
    setBoxesOpen(true);
    const box = key.startsWith("cond:") ? `${id}-cond-${key.slice(5)}` : `${id}-${key}`;
    window.setTimeout(() => document.getElementById(box)?.focus(), 0);
  };

  const set = <K extends keyof ListFilter>(key: K, value: ListFilter[K]) =>
    setFilter((prev) => ({ ...prev, [key]: value }));
  const setCondition = (index: number, patch: Partial<Condition>) =>
    setFilter((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));

  const chips = filterChips(filter, list, isClient);
  const inputClass = "w-full text-sm rounded-xl px-3 py-2";
  const labelClass = "block text-[12px] font-semibold mb-1";
  const rows = result?.rows ?? [];
  const fullList = list === "recaps" && result ? fullListHref(filter) : null;
  const status = loading
    ? "Searching…"
    : notice ||
      (result
        ? isEmptyFilter(filter)
          ? result.reason || copy.nothing
          : result.reason || resultCountLine(list, result.total, rows.length)
        : "");

  return (
    <section
      aria-label={copy.label}
      className={`rounded-2xl p-4 ${className}`.trim()}
      style={{ border: "1px solid var(--spark-border)", background: "var(--spark-surface)" }}
    >
      <form onSubmit={ask}>
        <label htmlFor={`${id}-question`} className="block text-sm font-semibold mb-1">
          {copy.label}
        </label>
        <div className="flex gap-2 flex-wrap">
          <input
            id={`${id}-question`}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={300}
            autoComplete="off"
            placeholder={copy.placeholder}
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
            aria-controls={`${id}-boxes`}
            onClick={() => setBoxesOpen((open) => !open)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={fieldStyle}
          >
            {boxesOpen ? "Hide filters" : "Filters"}
          </button>
          {result || chips.length > 0 ? (
            <button
              type="button"
              onClick={clear}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={fieldStyle}
            >
              Clear
            </button>
          ) : null}
        </div>
      </form>

      <FilterChips
        chips={chips}
        disabled={loading}
        onEdit={editChip}
        onRemove={(key) => void searchWith(withoutChip(filter, key))}
      />

      {result && result.ignored.length > 0 && !notice ? (
        <ul className="mt-3 text-[13px] list-none p-0" style={meta} aria-label="Left out">
          {result.ignored.map((line) => (
            <li key={line}>Left out: {line}</li>
          ))}
        </ul>
      ) : null}

      {boxesOpen ? (
        <form
          id={`${id}-boxes`}
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void searchWith(filter);
          }}
        >
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor={`${id}-store`} className={labelClass}>
                Store or retailer
              </label>
              <input
                id={`${id}-store`}
                value={filter.store}
                onChange={(e) => set("store", e.target.value)}
                className={inputClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <label htmlFor={`${id}-city`} className={labelClass}>
                City
              </label>
              <input
                id={`${id}-city`}
                value={filter.city}
                onChange={(e) => set("city", e.target.value)}
                className={inputClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <label htmlFor={`${id}-state`} className={labelClass}>
                State
              </label>
              <input
                id={`${id}-state`}
                value={filter.state}
                onChange={(e) => set("state", e.target.value)}
                maxLength={2}
                placeholder="TX"
                className={inputClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <label htmlFor={`${id}-product`} className={labelClass}>
                Product sampled
              </label>
              <input
                id={`${id}-product`}
                value={filter.product}
                onChange={(e) => set("product", e.target.value)}
                className={inputClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <label htmlFor={`${id}-date`} className={labelClass}>
                Event date from
              </label>
              <input
                id={`${id}-date`}
                type="date"
                value={filter.dateFrom}
                onChange={(e) => set("dateFrom", e.target.value)}
                className={inputClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <label htmlFor={`${id}-to`} className={labelClass}>
                Event date to
              </label>
              <input
                id={`${id}-to`}
                type="date"
                value={filter.dateTo}
                min={filter.dateFrom || undefined}
                onChange={(e) => set("dateTo", e.target.value)}
                className={inputClass}
                style={fieldStyle}
              />
            </div>
            <div>
              <label htmlFor={`${id}-activationType`} className={labelClass}>
                Activation type
              </label>
              <select
                id={`${id}-activationType`}
                value={filter.activationType}
                onChange={(e) => set("activationType", e.target.value)}
                className={inputClass}
                style={fieldStyle}
              >
                <option value="">Any</option>
                {ACTIVATION_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {list === "recaps" && !isClient ? (
              <div>
                <label htmlFor={`${id}-status`} className={labelClass}>
                  Recap status
                </label>
                <select
                  id={`${id}-status`}
                  value={filter.status}
                  onChange={(e) => set("status", e.target.value)}
                  className={inputClass}
                  style={fieldStyle}
                >
                  <option value="">Any</option>
                  {RECAP_STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <fieldset className="mt-3 border-0 p-0 m-0">
            <legend className={labelClass}>Figures from approved recaps</legend>
            {filter.conditions.map((c, i) => (
              <div key={i} className="flex flex-wrap gap-2 mb-2 items-center">
                <select
                  id={`${id}-cond-${i}`}
                  aria-label="Figure"
                  value={c.metric}
                  onChange={(e) => setCondition(i, { metric: e.target.value as Metric })}
                  className="text-sm rounded-xl px-3 py-2"
                  style={fieldStyle}
                >
                  {METRICS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Comparison"
                  value={c.op}
                  onChange={(e) => setCondition(i, { op: e.target.value as Op })}
                  className="text-sm rounded-xl px-3 py-2"
                  style={fieldStyle}
                >
                  {OPS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Number"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={Number.isFinite(c.value) ? c.value : ""}
                  onChange={(e) => setCondition(i, { value: Number(e.target.value) })}
                  className="text-sm rounded-xl px-3 py-2 w-28"
                  style={fieldStyle}
                />
                <button
                  type="button"
                  onClick={() => setFilter((prev) => withoutChip(prev, `cond:${i}`))}
                  className="text-[13px] underline"
                  style={{ ...meta, background: "transparent" }}
                >
                  Remove
                </button>
              </div>
            ))}
            {filter.conditions.length < 3 ? (
              <button
                type="button"
                onClick={() =>
                  setFilter((prev) => ({
                    ...prev,
                    conditions: [...prev.conditions, NEW_CONDITION],
                  }))
                }
                className="text-[13px] underline"
                style={{ color: "var(--spark-text-secondary)", background: "transparent" }}
              >
                Add a figure
              </button>
            ) : null}
          </fieldset>

          <div className="flex gap-2 mt-3">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ ...mainButton, opacity: loading ? 0.6 : 1 }}
            >
              Search with these
            </button>
          </div>
        </form>
      ) : null}

      {status ? (
        <p className="text-[13px] mt-3" style={meta} aria-live="polite">
          {status}
          {fullList && !loading && !notice && rows.length > 0 ? (
            <>
              {" "}
              <Link
                to={fullList}
                className="underline"
                style={{ color: "var(--spark-text-secondary)" }}
              >
                Show these in the list below
              </Link>
            </>
          ) : null}
        </p>
      ) : (
        <p className="sr-only" aria-live="polite" />
      )}

      {rows.length > 0 && !notice ? (
        <ol className="mt-1 list-none p-0" style={{ opacity: loading ? 0.5 : 1 }}>
          {rows.map((row) => {
            const figures = rowFigures(row);
            const state = rowStatusLabel(row, isClient);
            return (
              <li
                key={`${row.kind}:${row.uuid}`}
                className="py-3 flex gap-3 items-start justify-between"
                style={{ borderTop: "1px solid var(--spark-border)" }}
              >
                <div className="min-w-0">
                  <Link
                    to={rowHref(row)}
                    className="text-sm font-semibold underline-offset-2 hover:underline break-words"
                    style={{ color: "var(--spark-text)" }}
                  >
                    {row.title}
                  </Link>
                  <p className="text-[13px] break-words" style={meta}>
                    {rowPlaceLine(row)}
                  </p>
                  {figures ? (
                    <p className="text-[13px] tab-num" style={{ color: "var(--spark-text-secondary)" }}>
                      {figures}
                    </p>
                  ) : null}
                </div>
                {state ? (
                  <span className="text-[13px] font-semibold shrink-0" style={meta}>
                    {state}
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
