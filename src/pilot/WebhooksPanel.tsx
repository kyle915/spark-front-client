/**
 * Outbound Webhooks Studio (`recap.approved`, `request.created`, `shelf.oos_detected`).
 *
 * Mounted alongside the official Spark MCP Connector on `/ai-connector` so
 * technical brands can wire HubSpot, Klaviyo, Airtable, or Zapier with
 * HMAC-SHA256 signed payloads, 1-click test deliveries, secret rotation, and
 * recent delivery inspection.
 */

import React, { Suspense, useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  KeyRound,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Webhook,
  XCircle,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { WorkspaceWebhooksQuery } from "@/api/queries/SavedViewsWebhooksQueries";
import {
  CreateWebhookEndpointMutation,
  DeleteWebhookEndpointMutation,
  RotateWebhookSecretMutation,
  SendTestWebhookMutation,
  UpdateWebhookEndpointMutation,
} from "@/api/mutations/SavedViewsWebhooksMutations";
import type { SavedViewsWebhooksQueriesWorkspaceWebhooksQuery as WebhooksQueryType } from "@/api/queries/__generated__/SavedViewsWebhooksQueriesWorkspaceWebhooksQuery.graphql";
import type { SavedViewsWebhooksMutationsCreateWebhookEndpointMutation as CreateType } from "@/api/mutations/__generated__/SavedViewsWebhooksMutationsCreateWebhookEndpointMutation.graphql";
import type { SavedViewsWebhooksMutationsUpdateWebhookEndpointMutation as UpdateType } from "@/api/mutations/__generated__/SavedViewsWebhooksMutationsUpdateWebhookEndpointMutation.graphql";
import type { SavedViewsWebhooksMutationsRotateWebhookSecretMutation as RotateType } from "@/api/mutations/__generated__/SavedViewsWebhooksMutationsRotateWebhookSecretMutation.graphql";
import type { SavedViewsWebhooksMutationsDeleteWebhookEndpointMutation as DeleteType } from "@/api/mutations/__generated__/SavedViewsWebhooksMutationsDeleteWebhookEndpointMutation.graphql";
import type { SavedViewsWebhooksMutationsSendTestWebhookMutation as TestType } from "@/api/mutations/__generated__/SavedViewsWebhooksMutationsSendTestWebhookMutation.graphql";

const META = { color: "var(--spark-text-meta)" } as const;
const BORDER = { border: "1px solid var(--spark-border)" } as const;
const FIELD = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-field-bg, var(--spark-surface))",
  color: "var(--spark-text)",
} as const;

