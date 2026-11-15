import { useEffect, useRef } from "react";
import { useRelayEnvironment } from "react-relay/hooks";
import { fetchQuery, type Environment } from "relay-runtime";
import { TenantQuery } from "@/api/queries/TenantQuery";
import type { TenantQuery as TenantQueryType } from "@/api/queries/__generated__/TenantQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { rememberTenantRecent } from "@/layout/tenantPickerPrefs";
import {
  decideTenantSwitch,
  isSelectedTenant,
  type RecordTenantRef,
  type SwitchableTenant,
} from "@/lib/tenantDeepLink";

/**
 * The tenants the signed-in user can switch to — the same query (and the
 * same variables) the sidebar TenantPicker runs, so this is normally served
 * from the Relay store without a request. The server scopes the list: a
 * brand user gets only their own tenant.
 */
export async function fetchSwitchableTenants(
  environment: Environment,
  userUuid: string | null | undefined,
): Promise<SwitchableTenant[]> {
  const data = await fetchQuery<TenantQueryType>(
    environment,
    TenantQuery,
    { userUuid: userUuid ?? "" },
    { fetchPolicy: "store-or-network" },
  ).toPromise();
  return (data?.tenants?.edges ?? [])
    .map((edge) => edge?.node)
    .filter((n): n is NonNullable<typeof n> => Boolean(n))
    .map((n) => ({
      id: n.id,
      uuid: String(n.uuid),
      name: n.name ?? null,
      logo: n.image ?? null,
      requestUrlName: n.requestUrlName ?? null,
      tenantSlug: n.tenantSlug ?? null,
      checkinCode: n.checkinCode ?? null,
    }));
}

/** Select a tenant from the user's own switcher list, in place (no reload). */
export function applyTenantSwitch(target: SwitchableTenant): void {
  rememberTenantRecent(target.uuid);
  useAuthStore
    .getState()
    .setTenant(
      target.uuid,
      target.id,
      target.logo,
      target.requestUrlName,
      target.tenantSlug,
      target.checkinCode,
    );
}

/**
 * Detail pages call this with the tenant of the record they loaded.
 *
 * A record URL carries no client, so a link from an email (or a Jump recent,
 * a notification, a pasted URL) can open a Breakaway recap while the app is
 * still switched to Liquid Death — right page, wrong switcher, public link
 * and sidebar counts. When the record's tenant differs from the selected one
 * AND it is in the user's own switcher list, select it so the chrome matches
 * the page.
 *
 * In place, not a reload: the sidebar, topbar and counts all read the auth
 * store reactively. One attempt per record tenant, so it cannot loop and it
 * never fights a user who switches away on purpose.
 */
export function useAdoptRecordTenant(
  record: RecordTenantRef | null | undefined,
  /** Noun for the toast: "recap", "request", "event". */
  label = "page",
): void {
  const environment = useRelayEnvironment();
  const userUuid = useAuthStore((s) => s.user?.uuid ?? null);
  const tenantId = useAuthStore((s) => s.tenantId);
  const tenantUuid = useAuthStore((s) => s.tenantUuid);
  const recordId = record?.id ?? null;
  const recordUuid = record?.uuid ?? null;

  const attempted = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!recordId && !recordUuid) return;
    const ref: RecordTenantRef = { id: recordId, uuid: recordUuid };
    if (isSelectedTenant(ref, { tenantId, tenantUuid })) return;
    const key = `${recordId ?? ""}|${recordUuid ?? ""}`;
    if (attempted.current === key) return;
    attempted.current = key;

    fetchSwitchableTenants(environment, userUuid)
      .then((tenants) => {
        if (!mounted.current) return;
        // Re-read the store: the selection may have changed while the
        // tenant list was loading.
        const now = useAuthStore.getState();
        const target = decideTenantSwitch({
          selected: { tenantId: now.tenantId, tenantUuid: now.tenantUuid },
          record: ref,
          tenants,
        });
        if (!target) return;
        applyTenantSwitch(target);
        useAlertStore
          .getState()
          .showAlert(
            `Switched to ${target.name || "this client"} — this ${label} belongs to that client.`,
            "info",
          );
      })
      .catch(() => {
        // Couldn't load the switcher list — leave the selection alone.
      });
  }, [recordId, recordUuid, tenantId, tenantUuid, userUuid, environment, label]);
}

export default useAdoptRecordTenant;
