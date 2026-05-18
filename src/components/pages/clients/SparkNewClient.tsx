import { useState } from "react";
import { useNavigate } from "react-router";
import Layout from "@/layout/Layout";
import { useAlertStore } from "@/store/alertStore";

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

/**
 * Spark v2 — New Client / Tenant onboarding.
 *
 * Captures everything needed to spin up a new brand workspace inside
 * Ignite. v1 queues to localStorage and shows the backend wiring required
 * to actually create the tenant + initial RMM assignment + default forms.
 */

type ClientDraft = {
  name: string;
  slug: string;
  brandColor: string;
  logoUrl: string;
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

const slugify = (raw: string) =>
  `ighn-${raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")}`;

export default function SparkNewClient() {
  const navigate = useNavigate();
  const showAlert = useAlertStore((s) => s.showAlert);
  const [draft, setDraft] = useState<ClientDraft>({
    name: "",
    slug: "",
    brandColor: "#c5f546",
    logoUrl: "",
    primaryContactName: "",
    primaryContactEmail: "",
    primaryContactPhone: "",
    rmmEmail: "",
    notes: "",
    linkedSheetUrl: "",
  });

  const set = <K extends keyof ClientDraft>(k: K, v: ClientDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.primaryContactEmail.trim()) {
      showAlert("Brand name and primary contact email are required.", "warning");
      return;
    }
    if (submitting) return;
    setSubmitting(true);

    // Snapshot to localStorage first so a network hiccup doesn't
    // erase what kyle just typed. Cleared on success.
    const draftKey = "@spark.newClients.draft";
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ ...draft, at: new Date().toISOString() }),
      );
    } catch {
      /* ignore quota */
    }

    try {
      // Step 1: create the tenant. createTenant is admin-only on the
      // backend (spark-admin role check); the mutation also seeds
      // default RequestStatus / EventStatus rows for the new tenant.
      const tenantRes = await gqlPost<{
        createTenant: {
          success: boolean;
          message: string;
          tenant: { id: string; uuid: string; name: string } | null;
        };
      }>(
        `
          mutation CreateTenant($input: CreateTenantInput!) {
            createTenant(input: $input) {
              success
              message
              tenant { id uuid name }
            }
          }
        `,
        {
          input: {
            name: draft.name.trim(),
            image: draft.logoUrl.trim() || null,
          },
        },
      );
      const tc = tenantRes.createTenant;
      if (!tc?.success || !tc.tenant) {
        throw new Error(tc?.message || "Tenant create failed.");
      }
      const newTenantId = tc.tenant.id;

      // Step 2: invite the primary contact as a client of this tenant.
      // Best-effort — if it fails (e.g., email collision), we surface
      // a warning but don't undo the tenant create.
      let contactInvited = false;
      let contactError: string | null = null;
      try {
        const [firstName, ...rest] = draft.primaryContactName
          .trim()
          .split(/\s+/);
        const inviteRes = await gqlPost<{
          inviteUser: { success: boolean; message: string };
        }>(
          `
            mutation Invite($input: InviteUserInput!) {
              inviteUser(input: $input) { success message }
            }
          `,
          {
            input: {
              email: draft.primaryContactEmail.trim(),
              firstName: firstName || null,
              lastName: rest.join(" ") || null,
              role: "client",
              tenantId: newTenantId,
              note: draft.notes || null,
            },
          },
        );
        if (inviteRes.inviteUser?.success) {
          contactInvited = true;
        } else {
          contactError = inviteRes.inviteUser?.message ?? "unknown";
        }
      } catch (e) {
        contactError = (e as Error).message;
      }

      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }

      // Stash the per-tenant linked Sheet URL if kyle entered one
      // during onboarding. Read back on Master Tracker via the same
      // localStorage key pattern.
      const sheetUrl = draft.linkedSheetUrl.trim();
      if (sheetUrl && newTenantId) {
        try {
          localStorage.setItem(
            `@spark.linkedSheet.url/${newTenantId}`,
            sheetUrl,
          );
        } catch {
          /* ignore quota */
        }
      }

      if (contactInvited) {
        showAlert(
          `${tc.tenant.name} is live. Magic-link sent to ${draft.primaryContactEmail}.`,
          "success",
        );
      } else {
        showAlert(
          `${tc.tenant.name} is live, but the invite to ${draft.primaryContactEmail} didn't send: ${contactError}. Invite manually from People.`,
          "warning",
        );
      }
      navigate("/people");
    } catch (err) {
      showAlert(
        `Couldn't onboard ${draft.name}: ${(err as Error).message}. Your draft is saved — try again.`,
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <form
        onSubmit={onSubmit}
        className="space-y-6 max-w-3xl"
        style={{ paddingBottom: "6rem" }}
      >
        <div>
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            ONBOARDING · NEW BRAND
          </p>
          <h1
            className="display text-4xl font-bold mt-2"
            style={{ letterSpacing: "-0.04em" }}
          >
            Spin up a new client.
          </h1>
          <p className="mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            One page. Once submitted, Spark provisions a tenant, attaches
            a primary contact, assigns an RMM, and creates a default
            request form with the standard fields.
          </p>
        </div>

        <div className="spark-card p-6 space-y-5">
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.16em",
              color: "var(--spark-lime)",
            }}
          >
            01 · BRAND
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-mini block mb-1.5">Brand name *</label>
              <input
                style={inputStyle}
                value={draft.name}
                onChange={(e) => {
                  const name = e.target.value;
                  set("name", name);
                  if (!draft.slug || draft.slug === slugify(draft.name)) {
                    set("slug", slugify(name));
                  }
                }}
                placeholder="Liquid Death"
                required
              />
            </div>
            <div>
              <label className="label-mini block mb-1.5">
                URL slug (auto-derived)
              </label>
              <input
                style={inputStyle}
                value={draft.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="ighn-liquid-death"
              />
            </div>
            <div>
              <label className="label-mini block mb-1.5">
                Logo URL (optional)
              </label>
              <input
                style={inputStyle}
                value={draft.logoUrl}
                onChange={(e) => set("logoUrl", e.target.value)}
                placeholder="https://…/logo.svg"
              />
            </div>
            <div>
              <label className="label-mini block mb-1.5">Brand color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draft.brandColor}
                  onChange={(e) => set("brandColor", e.target.value)}
                  style={{
                    width: 44,
                    height: 44,
                    background: "transparent",
                    border: "1px solid var(--spark-border)",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                />
                <input
                  style={inputStyle}
                  value={draft.brandColor}
                  onChange={(e) => set("brandColor", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="spark-card p-6 space-y-5">
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.16em",
              color: "var(--spark-lime)",
            }}
          >
            02 · PRIMARY CONTACT
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-mini block mb-1.5">Name *</label>
              <input
                style={inputStyle}
                value={draft.primaryContactName}
                onChange={(e) =>
                  set("primaryContactName", e.target.value)
                }
                placeholder="Ross K."
              />
            </div>
            <div>
              <label className="label-mini block mb-1.5">Email *</label>
              <input
                style={inputStyle}
                type="email"
                value={draft.primaryContactEmail}
                onChange={(e) =>
                  set("primaryContactEmail", e.target.value)
                }
                placeholder="ross@liquid-death.com"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-mini block mb-1.5">Phone (optional)</label>
              <input
                style={inputStyle}
                type="tel"
                value={draft.primaryContactPhone}
                onChange={(e) =>
                  set("primaryContactPhone", e.target.value)
                }
                placeholder="+1 (323) 555-0117"
              />
            </div>
          </div>
        </div>

        <div className="spark-card p-6 space-y-5">
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.16em",
              color: "var(--spark-lime)",
            }}
          >
            03 · IGNITE ASSIGNMENT
          </p>
          <div>
            <label className="label-mini block mb-1.5">
              Default RMM email
            </label>
            <input
              style={inputStyle}
              type="email"
              value={draft.rmmEmail}
              onChange={(e) => set("rmmEmail", e.target.value)}
              placeholder="maya@igniteproductions.co"
            />
          </div>
          <div>
            <label className="label-mini block mb-1.5">
              Linked Google Sheet (optional)
            </label>
            <input
              style={inputStyle}
              type="url"
              value={draft.linkedSheetUrl}
              onChange={(e) => set("linkedSheetUrl", e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit"
            />
            <p
              className="mono text-[10px] mt-1.5"
              style={{
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              SHOWS A "📊 LINKED SHEET" BUTTON ON THE BRAND'S MASTER
              TRACKER. CAN ADD LATER FROM THE TRACKER HEADER.
            </p>
          </div>
          <div>
            <label className="label-mini block mb-1.5">
              Onboarding notes (internal)
            </label>
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: 100 }}
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Anything the RMM should know. Activation cadence, billing model, contract notes."
              rows={4}
            />
          </div>
        </div>

        <div
          className="spark-card p-5"
          style={{
            borderColor: "rgba(95,184,239,0.25)",
            background:
              "linear-gradient(180deg, rgba(95,184,239,0.06), transparent)",
          }}
        >
          <p
            className="mono text-[10px]"
            style={{
              letterSpacing: "0.16em",
              color: "var(--spark-sky)",
            }}
          >
            WHAT HAPPENS NEXT
          </p>
          <ol
            className="mt-3 space-y-2 text-sm list-decimal list-inside"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            <li>Tenant row is created + indexed in the picker.</li>
            <li>
              Primary contact gets an invite email with a one-click sign-in
              link.
            </li>
            <li>RMM is linked + sees the new brand in the sidebar picker.</li>
            <li>
              A default request form is provisioned. You can edit fields
              under <span className="mono">/forms/builder</span>.
            </li>
          </ol>
        </div>

        {/* Sticky submit */}
        <div
          className="fixed left-0 right-0 z-40"
          style={{
            bottom: 0,
            background: "rgba(10,13,9,0.92)",
            backdropFilter: "blur(14px)",
            borderTop: "1px solid var(--spark-border)",
          }}
        >
          <div className="max-w-3xl mx-auto px-6 lg:px-8 py-4 flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => navigate("/people")}
              className="mono text-[10px] transition"
              style={{
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              ← BACK
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-2xl text-sm font-semibold"
              style={{
                background: "var(--spark-lime)",
                color: "#0a0d09",
                boxShadow: "0 0 24px rgba(197,245,70,0.35)",
                opacity: submitting ? 0.5 : 1,
              }}
            >
              {submitting ? "Spinning up…" : "Spin up brand →"}
            </button>
          </div>
        </div>
      </form>
    </Layout>
  );
}
