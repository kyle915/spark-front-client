import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { Bar } from "react-chartjs-2";
import "@/lib/sparkChartRegister";
import Layout from "@/layout/Layout";
import ErrorBoundary from "@/components/ErrorBoundary";
import ChartBlock from "@/components/charts/ChartBlock";
import SparkPageHeader from "@/shared/SparkPageHeader";
import useSparkRole from "@/hooks/useSparkRole";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { StoreProfileQuery } from "@/api/queries/StoreProfileQuery";
import type { StoreProfileQuery as StoreProfileQueryType } from "@api/queries/__generated__/StoreProfileQuery.graphql";
import { RebookLastCrewMutation } from "@/api/mutations/RebookLastCrewMutation";
import type { RebookLastCrewMutation as RebookLastCrewMutationType } from "@api/mutations/__generated__/RebookLastCrewMutation.graphql";
import { SaveStoreLogisticsNotesMutation } from "@/api/mutations/SaveStoreLogisticsNotesMutation";
import type { SaveStoreLogisticsNotesMutation as SaveStoreLogisticsNotesMutationType } from "@api/mutations/__generated__/SaveStoreLogisticsNotesMutation.graphql";
import { barSeries, chartOptions } from "@/lib/sparkChart";
import {
  activationLabel,
  count,
  dayLabel,
  isStoreKey,
  percent,
  recapHref,
  visitSeries,
  visitStatusLabel,
} from "@/lib/storeProfile";

const META: CSSProperties = { color: "var(--spark-text-meta)" };
const SECONDARY: CSSProperties = { color: "var(--spark-text-secondary)" };
const INK: CSSProperties = { color: "var(--spark-text)" };
const RULE = "1px solid var(--spark-border)";

const COMMENT_KIND: Record<string, string> = {
  decline: "Reason to pass",
  question: "Question",
};

const Section: React.FC<{ title: string; note?: string; children: ReactNode }> = ({
  title,
  note,
  children,
}) => (
  <section className="spark-card p-5 sm:p-6" aria-label={title}>
    <h2 className="text-base font-semibold" style={INK}>
      {title}
    </h2>
    {note ? (
      <p className="text-[13px] mt-1" style={META}>
        {note}
      </p>
    ) : null}
    <div className="mt-3">{children}</div>
  </section>
);

const Figure: React.FC<{ label: string; value: string; note?: string }> = ({
  label,
  value,
  note,
}) => (
  <div className="min-w-0">
    <dt className="text-[13px]" style={SECONDARY}>
      {label}
    </dt>
    <dd className="m-0 text-2xl font-semibold tab-num" style={INK}>
      {value}
    </dd>
    {note ? (
      <dd className="m-0 text-xs" style={META}>
        {note}
      </dd>
    ) : null}
  </div>
);

const Message: React.FC<{ children: ReactNode; onNavigateAway?: () => void }> = ({
  children,
  onNavigateAway,
}) => (
  <div className="spark-card p-6">
    <p className="text-sm" style={INK}>
      {children}
    </p>
    <p className="text-sm mt-2">
      <Link to="/account-map" onClick={onNavigateAway} className="underline" style={SECONDARY}>
        Back to the account map
      </Link>
    </p>
  </div>
);

function formatSavedTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function buildStoreScheduleHref(store: {
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}): string {
  const market = [store.city, store.state].filter(Boolean).join(", ");
  const params = new URLSearchParams({
    venue: store.name || "Store",
  });
  const addr = (store.address || market || "").trim();
  if (addr) params.set("address", addr);
  if (store.state) params.set("state", store.state);
  return `/requests/create?${params.toString()}`;
}

