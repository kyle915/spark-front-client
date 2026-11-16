import { useCallback, useEffect, useState } from "react";
import { commitMutation, fetchQuery } from "react-relay";
import environment from "@/api/relay/environment";
import { RecapPhotoPicksQuery } from "@/api/queries/RecapPhotoPicksQuery";
import type { RecapPhotoPicksQuery as PicksQueryType } from "@/api/queries/__generated__/RecapPhotoPicksQuery.graphql";
import { SetRecapPhotoPickMutation } from "@/api/mutations/SetRecapPhotoPickMutation";
import type { SetRecapPhotoPickMutation as SetPickType } from "@/api/mutations/__generated__/SetRecapPhotoPickMutation.graphql";
import { thumbUrl } from "@/utils/thumb";
import {
  anyLookedAt,
  nextChoice,
  pickCount,
  picksFirst,
  statusLine,
  type PhotoPick,
  type PickChoice,
} from "./bestPhotos";

/**
 * Staff view of which photos on a recap count as its best photos: the ones
 * the Photos page, the program report and a client recap draft lead with.
 * Spark suggests three or four; staff can pin or unpin any photo and their
 * choice is kept. Receipts can't be pinned.
 *
 * Renders nothing for a recap with no photos, or when the server says the
 * viewer may not see it.
 */
export function RecapBestPhotosPanel({ recapId }: { recapId: string }) {
  const [items, setItems] = useState<PhotoPick[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetchQuery<PicksQueryType>(environment, RecapPhotoPicksQuery, { recapId })
      .toPromise()
      .then((data) => {
        if (!live) return;
        const result = data?.recapPhotoPicks;
        setItems(result?.ok ? result.items.map((i) => ({ ...i })) : []);
      })
      .catch(() => {
        if (live) setItems([]);
      });
    return () => {
      live = false;
    };
  }, [recapId]);

  const choose = useCallback((fileId: string, choice: PickChoice) => {
    setSaving(fileId);
    setError("");
    commitMutation<SetPickType>(environment, {
      mutation: SetRecapPhotoPickMutation,
      variables: { fileId, choice },
      onCompleted: (data) => {
        setSaving(null);
        const result = data.setRecapPhotoPick;
        if (result.items.length > 0) setItems(result.items.map((i) => ({ ...i })));
        if (!result.ok) setError(result.reason || "That change could not be saved.");
      },
      onError: () => {
        setSaving(null);
        setError("That change could not be saved. Try again.");
      },
    });
  }, []);

  if (!items || items.length === 0) return null;

  const picks = pickCount(items);
  const looked = anyLookedAt(items);

  return (
    <section className="spark-card p-5" aria-label="Best photos">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="text-sm font-semibold" style={{ color: "var(--recap-text, var(--spark-text))" }}>
          Best photos
        </h2>
        <span className="text-xs" style={{ color: "var(--recap-muted, var(--spark-text-meta))" }}>
          {picks} of {items.length}
        </span>
      </div>
      <p className="text-[13px] mt-1" style={{ color: "var(--recap-muted, var(--spark-text-secondary))" }}>
        {looked
          ? "These lead the Photos page, the program report and client recap drafts. Pin or unpin any photo and your choice is kept."
          : "Not scored yet. Photos are looked at within the hour once a recap is approved. You can pin photos now."}
      </p>
      {error ? (
        <p className="text-[13px] mt-2" role="alert" style={{ color: "var(--spark-flag-ink)" }}>
          {error}
        </p>
      ) : null}
      <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 list-none p-0 mt-4 mb-0">
        {picksFirst(items).map((item) => {
          const busy = saving === item.fileId;
          return (
            <li key={item.fileId}>
              <div
                className="overflow-hidden"
                style={{
                  borderRadius: "var(--spark-radius-control, 8px)",
                  border: item.isPick
                    ? "2px solid var(--recap-text, var(--spark-text))"
                    : "1px solid var(--spark-hairline, var(--spark-border))",
                  background: "var(--spark-surface-2)",
                }}
              >
                <img
                  src={thumbUrl(item.url, 400)}
                  alt={item.caption || item.category || "Recap photo"}
                  loading="lazy"
                  className="w-full aspect-[4/3] object-cover block"
                />
              </div>
              <p className="text-xs mt-1.5 font-semibold" style={{ color: "var(--recap-text, var(--spark-text))" }}>
                {item.isPick ? "Best photo" : item.category || "Photo"}
              </p>
              {item.caption ? (
                <p className="text-xs" style={{ color: "var(--recap-muted, var(--spark-text-secondary))" }}>
                  {item.caption}
                </p>
              ) : null}
              <p className="text-xs" style={{ color: "var(--recap-muted, var(--spark-text-meta))" }}>
                {statusLine(item)}
              </p>
              {item.canPick ? (
                <div className="flex items-center gap-3 mt-1.5">
                  <button
                    type="button"
                    className="text-xs font-semibold underline disabled:opacity-50"
                    style={{ color: "var(--recap-text, var(--spark-text))" }}
                    disabled={busy}
                    aria-pressed={item.isPick}
                    onClick={() => choose(item.fileId, nextChoice(item))}
                  >
                    {busy ? "Saving…" : item.isPick ? "Unpin" : "Pin"}
                  </button>
                  {item.staffChoice ? (
                    <button
                      type="button"
                      className="text-xs underline disabled:opacity-50"
                      style={{ color: "var(--recap-muted, var(--spark-text-meta))" }}
                      disabled={busy}
                      onClick={() => choose(item.fileId, "")}
                    >
                      Undo
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default RecapBestPhotosPanel;