const WebhooksInner: React.FC<{ tenantId: string | null }> = ({ tenantId }) => {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<WebhooksQueryType>(
    WorkspaceWebhooksQuery,
    { tenantId },
    { fetchPolicy: "store-and-network", fetchKey: `${tenantId ?? "none"}:${fetchKey}` },
  );
  const ws = data?.workspaceWebhooks;

  const [commitCreate, creating] = useMutation<CreateType>(CreateWebhookEndpointMutation);
  const [commitUpdate, updating] = useMutation<UpdateType>(UpdateWebhookEndpointMutation);
  const [commitRotate, rotating] = useMutation<RotateType>(RotateWebhookSecretMutation);
  const [commitDelete, deleting] = useMutation<DeleteType>(DeleteWebhookEndpointMutation);
  const [commitTest, testing] = useMutation<TestType>(SendTestWebhookMutation);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    "recap.approved",
    "shelf.oos_detected",
  ]);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [expandedUuid, setExpandedUuid] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  if (!ws) return null;

  const toggleEvent = (ev: string) => {
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((x) => x !== ev) : [...prev, ev],
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    commitCreate({
      variables: {
        name: name.trim(),
        url: url.trim(),
        events: selectedEvents,
        description: description.trim(),
        tenantId,
      },
      onCompleted: (res) => {
        const out = res.createWebhookEndpoint;
        if (out.ok) {
          setRevealedSecret(out.signingSecret ?? null);
          setName("");
          setUrl("");
          setDescription("");
          setFormOpen(false);
          setNotice({
            ok: true,
            text: "Webhook endpoint created. Copy your signing secret below — it is shown once.",
          });
          setFetchKey((k) => k + 1);
        } else {
          setNotice({ ok: false, text: out.error || "Could not create webhook." });
        }
      },
      onError: (err) => setNotice({ ok: false, text: err.message }),
    });
  };

  const handleToggleActive = (epUuid: string, current: boolean) => {
    commitUpdate({
      variables: { endpointUuid: epUuid, isActive: !current, tenantId },
      onCompleted: (res) => {
        if (res.updateWebhookEndpoint.ok) {
          setNotice({
            ok: true,
            text: !current ? "Webhook resumed." : "Webhook paused.",
          });
          setFetchKey((k) => k + 1);
        } else {
          setNotice({
            ok: false,
            text: res.updateWebhookEndpoint.error || "Could not update webhook.",
          });
        }
      },
    });
  };

  const handleRotate = (epUuid: string, epName: string) => {
    commitRotate({
      variables: { endpointUuid: epUuid, tenantId },
      onCompleted: (res) => {
        const out = res.rotateWebhookSecret;
        if (out.ok) {
          setRevealedSecret(out.signingSecret ?? null);
          setNotice({
            ok: true,
            text: `Rotated signing secret for “${epName}”. Copy the new secret now.`,
          });
          setFetchKey((k) => k + 1);
        } else {
          setNotice({ ok: false, text: out.error || "Could not rotate secret." });
        }
      },
    });
  };

  const handleTest = (epUuid: string, epName: string) => {
    setNotice(null);
    commitTest({
      variables: { endpointUuid: epUuid, tenantId },
      onCompleted: (res) => {
        const out = res.sendTestWebhook;
        setExpandedUuid(epUuid);
        setFetchKey((k) => k + 1);
        if (out.ok) {
          setNotice({
            ok: true,
            text: `Test event delivered to “${epName}” (HTTP ${out.httpStatus ?? 200} · ${out.durationMs ?? 0}ms).`,
          });
        } else {
          setNotice({
            ok: false,
            text: `Test delivery to “${epName}” failed: ${out.error || `HTTP ${out.httpStatus ?? "error"}`}`,
          });
        }
      },
      onError: (err) => setNotice({ ok: false, text: err.message }),
    });
  };

  const handleDelete = (epUuid: string, epName: string) => {
    commitDelete({
      variables: { endpointUuid: epUuid, tenantId },
      onCompleted: (res) => {
        if (res.deleteWebhookEndpoint.ok) {
          setNotice({ ok: true, text: `Deleted webhook “${epName}”.` });
          setFetchKey((k) => k + 1);
        } else {
          setNotice({
            ok: false,
            text: res.deleteWebhookEndpoint.error || "Could not delete webhook.",
          });
        }
      },
    });
  };

  return (
    <section
      id="webhooks"
      aria-label="Outbound Webhooks"
      className="spark-card p-5 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2">
            <Webhook size={17} style={META} />
            <h2 className="display text-lg font-bold">
              Outbound Webhooks · {ws.tenantName}
            </h2>
          </div>
          <p className="text-xs mt-1" style={META}>
            Push real-time HMAC-SHA256 signed events (<code>recap.approved</code>,{" "}
            <code>request.created</code>, <code>shelf.oos_detected</code>) straight into
            HubSpot, Klaviyo, Airtable, or Zapier. Never includes BA pay or internal staff notes.
          </p>
        </div>
        {ws.canManage ? (
          <button
            type="button"
            onClick={() => setFormOpen((o) => !o)}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            style={
              formOpen
                ? FIELD
                : {
                    background: "var(--spark-lime)",
                    color: "var(--spark-on-accent)",
                  }
            }
          >
            <Plus size={14} />
            {formOpen ? "Cancel" : "Add Webhook Endpoint"}
          </button>
        ) : null}
      </div>

      {revealedSecret && (
        <div
          className="rounded-xl p-4 space-y-2"
          style={{
            background: "var(--spark-ok-bg)",
            color: "var(--spark-ok-ink)",
            border: "1px solid var(--spark-ok-border)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold inline-flex items-center gap-1.5">
              <ShieldCheck size={14} />
              One-time HMAC signing secret (save this now)
            </span>
            <button
              type="button"
              onClick={() => setRevealedSecret(null)}
              className="text-xs underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 min-w-0 truncate px-3 py-1.5 rounded-lg text-xs mono"
              style={{ background: "rgba(255,255,255,0.75)", color: "#14160f" }}
            >
              {revealedSecret}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(revealedSecret).then(() => {
                  setCopiedSecret(true);
                  window.setTimeout(() => setCopiedSecret(false), 1600);
                });
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              style={{ background: "#14160f", color: "#ffffff" }}
            >
              <Copy size={12} />
              {copiedSecret ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div
          className="px-3 py-2 rounded-lg text-xs font-medium"
          style={
            notice.ok
              ? {
                  background: "var(--spark-ok-bg)",
                  color: "var(--spark-ok-ink)",
                  border: "1px solid var(--spark-ok-border)",
                }
              : {
                  background: "rgba(239, 90, 42, 0.12)",
                  color: "var(--spark-flag-ink, #a8340f)",
                  border: "1px solid rgba(239, 90, 42, 0.35)",
                }
          }
        >
          {notice.text}
        </div>
      )}

      {formOpen && ws.canManage && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl p-4 space-y-3 text-xs"
          style={{ background: "var(--spark-surface-2)", ...BORDER }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="font-medium" style={META}>
                Endpoint name *
              </span>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Zapier — Slack OOS & Recap Alerts"
                className="w-full px-3 py-2 rounded-lg text-xs"
                style={FIELD}
              />
            </label>
            <label className="block space-y-1">
              <span className="font-medium" style={META}>
                HTTPS destination URL *
              </span>
              <input
                required
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://hooks.zapier.com/hooks/catch/…"
                className="w-full px-3 py-2 rounded-lg text-xs"
                style={FIELD}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="font-medium" style={META}>
              Notes (optional)
            </span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Syncs approved recaps into HubSpot retail deal notes"
              className="w-full px-3 py-2 rounded-lg text-xs"
              style={FIELD}
            />
          </label>

          <div className="space-y-1.5">
            <span className="font-medium block" style={META}>
              Subscribed events *
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {ws.supportedEvents.map((ev) => {
                const checked = selectedEvents.includes(ev.event);
                return (
                  <label
                    key={ev.event}
                    className="flex items-start gap-2 rounded-lg p-2.5 cursor-pointer"
                    style={FIELD}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEvent(ev.event)}
                      className="mt-0.5"
                      style={{ accentColor: "var(--spark-lime)" }}
                    />
                    <span className="min-w-0">
                      <code className="block text-[11px] font-bold">{ev.event}</code>
                      <span className="block text-[11px] mt-0.5" style={META}>
                        {ev.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
              style={FIELD}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || selectedEvents.length === 0}
              className="px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
              }}
            >
              {creating ? "Creating…" : "Create endpoint"}
            </button>
          </div>
        </form>
      )}

      {ws.endpoints.length === 0 ? (
        <div
          className="rounded-xl p-4 text-xs space-y-1"
          style={{ background: "var(--spark-surface-2)", ...BORDER }}
        >
          <p className="font-semibold">No outbound webhooks configured yet.</p>
          <p style={META}>
            Connect Zapier, HubSpot, Klaviyo, or Airtable to trigger automations when recaps
            are approved, new demo requests arrive, or shelf OOS gaps are flagged.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ws.endpoints.map((ep) => {
            const isExpanded = expandedUuid === ep.uuid;
            return (
              <article
                key={ep.uuid}
                className="rounded-xl p-4 space-y-3 text-xs"
                style={{ background: "var(--spark-surface-2)", ...BORDER }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">{ep.name}</span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={
                          ep.isActive
                            ? {
                                background: "var(--spark-ok-bg)",
                                color: "var(--spark-ok-ink)",
                                border: "1px solid var(--spark-ok-border)",
                              }
                            : {
                                background: "var(--spark-surface)",
                                color: "var(--spark-text-meta)",
                                ...BORDER,
                              }
                        }
                      >
                        {ep.isActive ? "Active" : "Paused"}
                      </span>
                      {ep.lastStatusCode != null ? (
                        <span className="mono text-[11px]" style={META}>
                          Last HTTP {ep.lastStatusCode}
                        </span>
                      ) : null}
                    </div>
                    <code className="block text-[11px] truncate" style={META}>
                      {ep.url}
                    </code>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {ep.events.map((ev) => (
                        <span
                          key={ev}
                          className="mono px-2 py-0.5 rounded-md text-[10px] font-semibold"
                          style={{ background: "var(--spark-surface)", ...BORDER }}
                        >
                          {ev}
                        </span>
                      ))}
                      <span className="mono text-[10px] ml-1" style={META}>
                        Secret: {ep.signingSecretPreview}
                      </span>
                    </div>
                  </div>

                  {ws.canManage ? (
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={testing}
                        onClick={() => handleTest(ep.uuid, ep.name)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        style={FIELD}
                      >
                        <Send size={11} />
                        Test
                      </button>
                      <button
                        type="button"
                        disabled={updating}
                        onClick={() => handleToggleActive(ep.uuid, ep.isActive)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
                        style={FIELD}
                      >
                        {ep.isActive ? "Pause" : "Resume"}
                      </button>
                      <button
                        type="button"
                        disabled={rotating}
                        title="Rotate HMAC signing secret"
                        onClick={() => handleRotate(ep.uuid, ep.name)}
                        className="p-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                        style={FIELD}
                      >
                        <KeyRound size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={deleting}
                        title="Delete endpoint"
                        onClick={() => handleDelete(ep.uuid, ep.name)}
                        className="p-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                        style={FIELD}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="pt-2 border-t" style={{ borderColor: "var(--spark-border)" }}>
                  <button
                    type="button"
                    onClick={() => setExpandedUuid(isExpanded ? null : ep.uuid)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                    style={META}
                  >
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    Recent deliveries ({ep.recentDeliveries.length})
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-1.5">
                      {ep.recentDeliveries.length === 0 ? (
                        <p className="text-[11px]" style={META}>
                          No deliveries yet — click Test above to send a signed ping.
                        </p>
                      ) : (
                        ep.recentDeliveries.map((d) => (
                          <div
                            key={d.uuid}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2"
                            style={{ background: "var(--spark-surface)", ...BORDER }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {d.status === "delivered" ? (
                                <CheckCircle2
                                  size={13}
                                  style={{ color: "var(--spark-ok-ink)" }}
                                />
                              ) : (
                                <XCircle
                                  size={13}
                                  style={{ color: "var(--spark-flag-ink, #a8340f)" }}
                                />
                              )}
                              <code className="text-[11px] font-semibold">{d.eventType}</code>
                              <span className="mono text-[11px]" style={META}>
                                {d.httpStatus != null ? `HTTP ${d.httpStatus}` : "Network error"}
                                {d.durationMs != null ? ` · ${d.durationMs}ms` : ""}
                              </span>
                              {d.errorMessage ? (
                                <span
                                  className="text-[11px] truncate"
                                  style={{ color: "var(--spark-flag-ink, #a8340f)" }}
                                >
                                  {d.errorMessage}
                                </span>
                              ) : null}
                            </div>
                            <span className="mono text-[10px]" style={META}>
                              {d.createdAt.slice(0, 19).replace("T", " ")} UTC
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <details className="text-xs" style={META}>
        <summary className="cursor-pointer font-semibold">
          Signature verification header format (<code>X-Spark-Signature</code>)
        </summary>
        <p className="mt-1.5 leading-relaxed">
          Every POST includes <code>X-Spark-Event</code>, <code>X-Spark-Delivery</code>,{" "}
          <code>X-Spark-Timestamp</code>, and{" "}
          <code>X-Spark-Signature: t=&lt;ts&gt;,v1=&lt;hex&gt;</code> computed as{" "}
          <code>HMAC-SHA256(signing_secret, &quot;&lt;ts&gt;.&lt;raw_body&gt;&quot;)</code>.
        </p>
      </details>
    </section>
  );
};

export const WebhooksPanel: React.FC = () => {
  const tenantId = useAuthStore((s) => s.tenantId);
  if (!tenantId) return null;
  return (
    <Suspense
      fallback={
        <div className="spark-card p-5 text-sm" style={META}>
          Loading outbound webhooks…
        </div>
      }
    >
      <WebhooksInner key={tenantId} tenantId={tenantId} />
    </Suspense>
  );
};

export default WebhooksPanel;
