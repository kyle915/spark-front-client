import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";

/**
 * Public, no-auth consumer rebate upload page.
 *
 * Reached at /c/:slug where :slug identifies an always-on per-client
 * receipt campaign. No token, no login, no tenant guard — the slug is the
 * only handle. Hits two plain REST endpoints on the backend (same
 * /api/public surface the per-event ReceiptUpload page uses):
 *
 *   GET  {API_ORIGIN}/api/public/campaigns/:slug         -> campaign info
 *   POST {API_ORIGIN}/api/public/campaigns/:slug/submit  -> multipart upload
 *
 * Flow: brand runs a campaign ("Get $5 back"), a consumer photographs a
 * purchase receipt, drops their Venmo handle, and submits. An admin later
 * validates it and pays the reward via Venmo.
 *
 * Mobile-first: a single photo picker (camera-capture friendly), a required
 * Venmo handle, and a few optional fields. Light, branded-neutral theme so
 * it reads on a phone in a store aisle. Mirrors ReceiptUpload.tsx.
 */

type CampaignInfo = {
  name?: string;
  brandName?: string;
  headline?: string;
  description?: string;
  product?: string;
  rewardAmount?: string;
  rewardLabel?: string;
  isActive?: boolean;
};

type ApiError = {
  error: string;
  message: string;
};

// Derive the API base from the GraphQL endpoint env var (scheme + host).
// Vite inlines import.meta.env at build time, so VITE_GRAPHQL_ENDPOINT
// like https://host/api/vNNN/graphql/clients yields https://host here.
// Mirrors ReceiptUpload.tsx so we never wire a second env var for one REST
// base.
function apiOrigin(): string {
  const graphql = import.meta.env.VITE_GRAPHQL_ENDPOINT as string | undefined;
  if (!graphql) return "";
  try {
    return new URL(graphql).origin;
  } catch {
    return "";
  }
}

// Friendly copy for the documented backend error codes. Falls back to the
// server message (or a generic line) for anything unmapped.
function errorCopy(code: string, serverMessage?: string): string {
  switch (code) {
    case "image_required":
      return "Please attach a photo of your receipt before submitting.";
    case "too_large":
      return "That photo is too large. Try a smaller image or lower resolution.";
    case "unsupported_type":
      return "That file type isn't supported. Please upload a JPG or PNG photo.";
    case "upload_failed":
      return "Something went wrong saving your receipt. Please try again in a moment.";
    case "create_failed":
      return "We couldn't record your submission. Please try again in a moment.";
    case "not_found":
      return "This rebate isn't available right now. Double-check the link or ask for a new one.";
    default:
      return serverMessage || "Something went wrong. Please try again.";
  }
}

