import { useState, useEffect } from "react";
import { MoonIcon, SunIcon } from "@heroicons/react/24/solid";

const ThemeToggle = () => {
    const [theme, setTheme] = useState("fantajia");

    useEffect(() => {
        const saved = localStorage.getItem("@theme") || "fantajia";
        document.documentElement.setAttribute("data-theme", saved);
        setTheme(saved);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === "fantajia" ? "bijinesu" : "fantajia";
        document.documentElement.setAttribute("data-theme", newTheme);
        setTheme(newTheme);
        localStorage.setItem("@theme", newTheme);
    };

    return (
        <label className="flex cursor-pointer gap-2 items-center bg-base-100/20 backdrop-blur-sm px-3 py-2 rounded-full">
            <span className="text-sm text-base-content"><SunIcon className="h-5 w-5" /></span>
            <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={theme === "bijinesu"}
                onChange={toggleTheme}
            />
            <span className="text-sm text-base-content"><MoonIcon className="h-5 w-4" /></span>
        </label>
    )
}

export default ThemeToggle