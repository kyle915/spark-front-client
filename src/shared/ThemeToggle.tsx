import { MoonIcon, SunIcon } from "@heroicons/react/24/solid";
import { type TenantColorScheme } from "@utils/tenantThemeConfig";

type Props = {
  value: TenantColorScheme;
  onChange: (value: TenantColorScheme) => void;
};

const ThemeToggle = ({ value, onChange }: Props) => {
  const isDark = value === "dark";

  const toggleTheme = () => {
    onChange(isDark ? "light" : "dark");
  };

  return (
    <label className="flex cursor-pointer gap-2 items-center bg-base-100/20 backdrop-blur-sm px-3 py-2 rounded-full">
      <span className="text-sm text-base-content">
        <SunIcon className="h-5 w-5" />
      </span>

      <input
        type="checkbox"
        className="toggle toggle-primary"
        checked={isDark}
        onChange={toggleTheme}
      />

      <span className="text-sm text-base-content">
        <MoonIcon className="h-5 w-4" />
      </span>
    </label>
  );
};

export default ThemeToggle;
