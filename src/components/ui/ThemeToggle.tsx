import { memo } from "react";
import { Button } from "../../components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "@/hooks/useThemeMode";

const ThemeToggle = () => {
  const [isDark, toggleTheme] = useThemeMode();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className="cursor-pointer bg-white border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
};

export default memo(ThemeToggle);
