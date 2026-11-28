/**
 * Regional Manager Alert Subscriptions Card.
 *
 * Lets brand regional managers create instant email and/or signed HTTPS
 * webhook alert rules scoped to their own states and/or retail chains
 * (e.g. "Texas H-E-B: alert on out-of-stock, >5% MSRP drift, or missing tag").
 */

import React, { useState } from "react";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import {
  BellRing,
  CheckCircle2,
  Mail,
  Pencil,
  Plus,
  Send,
  Trash2,
  Webhook,
  X,
} from "lucide-react";
import { RegionalAlertSubscriptionsQuery } from "@/api/queries/RetentionAutomationQueries";
import {
  DeleteRegionalAlertSubscriptionMutation,
  SendTestRegionalAlertMutation,
  UpsertRegionalAlertSubscriptionMutation,
} from "@/api/mutations/RetentionAutomationMutations";
import type { RetentionAutomationQueriesRegionalAlertSubscriptionsQuery as QueryType } from "@/api/queries/__generated__/RetentionAutomationQueriesRegionalAlertSubscriptionsQuery.graphql";
import type { RetentionAutomationMutationsUpsertRegionalAlertSubscriptionMutation as UpsertType } from "@/api/mutations/__generated__/RetentionAutomationMutationsUpsertRegionalAlertSubscriptionMutation.graphql";
import type { RetentionAutomationMutationsDeleteRegionalAlertSubscriptionMutation as DeleteType } from "@/api/mutations/__generated__/RetentionAutomationMutationsDeleteRegionalAlertSubscriptionMutation.graphql";
import type { RetentionAutomationMutationsSendTestRegionalAlertMutation as TestType } from "@/api/mutations/__generated__/RetentionAutomationMutationsSendTestRegionalAlertMutation.graphql";
import { parseCsvTokens } from "./regionalAlertsHelpers";
import { BellToggle, InkSwitch } from "@/motion/InkSwitch";

const TEXT = { color: "var(--spark-text)" } as const;
const META = { color: "var(--spark-text-meta)" } as const;
const SECONDARY = { color: "var(--spark-text-secondary)" } as const;
const BORDER = { border: "1px solid var(--spark-border)" } as const;
const FIELD = {
  border: "1px solid var(--spark-border)",
  background: "var(--spark-field-bg, var(--spark-surface))",
  color: "var(--spark-text)",
} as const;