const CampaignUpload: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const origin = useMemo(apiOrigin, []);
  const infoEndpoint = slug
    ? `${origin}/api/public/campaigns/${encodeURIComponent(slug)}`
    : "";
  const submitEndpoint = slug
    ? `${origin}/api/public/campaigns/${encodeURIComponent(slug)}/submit`
    : "";

  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [loadErr, setLoadErr] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state.
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [payoutHandle, setPayoutHandle] = useState("");
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

  // Load campaign details on mount. A missing OR inactive campaign 404s.
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
          setLoadErr({
            error: code,
            message: errorCopy(code, (json as ApiError).message),
          });
          setCampaign(null);
        } else {
          setCampaign((json as { campaign?: CampaignInfo }).campaign ?? {});
          setLoadErr(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setLoadErr({
          error: "network",
          message:
            "We couldn't reach the server. Check your connection and try again.",
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
    if (!payoutHandle.trim()) {
      setSubmitErr("Please enter your Venmo username so we can pay you.");
      return;
    }
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("payoutHandle", payoutHandle.trim());
      if (consumerName.trim()) form.append("consumerName", consumerName.trim());
      if (consumerEmail.trim())
        form.append("consumerEmail", consumerEmail.trim());
      if (consumerPhone.trim())
        form.append("consumerPhone", consumerPhone.trim());
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
      setSubmitErr(
        "We couldn't reach the server. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    file,
    payoutHandle,
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
        <h1
          className="text-2xl font-bold mb-3"
          style={{ fontFamily: "Georgia, serif" }}
        >
          This rebate isn't available.
        </h1>
        <p className="text-sm text-stone-600">{loadErr.message}</p>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <p
          className="text-xs uppercase tracking-[0.2em] mb-2"
          style={{ color: "#3a7e2f" }}
        >
          Receipt received
        </p>
        <h1
          className="text-2xl font-bold mb-3"
          style={{ fontFamily: "Georgia, serif" }}
        >
          ✅ Thanks — you're all set!
        </h1>
        <p className="text-sm text-stone-600">
          We've got your receipt. Once it's verified we'll send your reward
          {payoutHandle.trim() ? ` to ${formatHandle(payoutHandle)} on Venmo` : ""}.
          You can safely close this tab.
        </p>
      </Shell>
    );
  }

  const brand = campaign?.brandName;
  const reward = campaign?.rewardLabel || formatReward(campaign?.rewardAmount);
  const headline =
    campaign?.headline?.trim() ||
    (reward
      ? `Get ${reward} back`
      : campaign?.name
        ? campaign.name
        : "Upload your receipt");

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-1">
        {brand ? `${brand} · ` : ""}REBATE
      </p>
      <h1
        className="text-2xl font-bold mb-1"
        style={{ fontFamily: "Georgia, serif" }}
      >
        {headline}
      </h1>
      {campaign?.description && (
        <p className="text-sm text-stone-600 mb-2">{campaign.description}</p>
      )}

      {reward && (
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-4 text-sm font-bold"
          style={{ background: "#eef9d4", color: "#3a7e2f" }}
        >
          <span aria-hidden>💸</span>
          {reward} reward
          {campaign?.product ? ` on ${campaign.product}` : ""}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4 mt-2"
      >
        {/* Photo picker + preview */}
        <div>
          <label className={LABEL_CLS}>Receipt photo</label>
          {preview ? (
            <div className="rounded-2xl overflow-hidden border border-stone-200 bg-stone-50">
              <img
                src={preview}
                alt="Receipt preview"
                className="w-full h-auto object-contain max-h-80"
              />
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 py-10 cursor-pointer">
              <span className="text-3xl" aria-hidden>
                📷
              </span>
              <span className="text-sm text-stone-600 font-medium">
                Tap to take or choose a photo
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
          {preview && (
            <button
              type="button"
              onClick={() => onPickFile(null)}
              className="mt-2 text-sm text-stone-600 underline"
            >
              Choose a different photo
            </button>
          )}
        </div>

        {/* Venmo handle — required, this is how the consumer gets paid. */}
        <Field label="Venmo username">
          <div className="flex items-stretch rounded-xl border border-stone-300 focus-within:border-stone-500 overflow-hidden">
            <span className="px-3 flex items-center text-base text-stone-500 bg-stone-50 border-r border-stone-200">
              @
            </span>
            <input
              type="text"
              value={payoutHandle}
              onChange={(e) => setPayoutHandle(e.target.value)}
              placeholder="your-venmo"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 p-3 text-base focus:outline-none"
            />
          </div>
          <p className="text-xs text-stone-400 mt-1">
            We'll send your reward here once your receipt is verified.
          </p>
        </Field>

        <TextField
          label="Store"
          value={storeName}
          onChange={setStoreName}
          placeholder="Where did you buy it?"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchase date">
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className={CONTROL_CLS}
            />
          </Field>
          <TextField
            label="Amount"
            value={amount}
            onChange={setAmount}
            placeholder="$0.00"
          />
        </div>
        <TextField
          label="Product"
          value={product}
          onChange={setProduct}
          placeholder="What did you buy?"
        />

        <div className="pt-2 border-t border-stone-100">
          <p className={LABEL_CLS + " mt-3 mb-1"}>Your details (optional)</p>
          <div className="space-y-3">
            <TextField
              label="Name"
              value={consumerName}
              onChange={setConsumerName}
              placeholder="Your name"
            />
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
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            {submitErr}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !file || !payoutHandle.trim()}
          className="w-full px-6 py-3.5 rounded-2xl text-base font-bold transition"
          style={{
            background: "#c5f546",
            color: "#0a0d09",
            opacity: submitting || !file || !payoutHandle.trim() ? 0.5 : 1,
            fontFamily: "Georgia, serif",
          }}
        >
          {submitting
            ? "Submitting…"
            : reward
              ? `Claim ${reward} →`
              : "Submit receipt →"}
        </button>
      </form>

      <p className="mt-8 text-xs text-stone-400">
        Spark by Ignite · We'll only use this to verify your purchase and send
        your reward.
      </p>
    </Shell>
  );
};

// Strip a leading @ for display so "@me" and "me" both read as "@me".
function formatHandle(raw: string): string {
  const v = raw.trim().replace(/^@+/, "");
  return v ? `@${v}` : "";
}

// Fallback reward label when the backend doesn't send a preformatted one.
// rewardAmount arrives as a numeric string like "5.00".
function formatReward(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("$")) return trimmed;
  const n = Number(trimmed);
  if (Number.isFinite(n)) {
    return `$${n.toFixed(2)}`;
  }
  return trimmed;
}

const LABEL_CLS =
  "block text-xs uppercase tracking-[0.16em] text-stone-500 mb-2";
const CONTROL_CLS =
  "w-full rounded-xl border border-stone-300 p-3 text-base focus:outline-none focus:border-stone-500";

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

// Light, warm chrome — readable on a phone, branded-neutral. Mirrors the
// per-event receipt upload page so the two no-login surfaces feel related.
const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen" style={{ background: "#faf7f1" }}>
    <div className="max-w-xl mx-auto px-5 py-10">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
          Spark by Ignite
        </p>
      </div>
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-sm">
        {children}
      </div>
    </div>
  </div>
);

export default CampaignUpload;
