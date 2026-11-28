import { Moon, Sun } from "lucide-react";
import { InkSwitch } from "@/motion/InkSwitch";
import { type TenantColorScheme } from "@utils/tenantThemeConfig";

type Props = {
  value: TenantColorScheme;
  onChange: (value: TenantColorScheme) => void;
};

const ThemeToggle = ({ value, onChange }: Props) => {
  const isDark = value === "dark";

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm"
      style={{
        background: "var(--spark-surface-2)",
        border: "1px solid var(--spark-border)",
        color: "var(--spark-text)",
      }}
    >
      <Sun
        size={15}
        strokeWidth={1.85}
        style={{
          color: !isDark ? "var(--spark-text)" : "var(--spark-text-meta)",
        }}
        aria-hidden
      />
      <InkSwitch
        checked={isDark}
        onChange={(nextDark) => onChange(nextDark ? "dark" : "light")}
        ariaLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
      />
      <Moon
        size={15}
        strokeWidth={1.85}
        style={{
          color: isDark ? "var(--spark-text)" : "var(--spark-text-meta)",
        }}
        aria-hidden
      />
    </div>
  );
};

export default ThemeToggle;
