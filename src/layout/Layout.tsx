import React, { type ReactNode, useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowRightEndOnRectangleIcon,
} from "@heroicons/react/24/solid";
import ThemeToggle from "@shared/ThemeToggle";
import { navigationMenuRoutes } from "@/routes/AppRoutes";
import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";
import { PageTransition } from "./PageTransition";
import useTenantTheme from "@/hooks/useTenantTheme";
import { type TenantColorScheme } from "@utils/tenantThemeConfig";
import { Clipboard, ExternalLink } from "lucide-react";

type NavigationLink = {
  title?: string;
  name?: string;
  path?: string;
  Icon?: React.ElementType;
  links?: NavigationLink[];
};

interface LayoutProps {
  children?: ReactNode;
}

type AvatarUser = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

const isRouteActive = (path?: string, pathname?: string) => {
  if (!path || !pathname) return false;
  return pathname === path || pathname.startsWith(path + "/");
};

const isTreeActive = (item: NavigationLink, pathname: string): boolean => {
  if (item.path && isRouteActive(item.path, pathname)) {
    return true;
  }

  if (item.links) {
    return item.links.some((child) => isTreeActive(child, pathname));
  }

  return false;
};

const getUserInitial = (user: AvatarUser | null | undefined) => {
  if (!user) return "U";

  if (user.firstName) return user.firstName.charAt(0).toUpperCase();
  if (user.lastName) return user.lastName.charAt(0).toUpperCase();
  if (user.email) return user.email.charAt(0).toUpperCase();

  return "U";
};

const UserAvatar = ({
  src,
  user,
  size = "w-10 h-10",
}: {
  src?: string | null;
  user?: AvatarUser | null;
  size?: string;
}) => {
  if (src) {
    return (
      <div className={`avatar ${size}`}>
        <div className="rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
          <img src={src} alt="User Avatar" className="object-cover" />
        </div>
      </div>
    );
  }

  const initial = getUserInitial(user);

  return (
    <div
      className={`${size} rounded-full flex items-center justify-center 
      bg-primary text-primary-content font-semibold uppercase
      ring ring-primary ring-offset-base-100 ring-offset-2`}
    >
      {initial}
    </div>
  );
};

