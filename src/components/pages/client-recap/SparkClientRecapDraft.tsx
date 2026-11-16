import { useCallback, useEffect, useMemo, useState } from "react";
import { commitMutation, fetchQuery } from "react-relay";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import Layout from "@/layout/Layout";
import SparkPageHeader from "@/shared/SparkPageHeader";
import environment from "@/api/relay/environment";
import {
  ClientRecapDraftPdfQuery,
  ClientRecapDraftQuery,
  ClientRecapDraftsQuery,
} from "@/api/queries/ClientRecapDraftQuery";
import type { ClientRecapDraftQuery as DraftQueryType } from "@api/queries/__generated__/ClientRecapDraftQuery.graphql";
import type { ClientRecapDraftQueryListQuery as DraftsQueryType } from "@api/queries/__generated__/ClientRecapDraftQueryListQuery.graphql";
import type { ClientRecapDraftQueryPdfQuery as PdfQueryType } from "@api/queries/__generated__/ClientRecapDraftQueryPdfQuery.graphql";
import {
  CreateClientRecapDraftMutation,
  UpdateClientRecapDraftMutation,
} from "@/api/mutations/ClientRecapDraftMutations";
import type { ClientRecapDraftMutationsCreateMutation as CreateType } from "@api/mutations/__generated__/ClientRecapDraftMutationsCreateMutation.graphql";
import type { ClientRecapDraftMutationsUpdateMutation as UpdateType } from "@api/mutations/__generated__/ClientRecapDraftMutationsUpdateMutation.graphql";
import { TenantPhotoGalleryQuery } from "@/api/queries/TenantPhotoGalleryQuery";
import type { TenantPhotoGalleryQuery as GalleryQueryType } from "@api/queries/__generated__/TenantPhotoGalleryQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";
import { inputColorScheme } from "@/theme/inputColorScheme";
import { thumbUrl } from "@/utils/thumb";
import {
  addPhoto,
  base64ToBytes,
  cleanTakeaways,
  initialRange,
  isDirty,
  MAX_DRAFT_PHOTOS,
  MAX_TAKEAWAYS,
  moveItem,
  photoPlace,
  rangeProblem,
  textSourceNote,
  type DraftPhoto,
  type DraftText,
} from "./clientRecapDraft";

type Draft = NonNullable<DraftQueryType["response"]["clientRecapDraft"]["draft"]>;
type DraftSummary = DraftsQueryType["response"]["clientRecapDrafts"][number];

const fieldStyle: React.CSSProperties = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-surface)",
  color: "var(--spark-text)",
  borderRadius: "var(--spark-radius-control, 8px)",
  padding: "8px 10px",
  fontSize: 14,
  minHeight: 38,
};

const meta: React.CSSProperties = { color: "var(--spark-text-meta)" };
const secondary: React.CSSProperties = { color: "var(--spark-text-secondary)" };

const Label: React.FC<{ htmlFor?: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} className="block text-xs mb-1" style={meta}>
    {children}
  </label>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-sm font-semibold" style={{ color: "var(--spark-text)" }}>
    {children}
  </h2>
);

const StaffOnly: React.FC = () => (
  <Layout>
    <div className="spark-empty spark-scale">
      <h1 className="spark-title text-2xl font-semibold">This page is for Ignite staff.</h1>
      <p className="spark-support mt-2 mx-auto">
        Your program report has the numbers, photos and feedback for any dates you pick.
      </p>
      <Link to="/reports" className="spark-btn-ghost mt-4">
        Open the program report
      </Link>
    </div>
  </Layout>
);

/* ─── Start: pick dates, see recent drafts ─────────────────────────── */

