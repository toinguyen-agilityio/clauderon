"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";

type Theme = "light" | "system" | "dark";
const KEY = "clauderon-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs before paint (inlined in the root layout) so the saved theme never flashes.
 * Light is the default; "system" follows the OS setting.
 */
export const THEME_BOOTSTRAP = `try{var t=localStorage.getItem("${KEY}");if(t==="dark"||(t==="system"&&matchMedia("${DARK_QUERY}").matches))document.documentElement.dataset.theme="dark"}catch(e){}`;

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: Icon.sun },
  { value: "system", label: "System", icon: Icon.monitor },
  { value: "dark", label: "Dark", icon: Icon.moon },
];

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia(DARK_QUERY).matches);
  if (dark) document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "dark" || saved === "system") setTheme(saved);
    } catch {
      // storage unavailable: stay on light
    }
  }, []);

  // While on "system", follow the OS when it switches.
  useEffect(() => {
    if (theme !== "system") return;
    const media = matchMedia(DARK_QUERY);
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const choose = (next: Theme) => {
    setTheme(next);
    apply(next);
    try {
      if (next === "light") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // storage unavailable: the choice lasts for this page only
    }
  };

  return (
    <div className="seg theme-seg" role="group" aria-label="Theme">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={theme === option.value ? "on" : ""}
          aria-pressed={theme === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => choose(option.value)}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}
