import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import CheckinQr from "@/components/pages/walkups/CheckinQr";
import Layout from "@/layout/Layout";
import { useAlertStore } from "@/store/alertStore";
import {
  WIZARD_STEPS,
  countCatalogCsv,
  deriveCodePrefix,
  parseLabelSwaps,
  slugifyBrand,
  stepLabel,
  validateLabelSwaps,
  validateSlug,
  type WizardStep,
} from "./launchWizard";

/**
 * Inline GraphQL POST helper. Use this when we don't have / don't want
 * to thread a Relay mutation through the codegen pipeline. Kept here
 * because the wizard is admin-only and called rarely (once per brand
 * onboarding).
 */
async function gqlPost<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(import.meta.env.VITE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${localStorage.getItem("@token") ?? ""}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(
      json.errors.map((e: { message: string }) => e.message).join("; "),
    );
  }
  return json.data as T;
}

type DonorOption = {
  templateId: number;
  templateName: string;
  tenantName: string;
  tenantSlug: string | null;
  eventType: string;
  fieldCount: number;
};

type PreviewField = { name: string; type: string; required: boolean; options: string[] };
type PreviewSection = { name: string; fields: PreviewField[] };
type LaunchPreview = {
  slug: string;
  existingTenant: { name: string } | null;
  existingCheckinCode: string | null;
  checkinUrl: string;
  sparkFormUrl: string;
  sections: PreviewSection[];
  photoBuckets: { name: string; helper: string | null; min: number | null }[];
  locationMode: string;
  catalogCount: number;
  errors: string[];
};

type LaunchResult = {
  checkinCode: string;
  checkinUrl: string;
  sparkFormUrl: string;
  tenantName: string;
};

type Draft = {
  name: string;
  slug: string;
  brandColor: string;
  logoUrl: string;
  donorTemplateId: string;
  newTemplateName: string;
  labelSwaps: string;
  catalogCsv: string;
  shopifyJson: string;
  codePrefix: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  rmmEmail: string;
  notes: string;
  linkedSheetUrl: string;
};

const inputStyle: React.CSSProperties = {
  background: "var(--spark-bg)",
  border: "1px solid var(--spark-border)",
  borderRadius: 12,
  padding: "0.75rem 0.95rem",
  color: "var(--spark-text)",
  fontSize: "0.9rem",
  outline: "none",
  width: "100%",
  fontFamily: "Space Grotesk, sans-serif",
};

