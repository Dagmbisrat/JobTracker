import "./LoginSignup.css";
import { DB_API_ADDY } from "../Config.js";
import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { AlertCircle, Loader2, Moon, Sun } from "lucide-react";
import DarkModeToggle from "../LightDarkmodeButton/LightDarkmodeButton.jsx";
import InfoButton from "../InfoButton/InfoButton.jsx";

const Button = ({ children, ...props }) => (
  <button {...props} className={`button ${props.className || ""}`}>
    {children}
  </button>
);

const Input = ({ ...props }) => (
  <input {...props} className={`input ${props.className || ""}`} />
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

  return (
    <div className="auth-container">
      <DarkModeToggle isDark={isDark} toggleDark={toggleDark} />

      <div className="auth-card">
        <div className="auth-header">
          <h2 className="auth-title">{isLogin ? "Login" : "Sign Up"}</h2>
          <p className="auth-description">
            {isLogin ? "Welcome back!" : "Create a new account to get started."}
          </p>
        </div>

        <div className="auth-content">
          <form onSubmit={handleSubmit} className="auth-form">
            {error && (
              <div className="auth-error">
                <AlertCircle className="error-icon" />
                <p>{error}</p>
              </div>
            )}

            {!isLogin && (
              <div className="form-group">
                <label>Name</label>
                <Input
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
              <Input
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
              <Input
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
                  <Input
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
                  <label>Email App Password</label>
                  <Input
                    name="email_app_password"
                    type="password"
                    value={formData.email_app_password}
                    onChange={handleChange}
                    placeholder="Your email app password"
                    required
                  />
                </div>
              </>
            )}

            <Button
              type="submit"
              className="auth-submit-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="loading-icon" />
                  <span>{isLogin ? "Logging in..." : "Signing up..."}</span>
                </>
              ) : isLogin ? (
                "Login"
              ) : (
                "Sign Up"
              )}
            </Button>
          </form>

          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
              setPasswordError("");
              setFormData({
                email: "",
                password: "",
                verifyPassword: "",
                name: "",
                email_app_password: "",
              });
            }}
            className="auth-toggle-button"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Login"}
          </button>
        </div>
      </div>
      {!isLogin && <InfoButton />}
    </div>
  );
};

export default AuthComponent;
