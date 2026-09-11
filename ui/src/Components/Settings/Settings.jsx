import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Settings as SettingsIcon, X, Check } from "lucide-react";
import "./Settings.css";

const DEFAULT_THEME = "slate";

const THEMES = [
  {
    id: "slate",
    name: "Slate",
    description: "Deep blue-grey, cool and dim.",
    swatch: ["#0c0f18", "#243149", "#3d97ff", "#f1f4fa"],
  },
  {
    id: "carbon",
    name: "Carbon",
    description: "Pure black, sharp and neutral.",
    swatch: ["#000000", "#1a1a1a", "#3a3a3a", "#ffffff"],
  },
];

const applyVariant = (id) => {
  const el = document.documentElement;
  if (id === DEFAULT_THEME) el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", id);
};

const readVariant = () => {
  try {
    return localStorage.getItem("themeVariant") || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

const Settings = ({ variant = "solid" }) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(readVariant);

  useEffect(() => {
    applyVariant(selected);
  }, [selected]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const choose = (id) => {
    setSelected(id);
    applyVariant(id);
    try {
      localStorage.setItem("themeVariant", id);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <button
        type="button"
        className={`settings-button ${variant}`}
        onClick={() => setOpen(true)}
        aria-label="Settings"
      >
        <SettingsIcon size={16} />
      </button>

      {open &&
        createPortal(
          <div className="settings-overlay" onClick={() => setOpen(false)}>
          <div
            className="settings-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-head">
              <h3 className="settings-title">Settings</h3>
              <button
                type="button"
                className="settings-close"
                onClick={() => setOpen(false)}
                aria-label="Close settings"
              >
                <X size={16} />
              </button>
            </div>

            <div className="settings-section">
              <h4 className="settings-section-title">Themes</h4>
              <p className="settings-hint">Applies to dark mode.</p>

              <ul className="theme-list">
                {THEMES.map((t) => {
                  const active = selected === t.id;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        className={`theme-option ${active ? "active" : ""}`}
                        aria-pressed={active}
                        onClick={() => choose(t.id)}
                      >
                        <span className="theme-swatch" aria-hidden="true">
                          {t.swatch.map((c, i) => (
                            <span key={i} style={{ background: c }} />
                          ))}
                        </span>
                        <span className="theme-meta">
                          <span className="theme-name">{t.name}</span>
                          <span className="theme-desc">{t.description}</span>
                        </span>
                        {active && (
                          <Check size={16} className="theme-check" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default Settings;
