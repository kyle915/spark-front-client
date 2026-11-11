import { Suspense, useEffect, useMemo, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Link } from "react-router";
import Layout from "@/layout/Layout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import { TenantPhotoGalleryQuery } from "@/api/queries/TenantPhotoGalleryQuery";
import type { TenantPhotoGalleryQuery as QueryType } from "@api/queries/__generated__/TenantPhotoGalleryQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { thumbUrl } from "@/utils/thumb";
import {
  DATE_RANGES,
  DECK_LAYOUTS,
  photoCaption,
  photoFileName,
  rangeDates,
  type DateRangeKey,
  type DeckLayout,
  type GalleryPhoto,
} from "./photoGallery";
import { buildDeckHtml, openDeck } from "./photoDeck";

const PAGE_SIZE = 60;

const fieldStyle: React.CSSProperties = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-surface)",
  color: "var(--spark-text)",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 14,
  minHeight: 38,
};

type Filters = {
  range: DateRangeKey;
  state: string;
  category: string;
  store: string;
};

const Grid: React.FC<{
  tenantId: string;
  filters: Filters;
  page: number;
  onPage: (p: number) => void;
  onChoices: (c: { categories: readonly string[]; states: readonly string[] }) => void;
  selected: Map<string, GalleryPhoto>;
  onToggle: (p: GalleryPhoto) => void;
  onSelectMany: (photos: readonly GalleryPhoto[], on: boolean) => void;
}> = ({ tenantId, filters, page, onPage, onChoices, selected, onToggle, onSelectMany }) => {
  const dates = useMemo(() => rangeDates(filters.range), [filters.range]);
  const data = useLazyLoadQuery<QueryType>(
    TenantPhotoGalleryQuery,
    {
      tenantId,
      startDate: dates.startDate,
      endDate: dates.endDate,
      state: filters.state || null,
      category: filters.category || null,
      store: filters.store || null,
      first: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    { fetchPolicy: "store-and-network" },
  );
  const g = data.tenantPhotoGallery;
  useEffect(() => {
    onChoices({ categories: g.categories, states: g.states });
    // Choices only change when the window does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.categories.join("|"), g.states.join("|")]);

  if (g.total === 0) {
    return (
      <div className="spark-empty">
        <h2 className="spark-title text-2xl font-semibold">No photos match.</h2>
        <p className="spark-support mt-2 mx-auto">
          Photos appear here once a recap is approved. Try a wider date range or
          clear the filters.
        </p>
      </div>
    );
  }

  const pages = Math.ceil(g.total / PAGE_SIZE);
  const allOnPage = g.photos.length > 0 && g.photos.every((p) => selected.has(p.id));

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3 text-sm">
        <span style={{ color: "var(--spark-text-meta)" }}>
          {g.total.toLocaleString("en-US")} photo{g.total === 1 ? "" : "s"}
          {pages > 1 ? ` · page ${page + 1} of ${pages}` : ""}
        </span>
        <button
          type="button"
          className="underline"
          style={{ color: "var(--spark-text-secondary)" }}
          onClick={() => onSelectMany(g.photos, !allOnPage)}
        >
          {allOnPage ? "Clear this page" : "Select this page"}
        </button>
      </div>
      <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 list-none p-0 m-0">
        {g.photos.map((p) => {
          const on = selected.has(p.id);
          return (
            <li key={p.id}>
              <div
                className="relative overflow-hidden"
                style={{
                  borderRadius: 12,
                  border: on
                    ? "2px solid var(--spark-text)"
                    : "1px solid var(--spark-hairline, var(--spark-border))",
                  background: "var(--spark-surface-2)",
                }}
              >
                <label className="block cursor-pointer">
                  <img
                    src={thumbUrl(p.url, 400)}
                    alt={p.category || "Field photo"}
                    loading="lazy"
                    className="w-full aspect-[4/3] object-cover block"
                  />
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onToggle(p)}
                    aria-label={`Select photo: ${p.category || "field photo"}, ${photoCaption(p)}`}
                    className="absolute top-2 left-2 w-5 h-5"
                    style={{ accentColor: "var(--spark-lime)" }}
                  />
                </label>
              </div>
              <p className="text-xs mt-1.5 font-semibold truncate" title={p.category}>
                {p.category || "Field photo"}
              </p>
              <p
                className="text-xs truncate"
                style={{ color: "var(--spark-text-meta)" }}
                title={photoCaption(p)}
              >
                <Link
                  to={`/recap/view-custom/${p.recapUuid}`}
                  style={{ color: "inherit" }}
                  className="hover:underline"
                >
                  {photoCaption(p) || "Open recap"}
                </Link>
              </p>
            </li>
          );
        })}
      </ul>
      {pages > 1 ? (
        <div className="flex items-center justify-center gap-3 mt-6 text-sm">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => onPage(page - 1)}
            className="px-3 py-1.5 rounded-xl disabled:opacity-40"
            style={{ border: "1px solid var(--spark-border)" }}
          >
            ← Newer
          </button>
          <button
            type="button"
            disabled={page + 1 >= pages}
            onClick={() => onPage(page + 1)}
            className="px-3 py-1.5 rounded-xl disabled:opacity-40"
            style={{ border: "1px solid var(--spark-border)" }}
          >
            Older →
          </button>
        </div>
      ) : null}
    </>
  );
};

/**
 * Every approved field photo for the brand in one place: filter, select,
 * download as a zip, or turn the selection into a print-ready photo deck.
 * Needs tenantPhotoGallery on the server (spark-api #1361).
 */
