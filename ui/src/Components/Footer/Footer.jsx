import React from "react";
import { Github, Twitter, Linkedin, Moon, Sun } from "lucide-react";
import "./Footer.css";

const Footer = ({ isDark, toggleDark }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="dashboard-footer">
      <div className="footer-content">
        <div className="footer-left">
          <div className="footer-copyright">
            © {currentYear} Job Application Tracker
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">
              Privacy Policy
            </a>
            <a href="#" className="footer-link">
              Terms of Service
            </a>
            <a href="#" className="footer-link">
              Contact
            </a>
          </div>
        </div>
        <div className="footer-right">
          <div className="footer-social">
            <a
              href="https://github.com/Dagmbisrat"
              className="social-icon"
              aria-label="GitHub"
            >
              <Github size={20} />
            </a>
            {/* <a href="#" className="social-icon" aria-label="Twitter">
              <Twitter size={20} />
            </a> */}
            <a
              href="https://www.linkedin.com/in/dagm-bisrat-482aa9250/"
              className="social-icon"
              aria-label="LinkedIn"
            >
              <Linkedin size={20} />
            </a>
            <button
              onClick={toggleDark}
              className="footer-theme-toggle"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <Sun className="footer-theme-icon" />
              ) : (
                <Moon className="footer-theme-icon" />
              )}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
