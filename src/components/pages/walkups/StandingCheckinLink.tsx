import { Fragment } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { TenantCheckinCodeQuery } from "@/api/queries/TenantCheckinCodeQuery";
import type { TenantCheckinCodeQuery as TenantCheckinCodeQueryType } from "@api/queries/__generated__/TenantCheckinCodeQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { checkinUrl } from "@/utils/publicHosts";
import CheckinQr from "./CheckinQr";

/**
 * The tenant's STANDING check-in link, pinned at the top of Walk-ups.
 *
 * One durable URL for the whole season — the field team saves it once and
 * uses it at every activation. The BA opens it on their phone, gives their
 * name + cell, says which store and what day, clocks in, and files the
 * recap. Spark creates or joins the event from those answers, so there is no
 * event code to distribute and nothing for ops to set up per activation.
 *
 * The review queue for what comes in through these links is the Walk-ups tab.
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
  const active =
    nodes.find(
      (n) =>
        String(n.id) === String(tenantId) ||
        String(n.uuid) === String(tenantId),
    ) ??
    nodes[0] ??
    null;

  const coded = nodes.filter((n) => (n.checkinCode ?? "").trim());
  if (coded.length === 0) return null;

  const activeCode = (active?.checkinCode ?? "").trim();
  const activeUrl = activeCode ? checkinUrl(activeCode) : "";

  const copy = async (url: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      showAlert("Check-in link copied.", "success");
    } catch {
      showAlert("Couldn't copy — select the link and copy it.", "error");
    }
  };

  return (
    <div className="mb-5 space-y-3">
      {activeCode ? (
        <div className="spark-card p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p
                className="mono text-[10px] mb-1"
                style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
              >
                SHARE WITH YOUR BAs
              </p>
              <p className="text-sm font-semibold mb-1">
                {active?.name ? `${active.name} check-in link` : "Check-in link"}
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                One link, every event. BAs clock in, add their store and date, and
                file the recap from their phone — no event code, no app install.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  void copy(activeUrl);
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                style={{ background: "var(--spark-lime)", color: "#0a0d09" }}
              >
                Copy link
              </button>
              <a
                href={activeUrl}
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
          <div
            className="mt-3 pt-3"
            style={{ borderTop: "1px solid var(--spark-border)" }}
          >
            <CheckinQr url={activeUrl} downloadName={`${activeCode}-checkin-qr.png`} />
            <p
              className="mono text-xs mt-3 break-all"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {activeUrl}
            </p>
          </div>
        </div>
      ) : null}

      <div className="spark-card p-4">
        <p
          className="mono text-[10px] mb-3"
          style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}
        >
          STANDING CODES
        </p>
        <ul className="flex flex-col gap-2">
          {coded.map((tenant) => {
            const code = (tenant.checkinCode ?? "").trim();
            const url = checkinUrl(code);
            const isActive =
              String(tenant.id) === String(active?.id) ||
              String(tenant.uuid) === String(active?.uuid);
            const programs = tenant.checkinEventTypeNames ?? [];
            const buckets = tenant.checkinPhotoBuckets ?? [];
            const teamCode = (tenant.checkinTeamCode ?? "").trim();
            const teamUrl = teamCode ? checkinUrl(teamCode) : "";
            return (
              <Fragment key={tenant.id}>
              <li
                className="rounded-xl p-3"
                style={{
                  border: isActive
                    ? "1px solid rgba(242,243,238,0.55)"
                    : "1px solid var(--spark-border)",
                  background: isActive ? "rgba(242,243,238,0.06)" : "transparent",
                }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {tenant.name}
                      {isActive ? (
                        <span
                          className="mono text-[10px] ml-2"
                          style={{ color: "var(--spark-lime)", letterSpacing: "0.12em" }}
                        >
                          ACTIVE
                        </span>
                      ) : null}
                    </p>
                    <p className="mono text-xs mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>
                      {code}
                    </p>
                    <p className="text-xs mt-1 break-all" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {url}
                    </p>
                    <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.62)" }}>
                      {programs.length ? programs.join(" · ") : "No programs listed"}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {buckets.length ? buckets.join(" · ") : "No photo buckets"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void copy(url);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-semibold shrink-0"
                    style={{
                      background: "transparent",
                      color: "var(--spark-text)",
                      border: "1px solid var(--spark-border)",
                    }}
                  >
                    Copy
                  </button>
                </div>
              </li>
              {teamCode ? (
                <li
                  className="rounded-xl p-3"
                  style={{ border: "1px solid var(--spark-border)" }}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {tenant.checkinTeamTitle?.trim() ||
                          `${tenant.name} · Client team recaps (no clock)`}
                      </p>
                      <p className="mono text-xs mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>
                        {teamCode}
                      </p>
                      <p className="text-xs mt-1 break-all" style={{ color: "rgba(255,255,255,0.5)" }}>
                        {teamUrl}
                      </p>
                      <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.62)" }}>
                        Name, event type, recap — no clock. Counts in totals.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void copy(teamUrl);
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-semibold shrink-0"
                      style={{
                        background: "transparent",
                        color: "var(--spark-text)",
                        border: "1px solid var(--spark-border)",
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </li>
              ) : null}
              </Fragment>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default StandingCheckinLink;
