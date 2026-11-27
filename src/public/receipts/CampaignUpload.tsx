import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import useTenantPublic from "@/public/form/hooks/useTenantPublic";
import { gqlRequest } from "@/public/api/graphqlClient";
import { QUERY_PUBLIC_TENANT_THEME } from "@/public/api/queries/PublicThemeTenant.query";

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
 * purchase receipt, drops their PayPal handle, and submits. An admin later
 * validates it and pays the reward via PayPal.
 *
 * Mobile-first: a single photo picker (camera-capture friendly), a required
 * PayPal handle, and a few optional fields.
 *
 * Branded per client: once the campaign resolves we have its tenant's
 * `request_url_name` (piggybacked on the REST payload — see
 * `_campaign_display_payload` in receipts/views.py). We query the same
 * no-auth tenantPublic / tenantThemePublic GraphQL queries the external
 * request form uses, but deliberately do NOT route through the shared
 * useTenantThemePublic hook or CSS var(--color-x, <fallback>) syntax at all.
 * Two reasons: (1) that hook applies its result globally via
 * document.documentElement.style, which would leak into other routes; (2)
 * more fundamentally, src/index.css ships a site-wide default DaisyUI theme
 * ("spark-v2", near-black) that unconditionally defines --color-base-200 etc.
 * at :root, so a var(--color-x, <literal>) fallback never actually triggers
 * — it silently resolves to Spark's own admin-console theme instead of this
 * page's neutral cream/white default. Fetched theme values are kept in
 * `brandVars` (below) and resolved to real literal colors via the `pick()`
 * helper at the bottom of this file, bypassing CSS custom properties
 * entirely. We try the `dark` scheme first, then `light`, since the
 * /customize-theme editor defaults to creating a light-scheme row.
 */

