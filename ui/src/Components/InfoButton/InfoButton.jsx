import React, { useState } from "react";
import { Info, X } from "lucide-react";
import "./InfoButton.css";

const InfoButton = ({ open, onOpenChange }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const setOpen = (value) => {
    if (!isControlled) setInternalOpen(value);
    if (onOpenChange) onOpenChange(value);
  };

  const toggleInfo = () => setOpen(!isOpen);

  return (
    <>
      <button
        className="info-button"
        onClick={toggleInfo}
        aria-label="How to get a Google App Password"
      >
        <Info className="info-icon" />
      </button>

      {isOpen && (
        <div className="info-overlay" onClick={() => setOpen(false)}>
          <div className="info-popup" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={() => setOpen(false)}>
              <X className="close-icon" />
            </button>

            <h3 className="info-title">Get Your Google App Password</h3>

            <div className="info-content">
              <h4>Step 1: Access Google Account Settings</h4>
              <ul>
                <li>
                  <strong>Go to:</strong> Google Account settings at
                  myaccount.google.com
                </li>
                <li>
                  <strong>Sign in:</strong> Use your Google account credentials
                  if not already logged in
                </li>
              </ul>

              <h4>Step 2: Enable 2-Step Verification</h4>
              <ul>
                <li>
                  <strong>Navigate to:</strong> Security &rarr; 2-Step
                  Verification
                </li>
                <li>
                  <strong>Follow:</strong> The setup process if not already
                  enabled
                </li>
              </ul>

              <h4>Step 3: Generate App Password</h4>
              <ul>
                <li>
                  <strong>Go to:</strong> Security &rarr; 2-Step Verification
                  &rarr; App Passwords
                </li>
                <li>
                  <strong>Select app:</strong> Choose "Mail" from the dropdown
                  menu
                </li>
                <li>
                  <strong>Select device:</strong> Choose your device type
                </li>
                <li>
                  <strong>Generate:</strong> Click "Generate" to create your app
                  password
                </li>
              </ul>

              <h4>Important Notes:</h4>
              <ul>
                <li>The app password will be 16 characters long</li>
                <li>Save this password in a secure location</li>
                <li>You can only view the password once when it's generated</li>
                <li>
                  You can revoke app passwords at any time from your Google
                  Account
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InfoButton;
