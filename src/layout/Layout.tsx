import React, { type ReactNode, useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router"; // ✅ usas react-router, no react-router-dom
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowRightEndOnRectangleIcon,
} from "@heroicons/react/24/solid";
import ThemeToggle from "@shared/ThemeToggle";
import { createPortal } from "react-dom";
import { navigationMenuRoutes } from "@/routes/AppRoutes";
import { useAuthStore } from "@/store/authStore";
import { PageTransition } from "./PageTransition";

interface LayoutProps {
  children?: ReactNode;
}

const FloatingMenu = ({
  anchorRef,
  children,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
  onClose: () => void;
}) => {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.top + window.scrollY, left: rect.right + 8 });
  }, [anchorRef]);

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      )
        onClose();
    };
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, [onClose, anchorRef]);

  return createPortal(
    <div
      ref={menuRef}
      className="absolute bg-base-100 border border-base-300 shadow-lg rounded-lg z-[9999] w-48 text-base-content"
      style={{ top: pos.top, left: pos.left }}
    >
      <ul className="menu menu-sm p-2">{children}</ul>
    </div>,
    document.body
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { user } = useAuthStore();
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  type NavigationLink = {
    title?: string;
    path?: string;
    Icon?: React.ElementType;
    links?: NavigationLink[];
    name?: string;
  };

  const IconButton = ({
    id,
    icon: Icon,
    label,
    menu,
    path,
  }: {
    id: string;
    icon?: React.ElementType;
    label: string;
    menu?: NavigationLink[];
    path?: string;
  }) => {
    const ref = useRef<HTMLDivElement>(null);
    const open = openId === id;
    const toggle = () => setOpenId(open ? null : id);

    if (!collapsed && menu?.length) {
      return (
        <div className="text-base-content">
          <button
            onClick={toggle}
            className="w-full flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-base-300 transition"
          >
            <div className="flex items-center gap-3">
              {Icon && <Icon className="w-5 h-5 text-primary" />}
              <span>{label}</span>
            </div>
            {open ? (
              <ChevronUpIcon className="w-4 h-4 opacity-60 transition-transform duration-200" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 opacity-60 transition-transform duration-200" />
            )}
          </button>

          {open && (
            <ul className="ml-9 mt-1 flex flex-col gap-1 border-l border-base-300 pl-3">
              {menu.map((sub) => (
                <li key={sub.path ?? sub.name ?? Math.random().toString()}>
                  <Link
                    to={sub.path ?? "#"}
                    className="flex items-center gap-2 py-1 hover:text-primary"
                  >
                    {sub.Icon && <sub.Icon className="w-4 h-4 text-primary" />}
                    {sub.name || sub.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    if (collapsed && menu?.length) {
      return (
        <div className="relative">
          <div
            ref={ref}
            className={`flex justify-center p-2 hover:bg-base-300 rounded-lg cursor-pointer text-base-content ${
              open ? "bg-base-300" : ""
            }`}
            onClick={toggle}
          >
            {Icon && <Icon className="w-5 h-5 text-primary" />}
          </div>
          {open && (
            <FloatingMenu anchorRef={ref} onClose={() => setOpenId(null)}>
              {menu.map((sub) => (
                <li key={sub.path ?? sub.name ?? Math.random().toString()}>
                  <Link
                    to={sub.path ?? "#"}
                    className="flex items-center gap-2 hover:text-primary"
                  >
                    {sub.Icon && <sub.Icon className="w-4 h-4 text-primary" />}
                    {sub.name || sub.title}
                  </Link>
                </li>
              ))}
            </FloatingMenu>
          )}
        </div>
      );
    }

    return (
      <li>
        <Link
          to={path ?? "#"}
          className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-base-300 transition"
        >
          {Icon && <Icon className="w-5 h-5 text-primary" />}
          {!collapsed && label}
        </Link>
      </li>
    );
  };

  const menuItems = navigationMenuRoutes.filter(
    (r) => r.title || r.path
  ) as NavigationLink[];

  return (
    <div className="flex h-screen bg-base-200 text-base-content">
      <aside
        className={`bg-base-100 border-r border-base-300 transition-all duration-300 flex flex-col ${
          collapsed ? "w-20" : "w-72"
        }`}
      >
        <div className="relative flex items-center justify-center p-4 border-b border-base-300">
          {!collapsed && (
            <img
              src="/logo.svg"
              alt="Liquid Death logo"
              className="h-8 w-auto app-logo"
            />
          )}
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

        <ul className="menu p-3 text-base flex-1 overflow-y-auto gap-1">
          {menuItems.map((item) => (
            <IconButton
              key={item.title ?? item.path ?? Math.random().toString()}
              id={item.title ?? item.path ?? ""}
              icon={item.Icon}
              label={item.title ?? item.name ?? ""}
              menu={item.links}
              path={item.path}
            />
          ))}
        </ul>

        {/* USER FOOTER */}
        <div className="p-4 border-t border-base-300 flex items-center gap-3">
          <div className="avatar">
            <div className="w-10 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
              <img
                src="https://i.pravatar.cc/100?img=8"
                alt="User"
                className="object-cover"
              />
            </div>
          </div>
          {!collapsed && (
            <>
              <div>
                <p className="font-semibold text-sm text-base-content">
                  {user?.firstName ?? "User"}
                </p>
                <p className="text-xs opacity-60">Team</p>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle />
              </div>
            </>
          )}
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex justify-end items-center bg-base-100 border-b border-base-300 h-16 px-6 sticky top-0 z-30 text-base-content">
          <div className="flex items-center gap-4">
            <div className="avatar">
              <div className="w-10 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                <img
                  src="https://i.pravatar.cc/100?img=8"
                  alt="User Avatar"
                  className="object-cover"
                />
              </div>
            </div>
            <span className="font-medium hidden sm:block">
              {user?.firstName ?? "User"}
            </span>

            <button
              onClick={onLogout}
              className="btn btn-ghost btn-sm text-base-content hover:text-error flex items-center gap-1"
            >
              <ArrowRightEndOnRectangleIcon className="w-5 h-5" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 bg-base-200 overflow-y-auto text-base-content">
          <PageTransition>
            {children || (
              <h1 className="text-lg font-semibold text-base-content">
                Dashboard
              </h1>
            )}
          </PageTransition>
        </main>
      </div>
    </div>
  );
};

export default Layout;