export const RegionalAlertsCard: React.FC<{
  tenantId: string;
  suggestedStates?: readonly string[];
  activeTargetMsrp?: number | null;
}> = ({ tenantId, suggestedStates = [], activeTargetMsrp = null }) => {
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<QueryType>(
    RegionalAlertSubscriptionsQuery,
    { tenantId },
    {
      fetchPolicy: "store-and-network",
      fetchKey: `reg-alerts:${tenantId}:${fetchKey}`,
    },
  );

  const workspace = data?.regionalAlertSubscriptions;
  const subscriptions = workspace?.subscriptions ?? [];

  const [commitUpsert, saving] = useMutation<UpsertType>(
    UpsertRegionalAlertSubscriptionMutation,
  );
  const [commitDelete, deleting] = useMutation<DeleteType>(
    DeleteRegionalAlertSubscriptionMutation,
  );
  const [commitTest, testing] = useMutation<TestType>(
    SendTestRegionalAlertMutation,
  );

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [statesText, setStatesText] = useState("");
  const [chainsText, setChainsText] = useState("");
  const [alertOos, setAlertOos] = useState(true);
  const [alertPriceDrift, setAlertPriceDrift] = useState(true);
  const [alertMissingTag, setAlertMissingTag] = useState(true);
  const [targetMsrp, setTargetMsrp] = useState("");
  const [driftThresholdPct, setDriftThresholdPct] = useState("5.0");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [recipientEmails, setRecipientEmails] = useState("");
  const [notifyWebhook, setNotifyWebhook] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [testingUuid, setTestingUuid] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const openCreate = () => {
    setEditingUuid(null);
    setName("");
    setStatesText(suggestedStates.slice(0, 1).join(", "));
    setChainsText("");
    setAlertOos(true);
    setAlertPriceDrift(true);
    setAlertMissingTag(true);
    setTargetMsrp(activeTargetMsrp ? activeTargetMsrp.toFixed(2) : "");
    setDriftThresholdPct("5.0");
    setNotifyEmail(true);
    setRecipientEmails(workspace?.defaultEmail ?? "");
    setNotifyWebhook(false);
    setWebhookUrl("");
    setIsActive(true);
    setNotice(null);
    setEditorOpen(true);
  };

  const openEdit = (sub: (typeof subscriptions)[number]) => {
    setEditingUuid(sub.uuid);
    setName(sub.name);
    setStatesText(sub.states.join(", "));
    setChainsText(sub.chains.join(", "));
    setAlertOos(sub.alertOos);
    setAlertPriceDrift(sub.alertPriceDrift);
    setAlertMissingTag(sub.alertMissingTag);
    setTargetMsrp(sub.targetMsrp ?? "");
    setDriftThresholdPct(sub.driftThresholdPct || "5.0");
    setNotifyEmail(sub.notifyEmail);
    setRecipientEmails(sub.recipientEmails || "");
    setNotifyWebhook(sub.notifyWebhook);
    setWebhookUrl(sub.webhookUrl || "");
    setIsActive(sub.isActive);
    setNotice(null);
    setEditorOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    commitUpsert({
      variables: {
        subscriptionUuid: editingUuid,
        name: name.trim(),
        states: parseCsvTokens(statesText).map((s) => s.toUpperCase()),
        chains: parseCsvTokens(chainsText),
        alertOos,
        alertPriceDrift,
        alertMissingTag,
        targetMsrp: targetMsrp.trim() || null,
        driftThresholdPct: driftThresholdPct.trim() || "5.0",
        notifyEmail,
        recipientEmails: recipientEmails.trim(),
        notifyWebhook,
        webhookUrl: webhookUrl.trim(),
        isActive,
        tenantId,
      },
      onCompleted: (res) => {
        const out = res.upsertRegionalAlertSubscription;
        if (out.ok) {
          setEditorOpen(false);
          setNotice({
            ok: true,
            text: editingUuid
              ? `Updated regional alert "${name.trim()}".`
              : `Created regional alert "${name.trim()}".`,
          });
          setFetchKey((k) => k + 1);
        } else {
          setNotice({
            ok: false,
            text: out.error || "Could not save regional alert rule.",
          });
        }
      },
      onError: () =>
        setNotice({ ok: false, text: "Could not reach Spark to save rule." }),
    });
  };

  const handleToggleActive = (sub: (typeof subscriptions)[number]) => {
    setNotice(null);
    commitUpsert({
      variables: {
        subscriptionUuid: sub.uuid,
        name: sub.name,
        states: [...sub.states],
        chains: [...sub.chains],
        alertOos: sub.alertOos,
        alertPriceDrift: sub.alertPriceDrift,
        alertMissingTag: sub.alertMissingTag,
        targetMsrp: sub.targetMsrp,
        driftThresholdPct: sub.driftThresholdPct,
        notifyEmail: sub.notifyEmail,
        recipientEmails: sub.recipientEmails,
        notifyWebhook: sub.notifyWebhook,
        webhookUrl: sub.webhookUrl,
        isActive: !sub.isActive,
        tenantId,
      },
      onCompleted: (res) => {
        if (res.upsertRegionalAlertSubscription.ok) {
          setFetchKey((k) => k + 1);
        } else {
          setNotice({
            ok: false,
            text:
              res.upsertRegionalAlertSubscription.error ||
              "Could not update rule status.",
          });
        }
      },
    });
  };

  const handleDelete = (sub: (typeof subscriptions)[number]) => {
    setNotice(null);
    commitDelete({
      variables: { subscriptionUuid: sub.uuid, tenantId },
      onCompleted: (res) => {
        if (res.deleteRegionalAlertSubscription.ok) {
          setNotice({
            ok: true,
            text: `Removed alert rule "${sub.name}".`,
          });
          setFetchKey((k) => k + 1);
        } else {
          setNotice({
            ok: false,
            text:
              res.deleteRegionalAlertSubscription.error ||
              "Could not delete rule.",
          });
        }
      },
    });
  };

  const handleTest = (sub: (typeof subscriptions)[number]) => {
    if (testing) return;
    setTestingUuid(sub.uuid);
    setNotice(null);
    commitTest({
      variables: { subscriptionUuid: sub.uuid, tenantId },
      onCompleted: (res) => {
        setTestingUuid(null);
        const out = res.sendTestRegionalAlert;
        if (out.ok) {
          setNotice({
            ok: true,
            text: `Sent test alert for "${sub.name}" via ${out.channels.join(" & ")}.`,
          });
          setFetchKey((k) => k + 1);
        } else {
          setNotice({
            ok: false,
            text: out.error || "Test alert delivery failed.",
          });
        }
      },
      onError: () => {
        setTestingUuid(null);
        setNotice({ ok: false, text: "Could not send test alert." });
      },
    });
  };

  const addStateChip = (code: string) => {
    const existing = parseCsvTokens(statesText).map((s) => s.toUpperCase());
    if (!existing.includes(code)) {
      setStatesText([...existing, code].join(", "));
    }
  };

  return (
    <section
      aria-label="Regional Manager Alert Subscriptions"
      className="spark-card p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BellRing size={15} strokeWidth={1.9} style={TEXT} />
            <h2
              className="display font-semibold text-base"
              style={{ ...TEXT, letterSpacing: "-0.02em" }}
            >
              Regional Manager Alerts
            </h2>
            {subscriptions.length > 0 ? (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold tab-num"
                style={{
                  background: "var(--spark-surface-2)",
                  ...BORDER,
                  ...META,
                }}
              >
                {subscriptions.filter((s) => s.isActive).length} active
              </span>
            ) : null}
          </div>
          <p className="text-xs max-w-2xl" style={META}>
            Get an instant email or signed HTTPS webhook whenever a shelf audit in
            your states or retail chains logs an out-of-stock, MSRP price drift, or
            missing price tag.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition hover:opacity-90"
          style={{
            background: "var(--spark-lime)",
            color: "var(--spark-on-accent)",
          }}
        >
          <Plus size={13.5} strokeWidth={2.2} />
          New regional alert
        </button>
      </div>

      {notice ? (
        <div
          className="rounded-xl px-3.5 py-2 text-xs font-medium"
          style={{
            background: notice.ok
              ? "var(--spark-ok-bg)"
              : "rgba(239, 90, 42, 0.12)",
            color: notice.ok
              ? "var(--spark-ok-ink)"
              : "var(--spark-flag-ink, #a8340f)",
            border: notice.ok
              ? "1px solid var(--spark-ok-border)"
              : "1px solid rgba(239, 90, 42, 0.34)",
          }}
        >
          {notice.text}
        </div>
      ) : null}

      {/* Inline Create / Edit Rule Form */}
      {editorOpen ? (
        <form
          onSubmit={handleSave}
          className="rounded-xl p-4 space-y-4"
          style={{ background: "var(--spark-surface-2)", ...BORDER }}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={TEXT}>
              {editingUuid ? "Edit regional alert rule" : "Create regional alert rule"}
            </h3>
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="p-1 rounded-lg cursor-pointer"
              style={{ background: "transparent", border: "none", ...META }}
              aria-label="Close alert editor"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={META}>
                Rule name
              </span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Texas H-E-B Shelf Watch"
                className="w-full rounded-lg px-3 py-1.5 text-xs outline-none"
                style={FIELD}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={META}>
                States (blank = all states)
              </span>
              <input
                type="text"
                value={statesText}
                onChange={(e) => setStatesText(e.target.value)}
                placeholder="TX, OK, LA"
                className="w-full rounded-lg px-3 py-1.5 text-xs outline-none"
                style={FIELD}
              />
              {suggestedStates.length > 0 ? (
                <div className="flex flex-wrap gap-1 pt-1">
                  {suggestedStates.slice(0, 6).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => addStateChip(st)}
                      className="rounded-md px-1.5 py-0.5 text-[10.5px] font-medium cursor-pointer transition hover:opacity-80"
                      style={{
                        background: "var(--spark-surface)",
                        ...BORDER,
                        ...META,
                      }}
                    >
                      + {st}
                    </button>
                  ))}
                </div>
              ) : null}
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={META}>
                Retail chains (blank = all chains)
              </span>
              <input
                type="text"
                value={chainsText}
                onChange={(e) => setChainsText(e.target.value)}
                placeholder="H-E-B, Whole Foods"
                className="w-full rounded-lg px-3 py-1.5 text-xs outline-none"
                style={FIELD}
              />
            </label>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider block" style={META}>
              Trigger conditions
            </span>
            <div className="flex flex-wrap items-center gap-4 text-xs" style={TEXT}>
              <InkSwitch
                checked={alertOos}
                onChange={setAlertOos}
                label="Out-of-stock / not found"
              />
              <InkSwitch
                checked={alertMissingTag}
                onChange={setAlertMissingTag}
                label="Missing shelf price tag"
              />
              <InkSwitch
                checked={alertPriceDrift}
                onChange={setAlertPriceDrift}
                label="MSRP price drift"
              />
            </div>
            {alertPriceDrift ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <label className="block space-y-1">
                  <span className="text-[11px]" style={META}>
                    Target MSRP ($)
                  </span>
                  <input
                    type="text"
                    value={targetMsrp}
                    onChange={(e) => setTargetMsrp(e.target.value)}
                    placeholder="4.99"
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none"
                    style={FIELD}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px]" style={META}>
                    Drift threshold (%)
                  </span>
                  <input
                    type="text"
                    value={driftThresholdPct}
                    onChange={(e) => setDriftThresholdPct(e.target.value)}
                    placeholder="5.0"
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none"
                    style={FIELD}
                  />
                </label>
              </div>
            ) : null}
          </div>

          {/* Delivery Channels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div
              className="rounded-xl p-3 space-y-2"
              style={{ background: "var(--spark-surface)", ...BORDER }}
            >
              <InkSwitch
                checked={notifyEmail}
                onChange={setNotifyEmail}
                className="text-xs font-semibold"
                label={
                  <span className="inline-flex items-center gap-1.5" style={TEXT}>
                    <Mail size={13} />
                    <span>Instant email alert</span>
                  </span>
                }
                ariaLabel="Instant email alert"
              />
              {notifyEmail ? (
                <input
                  type="text"
                  value={recipientEmails}
                  onChange={(e) => setRecipientEmails(e.target.value)}
                  placeholder="south-region@brand.com, broker@agency.com"
                  className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none"
                  style={FIELD}
                />
              ) : null}
            </div>

            <div
              className="rounded-xl p-3 space-y-2"
              style={{ background: "var(--spark-surface)", ...BORDER }}
            >
              <InkSwitch
                checked={notifyWebhook}
                onChange={setNotifyWebhook}
                className="text-xs font-semibold"
                label={
                  <span className="inline-flex items-center gap-1.5" style={TEXT}>
                    <Webhook size={13} />
                    <span>Signed HTTPS webhook (Slack / Zapier / CRM)</span>
                  </span>
                }
                ariaLabel="Signed HTTPS webhook"
              />
              {notifyWebhook ? (
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none"
                  style={FIELD}
                />
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="spark-btn-ghost text-xs px-3 py-1.5 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-xs font-semibold px-3.5 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
              style={{
                background: "var(--spark-lime)",
                color: "var(--spark-on-accent)",
              }}
            >
              {saving ? "Saving…" : editingUuid ? "Update alert rule" : "Save alert rule"}
            </button>
          </div>
        </form>
      ) : null}

      {/* Subscriptions List */}
      {subscriptions.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {subscriptions.map((sub) => (
            <div
              key={sub.uuid}
              className="rounded-xl p-4 space-y-3"
              style={{
                background: "var(--spark-surface-2)",
                ...BORDER,
                opacity: sub.isActive ? 1 : 0.72,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold truncate" style={TEXT}>
                      {sub.name}
                    </h3>
                    <BellToggle
                      active={sub.isActive}
                      onToggle={() => handleToggleActive(sub)}
                      title="Click to pause or resume"
                    />
                  </div>
                  <p className="text-[11.5px] mt-1" style={META}>
                    {sub.states.length > 0
                      ? `States: ${sub.states.join(", ")}`
                      : "All states"}{" "}
                    ·{" "}
                    {sub.chains.length > 0
                      ? `Chains: ${sub.chains.join(", ")}`
                      : "All chains"}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTest(sub)}
                    disabled={testing && testingUuid === sub.uuid}
                    className="spark-btn-ghost text-[11px] px-2 py-1 rounded-lg inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Send a test alert to configured channels"
                  >
                    <Send size={11} />
                    {testing && testingUuid === sub.uuid ? "Sending…" : "Test"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(sub)}
                    className="spark-btn-ghost p-1.5 rounded-lg cursor-pointer"
                    aria-label={`Edit ${sub.name}`}
                    title="Edit rule"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(sub)}
                    disabled={deleting}
                    className="spark-btn-ghost p-1.5 rounded-lg cursor-pointer"
                    aria-label={`Delete ${sub.name}`}
                    title="Delete rule"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Condition + Channel badges */}
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {sub.alertOos ? (
                  <span
                    className="rounded-md px-2 py-0.5 font-medium"
                    style={{ background: "var(--spark-surface)", ...BORDER, ...TEXT }}
                  >
                    Out-of-stock
                  </span>
                ) : null}
                {sub.alertPriceDrift ? (
                  <span
                    className="rounded-md px-2 py-0.5 font-medium"
                    style={{ background: "var(--spark-surface)", ...BORDER, ...TEXT }}
                  >
                    &gt;{sub.driftThresholdPct}% drift
                    {sub.targetMsrp ? ` vs. $${sub.targetMsrp}` : ""}
                  </span>
                ) : null}
                {sub.alertMissingTag ? (
                  <span
                    className="rounded-md px-2 py-0.5 font-medium"
                    style={{ background: "var(--spark-surface)", ...BORDER, ...TEXT }}
                  >
                    Missing tag
                  </span>
                ) : null}
                {sub.notifyEmail ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5"
                    style={{ background: "var(--spark-surface)", ...BORDER, ...SECONDARY }}
                  >
                    <Mail size={10.5} />
                    {sub.recipientEmails || "Email"}
                  </span>
                ) : null}
                {sub.notifyWebhook ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5"
                    style={{ background: "var(--spark-surface)", ...BORDER, ...SECONDARY }}
                  >
                    <Webhook size={10.5} />
                    Signed webhook
                  </span>
                ) : null}
              </div>

              {/* Recent deliveries */}
              {sub.recentDeliveries.length > 0 ? (
                <div
                  className="pt-2 space-y-1"
                  style={{
                    borderTop: "1px solid var(--spark-hairline, var(--spark-border))",
                  }}
                >
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider" style={META}>
                    Recent alerts ({sub.triggerCount} total triggers)
                  </span>
                  {sub.recentDeliveries.slice(0, 3).map((d) => (
                    <div
                      key={d.uuid}
                      className="flex items-center justify-between gap-2 text-[11px]"
                    >
                      <span className="inline-flex items-center gap-1.5 truncate" style={SECONDARY}>
                        <CheckCircle2
                          size={11}
                          style={{
                            color:
                              d.status === "sent"
                                ? "var(--spark-ok-ink)"
                                : "var(--spark-flag-ink, #a8340f)",
                          }}
                        />
                        <span className="truncate">
                          {d.storeName}
                          {d.stateCode ? ` (${d.stateCode})` : ""} · {d.channel}
                        </span>
                      </span>
                      <span className="shrink-0 tab-num" style={META}>
                        {d.status === "sent" ? "Sent" : "Failed"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : !editorOpen ? (
        <div
          className="rounded-xl px-4 py-3 text-xs flex items-center justify-between gap-3 flex-wrap"
          style={{ background: "var(--spark-surface-2)", ...BORDER }}
        >
          <span style={META}>
            No regional alert rules yet. Example: alert your Texas manager immediately
            whenever any H-E-B logs an out-of-stock, &gt;5% MSRP drift, or missing price tag.
          </span>
          <button
            type="button"
            onClick={openCreate}
            className="text-xs font-semibold underline underline-offset-2 cursor-pointer"
            style={{ ...TEXT, background: "transparent", border: "none", padding: 0 }}
          >
            Create your first rule
          </button>
        </div>
      ) : null}
    </section>
  );
};

export default RegionalAlertsCard;
