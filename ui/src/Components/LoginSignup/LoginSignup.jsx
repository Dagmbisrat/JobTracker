import "./LoginSignup.css";
import { DB_API_ADDY } from "../Config.js";
import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  Loader2,
  Mail,
  Lock,
  User,
  KeyRound,
} from "lucide-react";
import DarkModeToggle from "../LightDarkmodeButton/LightDarkmodeButton.jsx";
import InfoButton from "../InfoButton/InfoButton.jsx";

const Field = ({ icon: Icon, ...props }) => (
  <div className="field">
    {Icon && <Icon className="field-icon" size={18} aria-hidden="true" />}
    <input {...props} className={`input ${props.className || ""}`} />
  </div>
);

const AuthComponent = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isDark, setIsDark] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    return (
      savedTheme === "dark" ||
      (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    verifyPassword: "",
    name: "",
    email_app_password: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");

    if (!token || !user) {
      navigate("/");
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(`${DB_API_ADDY}/verify-token`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (!response.ok) {
          throw new Error("Token verification failed");
        }

        const data = await response.json();

        if (!data.valid) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/");
        } else {
          navigate("/dashboard");
        }
      } catch (error) {
        console.error("Token verification failed:", error);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/");
      }
    };

    verifyToken();
  }, [navigate]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  const toggleDark = () => {
    setIsDark(!isDark);
  };

  const validatePasswords = () => {
    if (!isLogin && formData.password !== formData.verifyPassword) {
      setPasswordError("Passwords do not match");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLogin && !validatePasswords()) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const endpoint = isLogin ? "/login" : "/signup";
      const { verifyPassword, ...submitData } = formData;

      // Convert email to lowercase before sending
      submitData.email = submitData.email.toLowerCase();

      const response = await fetch(`${DB_API_ADDY}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (!response.ok) {
        // Extract only the message text without error codes
        let errorMessage = data.detail || "An error occurred";
        if (typeof errorMessage === "string") {
          // Remove any error codes that might be in parentheses or brackets
          errorMessage = errorMessage.replace(/[\[\(].*?[\]\)]/g, "").trim();
          // Remove any leading error code patterns (e.g., "E123:", "Error 123:")
          errorMessage = errorMessage.replace(
            /^([Ee]rror\s*\d+:?\s*)|(\d+:?\s*)/i,
            "",
          );
        }
        throw new Error(errorMessage);
      }

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (name === "password" || name === "verifyPassword") {
      setPasswordError("");
    }
  };

  const switchMode = (loginMode) => {
    if (loginMode === isLogin) return;
    setIsLogin(loginMode);
    setError("");
    setPasswordError("");
    setFormData({
      email: "",
      password: "",
      verifyPassword: "",
      name: "",
      email_app_password: "",
    });
  };

  return (
    <div className="auth-container">
      <DarkModeToggle isDark={isDark} toggleDark={toggleDark} />

      <div className="auth-card">
        <div className="auth-brand">
          <img src="/Suitcase1.svg" alt="" className="auth-logo" />
          <span className="auth-wordmark">JobTracker</span>
        </div>

        <div className="auth-header">
          <h2 className="auth-title">
            {isLogin ? "Welcome back" : "Create your account"}
          </h2>
          <p className="auth-description">
            {isLogin
              ? "Log in to see your application pipeline."
              : "Connect your inbox and let it track applications for you."}
          </p>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={isLogin}
            className={`auth-tab ${isLogin ? "active" : ""}`}
            onClick={() => switchMode(true)}
          >
            Login
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isLogin}
            className={`auth-tab ${!isLogin ? "active" : ""}`}
            onClick={() => switchMode(false)}
          >
            Sign up
          </button>
        </div>

        <div className="auth-content">
          <form onSubmit={handleSubmit} className="auth-form">
            {error && (
              <div className="auth-error" role="alert">
                <AlertCircle className="error-icon" size={18} />
                <p>{error}</p>
              </div>
            )}

            {!isLogin && (
              <div className="form-group">
                <label>Name</label>
                <Field
                  icon={User}
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label>Email</label>
              <Field
                icon={Mail}
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <Field
                icon={Lock}
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
              />
            </div>

            {!isLogin && (
              <>
                <div className="form-group">
                  <label>Verify Password</label>
                  <Field
                    icon={Lock}
                    name="verifyPassword"
                    type="password"
                    value={formData.verifyPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                  />
                  {passwordError && (
                    <span className="password-error">{passwordError}</span>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    Email App Password
                    <span className="label-hint"> · Gmail 16-char code</span>
                  </label>
                  <Field
                    icon={KeyRound}
                    name="email_app_password"
                    type="password"
                    value={formData.email_app_password}
                    onChange={handleChange}
                    placeholder="xxxx xxxx xxxx xxxx"
                    required
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="button auth-submit-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="loading-icon" size={18} />
                  <span>{isLogin ? "Logging in..." : "Signing up..."}</span>
                </>
              ) : isLogin ? (
                "Log in"
              ) : (
                "Create account"
              )}
            </button>
          </form>
        </div>
      </div>
      {!isLogin && <InfoButton />}
    </div>
  );
};

export default AuthComponent;