const SparkPhotoGallery: React.FC = () => {
  const { tenantId } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [filters, setFilters] = useState<Filters>({
    range: "90",
    state: "",
    category: "",
    store: "",
  });
  const [storeDraft, setStoreDraft] = useState("");
  const [page, setPage] = useState(0);
  const [choices, setChoices] = useState<{
    categories: readonly string[];
    states: readonly string[];
  }>({ categories: [], states: [] });
  const [selected, setSelected] = useState<Map<string, GalleryPhoto>>(new Map());
  const [perPage, setPerPage] = useState<DeckLayout>(4);
  const [zipping, setZipping] = useState(false);

  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };

  // Search as you type, after a short pause.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (storeDraft.trim() !== filters.store) update({ store: storeDraft.trim() });
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeDraft]);

  const toggle = (p: GalleryPhoto) =>
    setSelected((cur) => {
      const next = new Map(cur);
      if (next.has(p.id)) next.delete(p.id);
      else next.set(p.id, p);
      return next;
    });
  const selectMany = (photos: readonly GalleryPhoto[], on: boolean) =>
    setSelected((cur) => {
      const next = new Map(cur);
      for (const p of photos) {
        if (on) next.set(p.id, p);
        else next.delete(p.id);
      }
      return next;
    });

  const chosen = useMemo(
    () =>
      [...selected.values()].sort(
        (a, b) => b.eventDate.localeCompare(a.eventDate) || a.store.localeCompare(b.store),
      ),
    [selected],
  );

  const makeDeck = () => {
    const rangeLabel = DATE_RANGES.find((r) => r.key === filters.range)?.label ?? "";
    const ok = openDeck(
      buildDeckHtml({
        title: "Field photos",
        subtitle: [rangeLabel, filters.state, filters.category].filter(Boolean).join(" · "),
        photos: chosen,
        perPage,
      }),
    );
    if (!ok) {
      showAlert("Your browser blocked the deck window. Allow pop-ups for Spark and try again.", "error");
    }
  };

  const downloadZip = async () => {
    if (zipping || chosen.length === 0) return;
    setZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      let added = 0;
      for (const [i, p] of chosen.entries()) {
        try {
          const res = await fetch(p.url);
          if (!res.ok) continue;
          zip.file(photoFileName(p, i), await res.blob());
          added += 1;
        } catch {
          /* skip a photo that would not download; the rest still zip */
        }
      }
      if (added === 0) {
        showAlert("None of those photos could be downloaded.", "error");
        return;
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `field-photos-${added}.zip`;
      a.click();
      URL.revokeObjectURL(href);
      showAlert(
        added === chosen.length
          ? `Downloaded ${added} photo${added === 1 ? "" : "s"}.`
          : `Downloaded ${added} of ${chosen.length}. The rest could not be fetched.`,
        added === chosen.length ? "success" : "warning",
      );
    } finally {
      setZipping(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-5">
        <SparkPageHeader
          eyebrow="RECAPS"
          title="Photos"
          support="Every approved field photo in one place. Filter, pick the ones you want, then download them or build a photo deck."
        />

        <div className="spark-card p-3 flex items-center gap-2 flex-wrap">
          <select
            aria-label="Date range"
            style={fieldStyle}
            value={filters.range}
            onChange={(e) => update({ range: e.target.value as DateRangeKey })}
          >
            {DATE_RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            aria-label="State"
            style={fieldStyle}
            value={filters.state}
            onChange={(e) => update({ state: e.target.value })}
          >
            <option value="">All states</option>
            {choices.states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            aria-label="Photo type"
            style={fieldStyle}
            value={filters.category}
            onChange={(e) => update({ category: e.target.value })}
          >
            <option value="">All photo types</option>
            {choices.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            aria-label="Search store or address"
            placeholder="Search store or address"
            style={{ ...fieldStyle, flex: "1 1 200px", minWidth: 160 }}
            value={storeDraft}
            onChange={(e) => setStoreDraft(e.target.value)}
          />
        </div>

        {chosen.length > 0 ? (
          <div
            className="spark-card p-3 flex items-center gap-2 flex-wrap text-sm sticky top-2 z-10"
            role="region"
            aria-label="Actions for selected photos"
          >
            <span className="font-semibold">{chosen.length} selected</span>
            <button
              type="button"
              onClick={makeDeck}
              className="px-3 py-1.5 rounded-xl font-semibold"
              style={{ background: "var(--spark-lime)", color: "var(--spark-on-accent)" }}
            >
              Build photo deck
            </button>
            <label className="inline-flex items-center gap-1.5">
              <span style={{ color: "var(--spark-text-meta)" }}>Photos per page</span>
              <select
                style={{ ...fieldStyle, minHeight: 32, padding: "4px 8px" }}
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value) as DeckLayout)}
              >
                {DECK_LAYOUTS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void downloadZip()}
              disabled={zipping}
              className="px-3 py-1.5 rounded-xl disabled:opacity-50"
              style={{ border: "1px solid var(--spark-border)" }}
            >
              {zipping ? "Preparing zip…" : "Download (.zip)"}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Map())}
              className="underline ml-auto"
              style={{ color: "var(--spark-text-secondary)" }}
            >
              Clear selection
            </button>
          </div>
        ) : null}

        {tenantId ? (
          <Suspense
            fallback={
              <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
                Loading photos…
              </p>
            }
          >
            <Grid
              tenantId={String(tenantId)}
              filters={filters}
              page={page}
              onPage={setPage}
              onChoices={setChoices}
              selected={selected}
              onToggle={toggle}
              onSelectMany={selectMany}
            />
          </Suspense>
        ) : (
          <p className="text-sm" style={{ color: "var(--spark-text-meta)" }}>
            Choose a client to see its photos.
          </p>
        )}
      </div>
    </Layout>
  );
};

export default SparkPhotoGallery;
