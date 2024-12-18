import React from "react";
import "./StatusIndicator.css";

const StatusIndicator = ({ isListening, showLabel = true }) => {
  return (
    <div className="status-indicator-container">
      <div
        className={`status-dot ${isListening ? "online" : "offline"}`}
        aria-hidden="true"
      />
      {showLabel && (
        <span className="status-label">
          {isListening ? "Listening" : "Not Listening"}
        </span>
      )}
    </div>
  );
};

export default StatusIndicator;
