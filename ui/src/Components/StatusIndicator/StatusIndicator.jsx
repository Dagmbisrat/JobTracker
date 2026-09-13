import React, { useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { DB_API_ADDY } from "../Config.js";
import "./StatusIndicator.css";

/**
 * Listening/Not Listening pill. Click it to confirm and flip whether the
 * inbox is being tracked. `onChange(nextListening)` lets the parent keep its
 * own copy of `user` (and localStorage) in sync.
 */
const StatusIndicator = ({ isListening, showLabel = true, onChange }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    if (saving) return;
    setOpen(false);
    setError("");
  };

  const confirm = async () => {
    setSaving(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${DB_API_ADDY}/users/listening`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listening: !isListening }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Something went wrong");
      }

      onChange?.(data.listening);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="status-indicator-container"
        onClick={() => setOpen(true)}
        aria-label={
          isListening ? "Stop tracking your inbox" : "Start tracking your inbox"
        }
      >
        <span
          className={`status-dot ${isListening ? "online" : "offline"}`}
          aria-hidden="true"
        />
        {showLabel && (
          <span className="status-label">
            {isListening ? "Listening" : "Not Listening"}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div className="tracking-overlay" onClick={close}>
            <div
              className="tracking-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Tracking preference"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="tracking-title">
                {isListening ? "Stop tracking your inbox?" : "Do you want to track?"}
              </h3>
              <p className="tracking-desc">
                {isListening
                  ? "JobTracker will stop scanning your inbox for job application emails."
                  : "JobTracker will scan your inbox and keep your pipeline up to date automatically."}
              </p>

              {error && (
                <div className="tracking-error" role="alert">
                  <AlertCircle size={16} />
                  <p>{error}</p>
                </div>
              )}

              <div className="tracking-actions">
                <button
                  type="button"
                  className="tracking-cancel"
                  onClick={close}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="tracking-confirm"
                  onClick={confirm}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 size={16} className="tracking-spin" />
                  ) : isListening ? (
                    "Stop tracking"
                  ) : (
                    "Start tracking"
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default StatusIndicator;
