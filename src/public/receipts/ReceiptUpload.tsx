import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";

/**
 * Public, no-auth consumer receipt upload page.
 *
 * Reached at /receipt-upload/:token where :token is minted by the admin
 * Receipts page (eventReceiptUploadLink). The token is the auth — this
 * page never touches Relay or the JWT stack. It hits two plain REST
 * endpoints on the backend:
 *
 *   GET  {API_ORIGIN}/api/public/receipts/:token         -> event info
 *   POST {API_ORIGIN}/api/public/receipts/:token/submit  -> multipart upload
 *
 * Mobile-first: library picker (no capture) plus optional camera take.
 * Putting capture on the only file input opens camera-only on iOS.
 */

type EventInfo = {
  eventName?: string;
  brandName?: string;
  product?: string;
  address?: string;
};

type ApiError = {
  error: string;
  message: string;
};

// Derive the API base from the GraphQL endpoint env var (scheme + host).
// Vite inlines import.meta.env at build time, so VITE_GRAPHQL_ENDPOINT
// like https://host/api/vNNN/graphql/clients yields https://host here.
// Mirrors src/public/approve/PublicApprove.tsx so we never wire a second
// env var for one REST base.
function apiOrigin(): string {
  const graphql = import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined;
  if (!graphql) return "";
  try {
    return new URL(graphql).origin;
  } catch {
    return "";
  }
}

// Friendly copy for the documented backend error codes. Falls back to
// the server message (or a generic line) for anything unmapped.
function errorCopy(code: string, serverMessage?: string): string {
  switch (code) {
    case "image_required":
      return "Please attach a photo of your receipt before submitting.";
    case "bad_image":
      return "We couldn't read that image. Try retaking the photo.";
    case "too_large":
      return "That photo is too large. Try a smaller image or lower resolution.";
    case "unsupported_type":
      return "That file type isn't supported. Please upload a JPG or PNG photo.";
    case "upload_failed":
      return "Something went wrong saving your receipt. Please try again in a moment.";
    case "expired":
      return "This upload link has expired. Please ask for a new one.";
    case "invalid":
      return "This upload link isn't valid.";
    case "not_found":
      return "We couldn't find this upload link.";
    default:
      return serverMessage || "Something went wrong. Please try again.";
  }
}

