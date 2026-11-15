/**
 * Deep links must land in the record's own client.
 *
 * The selected tenant lives in the auth store (+ localStorage `@tenantUuid`
 * / `@tenantId`) and nothing in a record URL (`/recap/view-custom/:uuid`,
 * `/request/view/:uuid`, …) says which client the record belongs to. A staff
 * user who last worked in Liquid Death and clicks a Breakaway
 * "Recap submitted" email got the Breakaway recap inside Liquid Death's
 * switcher, public-link pill and sidebar counts.
 *
 * These helpers are the whole decision, kept pure so it is unit-testable:
 * the caller may only ever move to a tenant that is already in the user's
 * own switcher list (`tenants(userUuid:)`). A URL or a record can never put
 * someone into a client they cannot switch to themselves.
 */

/** A tenant the signed-in user can already switch to (a TenantPicker row). */
export type SwitchableTenant = {
  /** Relay global id — what the auth store keeps as `tenantId`. */
  id: string;
  uuid: string;
  name?: string | null;
  logo?: string | null;
  requestUrlName?: string | null;
  tenantSlug?: string | null;
  checkinCode?: string | null;
};

/** How a loaded record points at its tenant. Either key is enough. */
export type RecordTenantRef = {
  id?: string | null;
  uuid?: string | null;
};

export type SelectedTenant = {
  tenantId?: string | null;
  tenantUuid?: string | null;
};

const norm = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v).trim().toLowerCase();

const sameKey = (a: unknown, b: unknown): boolean => {
  const x = norm(a);
  return x !== "" && x === norm(b);
};

/** True when the record's tenant is the one already selected. */
export function isSelectedTenant(
  record: RecordTenantRef | null | undefined,
  selected: SelectedTenant,
): boolean {
  if (!record) return false;
  // Global ids are case-sensitive base64 — compare those exactly.
  if (record.id && selected.tenantId && record.id === selected.tenantId) {
    return true;
  }
  return sameKey(record.uuid, selected.tenantUuid);
}

/** The switcher row for a record's tenant, or null when the user has none. */
export function findSwitchableTenant(
  record: RecordTenantRef | null | undefined,
  tenants: readonly SwitchableTenant[],
): SwitchableTenant | null {
  if (!record || (!record.id && !record.uuid)) return null;
  return (
    tenants.find(
      (t) =>
        (Boolean(record.id) && t.id === record.id) ||
        sameKey(record.uuid, t.uuid),
    ) ?? null
  );
}

/**
 * Which tenant to switch to so the app chrome matches the record on screen.
 *
 *   - record has no tenant, or it is already the selected one → null
 *   - different, and in the user's switcher list            → that tenant
 *   - different, and NOT in the user's list                 → null
 */
export function decideTenantSwitch(args: {
  selected: SelectedTenant;
  record: RecordTenantRef | null | undefined;
  tenants: readonly SwitchableTenant[];
}): SwitchableTenant | null {
  const { selected, record, tenants } = args;
  if (!record || (!record.id && !record.uuid)) return null;
  if (isSelectedTenant(record, selected)) return null;
  const target = findSwitchableTenant(record, tenants);
  if (!target) return null;
  // The list row is the source of truth for what gets selected; never the
  // raw value that came off the record or the URL.
  if (isSelectedTenant({ id: target.id, uuid: target.uuid }, selected)) {
    return null;
  }
  return target;
}

/** Query-string key list links carry: `/recaps/list?tenant=<uuid>`. */
export const TENANT_LINK_PARAM = "tenant";

/**
 * Resolve a `?tenant=` value (tenant uuid, or its slug) against the user's
 * switcher list. Anything that is not in the list resolves to null — the
 * param is then dropped and the current tenant stays.
 */
export function resolveTenantParam(
  param: string | null | undefined,
  tenants: readonly SwitchableTenant[],
): SwitchableTenant | null {
  const key = norm(param);
  if (!key) return null;
  return (
    tenants.find((t) => norm(t.uuid) === key) ??
    tenants.find((t) => norm(t.tenantSlug) === key) ??
    null
  );
}

/** Tenant to switch to for a `?tenant=` link, or null to stay put. */
export function decideTenantParamSwitch(args: {
  selected: SelectedTenant;
  param: string | null | undefined;
  tenants: readonly SwitchableTenant[];
}): SwitchableTenant | null {
  const target = resolveTenantParam(args.param, args.tenants);
  if (!target) return null;
  if (isSelectedTenant({ id: target.id, uuid: target.uuid }, args.selected)) {
    return null;
  }
  return target;
}

/** `search` with the tenant param removed (other params untouched). */
export function stripTenantParam(search: string): string {
  const params = new URLSearchParams(search);
  if (!params.has(TENANT_LINK_PARAM)) return search;
  params.delete(TENANT_LINK_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}
