import { useCallback, useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────
// AZIIKI DESIGN SYSTEM — theme controller.
// Toggles a `.dark` class on <html>, which flips every CSS custom property
// defined in src/index.css (:root vs .dark). Persists the choice, and
// falls back to the OS preference on first visit. Pure UI concern — no
// business logic, no data access.
// ─────────────────────────────────────────────────────────────────────────

export type Theme = "light" | "dark";

const STORAGE_KEY = "aziiki_theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
