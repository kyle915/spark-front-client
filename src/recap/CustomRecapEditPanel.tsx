/**
 * Admin field-level editor for a custom recap.
 *
 * Opens as a slide-over from /recap/view-custom/:uuid. Edits:
 *   - name
 *   - total engagements
 *   - late / incomplete / used corpo card booleans
 *   - every CustomField value (text input per field)
 *   - photo manager: list existing files with × remove, plus
 *     drag/select to add new files (uploaded to GCS via getUploadUrl)
 *
 * Save calls updateCustomRecap with the full payload (the mutation
 * is replace-set semantics: files not in the list get deleted).
 */
import { useState } from "react";
import { fetchQuery, useMutation } from "react-relay/hooks";
import environment from "@api/relay/environment";
import { useAlertStore } from "@/store/alertStore";
import { UpdateCustomRecapMutation } from "@/api/mutations/CustomRecapEditMutations";
import type { CustomRecapEditMutations_UpdateMutation } from "@api/mutations/__generated__/CustomRecapEditMutations_UpdateMutation.graphql";
import { GetUploadUrlQuery } from "@/api/queries/GetUploadUrlQuery";
import type { GetUploadUrlQuery as GetUploadUrlQueryType } from "@api/queries/__generated__/GetUploadUrlQuery.graphql";
import { recapFileUrl } from "@/utils/recapFileUrl";

type CustomField = {
  id: string;
  name: string;
  value: string | null | undefined;
  recapSection?: { id: string; name: string } | null;
};

type RecapFile = {
  id: string;
  name: string | null | undefined;
  url: string | null | undefined;
  fileType?: { id: string; name: string | null | undefined } | null;
  fileRecapCategory?: { id: string; name: string | null | undefined } | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  recap: {
    id: string;
    name: string | null | undefined;
    totalEngagements: number | null | undefined;
    late: boolean | null | undefined;
    incomplete: boolean | null | undefined;
    usedCorpoCard: boolean | null | undefined;
    approved: boolean | null | undefined;
    event: { id: string } | null | undefined;
    customRecapTemplate: { id: string } | null | undefined;
    customField: ReadonlyArray<CustomField> | null | undefined;
    customRecapFiles: ReadonlyArray<RecapFile> | null | undefined;
  };
}

export default function CustomRecapEditPanel({ open, onClose, recap }: Props) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 50,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100vw)",
          height: "100vh",
          background: "var(--spark-bg)",
          borderLeft: "1px solid var(--spark-border)",
          overflowY: "auto",
        }}
      >
        <Inner recap={recap} onClose={onClose} />
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.9)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 10,
  padding: "8px 12px",
  fontSize: 14,
  width: "100%",
};

