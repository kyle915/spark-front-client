import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantCheckinCodeQuery } from "@/api/queries/TenantCheckinCodeQuery";
import type { TenantCheckinCodeQuery as TenantCheckinCodeQueryType } from "@api/queries/__generated__/TenantCheckinCodeQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { checkinUrl } from "@/utils/publicHosts";

/**
 * The tenant's STANDING check-in link, pinned at the top of Walk-ups.
 *
 * One durable URL for the whole season — the field team saves it once and
 * uses it at every activation. The BA opens it on their phone, gives their
 * name + cell, says which store and what day, clocks in, and files the
 * recap. Spark creates or joins the event from those answers, so there is no
 * event code to distribute and nothing for ops to set up per activation.
 *
 * Whatever comes in through it lands in the queue directly below, which is
 * why this belongs here rather than on a settings page: the link and the
 * review of what it produced are one workflow.
 *
 * Renders NOTHING when the tenant has no code. Codes are minted by the
 * backend setup command, so most tenants see no banner at all and the page
 * looks exactly as it did before.
 */
const StandingCheckinLink: React.FC = () => {
  const { tenantId, user } = useAuthStore();
  const showAlert = useAlertStore((s) => s.showAlert);

  const data = useLazyLoadQuery<TenantCheckinCodeQueryType>(
    TenantCheckinCodeQuery,
    { userUuid: user?.uuid ?? null },
    { fetchPolicy: "store-or-network" },
  );

  // Pick the active tenant out of the viewer's tenants. Same matching as
  // useLinkedSheetUrl: tenantId is usually the Relay id, but the auth store
  // sometimes holds the uuid form.
  const nodes = (data?.tenants?.edges ?? [])
    .map((e) => e?.node)
    .filter((n): n is NonNullable<typeof n> => Boolean(n));
  const node =
    nodes.find(
      (n) =>
        String(n.id) === String(tenantId) ||
        String(n.uuid) === String(tenantId),
    ) ??
    nodes[0] ??
    null;

  const code = (node?.checkinCode ?? "").trim();
  if (!code) return null;

  // Always client.igniteproductions.co in prod — never the tab origin.
  // Walk-ups opened on leftover spark. tabs used to text BAs a spark. URL.
  const url = checkinUrl(code);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      showAlert("Check-in link copied.", "success");
    } catch {
      // Clipboard is blocked without a secure context or user gesture in
      // some browsers. The URL is on screen and selectable, so say that
      // instead of failing silently.
      showAlert("Couldn't copy — select the link and copy it.", "error");
    }
  };

  return (
    <div className="spark-card p-4 mb-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p
            className="mono text-[10px] mb-1"
            style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
          >
            SHARE WITH YOUR BAs
          </p>
          <p className="text-sm font-semibold mb-1">
            {node?.name ? `${node.name} check-in link` : "Check-in link"}
          </p>
          <p
            className="text-xs"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            One link, every event. BAs clock in, add their store and date, and
            file the recap from their phone — no event code, no app install.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={copy}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition"
            style={{ background: "var(--spark-lime)", color: "#0a0d09" }}
          >
            Copy link
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl text-sm font-semibold transition"
            style={{
              background: "transparent",
              color: "var(--spark-text)",
              border: "1px solid var(--spark-border)",
            }}
          >
            Preview
          </a>
        </div>
      </div>

      {/* The URL itself, selectable for anyone who'd rather copy by hand.
          break-all so a long code can't push the card wide on mobile. */}
      <p
        className="mono text-xs mt-3 pt-3 break-all"
        style={{
          borderTop: "1px solid var(--spark-border)",
          color: "rgba(255,255,255,0.7)",
        }}
      >
        {url}
      </p>
    </div>
  );
};

export default StandingCheckinLink;
