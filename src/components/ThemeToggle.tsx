import React from "react";
import { Sun, Moon } from "@phosphor-icons/react";
import { useTheme } from "../lib/useTheme";

// AZIIKI DESIGN SYSTEM — small, self-contained theme switch. Drop this
// anywhere in the chrome (sidebar footer, settings) without wiring any
// extra state through parent components.
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`az-btn az-btn-secondary micro-press ${compact ? "p-2" : "px-3 py-2"} !rounded-xl`}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      {!compact && <span className="text-[10px] font-bold">{isDark ? "Light" : "Dark"}</span>}
    </button>
  );
}
