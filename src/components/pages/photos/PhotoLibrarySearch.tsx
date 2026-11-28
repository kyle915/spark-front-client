import { useEffect, useMemo, useState } from "react";
import { commitMutation, fetchQuery } from "react-relay";
import { useLazyLoadQuery } from "react-relay/hooks";
import { Link } from "react-router";
import { Check, Maximize2 } from "lucide-react";
import environment from "@/api/relay/environment";
import { InterpretPhotoSearchQuery, PhotoLibraryQuery } from "@/api/queries/PhotoLibraryQuery";
import type { PhotoLibraryQuery as LibraryQueryType } from "@api/queries/__generated__/PhotoLibraryQuery.graphql";
import type { PhotoLibraryQueryInterpretQuery as InterpretQueryType } from "@api/queries/__generated__/PhotoLibraryQueryInterpretQuery.graphql";
import { ClientRecapDraftQuery, ClientRecapDraftsQuery } from "@/api/queries/ClientRecapDraftQuery";
import type { ClientRecapDraftQuery as DraftQueryType } from "@api/queries/__generated__/ClientRecapDraftQuery.graphql";
import type { ClientRecapDraftQueryListQuery as DraftsQueryType } from "@api/queries/__generated__/ClientRecapDraftQueryListQuery.graphql";
import { UpdateClientRecapDraftMutation } from "@/api/mutations/ClientRecapDraftMutations";
import type { ClientRecapDraftMutationsUpdateMutation as UpdateType } from "@api/mutations/__generated__/ClientRecapDraftMutationsUpdateMutation.graphql";
import { directThumbUrl, handleThumbError } from "@/utils/thumb";
import { photoCaption, type GalleryPhoto } from "./photoGallery";
import {
  EMPTY_LIBRARY_FILTERS,
  filterChips,
  optionsFromPage,
  type LibraryOptions as Options,
  fromInterpretation,
  isSearching,
  mergeDeckPhotoIds,
  qualityWord,
  QUICK_SHOWS,
  SORT_LABELS,
  toFilterInput,
  toGalleryPhoto,
  toggleKey,
  type LibraryFilters,
} from "./photoLibrary";

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

/**
 * The search box: type what you are after in plain words ("best crowd
 * photos at Kroger in Texas"). The server turns it into filters, shown as
 * chips you can remove. Quick chips add a tag type with one tap.
 */