const StartDraft: React.FC = () => {
  const { tenantId } = useAuthStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const first = useMemo(
    () => initialRange(params.get("start"), params.get("end")),
    [params],
  );
  const [start, setStart] = useState(first.start);
  const [end, setEnd] = useState(first.end);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<readonly DraftSummary[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    let live = true;
    fetchQuery<DraftsQueryType>(environment, ClientRecapDraftsQuery, { tenantId: String(tenantId) })
      .toPromise()
      .then((data) => {
        if (live) setRecent(data?.clientRecapDrafts ?? []);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [tenantId]);

  const problem = rangeProblem(start, end);

  const create = () => {
    if (busy || problem || !tenantId) return;
    setBusy(true);
    setError("");
    commitMutation<CreateType>(environment, {
      mutation: CreateClientRecapDraftMutation,
      variables: { tenantId: String(tenantId), startDate: start, endDate: end },
      onCompleted: (data) => {
        setBusy(false);
        const result = data.createClientRecapDraft;
        if (result.ok && result.draft) {
          navigate(`/reports/client-recap/${result.draft.uuid}`);
        } else {
          setError(result.reason || "The draft could not be made.");
        }
      },
      onError: () => {
        setBusy(false);
        setError("The draft could not be made. Try again.");
      },
    });
  };

  return (
    <Layout>
      <div className="space-y-5 max-w-3xl spark-scale">
        <SparkPageHeader
          title="Draft client recap"
          support="Headline numbers, the best photos and a short summary for the dates you pick. You edit it, then download a PDF."
        />

        {!tenantId ? (
          <p className="text-sm" style={meta}>
            Choose a client first.
          </p>
        ) : (
          <div className="spark-card p-5 space-y-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <Label htmlFor="draft-start">From</Label>
                <input
                  id="draft-start"
                  type="date"
                  value={start}
                  max={end || undefined}
                  onChange={(e) => setStart(e.target.value)}
                  style={{ ...fieldStyle, colorScheme: inputColorScheme() }}
                />
              </div>
              <div>
                <Label htmlFor="draft-end">To</Label>
                <input
                  id="draft-end"
                  type="date"
                  value={end}
                  min={start || undefined}
                  onChange={(e) => setEnd(e.target.value)}
                  style={{ ...fieldStyle, colorScheme: inputColorScheme() }}
                />
              </div>
              <button
                type="button"
                className="spark-btn-primary"
                onClick={create}
                disabled={busy || Boolean(problem)}
              >
                {busy ? "Drafting…" : "Draft client recap"}
              </button>
            </div>
            {problem ? (
              <p className="text-sm" style={meta}>
                {problem}
              </p>
            ) : null}
            {busy ? (
              <p className="text-sm" style={secondary} role="status">
                Pulling the numbers and photos and writing a first draft. This can take up to a
                minute.
              </p>
            ) : null}
            {error ? (
              <p className="text-sm" role="alert" style={{ color: "var(--spark-flag-ink)" }}>
                {error}
              </p>
            ) : null}
            <p className="text-xs" style={meta}>
              Built from approved recaps only. The draft is visible to Ignite staff and is not sent
              or shared with the client.
            </p>
          </div>
        )}

        {recent.length > 0 ? (
          <div className="spark-card p-5">
            <SectionTitle>Recent drafts</SectionTitle>
            <ul className="list-none p-0 m-0 mt-2">
              {recent.map((d) => (
                <li
                  key={d.uuid}
                  className="flex items-baseline justify-between gap-3 py-2"
                  style={{ borderTop: "1px solid var(--spark-hairline, var(--spark-border))" }}
                >
                  <Link
                    to={`/reports/client-recap/${d.uuid}`}
                    className="text-sm font-semibold hover:underline"
                    style={{ color: "var(--spark-text)" }}
                  >
                    {d.title || "Client recap"}
                  </Link>
                  <span className="text-xs" style={meta}>
                    {d.period}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Layout>
  );
};

/* ─── Photo picker ─────────────────────────────────────────────────── */

const PhotoPicker: React.FC<{
  tenantId: string;
  startDate: string;
  endDate: string;
  chosen: readonly DraftPhoto[];
  onAdd: (p: DraftPhoto) => void;
  onClose: () => void;
}> = ({ tenantId, startDate, endDate, chosen, onAdd, onClose }) => {
  const [bestOnly, setBestOnly] = useState(true);
  const [photos, setPhotos] = useState<DraftPhoto[] | null>(null);

  useEffect(() => {
    let live = true;
    setPhotos(null);
    fetchQuery<GalleryQueryType>(environment, TenantPhotoGalleryQuery, {
      tenantId,
      startDate,
      endDate,
      state: null,
      store: null,
      category: null,
      picksOnly: bestOnly,
      first: 60,
      offset: 0,
    })
      .toPromise()
      .then((data) => {
        if (!live) return;
        setPhotos(
          (data?.tenantPhotoGallery?.photos ?? []).map((p) => ({
            id: p.id,
            url: p.url,
            category: p.category,
            caption: p.caption,
            store: p.store,
            state: p.state,
            eventDate: p.eventDate,
            isPick: p.isPick,
          })),
        );
      })
      .catch(() => {
        if (live) setPhotos([]);
      });
    return () => {
      live = false;
    };
  }, [tenantId, startDate, endDate, bestOnly]);

  const taken = new Set(chosen.map((p) => p.id));
  const full = chosen.length >= MAX_DRAFT_PHOTOS;

  return (
    <div
      className="p-4 mt-4"
      style={{
        border: "1px solid var(--spark-hairline, var(--spark-border))",
        borderRadius: "var(--spark-radius-control, 8px)",
      }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div className="pill-group" role="group" aria-label="Which photos to choose from">
          {(
            [
              [true, "Best photos"],
              [false, "All photos"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setBestOnly(value)}
              aria-pressed={bestOnly === value}
              className={`pill-btn whitespace-nowrap ${bestOnly === value ? "on" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="text-sm underline ml-auto" style={secondary} onClick={onClose}>
          Done
        </button>
      </div>
      {photos === null ? (
        <p className="text-sm mt-3" style={meta}>
          Loading photos…
        </p>
      ) : photos.length === 0 ? (
        <p className="text-sm mt-3" style={meta}>
          {bestOnly
            ? "No best photos in these dates yet. Choose All photos to pick from everything."
            : "No approved photos in these dates."}
        </p>
      ) : (
        <ul className="grid gap-3 grid-cols-2 sm:grid-cols-4 list-none p-0 mt-3 mb-0">
          {photos.map((p) => {
            const added = taken.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={added || full}
                  onClick={() => onAdd(p)}
                  className="block w-full text-left disabled:opacity-50"
                  aria-label={`Add photo: ${p.caption || p.category || "field photo"}, ${photoPlace(p)}`}
                >
                  <img
                    src={thumbUrl(p.url, 400)}
                    alt=""
                    loading="lazy"
                    className="w-full aspect-[4/3] object-cover block"
                    style={{
                      borderRadius: "var(--spark-radius-control, 8px)",
                      border: "1px solid var(--spark-hairline, var(--spark-border))",
                    }}
                  />
                  <span className="block text-xs mt-1 truncate" style={secondary}>
                    {added ? "In the draft" : p.caption || p.category || "Field photo"}
                  </span>
                  <span className="block text-xs truncate" style={meta}>
                    {photoPlace(p)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {full ? (
        <p className="text-xs mt-3" style={meta}>
          The draft holds {MAX_DRAFT_PHOTOS} photos. Remove one to add another.
        </p>
      ) : null}
    </div>
  );
};

/* ─── Editor ───────────────────────────────────────────────────────── */

const Editor: React.FC<{ uuid: string }> = ({ uuid }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [takeaways, setTakeaways] = useState<string[]>([]);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [saved, setSaved] = useState<DraftText | null>(null);
  const [textSource, setTextSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    let live = true;
    fetchQuery<DraftQueryType>(environment, ClientRecapDraftQuery, { uuid })
      .toPromise()
      .then((data) => {
        if (!live) return;
        const result = data?.clientRecapDraft;
        if (!result?.ok || !result.draft) {
          setLoadError(result?.reason || "The draft could not be loaded.");
          return;
        }
        const d = result.draft;
        const loadedPhotos = d.photos.map((p) => ({ ...p }));
        setDraft(d);
        setTitle(d.title);
        setSummary(d.summary);
        setTakeaways([...d.takeaways]);
        setPhotos(loadedPhotos);
        setTextSource(d.textSource);
        setSaved({
          title: d.title,
          summary: d.summary,
          takeaways: [...d.takeaways],
          photoIds: loadedPhotos.map((p) => p.id),
        });
      })
      .catch(() => {
        if (live) setLoadError("The draft could not be loaded.");
      });
    return () => {
      live = false;
    };
  }, [uuid]);

  const current: DraftText = useMemo(
    () => ({ title, summary, takeaways, photoIds: photos.map((p) => p.id) }),
    [title, summary, takeaways, photos],
  );
  const dirty = saved ? isDirty(saved, current) : false;

  const save = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        if (!title.trim()) {
          showAlert("Give the draft a title.", "error");
          resolve(false);
          return;
        }
        setSaving(true);
        commitMutation<UpdateType>(environment, {
          mutation: UpdateClientRecapDraftMutation,
          variables: {
            uuid,
            title: title.trim(),
            summary: summary.trim(),
            takeaways: cleanTakeaways(takeaways),
            photoIds: photos.map((p) => p.id),
          },
          onCompleted: (data) => {
            setSaving(false);
            const result = data.updateClientRecapDraft;
            if (!result.ok || !result.draft) {
              showAlert(result.reason || "Your changes could not be saved.", "error");
              resolve(false);
              return;
            }
            const d = result.draft;
            const kept = d.photos.map((p) => ({ ...p }));
            setTitle(d.title);
            setSummary(d.summary);
            setTakeaways([...d.takeaways]);
            setPhotos(kept);
            setTextSource(d.textSource);
            setSaved({
              title: d.title,
              summary: d.summary,
              takeaways: [...d.takeaways],
              photoIds: kept.map((p) => p.id),
            });
            resolve(true);
          },
          onError: () => {
            setSaving(false);
            showAlert("Your changes could not be saved. Try again.", "error");
            resolve(false);
          },
        });
      }),
    [uuid, title, summary, takeaways, photos, showAlert],
  );

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      if (dirty && !(await save())) return;
      const data = await fetchQuery<PdfQueryType>(
        environment,
        ClientRecapDraftPdfQuery,
        { uuid },
        { fetchPolicy: "network-only" },
      ).toPromise();
      const pdf = data?.clientRecapDraftPdf;
      if (!pdf?.ok || !pdf.pdfBase64) {
        showAlert(pdf?.reason || "The PDF could not be made.", "error");
        return;
      }
      const bytes = base64ToBytes(pdf.pdfBase64);
      const href = URL.createObjectURL(
        new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }),
      );
      const a = document.createElement("a");
      a.href = href;
      a.download = pdf.filename || "client-recap.pdf";
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      showAlert("The PDF could not be made. Try again.", "error");
    } finally {
      setDownloading(false);
    }
  };

  if (loadError) {
    return (
      <Layout>
        <div className="spark-empty spark-scale">
          <h1 className="spark-title text-2xl font-semibold">{loadError}</h1>
          <Link to="/reports/client-recap" className="spark-btn-ghost mt-4">
            Back to drafts
          </Link>
        </div>
      </Layout>
    );
  }
  if (!draft) {
    return (
      <Layout>
        <p className="text-sm spark-scale" style={meta}>
          Loading the draft…
        </p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 max-w-5xl spark-scale">
        <SparkPageHeader
          title="Draft client recap"
          support={`${draft.tenantName} · ${draft.period}. Visible to Ignite staff only. Nothing is sent to the client.`}
          action={
            <>
              <button
                type="button"
                className="spark-btn-ghost"
                onClick={() => void save()}
                disabled={!dirty || saving}
              >
                {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
              </button>
              <button
                type="button"
                className="spark-btn-primary"
                onClick={() => void download()}
                disabled={downloading || saving}
              >
                {downloading ? "Preparing PDF…" : "Download PDF"}
              </button>
            </>
          }
        />
        <p className="text-sm sm:hidden" style={secondary}>
          {draft.tenantName} · {draft.period}
        </p>

        <div className="spark-card p-5">
          <Label htmlFor="draft-title">Title on the cover</Label>
          <input
            id="draft-title"
            type="text"
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
            style={{ ...fieldStyle, width: "100%" }}
          />
        </div>

        <div className="spark-card p-5">
          <SectionTitle>Numbers</SectionTitle>
          <p className="text-xs mt-1" style={meta}>
            The same figures as the dashboard for these dates, taken when the draft was made. To
            pick up newly approved recaps, start a new draft.
          </p>
          <dl className="grid gap-x-6 gap-y-4 grid-cols-2 sm:grid-cols-4 mt-4 mb-0">
            {draft.numbers.map((n) => (
              <div key={n.label}>
                <dd
                  className="text-2xl font-semibold m-0"
                  style={{ color: "var(--spark-text)", fontVariantNumeric: "tabular-nums" }}
                >
                  {n.value.toLocaleString("en-US")}
                </dd>
                <dt className="text-xs" style={meta}>
                  {n.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="spark-card p-5 space-y-4">
          <div>
            <SectionTitle>Summary and takeaways</SectionTitle>
            <p className="text-xs mt-1" style={meta}>
              {textSourceNote(textSource)}
            </p>
          </div>
          <div>
            <Label htmlFor="draft-summary">Summary</Label>
            <textarea
              id="draft-summary"
              value={summary}
              rows={5}
              onChange={(e) => setSummary(e.target.value)}
              style={{ ...fieldStyle, width: "100%", lineHeight: 1.5, resize: "vertical" }}
            />
          </div>
          <div>
            <p className="text-xs mb-1" style={meta}>
              Takeaways
            </p>
            <ol className="list-none p-0 m-0 space-y-2">
              {takeaways.map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className="text-sm pt-2 w-5 shrink-0"
                    style={{ ...meta, fontVariantNumeric: "tabular-nums" }}
                  >
                    {i + 1}.
                  </span>
                  <textarea
                    aria-label={`Takeaway ${i + 1}`}
                    value={line}
                    rows={2}
                    onChange={(e) =>
                      setTakeaways((cur) => cur.map((t, j) => (j === i ? e.target.value : t)))
                    }
                    style={{ ...fieldStyle, flex: 1, lineHeight: 1.45, resize: "vertical" }}
                  />
                  <button
                    type="button"
                    className="text-xs underline pt-2"
                    style={meta}
                    onClick={() => setTakeaways((cur) => cur.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
            {takeaways.length < MAX_TAKEAWAYS ? (
              <button
                type="button"
                className="text-sm underline mt-2"
                style={secondary}
                onClick={() => setTakeaways((cur) => [...cur, ""])}
              >
                Add a takeaway
              </button>
            ) : null}
          </div>
        </div>

        <div className="spark-card p-5">
          <div className="flex items-baseline gap-3 flex-wrap">
            <SectionTitle>Photos</SectionTitle>
            <span className="text-xs" style={meta}>
              {photos.length} of {MAX_DRAFT_PHOTOS}. The first one is the cover.
            </span>
            <button
              type="button"
              className="text-sm underline ml-auto"
              style={secondary}
              onClick={() => setPicking((v) => !v)}
            >
              {picking ? "Close" : "Add photos"}
            </button>
          </div>
          {photos.length === 0 ? (
            <p className="text-sm mt-3" style={meta}>
              No photos yet. Add some, or download the PDF without them.
            </p>
          ) : (
            <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 list-none p-0 mt-4 mb-0">
              {photos.map((p, i) => (
                <li key={p.id}>
                  <img
                    src={thumbUrl(p.url, 400)}
                    alt={p.caption || p.category || "Field photo"}
                    loading="lazy"
                    className="w-full aspect-[4/3] object-cover block"
                    style={{
                      borderRadius: "var(--spark-radius-control, 8px)",
                      border: "1px solid var(--spark-hairline, var(--spark-border))",
                    }}
                  />
                  <p className="text-xs mt-1.5 font-semibold truncate" style={{ color: "var(--spark-text)" }}>
                    {i === 0 ? "Cover" : p.caption || p.category || "Field photo"}
                  </p>
                  <p className="text-xs truncate" style={meta}>
                    {photoPlace(p) || p.category}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <button
                      type="button"
                      className="underline disabled:opacity-40"
                      style={secondary}
                      disabled={i === 0}
                      onClick={() => setPhotos((cur) => moveItem(cur, i, -1))}
                    >
                      Earlier
                    </button>
                    <button
                      type="button"
                      className="underline disabled:opacity-40"
                      style={secondary}
                      disabled={i === photos.length - 1}
                      onClick={() => setPhotos((cur) => moveItem(cur, i, 1))}
                    >
                      Later
                    </button>
                    <button
                      type="button"
                      className="underline"
                      style={meta}
                      onClick={() => setPhotos((cur) => cur.filter((x) => x.id !== p.id))}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {picking ? (
            <PhotoPicker
              tenantId={draft.tenantId}
              startDate={draft.startDate}
              endDate={draft.endDate}
              chosen={photos}
              onAdd={(p) => setPhotos((cur) => addPhoto(cur, p))}
              onClose={() => setPicking(false)}
            />
          ) : null}
        </div>

        {draft.quotes.length > 0 ? (
          <div className="spark-card p-5">
            <SectionTitle>What consumers said</SectionTitle>
            <p className="text-xs mt-1" style={meta}>
              Printed on the comments page as written on approved recaps.
            </p>
            <ul className="list-none p-0 m-0 mt-3 space-y-2">
              {draft.quotes.map((q, i) => (
                <li
                  key={i}
                  className="text-sm pl-3"
                  style={{ ...secondary, borderLeft: "2px solid var(--spark-border)" }}
                >
                  {q}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-xs" style={meta}>
          <Link to="/reports/client-recap" className="underline" style={{ color: "inherit" }}>
            All drafts
          </Link>
        </p>
      </div>
    </Layout>
  );
};

/**
 * Staff-only first draft of a client recap deck: numbers from the dashboard
 * roll-ups, the best photos, and a short summary with takeaways. Staff edit
 * the words, swap the photos and download a PDF. Nothing here sends or
 * shares anything with a client. Needs clientRecapDraft on the server.
 */
const SparkClientRecapDraft: React.FC = () => {
  const { uuid } = useParams<{ uuid?: string }>();
  const { isClient } = useSparkRole();
  if (isClient) return <StaffOnly />;
  return uuid ? <Editor key={uuid} uuid={uuid} /> : <StartDraft />;
};

export default SparkClientRecapDraft;
