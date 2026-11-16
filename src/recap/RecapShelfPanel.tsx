import { useEffect, useState } from "react";
import { fetchQuery, useMutation } from "react-relay";
import environment from "@/api/relay/environment";
import { RecapShelfReadingsQuery } from "@/api/queries/RecapShelfReadingsQuery";
import type { RecapShelfReadingsQuery as RecapShelfReadingsQueryType } from "@/api/queries/__generated__/RecapShelfReadingsQuery.graphql";
import { ReadRecapShelfPhotosMutation } from "@/api/mutations/ReadRecapShelfPhotosMutation";
import type { ReadRecapShelfPhotosMutation as ReadMutationType } from "@/api/mutations/__generated__/ReadRecapShelfPhotosMutation.graphql";
import { CorrectShelfReadingMutation } from "@/api/mutations/CorrectShelfReadingMutation";
import type { CorrectShelfReadingMutation as CorrectMutationType } from "@/api/mutations/__generated__/CorrectShelfReadingMutation.graphql";
import {
  SHELF_ANSWERS,
  answerWord,
  asShelfAnswer,
  effectiveAnswers,
  parseFacings,
  parsePrice,
  readingLines,
  statusLine,
  type ShelfAnswer,
  type ShelfPhoto,
} from "./shelfReading";

const META = { color: "var(--spark-text-meta)" } as const;
const SECONDARY = { color: "var(--spark-text-secondary)" } as const;
const TEXT = { color: "var(--spark-text)" } as const;
const BOX = {
  border: "1px solid var(--spark-border)",
  background: "rgba(var(--spark-ink-rgb),0.04)",
  color: "var(--spark-text)",
} as const;

type Draft = {
  productOnShelf: ShelfAnswer;
  facings: string;
  priceTagVisible: ShelfAnswer;
  price: string;
  outOfStockGap: ShelfAnswer;
  note: string;
};

function draftFor(photo: ShelfPhoto): Draft {
  const a = effectiveAnswers(photo);
  return {
    productOnShelf: asShelfAnswer(a?.productOnShelf),
    facings: typeof a?.facings === "number" ? String(a.facings) : "",
    priceTagVisible: asShelfAnswer(a?.priceTagVisible),
    price: a?.price ?? "",
    outOfStockGap: asShelfAnswer(a?.outOfStockGap),
    note: photo.correction?.note ?? "",
  };
}

const AnswerSelect: React.FC<{
  id: string;
  label: string;
  value: ShelfAnswer;
  onChange: (next: ShelfAnswer) => void;
}> = ({ id, label, value, onChange }) => (
  <label htmlFor={id} className="flex flex-col gap-1 text-[13px]" style={SECONDARY}>
    {label}
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(asShelfAnswer(e.target.value))}
      className="px-2.5 py-2 rounded-xl text-sm"
      style={BOX}
    >
      {SHELF_ANSWERS.map((answer) => (
        <option key={answer} value={answer}>
          {answerWord(answer)}
        </option>
      ))}
    </select>
  </label>
);

