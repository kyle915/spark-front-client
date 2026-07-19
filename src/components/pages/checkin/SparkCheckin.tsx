import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";

/**
 * Public, no-login web check-in for a BA working a specific event.
 *
 * The URL carries the event's walk-up code (`/checkin/:code`). A BA opens it,
 * types who they are, clocks in, works, clocks out, and files the event's FULL
 * custom recap template — photos and all — right in the browser. No app, no
 * account. It's the web twin of the mobile walk-up flow; the backend
 * (`/api/public/checkin/*`) mints a signed session token on identify that
 * authorizes the follow-up clock / photo-upload / recap calls.
 *
 * Plain fetch (no Relay / JWT) so it works fully logged-out. The session token
 * is kept in localStorage keyed by the code, so a returning link resumes where
 * the BA left off (clocked in → clock out → recap → done).
 */

// ── Types mirroring the backend payload (ambassadors/checkin_web.build_public_context)
type TemplateField = {
  id: string;
  name: string;
  required: boolean;
  type: string; // number | text | long_text | select | multiselect | photo | ...
  options: string[];
};
type TemplateSection = { id: string; name: string; fields: TemplateField[] };
type TemplateProduct = { id: string; name: string; imageUrl: string | null };
type Template = {
  id: string;
  name: string;
  productSamples: boolean;
  sections: TemplateSection[];
  products: TemplateProduct[];
};
type Clock = {
  state: "not_started" | "clocked_in" | "clocked_out";
  clockInAt: string | null;
  clockOutAt: string | null;
};
type Context = {
  event: { uuid: string; name: string; address: string | null; startTime: string | null; endTime: string | null };
  brand: { name: string; primaryColor: string | null };
  template: Template | null;
  session?: { ambassadorName: string; clock: Clock; hasRecap: boolean; pendingReview: boolean };
  error?: string;
  message?: string;
};

type Photo = { blobName: string | null; previewUrl: string; state: "uploading" | "done" | "failed" };

const FALLBACK_ACCENT = "#C4D82E";

function apiOrigin(): string {
  try {
    return new URL(import.meta.env.VITE_GRAPHQL_ENDPOINT as string).origin;
  } catch {
    return "";
  }
}

const isPhotoType = (t: string) => t.includes("photo") || t.includes("image");
const choiceKind = (t: string): "select" | "multiselect" | null => {
  if (t === "multiselect" || t.includes("multi")) return "multiselect";
  if (t === "select" || t.includes("dropdown")) return "select";
  return null;
};

const fmtTime = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).replace(":00", "");
};

export default function SparkCheckin() {
  const { code = "" } = useParams<{ code: string }>();
  const storeKey = `spark.checkin.${code}`;

  const [ctx, setCtx] = useState<Context | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(storeKey);
    } catch {
      return null;
    }
  });

  // ── Load / refresh context (with the session token if we have one) ─────────
  const refresh = useCallback(async () => {
    if (!code) return;
    try {
      // Session token rides a header, never the URL — keeps the bearer out of
      // access logs / browser history / Referer.
      const res = await fetch(`${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}`, {
        headers: token ? { "X-Checkin-Session": token } : undefined,
      });
      const json = (await res.json()) as Context;
      if (!res.ok || json.error) {
        setLoadErr(json.message || "This check-in link isn't active.");
        setCtx(null);
      } else {
        setCtx(json);
        setLoadErr(null);
      }
    } catch {
      setLoadErr("Couldn't load this check-in. Check your connection and reload.");
    }
  }, [code, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accent = ctx?.brand.primaryColor || FALLBACK_ACCENT;
  const clockState = ctx?.session?.clock.state ?? "not_started";
  const identified = Boolean(token && ctx?.session);
  const hasRecap = Boolean(ctx?.session?.hasRecap);

  if (loadErr) {
    return (
      <Shell>
        <div style={{ ...card, textAlign: "center", maxWidth: 440 }}>
          <p style={{ fontSize: 15, opacity: 0.85 }}>{loadErr}</p>
        </div>
      </Shell>
    );
  }
  if (!ctx) {
    return (
      <Shell>
        <p style={{ opacity: 0.6 }}>Loading…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <Header ctx={ctx} accent={accent} />
        {!identified ? (
          <IdentifyStep code={code} accent={accent} storeKey={storeKey} onDone={setToken} />
        ) : (
          <CheckedInFlow
            code={code}
            token={token as string}
            ctx={ctx}
            accent={accent}
            clockState={clockState}
            hasRecap={hasRecap}
            onRefresh={refresh}
          />
        )}
        <p style={{ fontSize: 11, opacity: 0.4, marginTop: 22, textAlign: "center" }}>
          Powered by Spark by Ignite
        </p>
      </div>
    </Shell>
  );
}

// ── Header ────────────────────────────────────────────────────────────────
function Header({ ctx, accent }: { ctx: Context; accent: string }) {
  const when = ctx.event.startTime
    ? new Date(ctx.event.startTime).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    : "";
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: accent, fontWeight: 700 }}>
        {ctx.brand.name || "Check in"}
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 2px", lineHeight: 1.15 }}>{ctx.event.name}</h1>
      <div style={{ fontSize: 13, opacity: 0.6 }}>
        {when}
        {when && (ctx.event.startTime || ctx.event.endTime) ? " · " : ""}
        {fmtTime(ctx.event.startTime)}
        {ctx.event.endTime ? `–${fmtTime(ctx.event.endTime)}` : ""}
      </div>
      {ctx.event.address ? <div style={{ fontSize: 13, opacity: 0.55, marginTop: 2 }}>{ctx.event.address}</div> : null}
    </div>
  );
}