export default function SparkNewClient() {
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [step, setStep] = useState<WizardStep>("basics");
  const [donors, setDonors] = useState<DonorOption[]>([]);
  const [preview, setPreview] = useState<LaunchPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState<LaunchResult | null>(null);
  const [draft, setDraft] = useState<Draft>({
    name: "",
    slug: "",
    brandColor: "#f2f3ee",
    logoUrl: "",
    donorTemplateId: "",
    newTemplateName: "",
    labelSwaps: "",
    catalogCsv: "",
    shopifyJson: "",
    codePrefix: "",
    primaryContactName: "",
    primaryContactEmail: "",
    primaryContactPhone: "",
    rmmEmail: "",
    notes: "",
    linkedSheetUrl: "",
  });

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  useEffect(() => {
    let cancelled = false;
    gqlPost<{ tenantLaunchDonors: DonorOption[] }>(
      `query LaunchDonors { tenantLaunchDonors {
        templateId templateName tenantName tenantSlug eventType fieldCount
      } }`,
      {},
    )
      .then((data) => {
        if (!cancelled) setDonors(data.tenantLaunchDonors ?? []);
      })
      .catch(() => {
        if (!cancelled) setDonors([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const slugError = useMemo(
    () => (draft.slug ? validateSlug(draft.slug) : null),
    [draft.slug],
  );
  const swapError = useMemo(
    () => validateLabelSwaps(draft.labelSwaps),
    [draft.labelSwaps],
  );
  const catalogRows = useMemo(
    () => countCatalogCsv(draft.catalogCsv),
    [draft.catalogCsv],
  );
  const stepIndex = WIZARD_STEPS.indexOf(step);

  const launchVariables = () => ({
    input: {
      name: draft.name.trim(),
      slug: draft.slug.trim().toLowerCase(),
      brandColor: draft.brandColor || null,
      logoUrl: draft.logoUrl.trim() || null,
      donorTemplateId: draft.donorTemplateId || null,
      newTemplateName: draft.newTemplateName.trim() || null,
      labelSwaps: parseLabelSwaps(draft.labelSwaps),
      catalogCsv: draft.catalogCsv.trim() || null,
      shopifyJson: draft.shopifyJson.trim() || null,
      codePrefix:
        draft.codePrefix.trim() ||
        deriveCodePrefix(draft.slug, draft.name) ||
        null,
    },
  });

  const runPreview = async () => {
    if (!draft.name.trim()) return showAlert("Brand name is required.", "warning");
    if (slugError) return showAlert(slugError, "warning");
    if (swapError) return showAlert(swapError, "warning");
    setPreviewing(true);
    try {
      const data = await gqlPost<{
        previewTenantLaunch: {
          success: boolean;
          message: string;
          preview: LaunchPreview | null;
        };
      }>(
        `mutation PreviewLaunch($input: TenantLaunchInput!) {
          previewTenantLaunch(input: $input) {
            success message
            preview {
              slug existingTenant { name } existingCheckinCode checkinUrl
              sparkFormUrl locationMode catalogCount errors
              sections { name fields { name type required options } }
              photoBuckets { name helper min }
            }
          }
        }`,
        launchVariables(),
      );
      const result = data.previewTenantLaunch;
      if (!result.success || !result.preview) {
        throw new Error(result.message || "Preview failed.");
      }
      setPreview(result.preview);
      showAlert("Preview ready — nothing was written yet.", "success");
    } catch (err) {
      showAlert(`Preview failed: ${(err as Error).message}`, "error");
    } finally {
      setPreviewing(false);
    }
  };

  const onLaunch = async () => {
    if (launching) return;
    if (!preview) {
      showAlert("Run the preview first so you can see the form before it goes live.", "warning");
      return;
    }
    setLaunching(true);
    try {
      const data = await gqlPost<{
        launchTenant: {
          success: boolean;
          message: string;
          checkinCode: string | null;
          checkinUrl: string | null;
          sparkFormUrl: string | null;
          tenant: { id: string; name: string } | null;
          catalogCreated: number;
          catalogReused: number;
          warnings: string[];
        };
      }>(
        `mutation LaunchTenant($input: TenantLaunchInput!) {
          launchTenant(input: $input) {
            success message checkinCode checkinUrl sparkFormUrl
            catalogCreated catalogReused warnings
            tenant { id name }
          }
        }`,
        launchVariables(),
      );
      const result = data.launchTenant;
      if (!result.success || !result.tenant || !result.checkinCode) {
        throw new Error(result.message || "Launch failed.");
      }
      const tenantId = result.tenant.id;

      // Primary contact invite reuses the existing invite flow.
      let inviteNote = "";
      if (draft.primaryContactEmail.trim()) {
        try {
          const [firstName, ...rest] = draft.primaryContactName.trim().split(/\s+/);
          const invite = await gqlPost<{ inviteUser: { success: boolean; message: string } }>(
            `mutation Invite($input: InviteUserInput!) {
              inviteUser(input: $input) { success message }
            }`,
            {
              input: {
                email: draft.primaryContactEmail.trim(),
                firstName: firstName || null,
                lastName: rest.join(" ") || null,
                role: "client",
                tenantId,
              },
            },
          );
          inviteNote = invite.inviteUser.success
            ? ` Invite sent to ${draft.primaryContactEmail.trim()}.`
            : ` Invite did not send: ${invite.inviteUser.message} — invite manually from People.`;
        } catch (err) {
          inviteNote = ` Invite did not send: ${(err as Error).message} — invite manually from People.`;
        }
      }
      if (draft.linkedSheetUrl.trim()) {
        try {
          localStorage.setItem(
            `@spark.linkedSheet.url/${tenantId}`,
            draft.linkedSheetUrl.trim(),
          );
        } catch {
          /* ignore quota */
        }
      }
      setLaunched({
        checkinCode: result.checkinCode,
        checkinUrl: result.checkinUrl ?? `https://client.igniteproductions.co/checkin/${result.checkinCode}`,
        sparkFormUrl: result.sparkFormUrl ?? `https://client.igniteproductions.co/spark-form/${draft.slug.trim().toLowerCase()}`,
        tenantName: result.tenant.name,
      });
      showAlert(`${result.tenant.name} is live.${inviteNote}`, result.warnings.length ? "warning" : "success");
    } catch (err) {
      showAlert(`Couldn't launch ${draft.name}: ${(err as Error).message}`, "error");
    } finally {
      setLaunching(false);
    }
  };

  const onCatalogFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    if (file.name.toLowerCase().endsWith(".json")) set("shopifyJson", text);
    else set("catalogCsv", text);
  };

  const next = () => {
    switch (step) {
      case "basics":
        if (!draft.name.trim()) return showAlert("Brand name is required.", "warning");
        if (slugError) return showAlert(slugError, "warning");
        setStep("template");
        return;
      case "template":
        if (swapError) return showAlert(swapError, "warning");
        setStep("catalog");
        return;
      case "catalog":
        setStep("walkup");
        return;
      case "walkup":
        setStep("review");
        return;
      case "review":
        return;
      default: {
        const _exhaustive: never = step;
        throw new Error(`Unknown wizard step: ${_exhaustive}`);
      }
    }
  };

  const back = () => {
    const idx = WIZARD_STEPS.indexOf(step);
    if (idx > 0) setStep(WIZARD_STEPS[idx - 1]);
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl" style={{ paddingBottom: "6rem" }}>
        <div>
          <p className="mono text-[10px]" style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}>
            ONBOARDING · NEW BRAND
          </p>
          <h1 className="display text-4xl font-bold mt-2" style={{ letterSpacing: "-0.04em" }}>
            Launch a client.
          </h1>
          <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            The Drink Lyft pattern, codified: brand basics, a cloned recap
            template, the Product catalog, and a standing walk-up code —
            previewed before anything goes live. Requests stay Pending and
            recaps still need admin approval.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {WIZARD_STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => i < stepIndex && setStep(s)}
              className="mono text-[10px] px-3 py-2 rounded-full"
              style={{
                letterSpacing: "0.12em",
                background: s === step ? "var(--spark-lime)" : "var(--spark-card)",
                color: s === step ? "#0a0d09" : "rgba(255,255,255,0.6)",
                border: "1px solid var(--spark-border)",
              }}
            >
              {i + 1} · {stepLabel(s).toUpperCase()}
            </button>
          ))}
        </div>

        {launched ? (
          <div className="spark-card p-6 space-y-4">
            <p className="mono text-[10px]" style={{ letterSpacing: "0.16em", color: "var(--spark-lime)" }}>
              LIVE · {launched.tenantName.toUpperCase()}
            </p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
              Standing walk-up code <strong>{launched.checkinCode}</strong> — minted
              once and never rotated. Share the link or QR with the field team.
            </p>
            <CheckinQr url={launched.checkinUrl} downloadName={`${launched.checkinCode}-checkin-qr.png`} />
            <div className="space-y-1 text-sm">
              <p>Check-in: <a href={launched.checkinUrl} target="_blank" rel="noreferrer" style={{ color: "var(--spark-lime)" }}>{launched.checkinUrl}</a></p>
              <p>Request form: <a href={launched.sparkFormUrl} target="_blank" rel="noreferrer" style={{ color: "var(--spark-lime)" }}>{launched.sparkFormUrl}</a></p>
            </div>
            <button type="button" onClick={() => navigate("/clients")} className="px-5 py-3 rounded-2xl text-sm font-semibold" style={{ background: "var(--spark-lime)", color: "#0a0d09" }}>
              Done
            </button>
          </div>
        ) : (
          <>
            {step === "basics" && (
              <div className="spark-card p-6 space-y-5">
                <p className="mono text-[10px]" style={{ letterSpacing: "0.16em", color: "var(--spark-lime)" }}>01 · BRAND BASICS</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label-mini block mb-1.5">Brand name *</label>
                    <input style={inputStyle} value={draft.name} onChange={(e) => {
                      const name = e.target.value;
                      set("name", name);
                      if (!draft.slug || draft.slug === slugifyBrand(draft.name)) set("slug", slugifyBrand(name));
                    }} placeholder="Drink Lyft" required />
                  </div>
                  <div>
                    <label className="label-mini block mb-1.5">Exact slug *</label>
                    <input style={inputStyle} value={draft.slug} onChange={(e) => set("slug", e.target.value)} placeholder="drink-lyft" />
                    {slugError && <p className="text-xs mt-1" style={{ color: "#ef5a2a" }}>{slugError}</p>}
                    <p className="mono text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>RESOLVED EXACTLY — NEVER A SUBSTRING MATCH.</p>
                  </div>
                  <div>
                    <label className="label-mini block mb-1.5">Logo URL (optional)</label>
                    <input style={inputStyle} value={draft.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://…/logo.svg" />
                  </div>
                  <div>
                    <label className="label-mini block mb-1.5">Brand color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={draft.brandColor} onChange={(e) => set("brandColor", e.target.value)} style={{ width: 44, height: 44, background: "transparent", border: "1px solid var(--spark-border)", borderRadius: 10, cursor: "pointer" }} />
                      <input style={inputStyle} value={draft.brandColor} onChange={(e) => set("brandColor", e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === "template" && (
              <div className="spark-card p-6 space-y-5">
                <p className="mono text-[10px]" style={{ letterSpacing: "0.16em", color: "var(--spark-lime)" }}>02 · CLONE RECAP TEMPLATE</p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Pick a donor tenant&apos;s recap form. Fields, photo buckets, and
                  location mode are cloned onto the new tenant — the donor is
                  never changed. Products Sampled pills read the new catalog.
                </p>
                <div>
                  <label className="label-mini block mb-1.5">Donor template</label>
                  <select style={inputStyle} value={draft.donorTemplateId} onChange={(e) => set("donorTemplateId", e.target.value)}>
                    <option value="">No donor — start blank</option>
                    {donors.map((d) => (
                      <option key={d.templateId} value={String(d.templateId)}>
                        {d.tenantName} · {d.templateName} ({d.eventType}, {d.fieldCount} fields)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-mini block mb-1.5">New template name (optional)</label>
                  <input style={inputStyle} value={draft.newTemplateName} onChange={(e) => set("newTemplateName", e.target.value)} placeholder="Defaults to the donor's name" />
                </div>
                <div>
                  <label className="label-mini block mb-1.5">Label swaps, one OLD=NEW per line</label>
                  <textarea style={{ ...inputStyle, minHeight: 80 }} value={draft.labelSwaps} onChange={(e) => set("labelSwaps", e.target.value)} placeholder={"Liquid Death=Acme Drinks"} />
                  {swapError && <p className="text-xs mt-1" style={{ color: "#ef5a2a" }}>{swapError}</p>}
                </div>
              </div>
            )}

            {step === "catalog" && (
              <div className="spark-card p-6 space-y-5">
                <p className="mono text-[10px]" style={{ letterSpacing: "0.16em", color: "var(--spark-lime)" }}>03 · PRODUCT CATALOG</p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Paste a CSV (name, sku, image_url) or a Shopify collection
                  JSON. Imports are idempotent by SKU — re-running adds
                  nothing. Only paste SKUs that really exist.
                </p>
                <div>
                  <label className="label-mini block mb-1.5">Catalog CSV {catalogRows ? `· ${catalogRows} rows` : ""}</label>
                  <textarea style={{ ...inputStyle, minHeight: 120, fontFamily: "JetBrains Mono, monospace" }} value={draft.catalogCsv} onChange={(e) => set("catalogCsv", e.target.value)} placeholder={"name,sku,image_url\nAcme Cola,ACME-1,https://…"} />
                </div>
                <div>
                  <label className="label-mini block mb-1.5">Shopify collection JSON (optional)</label>
                  <textarea style={{ ...inputStyle, minHeight: 80, fontFamily: "JetBrains Mono, monospace" }} value={draft.shopifyJson} onChange={(e) => set("shopifyJson", e.target.value)} placeholder='{"products": [{"title": "…", "variants": [{"sku": "…"}]}]}' />
                </div>
                <div>
                  <label className="label-mini block mb-1.5">Or upload a .csv / .json file</label>
                  <input type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => void onCatalogFile(e.target.files?.[0] ?? null)} />
                </div>
              </div>
            )}

            {step === "walkup" && (
              <div className="spark-card p-6 space-y-5">
                <p className="mono text-[10px]" style={{ letterSpacing: "0.16em", color: "var(--spark-lime)" }}>04 · STANDING WALK-UP CODE</p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                  One durable code, minted once at launch and never rotated.
                  If this slug already has a code, launch keeps it.
                </p>
                <div>
                  <label className="label-mini block mb-1.5">Code prefix (1–4 characters)</label>
                  <input style={inputStyle} value={draft.codePrefix} onChange={(e) => set("codePrefix", e.target.value.toUpperCase())} placeholder={deriveCodePrefix(draft.slug, draft.name)} maxLength={4} />
                </div>
                <p className="mono text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                  WILL SERVE https://client.igniteproductions.co/checkin/{(draft.codePrefix || deriveCodePrefix(draft.slug, draft.name) || "SP")}-XXXXXX
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label-mini block mb-1.5">Primary contact name</label>
                    <input style={inputStyle} value={draft.primaryContactName} onChange={(e) => set("primaryContactName", e.target.value)} />
                  </div>
                  <div>
                    <label className="label-mini block mb-1.5">Primary contact email</label>
                    <input style={inputStyle} type="email" value={draft.primaryContactEmail} onChange={(e) => set("primaryContactEmail", e.target.value)} />
                  </div>
                  <div>
                    <label className="label-mini block mb-1.5">Default RMM email (optional)</label>
                    <input style={inputStyle} type="email" value={draft.rmmEmail} onChange={(e) => set("rmmEmail", e.target.value)} />
                  </div>
                  <div>
                    <label className="label-mini block mb-1.5">Linked Google Sheet (optional)</label>
                    <input style={inputStyle} type="url" value={draft.linkedSheetUrl} onChange={(e) => set("linkedSheetUrl", e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
                  </div>
                </div>
              </div>
            )}

            {step === "review" && (
              <div className="spark-card p-6 space-y-5">
                <p className="mono text-[10px]" style={{ letterSpacing: "0.16em", color: "var(--spark-lime)" }}>05 · PREVIEW & LAUNCH</p>
                {!preview ? (
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                    Render the check-in/recap form for {draft.name || "the new tenant"} before
                    marking it live. Preview writes nothing.
                  </p>
                ) : (
                  <div className="space-y-4 text-sm">
                    {preview.existingTenant && (
                      <p style={{ color: "#ef5a2a" }}>
                        Slug already belongs to {preview.existingTenant.name} — launch
                        resumes that tenant{preview.existingCheckinCode ? ` and keeps code ${preview.existingCheckinCode}` : ""}.
                      </p>
                    )}
                    <p>Check-in: {preview.checkinUrl}</p>
                    <p>Request form: {preview.sparkFormUrl}</p>
                    <p>Location mode: {preview.locationMode || "—"} · Catalog rows: {preview.catalogCount}</p>
                    <p>Photo buckets: {preview.photoBuckets.map((b) => b.name).join(", ") || "—"}</p>
                    {preview.sections.map((section) => (
                      <div key={section.name} className="rounded-xl p-4" style={{ border: "1px solid var(--spark-border)" }}>
                        <p className="font-semibold">{section.name}</p>
                        <ul className="mt-2 space-y-1" style={{ color: "rgba(255,255,255,0.65)" }}>
                          {section.fields.map((f) => (
                            <li key={f.name}>{f.name} <span className="mono text-[10px]">[{f.type}]{f.required ? " *" : ""}</span></li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-3 flex-wrap">
                  <button type="button" onClick={() => void runPreview()} disabled={previewing} className="px-5 py-3 rounded-2xl text-sm font-semibold" style={{ border: "1px solid var(--spark-border)", color: "var(--spark-text)", opacity: previewing ? 0.5 : 1 }}>
                    {previewing ? "Previewing…" : "Preview form"}
                  </button>
                  <button type="button" onClick={() => void onLaunch()} disabled={launching || !preview} className="px-6 py-3 rounded-2xl text-sm font-semibold" style={{ background: "var(--spark-lime)", color: "#0a0d09", opacity: launching || !preview ? 0.5 : 1 }}>
                    {launching ? "Launching…" : "Launch tenant →"}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button type="button" onClick={stepIndex === 0 ? () => navigate("/clients") : back} className="mono text-[10px]" style={{ letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)" }}>
                ← BACK
              </button>
              {step !== "review" && (
                <button type="button" onClick={next} className="px-6 py-3 rounded-2xl text-sm font-semibold" style={{ background: "var(--spark-lime)", color: "#0a0d09" }}>
                  Continue →
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}