const PhotoRow: React.FC<{
  photo: ShelfPhoto;
  onSaved: (photo: ShelfPhoto) => void;
}> = ({ photo, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFor(photo));
  const [error, setError] = useState("");
  const [commit, saving] = useMutation<CorrectMutationType>(CorrectShelfReadingMutation);
  const answers = effectiveAnswers(photo);
  const id = `shelf-${photo.fileId}`;

  const save = () => {
    const facings = draft.facings.trim() === "" ? null : parseFacings(draft.facings);
    const price = parsePrice(draft.price);
    if (draft.facings.trim() !== "" && facings === null) {
      setError("Facings must be a whole number.");
      return;
    }
    if (price === null) {
      setError("Price must be an amount like 3.49.");
      return;
    }
    setError("");
    commit({
      variables: {
        input: {
          fileId: photo.fileId,
          productOnShelf: draft.productOnShelf,
          facings,
          priceTagVisible: draft.priceTagVisible,
          price: price === "" ? null : price,
          outOfStockGap: draft.outOfStockGap,
          note: draft.note,
        },
      },
      onCompleted: (res) => {
        const payload = res.correctShelfReading;
        if (payload.success && payload.photo) {
          onSaved(payload.photo);
          setEditing(false);
        } else {
          setError(payload.message || "Could not save that.");
        }
      },
      onError: () => setError("Could not save that. Try again."),
    });
  };

  return (
    <li className="flex gap-4 flex-wrap sm:flex-nowrap">
      {photo.fileUrl ? (
        <a href={photo.fileUrl} target="_blank" rel="noreferrer" className="shrink-0">
          <img
            src={photo.fileUrl}
            alt={`${photo.bucketName} photo`}
            loading="lazy"
            width={112}
            height={112}
            className="rounded-xl object-cover"
            style={{ width: 112, height: 112, border: "1px solid var(--spark-border)" }}
          />
        </a>
      ) : null}
      <div className="min-w-0 flex-1">
        {answers ? (
          <dl className="m-0 grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr] text-sm">
            {readingLines(answers).map((line) => (
              <div key={line.label} className="contents">
                <dt style={SECONDARY}>{line.label}</dt>
                <dd className="m-0 font-medium" style={TEXT}>
                  {line.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm" style={SECONDARY}>
            {statusLine(photo)}
          </p>
        )}
        {photo.correction ? (
          <p className="text-[13px] mt-1.5" style={META}>
            Corrected by {photo.correction.correctedByName || "staff"}.
            {photo.reading
              ? ` Read from the photo as: product ${answerWord(photo.reading.productOnShelf).toLowerCase()}, price tag ${answerWord(photo.reading.priceTagVisible).toLowerCase()}.`
              : ""}
            {photo.correction.note ? ` Note: ${photo.correction.note}` : ""}
          </p>
        ) : answers ? (
          <p className="text-[13px] mt-1.5" style={META}>
            Read from the photo. Correct it if it is wrong.
          </p>
        ) : null}

        {!editing ? (
          <button
            type="button"
            onClick={() => {
              setDraft(draftFor(photo));
              setEditing(true);
            }}
            className="mt-2 px-3 py-2 rounded-xl text-sm"
            style={{ border: "1px solid var(--spark-border)", color: "var(--spark-text)" }}
          >
            {answers ? "Correct" : "Enter by hand"}
          </button>
        ) : (
          <form
            className="mt-3 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <AnswerSelect
                id={`${id}-product`}
                label="Product on shelf"
                value={draft.productOnShelf}
                onChange={(v) => setDraft((d) => ({ ...d, productOnShelf: v }))}
              />
              <AnswerSelect
                id={`${id}-tag`}
                label="Price tag visible"
                value={draft.priceTagVisible}
                onChange={(v) => setDraft((d) => ({ ...d, priceTagVisible: v }))}
              />
              <AnswerSelect
                id={`${id}-gap`}
                label="Out-of-stock gap"
                value={draft.outOfStockGap}
                onChange={(v) => setDraft((d) => ({ ...d, outOfStockGap: v }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label
                htmlFor={`${id}-facings`}
                className="flex flex-col gap-1 text-[13px]"
                style={SECONDARY}
              >
                Facings
                <input
                  id={`${id}-facings`}
                  inputMode="numeric"
                  value={draft.facings}
                  disabled={draft.productOnShelf !== "yes"}
                  onChange={(e) => setDraft((d) => ({ ...d, facings: e.target.value }))}
                  className="px-2.5 py-2 rounded-xl text-sm"
                  style={{ ...BOX, opacity: draft.productOnShelf === "yes" ? 1 : 0.5 }}
                />
              </label>
              <label
                htmlFor={`${id}-price`}
                className="flex flex-col gap-1 text-[13px]"
                style={SECONDARY}
              >
                Price
                <input
                  id={`${id}-price`}
                  inputMode="decimal"
                  placeholder="3.49"
                  value={draft.price}
                  disabled={draft.priceTagVisible !== "yes"}
                  onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                  className="px-2.5 py-2 rounded-xl text-sm"
                  style={{ ...BOX, opacity: draft.priceTagVisible === "yes" ? 1 : 0.5 }}
                />
              </label>
              <label
                htmlFor={`${id}-note`}
                className="flex flex-col gap-1 text-[13px]"
                style={SECONDARY}
              >
                Note for staff
                <input
                  id={`${id}-note`}
                  value={draft.note}
                  maxLength={2000}
                  onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                  className="px-2.5 py-2 rounded-xl text-sm"
                  style={BOX}
                />
              </label>
            </div>
            {error ? (
              <p className="text-[13px]" role="alert" style={{ color: "var(--spark-danger, #b42318)" }}>
                {error}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-2 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--spark-lime)",
                  color: "var(--spark-on-accent)",
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? "Saving" : "Save"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setError("");
                }}
                className="px-3 py-2 rounded-xl text-sm"
                style={SECONDARY}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </li>
  );
};

/**
 * Staff review aid: what was read from each shelf photo on this recap
 * (product on shelf, facings, price tag, gap), beside the photo, with a way
 * to correct it. A correction is stored apart from the reading and is the
 * answer from then on. Shows nothing on a recap with no shelf photos, for
 * anyone who is not Ignite staff, or when the load fails. It does not
 * approve or reject.
 */
export function RecapShelfPanel({ recapId }: { recapId: string }) {
  const [photos, setPhotos] = useState<ShelfPhoto[] | null>(null);
  const [message, setMessage] = useState("");
  const [commitRead, reading] = useMutation<ReadMutationType>(ReadRecapShelfPhotosMutation);

  useEffect(() => {
    let live = true;
    setPhotos(null);
    setMessage("");
    fetchQuery<RecapShelfReadingsQueryType>(environment, RecapShelfReadingsQuery, { recapId })
      .toPromise()
      .then((data) => {
        if (!live) return;
        const result = data?.recapShelfReadings;
        setPhotos(result?.allowed ? [...result.photos] : []);
      })
      .catch(() => {
        if (live) setPhotos([]);
      });
    return () => {
      live = false;
    };
  }, [recapId]);

  if (!photos || photos.length === 0) return null;

  const pending = photos.filter((p) => p.status === "pending" && !p.correction).length;

  const readNow = () => {
    if (reading) return;
    setMessage("");
    commitRead({
      variables: { recapId },
      onCompleted: (res) => {
        const result = res.readRecapShelfPhotos;
        if (result.allowed) setPhotos([...result.photos]);
        setMessage(result.message || "");
      },
      onError: () => setMessage("Photos could not be read. Try again later."),
    });
  };

  return (
    <section className="spark-card p-5 mb-6" aria-label="On shelf">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-bold">On shelf</h3>
          <p className="text-sm mt-1" style={SECONDARY}>
            What the shelf photos show. This does not approve or reject the recap.
          </p>
        </div>
        {pending > 0 ? (
          <button
            type="button"
            onClick={readNow}
            disabled={reading}
            className="px-3 py-2 rounded-xl text-sm"
            style={{
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              opacity: reading ? 0.6 : 1,
            }}
          >
            {reading ? "Reading photos" : pending === 1 ? "Read 1 photo" : `Read ${pending} photos`}
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="text-[13px] mt-2" role="status" style={META}>
          {message}
        </p>
      ) : null}
      <ul className="m-0 p-0 list-none flex flex-col gap-5 mt-4">
        {photos.map((photo) => (
          <PhotoRow
            key={photo.fileId}
            photo={photo}
            onSaved={(next) =>
              setPhotos((current) =>
                (current ?? []).map((p) => (p.fileId === next.fileId ? next : p)),
              )
            }
          />
        ))}
      </ul>
    </section>
  );
}