const Inner: React.FC<{
  recap: Props["recap"];
  onClose: () => void;
}> = ({ recap, onClose }) => {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [name, setName] = useState(recap.name ?? "");
  const [totalEngagements, setTotalEngagements] = useState(
    recap.totalEngagements != null ? String(recap.totalEngagements) : "",
  );
  const [late, setLate] = useState(Boolean(recap.late));
  const [incomplete, setIncomplete] = useState(Boolean(recap.incomplete));
  const [usedCorpoCard, setUsedCorpoCard] = useState(
    Boolean(recap.usedCorpoCard),
  );

  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    Object.fromEntries(
      (recap.customField ?? []).map((f) => [String(f.id), f.value ?? ""]),
    ),
  );

  // Files state: existing kept + new uploaded blobs to add. Removing
  // a file means dropping it from `keptFileIds` — on submit we send
  // the union, ones not in that set get deleted server-side.
  const [keptFileIds, setKeptFileIds] = useState<Set<string>>(
    new Set((recap.customRecapFiles ?? []).map((f) => String(f.id))),
  );
  const [newBlobs, setNewBlobs] = useState<
    Array<{ blobName: string; fileTypeId?: string; displayName: string }>
  >([]);
  const [uploading, setUploading] = useState(false);

  const [commitUpdate, saving] =
    useMutation<CustomRecapEditMutations_UpdateMutation>(
      UpdateCustomRecapMutation,
    );

  const inflight = saving || uploading;

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const blobPath = `recaps/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
        const data = await fetchQuery<GetUploadUrlQueryType>(
          environment,
          GetUploadUrlQuery,
          { filePath: blobPath, contentType: file.type || "image/jpeg" },
        ).toPromise();
        const upload = data?.getUploadUrl;
        if (!upload?.uploadUrl) {
          showAlert(`Couldn't get upload URL for ${file.name}.`, "warning");
          continue;
        }
        const put = await fetch(upload.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "image/jpeg" },
          body: file,
        });
        if (!put.ok) {
          showAlert(`Upload failed for ${file.name}.`, "warning");
          continue;
        }
        setNewBlobs((prev) => [
          ...prev,
          { blobName: upload.blobName, displayName: file.name },
        ]);
      }
      showAlert("Files uploaded. Click Save to apply.", "success");
    } catch (e) {
      showAlert(`Upload error: ${(e as Error).message}`, "error");
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    if (!recap.event?.id || !recap.customRecapTemplate?.id) {
      showAlert(
        "Event or template missing on this recap — can't save.",
        "warning",
      );
      return;
    }
    const totalNum =
      totalEngagements.trim() === "" ? null : Number(totalEngagements);
    if (totalNum != null && Number.isNaN(totalNum)) {
      showAlert("Total engagements must be a number.", "warning");
      return;
    }

    // Build files payload: existing kept blobs + freshly uploaded.
    const kept = (recap.customRecapFiles ?? [])
      .filter((f) => keptFileIds.has(String(f.id)))
      .map((f) => ({
        file: f.url ?? "",
        fileTypeId: f.fileType?.id ?? null,
        fileRecapCategoryId: f.fileRecapCategory?.id ?? null,
      }))
      .filter((f) => f.file);
    const fresh = newBlobs.map((b) => ({
      file: b.blobName,
      fileTypeId: b.fileTypeId ?? null,
      fileRecapCategoryId: null,
    }));

    const customFieldValues = Object.entries(fieldValues).map(
      ([customFieldId, value]) => ({ customFieldId, value }),
    );

    commitUpdate({
      variables: {
        input: {
          id: recap.id,
          name,
          eventId: recap.event.id,
          customRecapTemplateId: recap.customRecapTemplate.id,
          totalEngagements: totalNum,
          late,
          incomplete,
          usedCorpoCard,
          approved: recap.approved ?? null,
          files: [...kept, ...fresh],
          customFieldValues,
        },
      },
      onCompleted: (resp) => {
        if (resp.updateCustomRecap?.success) {
          showAlert("Recap updated.", "success");
          window.location.reload();
        } else {
          showAlert(
            resp.updateCustomRecap?.message ?? "Update failed.",
            "warning",
          );
        }
      },
      onError: (err) => showAlert(err.message, "error"),
    });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            EDIT RECAP
          </p>
          <h2
            className="display text-2xl font-bold mt-1"
            style={{ letterSpacing: "-0.03em" }}
          >
            {recap.name || "Untitled"}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-sm"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          ← Back
        </button>
      </div>

      <Field label="Recap name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
      </Field>

      <Field label="Total engagements">
        <input
          value={totalEngagements}
          onChange={(e) => setTotalEngagements(e.target.value)}
          inputMode="numeric"
          placeholder="—"
          style={inputStyle}
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <BoolCheck label="Late" value={late} onChange={setLate} />
        <BoolCheck
          label="Incomplete"
          value={incomplete}
          onChange={setIncomplete}
        />
        <BoolCheck
          label="Used corpo card"
          value={usedCorpoCard}
          onChange={setUsedCorpoCard}
        />
      </div>

      {(recap.customField ?? []).length > 0 && (
        <div>
          <p
            className="mono text-[10px] mt-2"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            CUSTOM FIELDS
          </p>
          <div className="space-y-2 mt-2">
            {(recap.customField ?? []).map((f) => (
              <Field key={f.id} label={f.name || "Field"}>
                <input
                  value={fieldValues[String(f.id)] ?? ""}
                  onChange={(e) =>
                    setFieldValues({
                      ...fieldValues,
                      [String(f.id)]: e.target.value,
                    })
                  }
                  style={inputStyle}
                />
              </Field>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mt-2">
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            FILES · {keptFileIds.size + newBlobs.length}
          </p>
          <label
            className="px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer"
            style={{
              background: "transparent",
              border: "1px solid var(--spark-border)",
              color: "var(--spark-text)",
              opacity: inflight ? 0.5 : 1,
            }}
          >
            {uploading ? "Uploading…" : "+ Add files"}
            <input
              type="file"
              multiple
              hidden
              disabled={inflight}
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        <div className="space-y-1.5 mt-2">
          {(recap.customRecapFiles ?? []).map((f) => {
            const kept = keptFileIds.has(String(f.id));
            return (
              <div
                key={f.id}
                className="flex items-center gap-2 px-3 py-2 rounded-md"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  opacity: kept ? 1 : 0.4,
                  textDecoration: kept ? "none" : "line-through",
                }}
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={recapFileUrl(f.url ?? "")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold truncate underline"
                    style={{ color: "var(--spark-sky)" }}
                  >
                    {f.name || (f.url ?? "").split("/").pop() || "file"}
                  </a>
                </div>
                <button
                  onClick={() => {
                    const next = new Set(keptFileIds);
                    if (kept) next.delete(String(f.id));
                    else next.add(String(f.id));
                    setKeptFileIds(next);
                  }}
                  className="px-2 py-0.5 rounded text-xs"
                  style={{
                    color: kept ? "var(--spark-orange)" : "var(--spark-lime)",
                    border: "1px solid currentColor",
                  }}
                >
                  {kept ? "Remove" : "Undo"}
                </button>
              </div>
            );
          })}
          {newBlobs.map((b, i) => (
            <div
              key={b.blobName}
              className="flex items-center gap-2 px-3 py-2 rounded-md"
              style={{
                background: "rgba(197,245,70,0.06)",
                border: "1px solid rgba(197,245,70,0.30)",
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">
                  ＋ {b.displayName}
                </p>
                <p
                  className="text-xs truncate"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                >
                  {b.blobName}
                </p>
              </div>
              <button
                onClick={() =>
                  setNewBlobs(newBlobs.filter((_, idx) => idx !== i))
                }
                className="px-2 py-0.5 rounded text-xs"
                style={{
                  color: "var(--spark-orange)",
                  border: "1px solid var(--spark-orange)",
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-4 sticky bottom-0 bg-base-200 py-3 -mx-6 px-6 border-t border-base-300">
        <button
          onClick={save}
          disabled={inflight}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{
            background: "var(--spark-lime)",
            color: "#0a0d09",
            opacity: inflight ? 0.5 : 1,
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          onClick={onClose}
          disabled={inflight}
          className="px-4 py-2 rounded-xl text-sm"
          style={{
            background: "transparent",
            border: "1px solid var(--spark-border)",
            color: "var(--spark-text)",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div>
    <label
      className="mono text-[10px]"
      style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
    >
      {label.toUpperCase()}
    </label>
    <div className="mt-1.5">{children}</div>
  </div>
);

const BoolCheck: React.FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, value, onChange }) => (
  <label
    className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg"
    style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}
  >
    <input
      type="checkbox"
      checked={value}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="text-sm">{label}</span>
  </label>
);
