import React, { useEffect, useRef, useState } from "react";
import { useLazyLoadQuery } from "react-relay/hooks";
import { useNavigate } from "react-router";
import { ChevronDownIcon } from "@heroicons/react/24/solid";
import { TenantQuery } from "@/api/queries/TenantQuery";
import type { TenantQuery as TenantQueryType } from "@/api/queries/__generated__/TenantQuery.graphql";
import { useAuthStore } from "@/store/authStore";
import { useTenantSelection } from "@/hooks/useTenantSelection";

/**
 * Inline tenant switcher for the Spark v2 sidebar.
 * Renders the current tenant as a button; clicking opens a dropdown of all
 * tenants the user has access to. Switching reloads the page so all Relay
 * queries refetch under the new tenant context.
 */

type TenantNode = {
  id: string;
  uuid: string;
  name: string | null;
  requestUrlName?: string | null;
  tenantSlug?: string | null;
  image?: string | null;
};

export const TenantPicker: React.FC = () => {
  const { user, tenantUuid } = useAuthStore();
  const { selectTenant } = useTenantSelection();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const data = useLazyLoadQuery<TenantQueryType>(
    TenantQuery,
    { userUuid: user?.uuid ?? "" },
    { fetchPolicy: "store-or-network" },
  );

  const tenants: TenantNode[] =
    data?.tenants?.edges
      ?.map((e) => e?.node)
      ?.filter((n): n is NonNullable<typeof n> => Boolean(n))
      ?.map((n) => ({
        id: n.id,
        uuid: String(n.uuid),
        name: n.name ?? null,
        requestUrlName: n.requestUrlName ?? null,
        tenantSlug: n.tenantSlug ?? null,
        image: n.image ?? null,
      })) ?? [];

  const current = tenants.find((t) => t.uuid === tenantUuid) ?? tenants[0];
  const initials = (current?.name ?? "—").slice(0, 2).toUpperCase();

  const onPick = (t: TenantNode) => {
    selectTenant({
      tenantUuid: t.uuid,
      tenantId: t.id,
      logo: t.image,
      requestUrlName: t.requestUrlName,
      tenantSlug: t.tenantSlug,
    });
    setOpen(false);
    // Hard reload "/" so every Relay query refetches under the new tenant
    navigate("/", { replace: true });
    setTimeout(() => window.location.reload(), 50);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-base-300/40 border border-base-300 hover:border-primary/40 transition"
      >
        {current?.image ? (
          <img
            src={current.image}
            alt=""
            className="w-5 h-5 object-contain rounded-sm shrink-0"
          />
        ) : (
          <span className="w-5 h-5 rounded-sm bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
            {initials}
          </span>
        )}
        <span className="text-sm truncate flex-1 text-left">
          {current?.name ?? "Select tenant"}
        </span>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 shrink-0 text-base-content/55 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-base-300 bg-base-100 shadow-lg max-h-80 overflow-y-auto p-1 hide-scroll">
          {tenants.length === 0 && (
            <div className="px-3 py-2 text-xs text-base-content/55">
              No tenants
            </div>
          )}
          {tenants.map((t) => {
            const active = t.uuid === tenantUuid;
            return (
              <button
                key={t.uuid}
                onClick={() => onPick(t)}
                className={[
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition text-left",
                  active
                    ? "bg-primary/15 text-primary font-semibold"
                    : "hover:bg-base-300/40 text-base-content/80",
                ].join(" ")}
              >
                {t.image ? (
                  <img
                    src={t.image}
                    alt=""
                    className="w-5 h-5 object-contain rounded-sm shrink-0"
                  />
                ) : (
                  <span
                    className={[
                      "w-5 h-5 rounded-sm text-[10px] font-bold flex items-center justify-center shrink-0",
                      active
                        ? "bg-primary/30 text-primary"
                        : "bg-base-300 text-base-content/55",
                    ].join(" ")}
                  >
                    {(t.name ?? "—").slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="truncate flex-1">{t.name ?? "—"}</span>
                {active && (
                  <span className="mono text-[9px] tracking-[0.16em] text-primary">
                    ACTIVE
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TenantPicker;