type CampaignInfo = {
  name?: string;
  brandName?: string;
  tenantRequestUrlName?: string;
  headline?: string;
  description?: string;
  product?: string;
  rewardAmount?: string;
  rewardLabel?: string;
  isActive?: boolean;
  heroImage?: string | null;
  productImage?: string | null;
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
  const [brandVars, setBrandVars] = useState<Record<string, string> | null>(
    null,
  );
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

  // Brand theming — only fires once the campaign resolves and we know its
  // tenant's request_url_name. See the module docstring for why this fetch
  // is local (into `brandVars`, applied on the Shell's own root node) rather
  // than routed through the shared useTenantThemePublic hook.
  const tenantSlug = campaign?.tenantRequestUrlName || undefined;
  const { tenant, hasImage } = useTenantPublic({ slug: tenantSlug });

  useEffect(() => {
    if (!tenantSlug) {
      setBrandVars(null);
      return;
    }
    let cancelled = false;
    async function loadTheme() {
      for (const scheme of ["DARK", "LIGHT"]) {
        try {
          const result = await gqlRequest<{
            tenantThemePublic: { cssVariables: Record<string, string> } | null;
          }>(QUERY_PUBLIC_TENANT_THEME, {
            requestUrlName: tenantSlug,
            colorScheme: scheme,
          });
          const vars = result?.tenantThemePublic?.cssVariables;
          if (vars && Object.keys(vars).length > 0) {
            if (!cancelled) setBrandVars(vars);
            return;
          }
        } catch {
          // Try the next scheme.
        }
      }
      if (!cancelled) setBrandVars(null);
    }
    void loadTheme();
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

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
      setSubmitErr("Please enter your PayPal email so we can pay you.");
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
          className="display text-2xl font-bold mb-3"
          style={{ letterSpacing: "-0.025em", color: "#14160f" }}
        >
          This rebate isn't available.
        </h1>
        <p className="text-sm" style={{ color: "rgba(20, 22, 15, 0.74)" }}>
          {loadErr.message}
        </p>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell
        logoUrl={hasImage ? tenant?.image : null}
        brand={campaign?.brandName}
        brandVars={brandVars}
        heroImageUrl={campaign?.heroImage}
      >
        <p
          className="mono text-[10px] font-semibold uppercase tracking-[0.18em] mb-2"
          style={{ color: pick(brandVars, "--color-success", "#2b4c08") }}
        >
          Receipt received
        </p>
        <h1
          className="display text-2xl font-bold mb-3"
          style={{ letterSpacing: "-0.025em" }}
        >
          Thanks — you're all set.
        </h1>
        <p className="text-sm" style={{ opacity: 0.78 }}>
          We've got your receipt. Once it's verified we'll send your reward
          {payoutHandle.trim() ? ` to ${payoutHandle.trim()} via PayPal` : ""}.
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
  const description = rebateDescription(slug, campaign?.description);

  return (
    <Shell
      logoUrl={hasImage ? tenant?.image : null}
      brand={brand}
      brandVars={brandVars}
      heroImageUrl={campaign?.heroImage}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <p
            className="mono text-[10px] font-semibold uppercase tracking-[0.18em] mb-1"
            style={{
              color: pick(brandVars, "--color-base-content", "#4a4e42"),
              opacity: 0.65,
            }}
          >
            {brand ? `${brand} · ` : ""}REBATE
          </p>
          <h1
            className="display text-2xl font-bold mb-1"
            style={{ letterSpacing: "-0.025em" }}
          >
            {headline}
          </h1>
          {description && (
            <p className="text-sm mb-2 leading-relaxed" style={{ opacity: 0.78 }}>
              {description}
            </p>
          )}

          {reward && (
            <div
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold tab-num"
              style={{
                background: pick(brandVars, "--color-primary", "#14160f"),
                color: pick(brandVars, "--color-primary-content", "#ffffff"),
              }}
            >
              {reward} reward
              {campaign?.product ? ` on ${campaign.product}` : ""}
            </div>
          )}
        </div>

        {campaign?.productImage && (
          <img
            src={campaign.productImage}
            alt={campaign?.product || "Product"}
            className="w-20 h-20 rounded-xl object-contain flex-shrink-0 p-1"
            style={{
              background: pick(brandVars, "--color-base-100", "#ffffff"),
              border: `1px solid ${pick(brandVars, "--color-neutral", "#dcddd5")}`,
            }}
          />
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4 mt-2"
      >
        {/* Photo picker — library first (no capture), camera second. */}
        <div>
          <label className={LABEL_CLS}>Receipt photo</label>
          {preview ? (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid #dcddd5", background: "#f6f6f2" }}
            >
              <img
                src={preview}
                alt="Receipt preview"
                className="w-full h-auto object-contain max-h-80"
              />
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

        {/* PayPal email — required, this is how the consumer gets paid. */}
        <Field label="PayPal email">
          <input
            type="email"
            value={payoutHandle}
            onChange={(e) => setPayoutHandle(e.target.value)}
            placeholder="you@email.com"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={CONTROL_CLS}
          />
          <p className="text-xs mt-1" style={{ opacity: 0.6 }}>
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

        <div className="pt-3" style={{ borderTop: "1px solid #ecece6" }}>
          <p className={LABEL_CLS + " mt-1 mb-2"}>Your details (optional)</p>
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
          disabled={submitting || !file || !payoutHandle.trim()}
          className="w-full px-5 py-3 rounded-lg text-sm font-semibold transition cursor-pointer"
          style={{
            background: pick(brandVars, "--color-primary", "#14160f"),
            color: pick(brandVars, "--color-primary-content", "#ffffff"),
            opacity: submitting || !file || !payoutHandle.trim() ? 0.42 : 1,
          }}
        >
          {submitting
            ? "Submitting…"
            : reward
              ? `Claim ${reward} →`
              : "Submit receipt →"}
        </button>
      </form>
    </Shell>
  );
};

const GIRLBEER_REBATE_COPY =
  "Bought Girl Beer? Photograph your receipt and submit it here. Once we verify the purchase, we'll send your rebate to the PayPal email you enter.";

function rebateDescription(
  slug: string | undefined,
  raw: string | null | undefined,
): string {
  const text = (raw || "").trim();
  if (slug === "girlbeer" && (!text || /connor/i.test(text))) {
    return GIRLBEER_REBATE_COPY;
  }
  return text;
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

// Resolve a brand color as a real value, never a CSS var() fallback: the app
// ships a site-wide DaisyUI default theme (src/index.css, near-black) that
// always defines --color-base-200 etc. at :root, so var(--color-x, <literal>)
// never actually falls through — it silently resolves to Spark's own dark
// admin-console theme instead of this page's intended neutral stone/white.
function pick(
  vars: Record<string, string> | null | undefined,
  key: string,
  fallback: string,
): string {
  return vars?.[key] || fallback;
}

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

const Shell: React.FC<{
  children: React.ReactNode;
  logoUrl?: string | null;
  brand?: string;
  brandVars?: Record<string, string> | null;
  heroImageUrl?: string | null;
}> = ({ children, logoUrl, brand, brandVars, heroImageUrl }) => (
  <div
    data-theme="spark-v2"
    data-spark-mode="light"
    className="min-h-screen"
    style={{
      background: pick(brandVars, "--color-base-200", "#f6f6f2"),
      colorScheme: "light",
    }}
  >
    <div className="max-w-xl mx-auto px-5 py-10">
      {heroImageUrl && (
        <img
          src={heroImageUrl}
          alt=""
          className="w-full h-40 sm:h-52 object-cover rounded-xl mb-6"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <div className="mb-6 flex items-center justify-between gap-3">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={brand || "Brand logo"}
            className="h-9 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <p
            className="mono text-[11px] uppercase tracking-[0.2em] font-semibold"
            style={{ color: pick(brandVars, "--color-base-content", "#4a4e42") }}
          >
            {brand || ""}
          </p>
        )}
      </div>
      <div
        className="rounded-xl p-6 sm:p-8"
        style={{
          background: pick(brandVars, "--color-base-100", "#ffffff"),
          border: `1px solid ${pick(brandVars, "--color-neutral", "#dcddd5")}`,
          color: pick(brandVars, "--color-base-content", "#14160f"),
        }}
      >
        {children}
      </div>
      <p
        className="mt-6 text-xs text-center"
        style={{
          color: pick(brandVars, "--color-base-content", "#5c6154"),
          opacity: 0.68,
        }}
      >
        <a
          href="https://www.igniteproductions.co/"
          style={{ color: "inherit", textDecoration: "none" }}
        >
          Spark by Ignite
        </a>
        {" · "}
        We'll only use this to verify your purchase and send your reward.
      </p>
    </div>
  </div>
);

export default CampaignUpload;
