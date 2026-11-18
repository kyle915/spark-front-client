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
  SetClientRecapDeckStatusMutation,
  UpdateClientRecapDraftMutation,
} from "@/api/mutations/ClientRecapDraftMutations";
import type { ClientRecapDraftMutationsCreateMutation as CreateType } from "@api/mutations/__generated__/ClientRecapDraftMutationsCreateMutation.graphql";
import type { ClientRecapDraftMutationsUpdateMutation as UpdateType } from "@api/mutations/__generated__/ClientRecapDraftMutationsUpdateMutation.graphql";
import type { ClientRecapDraftMutationsStatusMutation as StatusType } from "@api/mutations/__generated__/ClientRecapDraftMutationsStatusMutation.graphql";
import { TenantPhotoGalleryQuery } from "@/api/queries/TenantPhotoGalleryQuery";
import type { TenantPhotoGalleryQuery as GalleryQueryType } from "@api/queries/__generated__/TenantPhotoGalleryQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import useSparkRole from "@/hooks/useSparkRole";
import { inputColorScheme } from "@/theme/inputColorScheme";
import { thumbUrl } from "@/utils/thumb";
import {
  addPhoto,
  cleanNextSteps,
  cleanTakeaways,
  initialRange,
  isDirty,
  MAX_DRAFT_PHOTOS,
  MAX_NEXT_STEPS,
  MAX_TAKEAWAYS,
  moveItem,
  photoPlace,
  rangeProblem,
  shortDay,
  statusLabel,
  statusNote,
  textSourceNote,
  toggleIn,
  type DraftPhoto,
  type DraftText,
} from "./clientRecapDraft";
import { downloadPdf } from "./downloadPdf";

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
          title="Client recap deck"
          support="The end-of-program deck for the dates you pick: headline numbers, where it ran, what consumers said, the best photos and a short summary. You check and edit it, then mark it ready to share with the brand."
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
                {busy ? "Building…" : "Build the deck"}
              </button>
            </div>
            {problem ? (
              <p className="text-sm" style={meta}>
                {problem}
              </p>
            ) : null}
            {busy ? (
              <p className="text-sm" style={secondary} role="status">
                Pulling the numbers, photos and consumer comments and writing a first draft. This
                can take up to a minute. For a big program the summary is finished in the
                background.
              </p>
            ) : null}
            {error ? (
              <p className="text-sm" role="alert" style={{ color: "var(--spark-flag-ink)" }}>
                {error}
              </p>
            ) : null}
            <p className="text-xs" style={meta}>
              Built from approved recaps only, with no-product visits left out of the demo count.
              Only Ignite staff see it until you mark it ready; nothing is emailed.
            </p>
          </div>
        )}

        {recent.length > 0 ? (
          <div className="spark-card p-5">
            <SectionTitle>Recent decks</SectionTitle>
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
                    {d.title || "Client recap deck"}
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
          The deck holds {MAX_DRAFT_PHOTOS} photos. Remove one to add another.
        </p>
      ) : null}
    </div>
  );
};

/* ─── Editor ───────────────────────────────────────────────────────── */

const BUILD_POLL_MS = 20_000;

const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span
    className="inline-block text-xs font-semibold px-2.5 py-1 whitespace-nowrap"
    style={{
      borderRadius: 999,
      border: "1px solid var(--spark-border)",
      color: "var(--spark-text)",
      background:
        status === "ready" ? "rgba(var(--spark-ok-rgb), 0.18)" : "var(--spark-surface)",
    }}
  >
    {statusLabel(status)}
  </span>
);

const LineList: React.FC<{
  label: string;
  lines: string[];
  max: number;
  addLabel: string;
  onChange: (next: string[]) => void;
}> = ({ label, lines, max, addLabel, onChange }) => (
  <div>
    <ol className="list-none p-0 m-0 space-y-2">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-2">
          <span
            className="text-sm pt-2 w-5 shrink-0"
            style={{ ...meta, fontVariantNumeric: "tabular-nums" }}
          >
            {i + 1}.
          </span>
          <textarea
            aria-label={`${label} ${i + 1}`}
            value={line}
            rows={2}
            onChange={(e) => onChange(lines.map((t, j) => (j === i ? e.target.value : t)))}
            style={{ ...fieldStyle, flex: 1, lineHeight: 1.45, resize: "vertical" }}
          />
          <button
            type="button"
            className="text-xs underline pt-2"
            style={meta}
            onClick={() => onChange(lines.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </li>
      ))}
    </ol>
    {lines.length < max ? (
      <button
        type="button"
        className="text-sm underline mt-2"
        style={secondary}
        onClick={() => onChange([...lines, ""])}
      >
        {addLabel}
      </button>
    ) : null}
  </div>
);