// ── Step 1: identify ────────────────────────────────────────────────────────
function IdentifyStep({
  code,
  accent,
  storeKey,
  onDone,
}: {
  code: string;
  accent: string;
  storeKey: string;
  onDone: (t: string) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!firstName.trim()) return setErr("Enter your name.");
    if (!phone.trim()) return setErr("Enter a phone number.");
    setBusy(true);
    try {
      const res = await fetch(`${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone, email }),
      });
      const json = await res.json();
      if (!res.ok || !json.sessionToken) {
        setErr(json.message || "Couldn't start your check-in.");
        setBusy(false);
        return;
      }
      try {
        window.localStorage.setItem(storeKey, json.sessionToken);
      } catch {
        /* private mode — token still held in memory for this session */
      }
      onDone(json.sessionToken);
    } catch {
      setErr("Network error. Try again.");
      setBusy(false);
    }
  };

  return (
    <div style={card}>
      <h2 style={h2}>Who's working?</h2>
      <p style={{ fontSize: 13, opacity: 0.6, margin: "0 0 14px" }}>
        Tell us who you are so your lead can confirm your hours.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input style={{ ...input, flex: "1 1 140px" }} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input style={{ ...input, flex: "1 1 140px" }} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <input style={input} placeholder="Mobile phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input style={input} placeholder="Email (optional)" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      {err ? <p style={errText}>{err}</p> : null}
      <button style={{ ...primaryBtn(accent), marginTop: 6 }} disabled={busy} onClick={submit}>
        {busy ? "Starting…" : "Start check-in"}
      </button>
    </div>
  );
}

// ── Steps 2-4: clock in/out + recap ─────────────────────────────────────────
function CheckedInFlow({
  code,
  token,
  ctx,
  accent,
  clockState,
  hasRecap,
  onRefresh,
}: {
  code: string;
  token: string;
  ctx: Context;
  accent: string;
  clockState: Clock["state"];
  hasRecap: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"" | "in" | "out">("");
  const [showRecap, setShowRecap] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const post = (path: string, body: Record<string, unknown>) =>
    fetch(`${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: token, ...body }),
    });

  const clock = async (kind: "in" | "out") => {
    setMsg(null);
    setBusy(kind);
    // Best-effort geolocation — clocking works even if it's denied/unavailable.
    const withCoords = (coords: { latitude?: number; longitude?: number }) =>
      post("clock", { kind, ...coords })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) setMsg(json.message || "Couldn't record that.");
        })
        .catch(() => setMsg("Network error. Try again."))
        .finally(async () => {
          setBusy("");
          await onRefresh();
        });
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => void withCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => void withCoords({}),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    } else {
      void withCoords({});
    }
  };

  const pending = ctx.session?.pendingReview;

  if (hasRecap && clockState !== "clocked_in") {
    return (
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 6 }}>✓</div>
        <h2 style={{ ...h2, marginBottom: 6 }}>You're all set</h2>
        <p style={{ fontSize: 14, opacity: 0.7 }}>
          Your recap is in{pending ? " and is pending your lead's confirmation" : ""}. Thanks for the great work!
        </p>
      </div>
    );
  }

  if (showRecap) {
    return (
      <RecapForm
        code={code}
        token={token}
        template={ctx.template}
        accent={accent}
        onCancel={() => setShowRecap(false)}
        onSubmitted={async () => {
          setShowRecap(false);
          await onRefresh();
        }}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.5 }}>
              Time clock
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
              {clockState === "clocked_in" ? "On the clock" : clockState === "clocked_out" ? "Clocked out" : "Not started"}
            </div>
            {ctx.session?.clock.clockInAt ? (
              <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>
                In {fmtTime(ctx.session.clock.clockInAt)}
                {ctx.session.clock.clockOutAt ? ` · Out ${fmtTime(ctx.session.clock.clockOutAt)}` : ""}
              </div>
            ) : null}
          </div>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: clockState === "clocked_in" ? accent : "rgba(0,0,0,0.2)",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          {clockState === "not_started" ? (
            <button style={primaryBtn(accent)} disabled={busy !== ""} onClick={() => clock("in")}>
              {busy === "in" ? "Clocking in…" : "Clock in"}
            </button>
          ) : null}
          {clockState === "clocked_in" ? (
            <button style={secondaryBtn} disabled={busy !== ""} onClick={() => clock("out")}>
              {busy === "out" ? "Clocking out…" : "Clock out"}
            </button>
          ) : null}
          {clockState !== "not_started" ? (
            <button style={primaryBtn(accent)} onClick={() => setShowRecap(true)}>
              {hasRecap ? "Edit recap" : "File recap"}
            </button>
          ) : null}
        </div>
        {msg ? <p style={errText}>{msg}</p> : null}
      </div>

      {clockState === "not_started" ? (
        <p style={{ fontSize: 13, opacity: 0.6, textAlign: "center" }}>Clock in when you arrive to start your shift.</p>
      ) : null}
    </div>
  );
}