export const LibrarySearchBar: React.FC<{
  tenantId: string;
  filters: LibraryFilters;
  options: Options;
  onFilters: (f: LibraryFilters) => void;
}> = ({ tenantId, filters, options, onFilters }) => {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const chips = useMemo(() => filterChips(filters, options), [filters, options]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const words = draft.trim();
    if (!words || busy) return;
    setBusy(true);
    setNote("");
    try {
      const data = await fetchQuery<InterpretQueryType>(environment, InterpretPhotoSearchQuery, {
        tenantId,
        text: words,
      }).toPromise();
      const result = data?.interpretPhotoSearch;
      if (!result) {
        onFilters({ ...filters, text: words });
        setNote("Searched your words as typed.");
        return;
      }
      onFilters(fromInterpretation(result.filters));
      if (!result.ok && result.reason) setNote(result.reason);
    } catch {
      onFilters({ ...filters, text: words });
      setNote("Searched your words as typed.");
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setDraft("");
    setNote("");
    onFilters(EMPTY_LIBRARY_FILTERS);
  };

  return (
    <div className="spark-card p-3 space-y-3">
      <form
        className="flex items-center gap-2 flex-wrap"
        onSubmit={(e) => void submit(e)}
        role="search"
      >
        <input
          type="search"
          aria-label="Search photos"
          placeholder="Search photos, like “best crowd photos at Kroger in Texas”"
          style={{ ...fieldStyle, flex: "1 1 320px", minWidth: 220 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="px-3 py-2 rounded-xl font-semibold text-sm disabled:opacity-50"
          style={{
            background: "var(--spark-lime)",
            color: "var(--spark-on-accent)",
          }}
        >
          {busy ? "Searching…" : "Search"}
        </button>
        {isSearching(filters) ? (
          <button
            type="button"
            onClick={clear}
            className="underline text-sm"
            style={{ color: "var(--spark-text-secondary)" }}
          >
            Clear search
          </button>
        ) : null}
      </form>

      <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Photo types">
        {QUICK_SHOWS.map((key) => {
          const on = filters.shows.includes(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => onFilters({ ...filters, shows: toggleKey(filters.shows, key) })}
              className={`pill-btn whitespace-nowrap ${on ? "on" : ""}`}
            >
              {options.shows.get(key) ?? key}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={filters.hideIssues}
          onClick={() => onFilters({ ...filters, hideIssues: !filters.hideIssues })}
          className={`pill-btn whitespace-nowrap ${filters.hideIssues ? "on" : ""}`}
        >
          Hide blurry or dark
        </button>
        <label className="inline-flex items-center gap-1.5 text-sm ml-auto">
          <span style={{ color: "var(--spark-text-meta)" }}>Sort</span>
          <select
            aria-label="Sort photos"
            style={{ ...fieldStyle, minHeight: 32, padding: "4px 8px" }}
            value={filters.sort}
            onChange={(e) => onFilters({ ...filters, sort: e.target.value })}
          >
            <option value="">{filters.text ? "Best match" : "Best quality"}</option>
            {Object.entries(SORT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {chips.length > 0 ? (
        <ul
          className="flex items-center gap-2 flex-wrap list-none p-0 m-0"
          aria-label="Search filters in use"
        >
          {chips.map((chip) => (
            <li key={chip.id}>
              <button
                type="button"
                onClick={() => onFilters(chip.without)}
                className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full"
                style={{
                  border: "1px solid var(--spark-border)",
                  background: "var(--spark-surface-2)",
                  color: "var(--spark-text)",
                }}
                aria-label={`Remove filter: ${chip.label}`}
              >
                {chip.label}
                <span aria-hidden="true" style={{ color: "var(--spark-text-meta)" }}>
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {note ? (
        <p className="text-sm m-0" style={{ color: "var(--spark-text-meta)" }}>
          {note}
        </p>
      ) : null}
    </div>
  );
};

/** Search results. Same tiles and selection as the gallery, plus what
 *  Spark saw in each photo. */
export const LibraryGrid: React.FC<{
  tenantId: string;
  filters: LibraryFilters;
  dates: { startDate: string | null; endDate: string | null };
  approvedOnly: boolean;
  picksOnly: boolean;
  showApproval: boolean;
  page: number;
  onPage: (p: number) => void;
  onOptions: (o: Options) => void;
  selected: Map<string, GalleryPhoto>;
  onToggle: (p: GalleryPhoto) => void;
  onSelectMany: (photos: readonly GalleryPhoto[], on: boolean) => void;
  onPreview?: (photos: readonly GalleryPhoto[], index: number) => void;
}> = ({
  tenantId,
  filters,
  dates,
  approvedOnly,
  picksOnly,
  showApproval,
  page,
  onPage,
  onOptions,
  selected,
  onToggle,
  onSelectMany,
  onPreview,
}) => {
  const data = useLazyLoadQuery<LibraryQueryType>(
    PhotoLibraryQuery,
    {
      tenantId,
      filters: toFilterInput(filters, { approvedOnly, picksOnly, ...dates }),
      first: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    { fetchPolicy: "store-and-network" },
  );
  const lib = data.photoLibrary;
  const optionsKey = [
    lib.products.length,
    lib.showOptions.length,
    lib.crowdOptions.length,
    lib.settingOptions.length,
  ].join("|");
  useEffect(() => {
    onOptions(optionsFromPage(lib));
    // Options only change when the brand's catalog does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey]);

  const photos = useMemo(() => lib.photos.map(toGalleryPhoto), [lib.photos]);
  const pages = Math.ceil(lib.total / PAGE_SIZE);
  const notTagged = lib.inScope - lib.tagged;

  if (lib.total === 0) {
    return (
      <div className="spark-empty">
        <h2 className="spark-title text-2xl font-semibold">No photos match.</h2>
        <p className="spark-support mt-2 mx-auto">
          Try fewer words, remove a filter or widen the date range.
          {notTagged > 0
            ? ` ${notTagged.toLocaleString("en-US")} photo${notTagged === 1 ? " is" : "s are"} still being tagged and only show in a search once tagged.`
            : ""}
        </p>
      </div>
    );
  }
  const allOnPage = photos.length > 0 && photos.every((p) => selected.has(p.id));

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3 text-sm">
        <span style={{ color: "var(--spark-text-meta)" }}>
          {lib.total.toLocaleString("en-US")} photo{lib.total === 1 ? "" : "s"}
          {pages > 1 ? ` · page ${page + 1} of ${pages}` : ""}
          {notTagged > 0 ? ` · ${notTagged.toLocaleString("en-US")} not tagged yet` : ""}
        </span>
        <button
          type="button"
          className="underline"
          style={{ color: "var(--spark-text-secondary)" }}
          onClick={() => onSelectMany(photos, !allOnPage)}
        >
          {allOnPage ? "Clear this page" : "Select this page"}
        </button>
      </div>
      <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 list-none p-0 m-0">
        {lib.photos.map((p, i) => {
          const g = photos[i];
          const on = selected.has(p.id);
          const tags = [p.showLabels.slice(0, 2).join(", "), p.peoplePresent ? p.crowdLabel : ""]
            .filter(Boolean)
            .join(" · ");
          const quality = qualityWord(p.qualityScore);
          return (
            <li key={p.id}>
              <div
                className="group relative overflow-hidden"
                style={{
                  borderRadius: 12,
                  border: on
                    ? "2px solid var(--spark-text)"
                    : "1px solid var(--spark-hairline, var(--spark-border))",
                  background: "var(--spark-surface-2)",
                }}
              >
                <button
                  type="button"
                  onClick={() => onPreview?.(photos, i)}
                  aria-label={`Inspect photo: ${p.caption || tags || "field photo"}`}
                  className="block w-full text-left cursor-zoom-in"
                >
                  <img
                    src={directThumbUrl(p.url, 400)}
                    onError={(e) => handleThumbError(e.currentTarget, p.url, 400)}
                    alt={p.caption || tags || "Field photo"}
                    loading="lazy"
                    className="w-full aspect-[4/3] object-cover block transition duration-200 group-hover:scale-[1.02]"
                  />
                  <span
                    aria-hidden
                    className="absolute bottom-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    style={{
                      background: "rgba(20, 22, 15, 0.72)",
                      color: "#ffffff",
                    }}
                  >
                    <Maximize2 size={13} strokeWidth={2} />
                  </span>
                </button>
                <label
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-2 left-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-lg cursor-pointer transition"
                  style={{
                    background: on ? "var(--spark-lime)" : "rgba(255, 255, 255, 0.92)",
                    border: on
                      ? "1px solid var(--spark-lime)"
                      : "1px solid rgba(20, 22, 15, 0.18)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => onToggle(g)}
                    aria-label={`Select photo: ${p.caption || tags || "field photo"}, ${photoCaption(g)}`}
                    className="sr-only"
                  />
                  {on ? (
                    <Check size={14} strokeWidth={2.5} style={{ color: "var(--spark-on-accent)" }} />
                  ) : (
                    <span
                      aria-hidden
                      className="w-3.5 h-3.5 rounded-[4px]"
                      style={{ border: "1.5px solid rgba(20, 22, 15, 0.45)" }}
                    />
                  )}
                </label>
                {showApproval && !p.approved ? (
                  <span
                    className="absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: "var(--spark-surface)",
                      color: "var(--spark-text-secondary)",
                    }}
                  >
                    Not approved
                  </span>
                ) : null}
              </div>
              <p className="text-xs mt-1.5 font-semibold truncate" title={p.caption}>
                {p.caption || tags || p.category || "Field photo"}
              </p>
              {tags || quality ? (
                <p
                  className="text-xs truncate"
                  style={{ color: "var(--spark-text-secondary)" }}
                  title={[tags, quality, ...p.products].filter(Boolean).join(" · ")}
                >
                  {[tags, quality].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {p.products.length > 0 ? (
                <p
                  className="text-xs truncate"
                  style={{ color: "var(--spark-text-secondary)" }}
                  title={p.products.join(", ")}
                >
                  {p.products.join(", ")}
                </p>
              ) : null}
              <p
                className="text-xs truncate"
                style={{ color: "var(--spark-text-meta)" }}
                title={photoCaption(g)}
              >
                <Link
                  to={`/recap/view-custom/${p.recapUuid}`}
                  style={{ color: "inherit" }}
                  className="hover:underline"
                >
                  {photoCaption(g) || "Open recap"}
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
            ← Previous
          </button>
          <button
            type="button"
            disabled={page + 1 >= pages}
            onClick={() => onPage(page + 1)}
            className="px-3 py-1.5 rounded-xl disabled:opacity-40"
            style={{ border: "1px solid var(--spark-border)" }}
          >
            Next →
          </button>
        </div>
      ) : null}
    </>
  );
};

type DraftSummary = DraftsQueryType["response"]["clientRecapDrafts"][number];

/**
 * Staff only: put the selected photos on a recap deck draft for this brand.
 * Photos the deck cannot use (not approved, a no-product visit) are left off
 * by the server; the message says how many went on.
 */
export const AddToDeck: React.FC<{
  tenantId: string;
  photoIds: readonly string[];
  onDone: (message: string, ok: boolean) => void;
}> = ({ tenantId, photoIds, onDone }) => {
  const [drafts, setDrafts] = useState<readonly DraftSummary[] | null>(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchQuery<DraftsQueryType>(environment, ClientRecapDraftsQuery, {
      tenantId,
    })
      .toPromise()
      .then((data) => {
        if (!live) return;
        const list = data?.clientRecapDrafts ?? [];
        setDrafts(list);
        setChoice((c) => c || list[0]?.uuid || "");
      })
      .catch(() => live && setDrafts([]));
    return () => {
      live = false;
    };
  }, [tenantId]);

  if (drafts === null || drafts.length === 0) {
    return drafts === null ? null : (
      <Link
        to="/reports/client-recap"
        className="underline"
        style={{ color: "var(--spark-text-secondary)" }}
      >
        Start a recap deck
      </Link>
    );
  }

  const add = async () => {
    if (!choice || busy) return;
    setBusy(true);
    try {
      const data = await fetchQuery<DraftQueryType>(environment, ClientRecapDraftQuery, {
        uuid: choice,
      }).toPromise();
      const draft = data?.clientRecapDraft?.draft;
      if (!draft) {
        onDone(data?.clientRecapDraft?.reason || "That deck could not be opened.", false);
        return;
      }
      if (!draft.canEdit) {
        onDone(
          "That deck can't be changed now. It is shared with the brand or still being built.",
          false,
        );
        return;
      }
      const before = draft.photos.map((p) => p.id);
      const merged = mergeDeckPhotoIds(before, photoIds);
      if (merged.added === 0) {
        onDone(
          merged.dropped > 0
            ? "That deck already has the most photos it can hold (13)."
            : "Those photos are already on that deck.",
          false,
        );
        return;
      }
      await new Promise<void>((resolve) => {
        commitMutation<UpdateType>(environment, {
          mutation: UpdateClientRecapDraftMutation,
          variables: { uuid: choice, photoIds: merged.ids },
          onCompleted: (res) => {
            const result = res.updateClientRecapDraft;
            if (!result.ok || !result.draft) {
              onDone(result.reason || "The deck could not be saved.", false);
            } else {
              const added = result.draft.photos.length - before.length;
              const skipped = photoIds.length - Math.max(0, added);
              onDone(
                added > 0
                  ? `Added ${added} photo${added === 1 ? "" : "s"} to the deck.${skipped > 0 ? ` ${skipped} could not be used (already on it, not approved, or the deck is full).` : ""}`
                  : "None of those photos can go on a deck. Only photos from approved recaps can.",
                added > 0,
              );
            }
            resolve();
          },
          onError: () => {
            onDone("The deck could not be saved.", false);
            resolve();
          },
        });
      });
    } catch {
      onDone("The deck could not be saved.", false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        aria-label="Recap deck"
        style={{
          ...fieldStyle,
          minHeight: 32,
          padding: "4px 8px",
          maxWidth: 220,
        }}
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
      >
        {drafts.map((d) => (
          <option key={d.uuid} value={d.uuid}>
            {d.title || "Untitled deck"} · {d.period}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => void add()}
        disabled={busy}
        className="px-3 py-1.5 rounded-xl disabled:opacity-50"
        style={{ border: "1px solid var(--spark-border)" }}
      >
        {busy ? "Adding…" : "Add to deck"}
      </button>
    </span>
  );
};
