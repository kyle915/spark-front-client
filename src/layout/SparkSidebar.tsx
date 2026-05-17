import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import { navigationMenuRoutes } from "@/routes/AppRoutes";
import { useAuthStore } from "@/store/authStore";

/**
 * Spark v2 sidebar — wireframe-faithful version of spark-demo/index.html
 * (lines 409–466). Narrow rail, brand mark, grouped nav sections with mono
 * labels and lime-on-active styling.
 *
 * Data source is the existing `navigationMenuRoutes` so every route the app
 * already has continues to work — only the rendering changed.
 */

type NavLeaf = {
  path?: string;
  name?: string;
  title?: string;
  Icon?: React.ElementType;
};

type NavGroup = {
  title?: string;
  name?: string;
  path?: string;
  Icon?: React.ElementType;
  links?: NavLeaf[];
};

const isActive = (path: string | undefined, pathname: string) => {
  if (!path) return false;
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(path + "/");
};

const NavLeafItem: React.FC<{
  leaf: NavLeaf;
  pathname: string;
  indent?: boolean;
}> = ({ leaf, pathname, indent }) => {
  const active = isActive(leaf.path, pathname);
  return (
    <Link
      to={leaf.path ?? "#"}
      className={[
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition",
        indent ? "ml-2" : "",
        active
          ? "bg-primary/10 text-primary border-l-2 border-primary -ml-[2px] pl-[10px]"
          : "text-base-content/75 hover:text-base-content hover:bg-base-300/40",
      ].join(" ")}
    >
      {leaf.Icon && (
        <leaf.Icon
          className={`w-4 h-4 shrink-0 ${active ? "text-primary" : "text-base-content/50"}`}
        />
      )}
      <span className="truncate">{leaf.name ?? leaf.title}</span>
    </Link>
  );
};

const NavGroupBlock: React.FC<{
  group: NavGroup;
  pathname: string;
}> = ({ group, pathname }) => {
  // Solo-link group (no submenu) — render as section + single leaf.
  if (group.path && !group.links?.length) {
    return (
      <div className="mb-2">
        <NavLeafItem leaf={group} pathname={pathname} />
      </div>
    );
  }

  // Section header + nested leaves (collapsible).
  const childActive =
    group.links?.some((l) => isActive(l.path, pathname)) ?? false;
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] tracking-[0.18em] uppercase text-base-content/45 hover:text-base-content/80 transition mono"
      >
        <span className="flex-1 text-left">{group.title ?? group.name}</span>
        {open ? (
          <ChevronUpIcon className="w-3 h-3" />
        ) : (
          <ChevronDownIcon className="w-3 h-3" />
        )}
      </button>
      {open && (
        <ul className="space-y-0.5 mt-1">
          {group.links?.map((leaf) => (
            <li key={leaf.path ?? leaf.name}>
              <NavLeafItem leaf={leaf} pathname={pathname} indent />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const SparkSidebar: React.FC = () => {
  const { user, tenantMeta } = useAuthStore();
  const location = useLocation();
  const pathname = location.pathname;
  const initial = (user?.firstName ?? user?.email ?? "U").charAt(0).toUpperCase();
  const groups = (navigationMenuRoutes ?? []) as NavGroup[];

  return (
    <aside className="w-64 shrink-0 border-r border-base-300 bg-base-100/80 backdrop-blur-xl flex flex-col h-screen min-h-0">
      {/* Brand mark */}
      <div className="p-5 border-b border-base-300">
        <div className="spark-mark text-2xl">
          <span className="word">Spark</span>
          <span className="tag">BY IGNITE</span>
        </div>
      </div>

      {/* Tenant chip */}
      <div className="p-3 border-b border-base-300">
        <div className="label-mini mb-1.5">Tenant</div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-base-300/40 border border-base-300">
          {tenantMeta?.logo ? (
            <img
              src={tenantMeta.logo}
              alt=""
              className="w-5 h-5 object-contain rounded-sm"
            />
          ) : (
            <span className="w-5 h-5 rounded-sm bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
              {(tenantMeta?.requestUrlName ?? "—").slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="text-sm truncate flex-1">
            {tenantMeta?.requestUrlName ?? "—"}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 hide-scroll">
        {groups.map((g) => (
          <NavGroupBlock
            key={g.path ?? g.title ?? g.name}
            group={g}
            pathname={pathname}
          />
        ))}
      </nav>

      {/* Footer: avatar + user */}
      <div className="p-3 border-t border-base-300 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary text-primary-content text-xs font-bold flex items-center justify-center shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {user?.firstName ?? user?.email ?? "User"}
          </p>
          <p className="mono text-[10px] text-base-content/40 truncate">
            IGNITE PRODUCTIONS
          </p>
        </div>
      </div>
    </aside>
  );
};

export default SparkSidebar;
