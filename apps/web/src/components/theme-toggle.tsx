"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "system" | "dark";
const KEY = "clauderon-theme";

/** Runs before paint (inlined in the root layout) so the saved theme never flashes. */
export const THEME_BOOTSTRAP = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      // storage unavailable: stay on system
    }
  }, []);

  const choose = (next: Theme) => {
    setTheme(next);
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // storage unavailable: the choice lasts for this page only
    }
  };

  return (
    <div className="seg theme-seg" role="group" aria-label="Theme">
      {(["light", "system", "dark"] as const).map((option) => (
        <button key={option} type="button" className={theme === option ? "on" : ""} onClick={() => choose(option)}>
          {option[0]!.toUpperCase() + option.slice(1)}
        </button>
      ))}
    </div>
  );
}
