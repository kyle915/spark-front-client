/**
 * AI connector — how a brand connects Claude or ChatGPT to Spark through the
 * official Spark MCP connection, and the list of AI apps connected so far
 * (with Disconnect). Ignite admins see everyone's connections here; the
 * server decides that (myAiConnections.isAdminView).
 *
 * The Terms allow automated access only through this connection, so this
 * page is also where "how do I get our data into ChatGPT?" should land.
 */

import { Suspense, useState } from "react";
import { Link } from "react-router";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";

import Layout from "@/layout/Layout";
import { MyAiConnectionsQuery } from "@/api/queries/MyAiConnectionsQuery";
import type { MyAiConnectionsQuery as MyAiConnectionsQueryType } from "@api/queries/__generated__/MyAiConnectionsQuery.graphql";
import { RevokeAiConnectionMutation } from "@/api/mutations/RevokeAiConnectionMutation";
import type { RevokeAiConnectionMutation as RevokeAiConnectionMutationType } from "@api/mutations/__generated__/RevokeAiConnectionMutation.graphql";
import { useAlertStore } from "@/store/alertStore";

const meta = { color: "var(--spark-text-meta)" } as const;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const TOOLS: { name: string; text: string }[] = [
  { name: "Program results", text: "Events, recaps, consumers sampled, samples, products sold and audience figures for any period up to a year, compared with the period before." },
  { name: "Recaps", text: "Approved recaps with date, store, state and consumers sampled, each with a link back to Spark." },
  { name: "Consumer breakdowns", text: "Consumers sampled by store, state or week, and units sold and sampled by product." },
  { name: "Upcoming events", text: "The next 1–30 days of events and requests, with how many brand ambassadors are booked." },
  { name: "Pending approvals", text: "Requests and recaps waiting on you, with links. Approving still happens in Spark." },
  { name: "Weekly summary", text: "The latest published weekly summary, or one for a given week." },
];

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code
        className="flex-1 min-w-0 truncate text-sm px-3 py-2 rounded-lg border"
        style={{ borderColor: "var(--spark-border)" }}
      >
        {value}
      </code>
      <button
        type="button"
        className="px-3 py-2 rounded-lg text-sm font-semibold border"
        style={{ borderColor: "var(--spark-border)" }}
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Connections() {
  const showAlert = useAlertStore((s) => s.showAlert);
  const [fetchKey, setFetchKey] = useState(0);
  const data = useLazyLoadQuery<MyAiConnectionsQueryType>(
    MyAiConnectionsQuery,
    {},
    { fetchPolicy: "network-only", fetchKey },
  );
  const [revoke, revoking] = useMutation<RevokeAiConnectionMutationType>(RevokeAiConnectionMutation);
  const info = data.myAiConnections;

  const disconnect = (id: string, appName: string) => {
    if (!window.confirm(`Disconnect ${appName}? It will stop being able to read Spark right away.`)) return;
    revoke({
      variables: { id },
      onCompleted: (res) => {
        const ok = res.revokeAiConnection.ok;
        showAlert(ok ? `${appName} disconnected.` : res.revokeAiConnection.message, ok ? "success" : "error");
        setFetchKey((k) => k + 1);
      },
      onError: (err) => showAlert(`Couldn't disconnect: ${err.message}`, "error"),
    });
  };

  return (
    <>
      <section className="spark-card p-5 space-y-3">
        <h2 className="text-lg font-semibold">Connector URL</h2>
        <p className="text-sm" style={meta}>
          Paste this into Claude or ChatGPT when you add a custom connector.
        </p>
        <CopyField value={info.connectorUrl} />
      </section>

      <section className="spark-card p-5 space-y-3">
        <h2 className="text-lg font-semibold">
          {info.isAdminView ? "All connected AI apps" : "Your connected AI apps"}
        </h2>
        {info.connections.length === 0 ? (
          <p className="text-sm" style={meta}>Nothing connected yet.</p>
        ) : (
          <ul>
            {info.connections.map((c, i) => (
              <li
                key={c.id}
                className="py-3 flex items-center gap-4"
                style={i ? { borderTop: "1px solid var(--spark-hairline)" } : undefined}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {c.appName} · {c.brandName}
                  </p>
                  <p className="text-xs mt-0.5" style={meta}>
                    {c.userEmail ? `${c.userEmail} · ` : ""}
                    Connected {fmtDate(c.createdAt)} · Last used {fmtDate(c.lastUsedAt)} ·{" "}
                    {c.callsLast30Days} calls in the last 30 days
                  </p>
                </div>
                <button
                  type="button"
                  disabled={revoking}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold border"
                  style={{ borderColor: "var(--spark-border)" }}
                  onClick={() => disconnect(String(c.id), c.appName)}
                >
                  Disconnect
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs" style={meta}>
          Each brand can make {info.dailyCallLimit} AI requests a day across all connected apps.
        </p>
      </section>
    </>
  );
}

export default function SparkAiConnector() {
  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="display text-4xl font-bold" style={{ letterSpacing: "-0.04em" }}>
            Connect Claude or ChatGPT
          </h1>
          <p className="mt-2" style={meta}>
            Ask an AI assistant about your program — results, recaps, stores, upcoming events — using
            your own Spark login. It can read your brand's data and nothing else, and it can't change
            anything.
          </p>
        </div>

        <Suspense fallback={<div className="spark-card p-5 text-sm" style={meta}>Loading…</div>}>
          <Connections />
        </Suspense>

        <section className="spark-card p-5 space-y-3">
          <h2 className="text-lg font-semibold">Claude</h2>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            <li>In Claude, open Settings → Connectors → Add custom connector.</li>
            <li>Name it Spark and paste the connector URL. Leave the OAuth fields empty.</li>
            <li>Click Connect. Sign in to Spark, choose your brand and click Allow.</li>
            <li>In a chat, turn on Spark from the tools menu and ask a question.</li>
          </ol>
          <p className="text-xs" style={meta}>
            On Claude Team and Enterprise plans an owner may need to add the connector first.
          </p>
        </section>

        <section className="spark-card p-5 space-y-3">
          <h2 className="text-lg font-semibold">ChatGPT</h2>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            <li>In ChatGPT, open Settings → Apps &amp; Connectors → Advanced and turn on developer mode.</li>
            <li>Create a connector named Spark with the connector URL and OAuth sign-in.</li>
            <li>Sign in to Spark, choose your brand and click Allow.</li>
          </ol>
          <p className="text-xs" style={meta}>
            On ChatGPT Business and Enterprise a workspace admin may need to allow custom connectors.
          </p>
        </section>

        <section className="spark-card p-5 space-y-3">
          <h2 className="text-lg font-semibold">What it can see</h2>
          <ul className="space-y-2 text-sm">
            {TOOLS.map((t) => (
              <li key={t.name}>
                <span className="font-semibold">{t.name}.</span>{" "}
                <span style={meta}>{t.text}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm" style={meta}>
            Approved recaps only, the same numbers as your dashboard. Brand ambassadors' names and
            personal details are never shared. Date ranges are limited to a year and lists to 50
            rows per request.
          </p>
        </section>

        <section className="spark-card p-5 space-y-2">
          <h2 className="text-lg font-semibold">Rules</h2>
          <p className="text-sm" style={meta}>
            This connection is the only approved way to give an AI app, script or bot access to
            Spark. Copying your login token into other tools isn't allowed and may get access
            suspended. See the{" "}
            <Link to="/terms-of-service#automated-access" className="link link-primary">
              Terms of Service, section 7.1
            </Link>
            .
          </p>
        </section>
      </div>
    </Layout>
  );
}
