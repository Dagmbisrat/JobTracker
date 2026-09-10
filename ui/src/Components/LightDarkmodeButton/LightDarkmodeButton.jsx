import React, { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import "./LightDarkmodeButton.css";

/**
 * Sliding light/dark switch.
 * - Uncontrolled (no props): manages its own theme state + <html> class.
 * - Controlled: pass `isDark` + `toggleDark` and the parent owns the state.
 * `variant="fixed"` pins it to the top-right; `variant="inline"` sits in flow.
 */
const DarkModeToggle = ({
  isDark: controlledIsDark,
  toggleDark: controlledToggle,
  variant = "fixed",
}) => {
  const isControlled = controlledIsDark !== undefined;

  const [internalIsDark, setInternalIsDark] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    return (
      savedTheme === "dark" ||
      (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });

  useEffect(() => {
    if (isControlled) return;
    document.documentElement.classList.toggle("dark", internalIsDark);
    localStorage.setItem("theme", internalIsDark ? "dark" : "light");
  }, [internalIsDark, isControlled]);

  const isDark = isControlled ? controlledIsDark : internalIsDark;

  const handleToggle = () => {
    if (isControlled) controlledToggle();
    else setInternalIsDark((v) => !v);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`theme-switch ${variant} ${isDark ? "is-dark" : ""}`}
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
    >
      <span className="theme-switch-track">
        <Sun className="theme-switch-ghost sun" size={12} aria-hidden="true" />
        <Moon className="theme-switch-ghost moon" size={12} aria-hidden="true" />
        <span className="theme-switch-knob">
          {isDark ? <Moon size={12} /> : <Sun size={12} />}
        </span>
      </span>
    </button>
  );
};

export default DarkModeToggle;