const ReceiptUpload: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const origin = useMemo(apiOrigin, []);
  const infoEndpoint = token
    ? `${origin}/api/public/receipts/${encodeURIComponent(token)}`
    : "";
  const submitEndpoint = token
    ? `${origin}/api/public/receipts/${encodeURIComponent(token)}/submit`
    : "";

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [loadErr, setLoadErr] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state.
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [amount, setAmount] = useState("");
  const [product, setProduct] = useState("");
  const [consumerName, setConsumerName] = useState("");
  const [consumerEmail, setConsumerEmail] = useState("");
  const [consumerPhone, setConsumerPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Load event details on mount.
  useEffect(() => {
    if (!infoEndpoint) return;
    let cancelled = false;
    setLoading(true);
    fetch(infoEndpoint)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          const code = (json as ApiError).error || "not_found";
          setLoadErr({ error: code, message: errorCopy(code, (json as ApiError).message) });
          setEvent(null);
        } else {
          setEvent((json as { event?: EventInfo }).event ?? {});
          setLoadErr(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLoadErr({
          error: "network",
          message: "We couldn't reach the server. Check your connection and try again.",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [infoEndpoint]);

  // Build / revoke an object URL for the chosen photo preview.
  const onPickFile = useCallback((f: File | null) => {
    setFile(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
  }, []);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const submit = useCallback(async () => {
    if (submitting) return;
    if (!file) {
      setSubmitErr(errorCopy("image_required"));
      return;
    }
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const form = new FormData();
      form.append("image", file);
      if (consumerName.trim()) form.append("consumerName", consumerName.trim());
      if (consumerEmail.trim()) form.append("consumerEmail", consumerEmail.trim());
      if (consumerPhone.trim()) form.append("consumerPhone", consumerPhone.trim());
      if (storeName.trim()) form.append("storeName", storeName.trim());
      if (purchaseDate.trim()) form.append("purchaseDate", purchaseDate.trim());
      if (amount.trim()) form.append("amount", amount.trim());
      if (product.trim()) form.append("product", product.trim());

      // NOTE: do not set Content-Type — the browser sets the multipart
      // boundary header automatically for a FormData body.
      const res = await fetch(submitEndpoint, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = (json as ApiError).error || "upload_failed";
        setSubmitErr(errorCopy(code, (json as ApiError).message));
      } else if ((json as { ok?: boolean }).ok) {
        setDone(true);
      } else {
        setSubmitErr(errorCopy("upload_failed"));
      }
    } catch {
      setSubmitErr("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    file,
    submitEndpoint,
    consumerName,
    consumerEmail,
    consumerPhone,
    storeName,
    purchaseDate,
    amount,
    product,
  ]);

  // ── render ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Shell>
        <p className="text-sm text-stone-500">Loading…</p>
      </Shell>
    );
  }

  if (loadErr) {
    return (
      <Shell>
        <h1 className="display text-2xl font-bold mb-3" style={{ letterSpacing: "-0.025em", color: "#14160f" }}>
          {loadErr.error === "expired"
            ? "This link has expired."
            : "We couldn't open this link."}
        </h1>
        <p className="text-sm" style={{ color: "rgba(20, 22, 15, 0.74)" }}>{loadErr.message}</p>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <p className="mono text-[10px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: "#2b4c08" }}>
          Receipt received
        </p>
        <h1 className="display text-2xl font-bold mb-3" style={{ letterSpacing: "-0.025em", color: "#14160f" }}>
          Thanks — your receipt was submitted.
        </h1>
        <p className="text-sm" style={{ color: "rgba(20, 22, 15, 0.74)" }}>
          We've got it. You can safely close this tab.
        </p>
      </Shell>
    );
  }

  const product_ = event?.product;
  const eventName = event?.eventName;
  const brand = event?.brandName;
  const headline =
    product_ && eventName
      ? `Upload your receipt for ${product_} at ${eventName}`
      : eventName
        ? `Upload your receipt for ${eventName}`
        : "Upload your receipt";

  return (
    <Shell>
      <p className="mono text-[10px] font-semibold uppercase tracking-[0.18em] mb-1" style={{ color: "rgba(20, 22, 15, 0.58)" }}>
        {brand ? `${brand} · ` : ""}RECEIPT UPLOAD
      </p>
      <h1 className="display text-2xl font-bold mb-1" style={{ letterSpacing: "-0.025em", color: "#14160f" }}>
        {headline}
      </h1>
      {event?.address && (
        <p className="text-sm mb-5" style={{ color: "rgba(20, 22, 15, 0.72)" }}>{event.address}</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4 mt-4"
      >
        {/* Photo picker — library first (no capture), camera second.
            capture on the only input opens camera-only on iOS. */}
        <div>
          <label className={LABEL_CLS}>Receipt photo</label>
          {preview ? (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid #dcddd5", background: "#f6f6f2" }}
            >
              <img src={preview} alt="Receipt preview" className="w-full h-auto object-contain max-h-80" />
            </div>
          ) : (
            <div className="space-y-2">
              <label
                className="flex flex-col items-center justify-center gap-2 rounded-xl py-10 cursor-pointer"
                style={{ border: "2px dashed #c8cac0", background: "#f6f6f2" }}
              >
                <span className="text-sm font-semibold" style={{ color: "#14160f" }}>
                  Choose from photo library
                </span>
                <span className="mono text-[10px]" style={{ letterSpacing: "0.14em", color: "rgba(20, 22, 15, 0.54)" }}>
                  JPG · PNG · HEIC
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <label
                className="flex items-center justify-center rounded-lg py-2.5 cursor-pointer text-sm font-semibold"
                style={{ border: "1px solid #dcddd5", background: "#ffffff", color: "#14160f" }}
              >
                Take photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          )}
          {preview && (
            <button
              type="button"
              onClick={() => onPickFile(null)}
              className="mt-2 text-sm underline cursor-pointer"
              style={{ color: "rgba(20, 22, 15, 0.72)" }}
            >
              Choose a different photo
            </button>
          )}
        </div>

        <TextField label="Store" value={storeName} onChange={setStoreName} placeholder="Where did you buy it?" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchase date">
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className={CONTROL_CLS}
            />
          </Field>
          <TextField label="Amount" value={amount} onChange={setAmount} placeholder="$0.00" />
        </div>
        <TextField label="Product" value={product} onChange={setProduct} placeholder="What did you buy?" />

        <div className="pt-3" style={{ borderTop: "1px solid #ecece6" }}>
          <p className={LABEL_CLS + " mt-1 mb-2"}>Your details (optional)</p>
          <div className="space-y-3">
            <TextField label="Name" value={consumerName} onChange={setConsumerName} placeholder="Your name" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Email">
                <input
                  type="email"
                  value={consumerEmail}
                  onChange={(e) => setConsumerEmail(e.target.value)}
                  placeholder="you@email.com"
                  className={CONTROL_CLS}
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={consumerPhone}
                  onChange={(e) => setConsumerPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  className={CONTROL_CLS}
                />
              </Field>
            </div>
          </div>
        </div>

        {submitErr && (
          <div
            className="rounded-xl p-3 text-sm font-medium"
            style={{
              background: "rgba(210, 72, 27, 0.08)",
              border: "1px solid rgba(210, 72, 27, 0.28)",
              color: "#a8340f",
            }}
          >
            {submitErr}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !file}
          className="w-full px-5 py-3 rounded-lg text-sm font-semibold transition cursor-pointer"
          style={{
            background: "#14160f",
            color: "#ffffff",
            opacity: submitting || !file ? 0.42 : 1,
          }}
        >
          {submitting ? "Submitting…" : "Submit receipt →"}
        </button>
      </form>

      <p className="mt-8 text-xs" style={{ color: "rgba(20, 22, 15, 0.52)" }}>
        Spark by Ignite · We'll only use this to verify your purchase.
      </p>
    </Shell>
  );
};

const LABEL_CLS =
  "block mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4a4e42] mb-1.5";
const CONTROL_CLS =
  "w-full rounded-lg border border-[#dcddd5] bg-white px-3 py-2.5 text-[15px] text-[#14160f] focus:outline-none focus:border-[#14160f]";

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div>
    <label className={LABEL_CLS}>{label}</label>
    {children}
  </div>
);

const TextField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <Field label={label}>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={CONTROL_CLS}
    />
  </Field>
);

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    data-theme="spark-v2"
    data-spark-mode="light"
    className="min-h-screen"
    style={{ background: "#f6f6f2", color: "#14160f", colorScheme: "light" }}
  >
    <div className="max-w-xl mx-auto px-5 py-10">
      <div className="mb-6">
        <a href="https://www.igniteproductions.co/" style={{ textDecoration: "none" }}>
          <img
            src="/legal/spark-logo.png"
            alt="Spark by Ignite"
            style={{ height: 26, width: "auto" }}
          />
        </a>
      </div>
      <div
        className="rounded-xl p-6 sm:p-8"
        style={{ background: "#ffffff", border: "1px solid #dcddd5" }}
      >
        {children}
      </div>
    </div>
  </div>
);

export default ReceiptUpload;