export const StoreProfileContent: React.FC<{
  tenantId: string;
  storeKey: string;
  inDrawer?: boolean;
  onNavigateAway?: () => void;
  onResolvedTitle?: (title: string) => void;
}> = ({ tenantId, storeKey, inDrawer = false, onNavigateAway, onResolvedTitle }) => {
  const navigate = useNavigate();
  const { isClient } = useSparkRole();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [refreshKey, setRefreshKey] = useState(0);

  const data = useLazyLoadQuery<StoreProfileQueryType>(
    StoreProfileQuery,
    { tenantId, storeKey },
    { fetchPolicy: "store-and-network", fetchKey: refreshKey },
  );
  const store = data.storeProfile;
  const series = useMemo(() => visitSeries(store?.visits ?? []), [store]);

  useEffect(() => {
    if (store?.name && onResolvedTitle) {
      onResolvedTitle(store.name);
    }
  }, [store?.name, onResolvedTitle]);

  const upcomingVisits = useMemo(() => {
    const rows = (store?.visits ?? []).filter((v) => v.status === "upcoming");
    return [...rows].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  }, [store?.visits]);

  const [selectedUpcomingEventId, setSelectedUpcomingEventId] = useState<string>("");
  useEffect(() => {
    if (upcomingVisits.length === 0) {
      setSelectedUpcomingEventId("");
      return;
    }
    if (!upcomingVisits.some((v) => v.eventId === selectedUpcomingEventId)) {
      setSelectedUpcomingEventId(upcomingVisits[0].eventId);
    }
  }, [upcomingVisits, selectedUpcomingEventId]);

  const [notesDraft, setNotesDraft] = useState(store?.logisticsNotes ?? "");
  const [savedNotes, setSavedNotes] = useState(store?.logisticsNotes ?? "");
  const [savedAt, setSavedAt] = useState<string | null>(
    store?.logisticsNotesUpdatedAt ?? null,
  );
  useEffect(() => {
    setNotesDraft(store?.logisticsNotes ?? "");
    setSavedNotes(store?.logisticsNotes ?? "");
    setSavedAt(store?.logisticsNotesUpdatedAt ?? null);
  }, [store?.storeKey, store?.logisticsNotes, store?.logisticsNotesUpdatedAt]);

  const [commitRebook, rebooking] =
    useMutation<RebookLastCrewMutationType>(RebookLastCrewMutation);
  const [commitSaveNotes, savingNotes] =
    useMutation<SaveStoreLogisticsNotesMutationType>(SaveStoreLogisticsNotesMutation);

  if (!store) {
    return (
      <Message onNavigateAway={onNavigateAway}>
        This store is not one of this client&apos;s stores.
      </Message>
    );
  }

  const { totals } = store;
  const isStaff = store.staff != null;
  const market = [store.city, store.state].filter(Boolean).join(", ");
  const where = store.address || market;
  const scheduleHref = buildStoreScheduleHref(store);
  const mapHref = `/account-map?q=${encodeURIComponent(store.name || store.address || "")}`;
  const notesDirty = notesDraft.trim() !== savedNotes.trim();
  const hasPastVisits = totals.visits > 0;
  const canRebookCrew = !isClient && upcomingVisits.length > 0 && Boolean(selectedUpcomingEventId);

  const handleScheduleVisit = () => {
    onNavigateAway?.();
    navigate(scheduleHref);
  };

  const handleRebookLastCrew = () => {
    if (!selectedUpcomingEventId || rebooking) return;
    commitRebook({
      variables: { input: { eventId: selectedUpcomingEventId } },
      onCompleted: (res) => {
        const payload = res.rebookLastCrew;
        if (payload?.success) {
          showAlert(payload.message || "Last crew booked onto upcoming shift.", "success");
          setRefreshKey((k) => k + 1);
        } else {
          showAlert(payload?.message || "Could not rebook last crew.", "warning");
        }
      },
      onError: (err) => {
        showAlert(err.message || "Could not rebook last crew.", "error");
      },
    });
  };

  const handleSaveLogistics = () => {
    if (savingNotes) return;
    commitSaveNotes({
      variables: {
        input: {
          tenantId,
          storeKey: store.storeKey,
          notes: notesDraft.trim(),
        },
      },
      onCompleted: (res) => {
        const payload = res.saveStoreLogisticsNotes;
        if (payload?.success) {
          const next = payload.logisticsNotes ?? notesDraft.trim();
          setNotesDraft(next);
          setSavedNotes(next);
          setSavedAt(payload.logisticsNotesUpdatedAt ?? new Date().toISOString());
          showAlert("Store logistics notes saved.", "success");
        } else {
          showAlert(payload?.message || "Could not save logistics notes.", "error");
        }
      },
      onError: (err) => {
        showAlert(err.message || "Could not save logistics notes.", "error");
      },
    });
  };

  const actionBar = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleScheduleVisit}
        className="px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
        style={{
          background: "var(--spark-lime)",
          color: "var(--spark-on-accent)",
          border: "none",
        }}
      >
        Schedule visit
      </button>

      {!isClient ? (
        <div className="inline-flex items-center gap-1.5 flex-wrap">
          {upcomingVisits.length > 1 ? (
            <select
              value={selectedUpcomingEventId}
              onChange={(e) => setSelectedUpcomingEventId(e.target.value)}
              aria-label="Target upcoming shift for rebook"
              className="text-xs rounded-xl px-2.5 py-2"
              style={{
                background: "rgba(var(--spark-ink-rgb),0.04)",
                border: RULE,
                color: "var(--spark-text)",
              }}
            >
              {upcomingVisits.map((u) => (
                <option key={u.eventId} value={u.eventId}>
                  {dayLabel(u.date) || u.title}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            disabled={!canRebookCrew || rebooking}
            onClick={handleRebookLastCrew}
            title={
              upcomingVisits.length === 0
                ? "Schedule an upcoming visit at this store first to rebook the last crew"
                : !hasPastVisits
                  ? "Attempt to book prior crew onto the upcoming shift"
                  : `Book the prior approved crew onto ${
                      dayLabel(
                        upcomingVisits.find((u) => u.eventId === selectedUpcomingEventId)?.date,
                      ) || "the upcoming shift"
                    }`
            }
            className="spark-btn-ghost text-xs px-3 py-2 rounded-xl disabled:opacity-50"
          >
            {rebooking ? "Rebooking…" : "Rebook last crew"}
          </button>
        </div>
      ) : null}

      <Link
        to={mapHref}
        onClick={onNavigateAway}
        className="spark-btn-ghost text-xs px-3 py-2 rounded-xl no-underline"
      >
        View on map
      </Link>
    </div>
  );

  return (
    <div className="space-y-4">
      {inDrawer ? (
        <div className="space-y-3">
          {where ? (
            <p className="text-[13px]" style={SECONDARY}>
              {where}
            </p>
          ) : null}
          {actionBar}
        </div>
      ) : (
        <>
          <SparkPageHeader
            eyebrow="Store"
            title={store.name || "Store"}
            titleClassName="text-3xl md:text-4xl font-bold"
            support={where || undefined}
            action={actionBar}
          />
          {where ? (
            <p className="text-[13px] sm:hidden" style={META}>
              {where}
            </p>
          ) : null}
        </>
      )}

      {store.summary ? (
        <p className="text-sm leading-relaxed max-w-3xl" style={INK}>
          {store.summary}
        </p>
      ) : null}

      <Section
        title="Store logistics notes"
        note="Pinned door instructions (check-in contact, cooler/table spot, parking). Surfaced automatically in shift briefings and confirmation emails."
      >
        <div className="space-y-2.5">
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="e.g. Check in with Maria at Customer Service; set 4ft table beside endcap #2; park in lot B."
            aria-label="Store logistics notes"
            className="w-full rounded-xl p-3 text-sm resize-y"
            style={{
              background: "rgba(var(--spark-ink-rgb),0.03)",
              border: RULE,
              color: "var(--spark-text)",
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs" style={META}>
              {savedAt
                ? `Last saved ${formatSavedTimestamp(savedAt)}`
                : savedNotes
                  ? "Loaded from account list"
                  : "No door notes saved yet."}
            </span>
            <div className="flex items-center gap-2">
              {notesDirty ? (
                <button
                  type="button"
                  onClick={() => setNotesDraft(savedNotes)}
                  disabled={savingNotes}
                  className="text-xs underline px-2 py-1"
                  style={SECONDARY}
                >
                  Reset
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleSaveLogistics}
                disabled={savingNotes || !notesDirty}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition disabled:opacity-45"
                style={{
                  background: notesDirty ? "var(--spark-lime)" : "rgba(var(--spark-ink-rgb),0.08)",
                  color: notesDirty ? "var(--spark-on-accent)" : "var(--spark-text-secondary)",
                  border: "none",
                  cursor: savingNotes || !notesDirty ? "default" : "pointer",
                }}
              >
                {savingNotes ? "Saving…" : notesDirty ? "Save notes" : "Saved"}
              </button>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Totals" note="From approved recaps at this store.">
        <dl className="m-0 grid gap-x-6 gap-y-4 grid-cols-2 lg:grid-cols-4">
          <Figure
            label="Visits"
            value={count(totals.visits)}
            note={totals.upcoming ? `${count(totals.upcoming)} upcoming` : undefined}
          />
          <Figure
            label="Consumers sampled"
            value={count(totals.consumers)}
            note={
              totals.averageConsumers != null
                ? `${count(totals.averageConsumers)} per recap`
                : undefined
            }
          />
          <Figure
            label="Units sold"
            value={count(totals.unitsSold)}
            note={
              totals.averageUnitsSold != null
                ? `${count(totals.averageUnitsSold)} per recap`
                : undefined
            }
          />
          <Figure
            label="Conversion"
            value={percent(totals.conversion)}
            note={`${count(totals.approvedRecaps)} approved ${
              totals.approvedRecaps === 1 ? "recap" : "recaps"
            }`}
          />
        </dl>
        {series.values.length > 0 ? (
          <div className="mt-5">
            <ChartBlock title="Consumers sampled per visit" height={180}>
              <Bar
                data={{
                  labels: series.labels,
                  datasets: [barSeries({ label: "Consumers sampled", data: series.values })],
                }}
                options={chartOptions<"bar">()}
              />
            </ChartBlock>
          </div>
        ) : null}
      </Section>

      <Section
        title="Visits"
        note={
          store.visitTotal > store.visits.length
            ? `The newest ${count(store.visits.length)} of ${count(store.visitTotal)}.`
            : undefined
        }
      >
        {store.visits.length === 0 ? (
          <p className="text-sm" style={META}>
            No visits yet.
          </p>
        ) : (
          <ul className="m-0 p-0 list-none">
            {store.visits.map((v, i) => {
              const figures = [
                v.consumers != null ? `${count(v.consumers)} sampled` : "",
                v.unitsSold != null ? `${count(v.unitsSold)} sold` : "",
                v.conversion != null ? `${v.conversion}% conversion` : "",
              ].filter(Boolean);
              return (
                <li
                  key={v.eventUuid}
                  className="py-3 flex flex-wrap gap-x-4 gap-y-1 items-baseline justify-between"
                  style={i > 0 ? { borderTop: RULE } : undefined}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={INK}>
                      {dayLabel(v.date) || "No date"}
                      <span className="font-normal" style={SECONDARY}>
                        {activationLabel(v.activationType)
                          ? ` · ${activationLabel(v.activationType)}`
                          : ""}
                      </span>
                    </p>
                    {figures.length > 0 ? (
                      <p className="text-[13px] tab-num" style={SECONDARY}>
                        {figures.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-[13px] flex gap-3 shrink-0" style={META}>
                    <span>{visitStatusLabel(v.status, isStaff)}</span>
                    {v.recapUuid ? (
                      <Link
                        to={recapHref(v.recapKind, v.recapUuid)}
                        onClick={onNavigateAway}
                        className="underline"
                        style={SECONDARY}
                      >
                        Recap
                      </Link>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {store.products.length > 0 ? (
        <Section
          title="Products"
          note="Samples handed out here, and units sold where recaps record sales by product."
        >
          <ul className="m-0 p-0 list-none">
            {store.products.map((p, i) => (
              <li
                key={p.label}
                className="py-2 flex gap-4 justify-between text-sm"
                style={i > 0 ? { borderTop: RULE } : undefined}
              >
                <span style={INK}>{p.label}</span>
                <span className="tab-num shrink-0" style={SECONDARY}>
                  {count(p.samples)} sampled
                  {p.sold != null ? ` · ${count(p.sold)} sold` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {store.comments.length > 0 ? (
        <Section
          title="What people said here"
          note="Comments from consumers, as written on approved recaps."
        >
          <ul className="m-0 p-0 list-none">
            {store.comments.map((c, i) => (
              <li
                key={`${c.recapUuid ?? ""}-${i}`}
                className="py-3"
                style={i > 0 ? { borderTop: RULE } : undefined}
              >
                <p className="text-sm leading-relaxed max-w-3xl" style={INK}>
                  {c.text}
                </p>
                <p className="text-xs mt-1 flex gap-3" style={META}>
                  {COMMENT_KIND[c.kind] ? <span>{COMMENT_KIND[c.kind]}</span> : null}
                  {c.recapUuid ? (
                    <Link
                      to={recapHref(c.recapKind, c.recapUuid)}
                      onClick={onNavigateAway}
                      className="underline"
                      style={SECONDARY}
                    >
                      Recap
                    </Link>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {store.photos.length > 0 ? (
        <Section title="Photos" note="From approved recaps. Receipts are left out.">
          <ul className="m-0 p-0 list-none grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {store.photos.map((p) => (
              <li key={p.url}>
                <Link
                  to={recapHref("custom", p.recapUuid)}
                  onClick={onNavigateAway}
                  className="block"
                >
                  <img
                    src={p.url}
                    alt={
                      [p.category, dayLabel(p.eventDate)].filter(Boolean).join(", ") ||
                      "Recap photo"
                    }
                    loading="lazy"
                    className="w-full aspect-square object-cover rounded-xl"
                    style={{ border: RULE }}
                  />
                </Link>
                <p className="text-xs mt-1" style={META}>
                  {[p.category, dayLabel(p.eventDate)].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {store.staff ? (
        <Section title="Staff only" note="Clients do not see this section.">
          {store.staff.inReview > 0 ? (
            <p className="text-sm mb-3" style={INK}>
              {count(store.staff.inReview)}{" "}
              {store.staff.inReview === 1 ? "recap is" : "recaps are"} still in review and not
              counted above.
            </p>
          ) : null}
          <h3 className="text-[13px] font-medium mb-1" style={SECONDARY}>
            Who worked here
          </h3>
          {store.staff.people.length === 0 ? (
            <p className="text-sm" style={META}>
              No clock-ins or recaps with a name yet.
            </p>
          ) : (
            <ul className="m-0 p-0 list-none">
              {store.staff.people.map((person, i) => (
                <li
                  key={`${person.name}-${i}`}
                  className="py-2 flex gap-4 justify-between text-sm"
                  style={i > 0 ? { borderTop: RULE } : undefined}
                >
                  <span style={INK}>{person.name}</span>
                  <span className="tab-num shrink-0" style={SECONDARY}>
                    {count(person.visits)} {person.visits === 1 ? "visit" : "visits"}
                    {person.lastDate ? ` · last ${dayLabel(person.lastDate)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="text-[13px] font-medium mt-4 mb-1" style={SECONDARY}>
            Review flags on the latest recaps
          </h3>
          {store.staff.flags.length === 0 ? (
            <p className="text-sm" style={META}>
              Nothing flagged.
            </p>
          ) : (
            <ul className="m-0 p-0 list-none">
              {store.staff.flags.map((flag, i) => (
                <li
                  key={flag.recapUuid}
                  className="py-2 text-sm"
                  style={i > 0 ? { borderTop: RULE } : undefined}
                >
                  <Link
                    to={recapHref(flag.recapKind, flag.recapUuid)}
                    onClick={onNavigateAway}
                    className="underline"
                    style={INK}
                  >
                    {dayLabel(flag.date) || "Recap"}
                  </Link>
                  <span style={SECONDARY}>: {flag.labels.join(", ")}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}
    </div>
  );
};

/**
 * One store of the current client: every visit, what its approved recaps
 * add up to, what consumers said there, its photos, and persistent door
 * logistics notes. Reached from the account map, the store chart, a recap,
 * or "Open full page" in the universal StoreSheet drawer.
 */
export default function SparkStoreProfile() {
  const { storeKey = "" } = useParams<{ storeKey: string }>();
  const { tenantId } = useAuthStore();
  const tenant = tenantId ? String(tenantId) : "";
  return (
    <Layout>
      <div className="spark-page spark-fade-in spark-scale max-w-5xl">
        {!tenant ? (
          <Message>Choose a client to see its stores.</Message>
        ) : !isStoreKey(storeKey) ? (
          <Message>That link is not a store page.</Message>
        ) : (
          <ErrorBoundary
            key={`${tenant}|${storeKey}`}
            fallback={<Message>This store page could not load. Try again in a moment.</Message>}
          >
            <Suspense
              fallback={
                <p className="text-sm py-6" style={META} role="status">
                  Loading store
                </p>
              }
            >
              <StoreProfileContent tenantId={tenant} storeKey={storeKey} />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </Layout>
  );
}