const VisitRow: React.FC<{
  visit: Draft["leftOutVisits"][number];
  toggle?: { checked: boolean; onChange: (on: boolean) => void };
}> = ({ visit, toggle }) => {
  const where = [visit.store || "Store not recorded", visit.state].filter(Boolean).join(", ");
  return (
    <li
      className="py-2.5 flex items-start gap-3"
      style={{ borderTop: "1px solid var(--spark-hairline, var(--spark-border))" }}
    >
      {toggle ? (
        <input
          type="checkbox"
          className="mt-1"
          checked={toggle.checked}
          onChange={(e) => toggle.onChange(e.target.checked)}
          aria-label={`Count the ${shortDay(visit.day)} visit to ${where} as a demo`}
        />
      ) : null}
      <div className="min-w-0">
        <p className="text-sm m-0" style={{ color: "var(--spark-text)" }}>
          {[shortDay(visit.day), where].filter(Boolean).join(" · ")}
          <span style={meta}> · {visit.label}</span>
        </p>
        {visit.evidence ? (
          <p className="text-xs m-0 mt-0.5" style={meta}>
            Notes: {visit.evidence}
          </p>
        ) : null}
      </div>
    </li>
  );
};

const Editor: React.FC<{ uuid: string }> = ({ uuid }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [takeaways, setTakeaways] = useState<string[]>([]);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [hiddenQuotes, setHiddenQuotes] = useState<string[]>([]);
  const [keptVisits, setKeptVisits] = useState<string[]>([]);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [saved, setSaved] = useState<DraftText | null>(null);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [picking, setPicking] = useState(false);

  const apply = useCallback((d: Draft) => {
    const loadedPhotos = d.photos.map((p) => ({ ...p }));
    const hidden = d.quoteChoices.filter((q) => q.hidden).map((q) => q.text);
    const kept = d.leftOutVisits.filter((v) => v.kept).map((v) => v.key);
    setDraft(d);
    setTitle(d.title);
    setSummary(d.summary);
    setTakeaways([...d.takeaways]);
    setNextSteps([...d.nextSteps]);
    setHiddenQuotes(hidden);
    setKeptVisits(kept);
    setPhotos(loadedPhotos);
    setSaved({
      title: d.title,
      summary: d.summary,
      takeaways: [...d.takeaways],
      photoIds: loadedPhotos.map((p) => p.id),
      nextSteps: [...d.nextSteps],
      hiddenQuotes: hidden,
      keptVisits: kept,
    });
  }, []);

  const load = useCallback(
    () =>
      fetchQuery<DraftQueryType>(
        environment,
        ClientRecapDraftQuery,
        { uuid },
        { fetchPolicy: "network-only" },
      )
        .toPromise()
        .then((data) => {
          const result = data?.clientRecapDraft;
          if (!result?.ok || !result.draft) {
            setLoadError(result?.reason || "The draft could not be loaded.");
            return null;
          }
          apply(result.draft);
          return result.draft;
        })
        .catch(() => {
          setLoadError("The draft could not be loaded.");
          return null;
        }),
    [uuid, apply],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // A big program is finished in the background: check back until it is.
  const building = draft?.status === "building";
  useEffect(() => {
    if (!building) return;
    const timer = window.setInterval(() => void load(), BUILD_POLL_MS);
    return () => window.clearInterval(timer);
  }, [building, load]);

  const current: DraftText = useMemo(
    () => ({
      title,
      summary,
      takeaways,
      photoIds: photos.map((p) => p.id),
      nextSteps,
      hiddenQuotes,
      keptVisits,
    }),
    [title, summary, takeaways, photos, nextSteps, hiddenQuotes, keptVisits],
  );
  const dirty = saved ? isDirty(saved, current) : false;
  const canEdit = Boolean(draft?.canEdit);

  const save = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        if (!title.trim()) {
          showAlert("Give the deck a title.", "error");
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
            nextSteps: cleanNextSteps(nextSteps),
            hiddenQuotes,
            keptVisits,
          },
          onCompleted: (data) => {
            const result = data.updateClientRecapDraft;
            if (!result.ok || !result.draft) {
              setSaving(false);
              showAlert(result.reason || "Your changes could not be saved.", "error");
              resolve(false);
              return;
            }
            void load().then((d) => {
              setSaving(false);
              resolve(Boolean(d));
            });
          },
          onError: () => {
            setSaving(false);
            showAlert("Your changes could not be saved. Try again.", "error");
            resolve(false);
          },
        });
      }),
    [uuid, title, summary, takeaways, photos, nextSteps, hiddenQuotes, keptVisits, showAlert, load],
  );

  const setStatus = async (next: "ready" | "draft") => {
    if (sharing) return;
    setSharing(true);
    try {
      if (next === "ready" && dirty && !(await save())) return;
      await new Promise<void>((resolve) => {
        commitMutation<StatusType>(environment, {
          mutation: SetClientRecapDeckStatusMutation,
          variables: { uuid, status: next },
          onCompleted: (data) => {
            const result = data.setClientRecapDeckStatus;
            if (!result.ok) {
              showAlert(result.reason || "That change could not be saved.", "error");
              resolve();
              return;
            }
            showAlert(
              next === "ready"
                ? "Shared. The brand can download it from their program report. Nothing was emailed."
                : "Back to a staff draft. The brand can no longer see it.",
              "success",
            );
            void load().then(() => resolve());
          },
          onError: () => {
            showAlert("That change could not be saved. Try again.", "error");
            resolve();
          },
        });
      });
    } finally {
      setSharing(false);
    }
  };

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      if (dirty && canEdit && !(await save())) return;
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
      downloadPdf(pdf.pdfBase64, pdf.filename || "client-recap.pdf");
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
            Back to decks
          </Link>
        </div>
      </Layout>
    );
  }
  if (!draft) {
    return (
      <Layout>
        <p className="text-sm spark-scale" style={meta}>
          Loading the deck…
        </p>
      </Layout>
    );
  }

  const dashboard = Object.fromEntries(draft.numbers.map((n) => [n.label, n.value]));
  const keptCount = draft.leftOutVisits.filter((v) => keptVisits.includes(v.key)).length;

  return (
    <Layout>
      <div className="space-y-5 max-w-5xl spark-scale">
        <SparkPageHeader
          title="Client recap deck"
          support={`${draft.tenantName} · ${draft.period}`}
          action={
            <>
              {canEdit ? (
                <button
                  type="button"
                  className="spark-btn-ghost"
                  onClick={() => void save()}
                  disabled={!dirty || saving}
                >
                  {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
                </button>
              ) : null}
              <button
                type="button"
                className="spark-btn-ghost"
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

        {/* Where the deck is: being written, staff draft, or shared. */}
        <div className="spark-card p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <StatusPill status={draft.status} />
            {draft.status === "ready" && draft.readyAt ? (
              <span className="text-xs" style={meta}>
                Since {shortDay(draft.readyAt)}
              </span>
            ) : null}
            <div className="ml-auto">
              {draft.status === "draft" ? (
                <button
                  type="button"
                  className="spark-btn-primary"
                  onClick={() => void setStatus("ready")}
                  disabled={sharing || saving}
                >
                  {sharing ? "Sharing…" : "Mark ready to share"}
                </button>
              ) : draft.status === "ready" ? (
                <button
                  type="button"
                  className="spark-btn-ghost"
                  onClick={() => void setStatus("draft")}
                  disabled={sharing}
                >
                  {sharing ? "Saving…" : "Back to draft"}
                </button>
              ) : null}
            </div>
          </div>
          <p className="text-sm mt-3 mb-0" style={secondary}>
            {statusNote(draft.status)}
          </p>
          {draft.buildNote ? (
            <p className="text-sm mt-2 mb-0" style={{ color: "var(--spark-flag-ink)" }}>
              {draft.buildNote}
            </p>
          ) : null}
        </div>

        <fieldset disabled={!canEdit} className="space-y-5 m-0 p-0 border-0 min-w-0">
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
            <SectionTitle>Headline numbers</SectionTitle>
            <p className="text-xs mt-1" style={meta}>
              What the deck prints. Totals are the dashboard's for these dates, taken when the deck
              was made
              {dashboard["Approved recaps"] !== undefined
                ? ` (${dashboard["Approved recaps"].toLocaleString("en-US")} approved recaps)`
                : ""}
              . To pick up newly approved recaps, start a new deck.
            </p>
            <dl className="grid gap-x-6 gap-y-4 grid-cols-2 sm:grid-cols-4 mt-4 mb-0">
              {draft.deckNumbers.map((n) => (
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
            {draft.noProductNote ? (
              <p className="text-sm mt-4 mb-0" style={secondary}>
                {draft.noProductNote}
              </p>
            ) : null}
          </div>

          {draft.leftOutVisits.length > 0 || draft.visitsToCheck.length > 0 ? (
            <div className="spark-card p-5">
              <SectionTitle>No-product visits</SectionTitle>
              <p className="text-xs mt-1" style={meta}>
                A visit that recorded nothing and either says there was no product or has no notes
                is left out of the demo count. Totals do not change. Read each one: if the store
                did have product (a photo of a stocked shelf, say), tick it to count it as a demo.
                The deck lists left-out visits by date, store and reason only, never the notes.
              </p>
              {draft.leftOutVisits.length > 0 ? (
                <>
                  <p className="text-sm font-semibold mt-4 mb-1" style={{ color: "var(--spark-text)" }}>
                    Left out ({draft.leftOutVisits.length - keptCount} of {draft.leftOutVisits.length})
                  </p>
                  <ul className="list-none p-0 m-0">
                    {draft.leftOutVisits.map((v) => (
                      <VisitRow
                        key={v.key}
                        visit={v}
                        toggle={{
                          checked: keptVisits.includes(v.key),
                          onChange: (on) => setKeptVisits((cur) => toggleIn(cur, v.key, on)),
                        }}
                      />
                    ))}
                  </ul>
                  <p className="text-xs mt-2 mb-0" style={meta}>
                    Ticked visits count as demos.
                  </p>
                </>
              ) : null}
              {draft.visitsToCheck.length > 0 ? (
                <>
                  <p className="text-sm font-semibold mt-5 mb-1" style={{ color: "var(--spark-text)" }}>
                    Counted, but worth a look ({draft.visitsToCheck.length})
                  </p>
                  <ul className="list-none p-0 m-0">
                    {draft.visitsToCheck.map((v) => (
                      <VisitRow key={v.key} visit={v} />
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="spark-card p-5 space-y-4">
            <div>
              <SectionTitle>Summary and takeaways</SectionTitle>
              <p className="text-xs mt-1" style={meta}>
                {draft.status === "building"
                  ? "Built from the numbers for now. The written version replaces it when it is ready."
                  : textSourceNote(draft.textSource)}
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
              <LineList
                label="Takeaway"
                lines={takeaways}
                max={MAX_TAKEAWAYS}
                addLabel="Add a takeaway"
                onChange={setTakeaways}
              />
            </div>
          </div>

          <div className="spark-card p-5">
            <SectionTitle>Next steps</SectionTitle>
            <p className="text-xs mt-1 mb-3" style={meta}>
              Optional. Printed on their own page when there are any. Suggested from the numbers and
              comments; keep only what Ignite will stand behind.
            </p>
            <LineList
              label="Next step"
              lines={nextSteps}
              max={MAX_NEXT_STEPS}
              addLabel="Add a next step"
              onChange={setNextSteps}
            />
          </div>

          <div className="spark-card p-5">
            <div className="flex items-baseline gap-3 flex-wrap">
              <SectionTitle>Photos</SectionTitle>
              <span className="text-xs" style={meta}>
                {photos.length} of {MAX_DRAFT_PHOTOS}. The first one is the cover. Receipts,
                screenshots, unusable shots and photos from no-product visits are never used.
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
                    <p
                      className="text-xs mt-1.5 font-semibold truncate"
                      style={{ color: "var(--spark-text)" }}
                    >
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
            {picking && canEdit ? (
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

          {draft.quoteChoices.length > 0 ? (
            <div className="spark-card p-5">
              <SectionTitle>What consumers said</SectionTitle>
              <p className="text-xs mt-1" style={meta}>
                As noted on approved recaps, trimmed for length, never reworded. The deck prints
                up to six; leave out any that should not go to the brand.
              </p>
              <ul className="list-none p-0 m-0 mt-3 space-y-2">
                {draft.quoteChoices.map((q) => {
                  const hidden = hiddenQuotes.includes(q.text);
                  return (
                    <li key={q.text} className="flex items-start gap-3">
                      <span
                        className="text-sm pl-3 flex-1"
                        style={{
                          ...(hidden ? meta : secondary),
                          borderLeft: "2px solid var(--spark-border)",
                          textDecoration: hidden ? "line-through" : "none",
                        }}
                      >
                        {q.text}
                      </span>
                      <button
                        type="button"
                        className="text-xs underline whitespace-nowrap"
                        style={meta}
                        onClick={() => setHiddenQuotes((cur) => toggleIn(cur, q.text, !hidden))}
                      >
                        {hidden ? "Put back" : "Leave out"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </fieldset>

        <p className="text-xs" style={meta}>
          <Link to="/reports/client-recap" className="underline" style={{ color: "inherit" }}>
            All decks
          </Link>
        </p>
      </div>
    </Layout>
  );
};

/**
 * Client recap deck, staff side: numbers from the dashboard roll-ups with
 * no-product visits left out of the demo count, the best photos, consumer
 * quotes, a short summary, takeaways and next steps. Staff edit it, then
 * mark it ready; only then can the brand's users download it from their
 * program report. Nothing here emails anyone. Needs clientRecapDraft and
 * setClientRecapDeckStatus on the server.
 */
const SparkClientRecapDraft: React.FC = () => {
  const { uuid } = useParams<{ uuid?: string }>();
  const { isClient } = useSparkRole();
  if (isClient) return <StaffOnly />;
  return uuid ? <Editor key={uuid} uuid={uuid} /> : <StartDraft />;
};

export default SparkClientRecapDraft;
