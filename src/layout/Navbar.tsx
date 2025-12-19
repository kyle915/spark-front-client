import { NavLink, useLocation } from "react-router";
import { ChevronDown } from "lucide-react";
import ThemeToggle from "../components/ui/ThemeToggle";


type NavLinkItem = { to: string; label: string };

const defaultNavLinks: NavLinkItem[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/sales", label: "Sales Form" },
  { to: "/approval-queue", label: "Approval Queue" },
  { to: "/retail-recaps", label: "Retail Recaps" },
];

export default function Navbar({ navLinks = defaultNavLinks }: { navLinks?: NavLinkItem[]; onOpenDrawer?: () => void }) {
  const location = useLocation();
  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 text-sm font-semibold rounded-md transition-colors duration-200 ${
      isActive
        ? "border-b-2 border-primary text-primary"
        : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
    }`;
  const dropdownLinkClassName = ({ isActive }: { isActive: boolean }) =>
    isActive ? "font-semibold text-primary" : "";

  const currentDashboard =
    location.pathname.startsWith("/dashboard-event")
      ? "Event Dashboard"
      : "Retail Dashboard";

  return (
    <header className="sticky mb-0 md:mb-5 top-0 z-50 w-full border-b backdrop-blur-xs bg-white/90 border-gray-200 dark:bg-gray-900/90 dark:border-gray-800 transition-colors duration-300">
      <div className="mx-auto p-3 sm:px-5 flex justify-between items-center">
        
        {/* Logo */}
        <h1 className="text-1xl text-gray-900 dark:text-white font-bold">Spark</h1>

        {/* Center nav */}
        <nav className="flex justify-center flex-1">
          <ul className="menu menu-horizontal px-1 space-x-2">
            {navLinks.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={navLinkClassName}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Dashboard selector */}
        <div className="flex-none">
          <div className="dropdown dropdown-end">
            <label
              tabIndex={0}
              className="btn btn-sm bg-white border border-gray-300 hover:border-primary hover:bg-gray-50 text-gray-800 dark:bg-gray-800 dark:text-white flex items-center gap-2"
            >
              {currentDashboard}
              <ChevronDown className="w-4 h-4" />
            </label>

            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300"
            >
              <li>
                <NavLink
                  to="/dashboard"
                  className={dropdownLinkClassName}
                >
                  Retail Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/dashboard-event"
                  className={dropdownLinkClassName}
                >
                  Event Dashboard
                </NavLink>
              </li>
            </ul>
          </div>
          
        </div>
        <ThemeToggle />

      </div>
    </header>
  );
}
