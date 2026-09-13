import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Loader2, X } from "lucide-react";
import { DB_API_ADDY } from "../Config.js";
import "./EditApplicationModal.css";

const STATUS_OPTIONS = [
  "Pending Response",
  "Interview Scheduled",
  "Talk Scheduled",
  "Offer Received",
  "Rejected",
];

/**
 * Edit an application's company name, job title, and status.
 * `application` is the row being edited (must include app_id), or null to
 * keep the modal closed/unmounted.
 */
const EditApplicationModal = ({ application, onClose, onSaved }) => {
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [status, setStatus] = useState("Pending Response");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!application) return;
    setCompanyName(application.company_name || "");
    setJobTitle(application.job_title || "");
    setStatus(application.status || "Pending Response");
    setError("");
  }, [application]);

  useEffect(() => {
    if (!application) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [application, onClose]);

  if (!application) return null;

  const trimmedCompany = companyName.trim();
  const trimmedTitle = jobTitle.trim();
  const canSave = trimmedCompany && trimmedTitle && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `${DB_API_ADDY}/applications/${application.app_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_name: trimmedCompany,
            job_title: trimmedTitle,
            status,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        let errorMessage = data.detail || "An error occurred";
        if (typeof errorMessage === "string") {
          errorMessage = errorMessage.replace(/[[(].*?[\])]/g, "").trim();
          errorMessage = errorMessage.replace(
            /^([Ee]rror\s*\d+:?\s*)|(\d+:?\s*)/i,
            "",
          );
        }
        throw new Error(errorMessage);
      }

      onSaved({
        company_name: trimmedCompany,
        job_title: trimmedTitle,
        status,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="edit-app-overlay" onClick={onClose}>
      <div
        className="edit-app-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Edit application"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="edit-app-head">
          <h3 className="edit-app-title">Edit application</h3>
          <button
            type="button"
            className="edit-app-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-app-form">
          {error && (
            <div className="edit-app-error" role="alert">
              <AlertCircle size={16} />
              <p>{error}</p>
            </div>
          )}

          <div className="edit-app-field">
            <label htmlFor="edit-app-company">Company</label>
            <input
              id="edit-app-company"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>

          <div className="edit-app-field">
            <label htmlFor="edit-app-title">Position</label>
            <input
              id="edit-app-title"
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              required
            />
          </div>

          <div className="edit-app-field">
            <label htmlFor="edit-app-status">Status</label>
            <select
              id="edit-app-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="edit-app-actions">
            <button
              type="button"
              className="edit-app-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="edit-app-save"
              disabled={!canSave}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="edit-app-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

export default EditApplicationModal;
