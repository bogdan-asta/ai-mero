"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      aria-label="Переключить тему"
      className="theme-control"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      title="Переключить тему"
      type="button"
    >
      <Sun aria-hidden="true" className="theme-icon-light" size={15} />
      <Moon aria-hidden="true" className="theme-icon-dark" size={15} />
    </button>
  );
}
