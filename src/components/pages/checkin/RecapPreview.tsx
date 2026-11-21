/**
 * Read-only recap preview: a "Before your shift" checklist, then every recap
 * question in order. Shared by the sheet on the check-in page and the
 * standalone /checkin/<code>/preview page the reminder email links to.
 *
 * Nothing here is an input. Opening it never identifies the BA, clocks in, or
 * creates an event — see recapPreviewModel.ts.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { card, h2, secondaryBtn } from "./checkinStyles";
import { programDescription, programLabel } from "./eventTypeDescriptor";
import {
  PREVIEW_BUTTON_LABEL,
  PREVIEW_INTRO,
  PREVIEW_TITLE,
  buildChecklist,
  conditionHint,
  fieldKind,
  fieldTypeHint,
  loadRecapPreview,
  photoCountLabel,
  type ChecklistItem,
  type PreviewLoad,
  type RecapPreviewPayload,
} from "./recapPreviewModel";
import { timedFetch } from "./timedFetch";

const ink = "#1c1917";
const muted = "#57534e";
const hair = "#e7e5e4";

const groupTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: muted,
  margin: "14px 0 6px",
};

function ChecklistGroup({ title, items }: { title: string; items: ChecklistItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p style={groupTitle}>{title}</p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((item, i) => (
          <li
            key={`${item.text}-${i}`}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: "6px 0",
              borderTop: i === 0 ? "none" : `1px solid ${hair}`,
            }}
          >
            <span
              aria-hidden
              style={{
                flex: "0 0 auto",
                width: 16,
                height: 16,
                marginTop: 2,
                borderRadius: 4,
                border: `1.5px solid #a8a29e`,
              }}
            />
            <span style={{ fontSize: 15, lineHeight: 1.4, color: ink }}>
              {item.text}
              {item.note ? (
                <span style={{ display: "block", fontSize: 13, color: muted }}>{item.note}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RequiredTag({ required }: { required: boolean }) {
  return (
    <span
      style={{
        flex: "0 0 auto",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: "20px",
        padding: "0 8px",
        borderRadius: 999,
        color: required ? "#9a3412" : muted,
        background: required ? "#fff1eb" : "#f5f5f4",
      }}
    >
      {required ? "Required" : "Optional"}
    </span>
  );
}

/** The checklist + full question list for one program. */
export function RecapPreviewContent({
  payload,
  accent,
  onPickProgram,
  offline = false,
}: {
  payload: RecapPreviewPayload;
  accent: string;
  /** Multi-program link: called with the program the BA wants to see. */
  onPickProgram?: (id: string) => void;
  offline?: boolean;
}) {
  if (payload.needsProgram) {
    return (
      <div>
        <p style={{ fontSize: 15, color: ink, margin: "0 0 12px", lineHeight: 1.45 }}>
          Each event type has its own recap. Which one are you working?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {payload.programs.map((p) => {
            const description = programDescription(p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPickProgram?.(p.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 14px",
                  minHeight: 48,
                  borderRadius: 12,
                  border: `1px solid ${hair}`,
                  background: "#fff",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: ink }}>
                  {programLabel(p)}
                </span>
                {description ? (
                  <span style={{ display: "block", fontSize: 13, color: muted, marginTop: 4, lineHeight: 1.45 }}>
                    {description}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const template = payload.template;
  if (!template) {
    return (
      <p style={{ fontSize: 15, color: ink, lineHeight: 1.45 }}>
        This brand hasn't set up recap questions for this event type yet. You'll still add
        photos of your setup after your shift.
      </p>
    );
  }

  const checklist = buildChecklist(payload);
  const allFields = template.sections.flatMap((s) => s.fields);
  const programName = payload.program ? programLabel(payload.program) : null;

  return (
    <div>
      {offline ? (
        <p
          role="status"
          style={{
            fontSize: 13,
            color: "#92400e",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 10,
            padding: "8px 10px",
            margin: "0 0 12px",
          }}
        >
          No signal. Showing the copy saved on this phone.
        </p>
      ) : null}
      {programName ? (
        <p style={{ fontSize: 13, color: muted, margin: "0 0 10px" }}>
          Event type: <strong style={{ color: ink }}>{programName}</strong>
          {payload.programs.length > 1 && onPickProgram ? (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => onPickProgram("")}
                style={{
                  border: "none",
                  background: "none",
                  padding: 0,
                  font: "inherit",
                  fontSize: 13,
                  color: ink,
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                See another
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      <section
        aria-labelledby="recap-preview-checklist"
        style={{ ...card, border: `2px solid ${accent}`, padding: "14px 16px" }}
      >
        <h2 id="recap-preview-checklist" style={{ ...h2, fontSize: 17 }}>
          Before your shift
        </h2>
        <p style={{ fontSize: 13, color: muted, margin: "4px 0 0", lineHeight: 1.45 }}>
          Collect these during your demo so your recap is quick to finish.
        </p>
        <ChecklistGroup title="Keep count of" items={checklist.counts} />
        <ChecklistGroup title="Be ready to answer" items={checklist.answers} />
        <ChecklistGroup title="Photos to take" items={checklist.photos} />
      </section>

      {payload.photoBuckets.length > 0 ? (
        <section style={{ marginTop: 18 }} aria-labelledby="recap-preview-photos">
          <h3 id="recap-preview-photos" style={{ ...h2, fontSize: 15, margin: "0 0 6px" }}>
            Photos
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {payload.photoBuckets.map((b) => (
              <li
                key={b.name}
                style={{ ...card, padding: "10px 12px", marginBottom: 8, borderRadius: 12 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: ink }}>{b.name}</span>
                  <RequiredTag required={b.min > 0} />
                </div>
                <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>
                  {b.min > 0 ? `Take ${photoCountLabel(b.min)}` : "Add if you have them"}
                  {b.helper ? ` · ${b.helper}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {template.productSamples && template.products.length > 0 ? (
        <section style={{ marginTop: 18 }} aria-labelledby="recap-preview-products">
          <h3 id="recap-preview-products" style={{ ...h2, fontSize: 15, margin: "0 0 6px" }}>
            Products you'll count
          </h3>
          <p style={{ fontSize: 13, color: muted, margin: "0 0 6px" }}>
            {template.products.map((p) => p.name).join(", ")}
          </p>
        </section>
      ) : null}

      <h3 style={{ ...h2, fontSize: 15, margin: "20px 0 4px" }}>
        Every question, in order
      </h3>
      {template.sections.map((section, si) => (
        <section key={`${section.name}-${si}`} style={{ marginTop: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: ink, margin: "0 0 6px" }}>
            {section.name}
          </p>
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {section.fields.map((f) => {
              const kind = fieldKind(f.type);
              const cond = conditionHint(f, allFields);
              return (
                <li
                  key={f.id}
                  style={{ ...card, padding: "10px 12px", marginBottom: 8, borderRadius: 12 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: ink, lineHeight: 1.35 }}>
                      {f.name}
                    </span>
                    <RequiredTag required={f.required} />
                  </div>
                  <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>
                    {fieldTypeHint(f)}
                    {cond ? ` · ${cond}` : ""}
                  </div>
                  {(kind === "choice" || kind === "multi") && f.options.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {f.options.map((o) => (
                        <span
                          key={o}
                          style={{
                            fontSize: 13,
                            lineHeight: "22px",
                            padding: "0 8px",
                            borderRadius: 8,
                            border: `1px solid ${hair}`,
                            background: "#fafaf9",
                            color: ink,
                          }}
                        >
                          {o}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {f.placeholder ? (
                    <div style={{ fontSize: 13, color: muted, marginTop: 6, fontStyle: "italic" }}>
                      Example: {f.placeholder}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** Secondary button that opens the sheet. */
export function RecapPreviewButton({
  onClick,
  style,
}: {
  onClick: () => void;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...secondaryBtn, width: "100%", minHeight: 48, background: "#fff", ...style }}
    >
      {PREVIEW_BUTTON_LABEL}
    </button>
  );
}

type SheetState = { kind: "loading" } | PreviewLoad;

/**
 * Read-only sheet over the check-in page. Fetches the preview for `code` (and
 * `programId` on multi-program links) unless a `payload` is handed in — after
 * identify the page already holds the event's real form.
 */
export function RecapPreviewSheet({
  code,
  programId,
  payload,
  accent,
  onClose,
  footer,
}: {
  code: string;
  programId?: string | null;
  payload?: RecapPreviewPayload | null;
  accent: string;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const [picked, setPicked] = useState<string | null>(programId ?? null);
  const [state, setState] = useState<SheetState>(
    payload ? { kind: "ok", payload, offline: false } : { kind: "loading" },
  );
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (payload) return;
    let live = true;
    setState({ kind: "loading" });
    void loadRecapPreview(code, picked, timedFetch).then((res) => {
      if (live) setState(res);
    });
    return () => {
      live = false;
    };
  }, [code, picked, payload]);

  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prior?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(28,25,23,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recap-preview-title"
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "92dvh",
          display: "flex",
          flexDirection: "column",
          background: "#faf7f1",
          color: ink,
          borderRadius: "18px 18px 0 0",
          boxShadow: "0 -8px 30px rgba(0,0,0,0.18)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "14px 16px 10px",
            borderBottom: `1px solid ${hair}`,
          }}
        >
          <h2 id="recap-preview-title" style={{ ...h2, fontSize: 18 }}>
            {PREVIEW_TITLE}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            style={{
              minWidth: 72,
              minHeight: 44,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.18)",
              background: "#fff",
              fontSize: 15,
              fontWeight: 600,
              color: ink,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
        <div
          style={{
            overflowY: "auto",
            padding: "12px 16px calc(20px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <p style={{ fontSize: 13, color: muted, margin: "0 0 12px", lineHeight: 1.45 }}>
            {PREVIEW_INTRO}
          </p>
          {state.kind === "loading" ? (
            <p role="status" style={{ fontSize: 15, color: muted }}>
              Loading the recap…
            </p>
          ) : state.kind === "error" ? (
            <p role="alert" style={{ fontSize: 15, color: "#9a3412", lineHeight: 1.45 }}>
              {state.message}
            </p>
          ) : (
            <RecapPreviewContent
              payload={state.payload}
              accent={accent}
              offline={state.offline}
              onPickProgram={payload ? undefined : (id) => setPicked(id || null)}
            />
          )}
          {footer}
        </div>
      </div>
    </div>
  );
}
