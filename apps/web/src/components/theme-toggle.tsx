"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "clauderon-theme";

/** Runs before paint (inlined in the root layout) so the saved theme never flashes. Dark is the default. */
export const THEME_BOOTSTRAP = `try{var t=localStorage.getItem("${KEY}");if(t==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "light") setTheme("light");
    } catch {
      // storage unavailable: stay on dark
    }
  }, []);

  const choose = (next: Theme) => {
    setTheme(next);
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      if (next === "light") localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch {
      // storage unavailable: the choice lasts for this page only
    }
  };

  return (
    <div className="seg theme-seg" role="group" aria-label="Theme">
      {(["light", "dark"] as const).map((option) => (
        <button key={option} type="button" className={theme === option ? "on" : ""} onClick={() => choose(option)}>
          {option[0]!.toUpperCase() + option.slice(1)}
        </button>
      ))}
    </div>
  );
}