const SidebarItem = ({
  item,
  collapsed,
  pathname,
  level = 0,
}: {
  item: NavigationLink;
  collapsed: boolean;
  pathname: string;
  level?: number;
}) => {
  const hasChildren = !!item.links?.length;

  const sectionActive = isTreeActive(item, pathname);

  const [expanded, setExpanded] = useState(sectionActive);

  useEffect(() => {
    if (sectionActive) setExpanded(true);
  }, [sectionActive]);

  const leftPadding = level === 0 ? "px-4" : level === 1 ? "px-3" : "px-3";

  if (hasChildren && !collapsed) {
    return (
      <div className="text-base-content text-md">
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`w-full flex items-center gap-3 py-2 ${leftPadding}
              rounded-lg transition min-w-0 overflow-hidden
              ${
                sectionActive
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-base-300"
              }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {item.Icon && (
              <item.Icon className="w-5 h-5 text-primary shrink-0" />
            )}
            <span className="truncate whitespace-nowrap block max-w-full">
              {item.title ?? item.name}
            </span>
          </div>

          {expanded ? (
            <ChevronUpIcon className="w-4 h-4 opacity-70 ml-auto shrink-0 transition-transform duration-200" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 opacity-70 ml-auto shrink-0 transition-transform duration-200" />
          )}
        </button>

        {expanded && (
          <ul className="mt-1 ml-3 pl-3 flex flex-col gap-1 border-l border-base-300 min-w-0 overflow-hidden">
            {item.links!.map((child) => (
              <SidebarItem
                key={child.path ?? child.name}
                item={child}
                collapsed={collapsed}
                pathname={pathname}
                level={level + 1}
              />
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <li>
      <Link
        to={item.path ?? "#"}
        className={`flex items-center gap-3 py-2 px-3 rounded-lg transition min-w-0
                    ${
                      sectionActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "hover:bg-base-300"
                    }`}
      >
        {item.Icon && <item.Icon className="w-5 h-5 text-primary shrink-0" />}
        {!collapsed && (
          <span className="truncate whitespace-nowrap">
            {item.title ?? item.name}
          </span>
        )}
      </Link>
    </li>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [colorScheme, setColorScheme] = useState<TenantColorScheme>(
    (localStorage.getItem("@color-scheme") as TenantColorScheme) || "dark",
  );

  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuthStore();
  const { tenantMeta } = useAuthStore();
  const { tenantId } = useAuthStore();
  const { showAlert } = useAlertStore();
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const avatarSrc = user?.image || null;
  const location = useLocation();
  const pathname = location.pathname;

  const publicFormUrl = useMemo(() => {
    const requestUrlName = tenantMeta?.requestUrlName?.trim();
    if (!requestUrlName) return null;

    return `${window.location.origin}/spark-form/${requestUrlName}`;
  }, [tenantMeta?.requestUrlName]);

  const copyPublicFormUrl = async () => {
    if (!publicFormUrl) return;

    try {
      await navigator.clipboard.writeText(publicFormUrl);
      showAlert("Link copied to clipboard", "success");
    } catch {
      showAlert("Error al copiar el link", "error");
    }
  };

  const openPublicFormUrl = () => {
    if (!publicFormUrl) return;
    window.open(publicFormUrl, "_blank", "noopener,noreferrer");
  };

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  useTenantTheme({
    tenantId,
    colorScheme,
    enabled: Boolean(tenantId),
  });

  useEffect(() => {
    const saved = localStorage.getItem(
      "@color-scheme",
    ) as TenantColorScheme | null;

    if (saved) setColorScheme(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("@color-scheme", colorScheme);
  }, [colorScheme]);

  const menuItems = navigationMenuRoutes.filter(
    (r) => r.title || r.path,
  ) as NavigationLink[];

  return (
    <div className="flex h-screen bg-base-200 text-base-content">
      <aside className="bg-base-100 border-r border-base-300 flex flex-col h-screen min-h-0 overflow-hidden">
        {/* HEADER */}
        <div className="relative flex items-center justify-center p-4 border-b border-base-300">
          {!collapsed &&
            (tenantMeta?.logo ? (
              <img
                src={tenantMeta.logo}
                alt={tenantMeta.requestUrlName ?? "Tenant logo"}
                className="h-8 w-auto app-logo object-contain"
              />
            ) : (
              <img
                src="/logo.svg"
                alt="Default logo"
                className="h-8 w-auto app-logo"
              />
            ))}
          <button
            className={`btn btn-ghost btn-sm text-primary ${
              collapsed ? "" : "absolute right-4"
            }`}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRightIcon className="w-6 h-6" />
            ) : (
              <ChevronLeftIcon className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* MENU */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <ul className="menu text-base p-3 space-y-1 w-full max-w-none">
            {menuItems.map((item) => (
              <SidebarItem
                key={item.path ?? item.title}
                item={item}
                collapsed={collapsed}
                pathname={pathname}
              />
            ))}
          </ul>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-base-300 flex items-center gap-3">
          <UserAvatar src={avatarSrc} user={user} />

          {!collapsed && (
            <>
              <div>
                <p className="font-semibold text-sm">
                  {user?.firstName ?? "User"}
                </p>
                <p className="text-xs opacity-60">Team</p>
              </div>
              <ThemeToggle value={colorScheme} onChange={setColorScheme} />
            </>
          )}
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex justify-between items-center bg-base-100 border-b border-base-300 h-16 px-6 sticky top-0 z-30 text-base-content">
          {/* LEFT: path + requestUrl */}
          <div className="flex items-center gap-2 text-sm font-medium text-base-content/70">
            {publicFormUrl && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-base-200 border border-base-300 text-sm">
                {/* LABEL */}
                <span className="text-base-content/60">
                  Public Form Link For External Requestors
                </span>

                {/* VALUE */}
                <span className="font-medium text-primary truncate max-w-[180px]">
                  {tenantMeta?.requestUrlName}
                </span>

                {/* ACTIONS */}
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={copyPublicFormUrl}
                    className="btn btn-xs btn-ghost text-primary"
                    title="Copiar link del formulario"
                  >
                    <Clipboard className="w-4 h-4" />
                  </button>

                  <button
                    onClick={openPublicFormUrl}
                    className="btn btn-xs btn-ghost text-primary"
                    title="Abrir formulario"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: user + logout */}
          <div className="flex items-center gap-4">
            <UserAvatar src={avatarSrc} user={user} />

            <button
              onClick={onLogout}
              className="btn btn-ghost btn-sm text-base-content hover:text-error flex items-center gap-1"
            >
              <ArrowRightEndOnRectangleIcon className="w-5 h-5" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 bg-base-200 overflow-y-auto">
          <PageTransition>
            <div className="p-6 min-h-full">
              {children || <h1 className="text-lg font-semibold">Dashboard</h1>}
            </div>
          </PageTransition>
        </main>
      </div>
    </div>
  );
};

export default Layout;