// ── Recap form (renders the full custom template) ───────────────────────────
function RecapForm({
  code,
  token,
  template,
  accent,
  onCancel,
  onSubmitted,
}: {
  code: string;
  token: string;
  template: Template | null;
  accent: string;
  onCancel: () => void;
  onSubmitted: () => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [samples, setSamples] = useState<Record<string, string>>({});
  const [engagements, setEngagements] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const hasPhotoField = useMemo(
    () => (template?.sections ?? []).some((s) => s.fields.some((f) => isPhotoType(f.type))),
    [template],
  );

  const setVal = (id: string, v: string | string[]) => setValues((p) => ({ ...p, [id]: v }));

  const uploadFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    for (const file of Array.from(files)) {
      const idx = photos.length;
      const preview = URL.createObjectURL(file);
      setPhotos((p) => [...p, { blobName: null, previewUrl: preview, state: "uploading" }]);
      try {
        const urlRes = await fetch(`${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: token, filename: file.name, contentType: file.type || "image/jpeg" }),
        });
        const meta = await urlRes.json();
        if (!urlRes.ok || !meta.uploadUrl) throw new Error(meta.message || "no url");
        const put = await fetch(meta.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "image/jpeg" },
          body: file,
        });
        if (!put.ok) throw new Error("upload failed");
        setPhotos((p) => p.map((ph, i) => (i === idx ? { ...ph, blobName: meta.blobName, state: "done" } : ph)));
      } catch {
        setPhotos((p) => p.map((ph, i) => (i === idx ? { ...ph, state: "failed" } : ph)));
      }
    }
  };

  const removePhoto = (idx: number) => setPhotos((p) => p.filter((_, i) => i !== idx));

  const submit = async () => {
    setErr(null);
    // Required non-photo fields must be answered.
    for (const s of template?.sections ?? []) {
      for (const f of s.fields) {
        if (!f.required || isPhotoType(f.type)) continue;
        const v = values[f.id];
        const empty = v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");
        if (empty) return setErr(`Please fill in "${f.name}".`);
      }
    }
    const donePhotos = photos.filter((p) => p.state === "done" && p.blobName);
    if (photos.some((p) => p.state === "uploading")) return setErr("Hang on — photos are still uploading.");
    if (donePhotos.length === 0) return setErr("Add at least one photo of your event.");

    const fieldValues = Object.entries(values)
      .map(([id, v]) => ({ customFieldId: id, value: Array.isArray(v) ? JSON.stringify(v) : String(v) }))
      .filter((fv) => fv.value !== "" && fv.value !== "[]");
    const productSamples = Object.entries(samples)
      .map(([productId, q]) => ({ productId, quantity: Number(q) }))
      .filter((s) => Number.isFinite(s.quantity) && s.quantity > 0);

    setBusy(true);
    try {
      const res = await fetch(`${apiOrigin()}/api/public/checkin/${encodeURIComponent(code)}/recap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session: token,
          fieldValues,
          files: donePhotos.map((p) => ({ blobName: p.blobName })),
          productSamples,
          totalEngagements: engagements.trim() === "" ? null : Number(engagements),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErr(json.message || "Couldn't submit your recap.");
        setBusy(false);
        return;
      }
      await onSubmitted();
    } catch {
      setErr("Network error. Try again.");
      setBusy(false);
    }
  };

  if (!template) {
    return (
      <div style={{ ...card, textAlign: "center" }}>
        <p style={{ opacity: 0.7 }}>This event has no recap form set up. Ask your lead.</p>
        <button style={{ ...secondaryBtn, marginTop: 12 }} onClick={onCancel}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {template.sections.map((section) => (
        <div key={section.id} style={card}>
          <h2 style={h2}>{section.name}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
            {section.fields.map((f) => (
              <FieldInput
                key={f.id}
                field={f}
                value={values[f.id]}
                accent={accent}
                onChange={(v) => setVal(f.id, v)}
                onAddPhotos={uploadFiles}
                photos={photos}
                onRemovePhoto={removePhoto}
              />
            ))}
          </div>
        </div>
      ))}

      {template.productSamples && template.products.length > 0 ? (
        <div style={card}>
          <h2 style={h2}>Products sampled</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            {template.products.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover" }} />
                ) : null}
                <span style={{ flex: 1, fontSize: 14 }}>{p.name}</span>
                <input
                  style={{ ...input, width: 88, margin: 0 }}
                  inputMode="numeric"
                  placeholder="0"
                  value={samples[p.id] ?? ""}
                  onChange={(e) => setSamples((s) => ({ ...s, [p.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={card}>
        <label style={label}>Total engagements</label>
        <input style={input} inputMode="numeric" placeholder="e.g. 120" value={engagements} onChange={(e) => setEngagements(e.target.value)} />
        {!hasPhotoField ? (
          <>
            <label style={{ ...label, marginTop: 10 }}>
              Photos <span style={{ color: "#EF5A2A" }}>*</span>
            </label>
            <PhotoGrid photos={photos} onAdd={() => fileRef.current?.click()} onRemove={removePhoto} accent={accent} />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => uploadFiles(e.target.files)}
            />
          </>
        ) : null}
      </div>

      {err ? <p style={{ ...errText, textAlign: "center" }}>{err}</p> : null}
      <div style={{ display: "flex", gap: 10 }}>
        <button style={secondaryBtn} onClick={onCancel} disabled={busy}>
          Back
        </button>
        <button style={primaryBtn(accent)} onClick={submit} disabled={busy}>
          {busy ? "Submitting…" : "Submit recap"}
        </button>
      </div>
    </div>
  );
}

// ── One template field ───────────────────────────────────────────────────────
function FieldInput({
  field,
  value,
  accent,
  onChange,
  onAddPhotos,
  photos,
  onRemovePhoto,
}: {
  field: TemplateField;
  value: string | string[] | undefined;
  accent: string;
  onChange: (v: string | string[]) => void;
  onAddPhotos: (files: FileList | null) => void;
  photos: Photo[];
  onRemovePhoto: (idx: number) => void;
}) {
  const localRef = useRef<HTMLInputElement | null>(null);
  const req = field.required ? <span style={{ color: "#EF5A2A" }}> *</span> : null;

  if (isPhotoType(field.type)) {
    return (
      <div>
        <label style={label}>
          {field.name}
          {req}
        </label>
        <PhotoGrid photos={photos} onAdd={() => localRef.current?.click()} onRemove={onRemovePhoto} accent={accent} />
        <input ref={localRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => onAddPhotos(e.target.files)} />
      </div>
    );
  }

  const kind = choiceKind(field.type);
  if (kind === "select") {
    return (
      <div>
        <label style={label}>
          {field.name}
          {req}
        </label>
        <select style={input} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (kind === "multiselect") {
    const arr = Array.isArray(value) ? value : [];
    const toggle = (o: string) => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
    return (
      <div>
        <label style={label}>
          {field.name}
          {req}
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {field.options.map((o) => {
            const on = arr.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => toggle(o)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontSize: 13,
                  cursor: "pointer",
                  border: on ? "none" : "1px solid rgba(0,0,0,0.15)",
                  background: on ? accent : "transparent",
                  color: on ? "#0a0d09" : "inherit",
                }}
              >
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const isLong = field.type.includes("long") || field.type.includes("area") || field.type.includes("paragraph");
  const isNumber = field.type.includes("number") || field.type.includes("int") || field.type.includes("decimal");
  return (
    <div>
      <label style={label}>
        {field.name}
        {req}
      </label>
      {isLong ? (
        <textarea
          style={{ ...input, minHeight: 84, resize: "vertical" }}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          style={input}
          inputMode={isNumber ? "numeric" : "text"}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function PhotoGrid({
  photos,
  onAdd,
  onRemove,
  accent,
}: {
  photos: Photo[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  accent: string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
      {photos.map((p, i) => (
        <div key={i} style={{ position: "relative", width: 72, height: 72 }}>
          <img
            src={p.previewUrl}
            alt=""
            style={{
              width: 72,
              height: 72,
              objectFit: "cover",
              borderRadius: 10,
              opacity: p.state === "done" ? 1 : 0.5,
              border: p.state === "failed" ? "2px solid #EF5A2A" : "1px solid rgba(0,0,0,0.1)",
            }}
          />
          {p.state === "uploading" ? (
            <span style={photoBadge}>…</span>
          ) : p.state === "failed" ? (
            <span style={{ ...photoBadge, color: "#EF5A2A" }}>!</span>
          ) : null}
          <button onClick={() => onRemove(i)} style={photoRemove} aria-label="Remove photo">
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        style={{
          width: 72,
          height: 72,
          borderRadius: 10,
          border: `2px dashed ${accent}`,
          background: "transparent",
          fontSize: 26,
          color: accent,
          cursor: "pointer",
        }}
      >
        +
      </button>
    </div>
  );
}

// ── Chrome ──────────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return <div style={wrap}>{children}</div>;
}

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#fafafa",
  color: "#14181a",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  padding: "28px 16px 48px",
  fontFamily: "system-ui, -apple-system, sans-serif",
};
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 18,
  padding: 18,
};
const h2: React.CSSProperties = { fontSize: 16, fontWeight: 700, margin: 0 };
const label: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 4,
  opacity: 0.8,
};
const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  fontSize: 15,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.15)",
  background: "#fff",
  color: "#14181a",
  marginTop: 8,
  outline: "none",
};
const errText: React.CSSProperties = { color: "#EF5A2A", fontSize: 13, marginTop: 10, marginBottom: 0 };
const photoBadge: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
  color: "#fff",
};
const photoRemove: React.CSSProperties = {
  position: "absolute",
  top: -6,
  right: -6,
  width: 20,
  height: 20,
  borderRadius: 999,
  border: "none",
  background: "#14181a",
  color: "#fff",
  fontSize: 14,
  lineHeight: "20px",
  cursor: "pointer",
  padding: 0,
};
function primaryBtn(accent: string): React.CSSProperties {
  return {
    flex: 1,
    padding: "13px 16px",
    borderRadius: 12,
    border: "none",
    background: accent,
    color: "#0a0d09",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  };
}
const secondaryBtn: React.CSSProperties = {
  flex: 1,
  padding: "13px 16px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "transparent",
  color: "#14181a",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
