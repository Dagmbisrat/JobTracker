import React from "react";
import { Github, Linkedin, Moon, Sun } from "lucide-react";
import "./Footer.css";

const Footer = ({ isDark, toggleDark }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="dashboard-footer">
      <div className="footer-content">
        <div className="footer-copyright">
          © {currentYear} JobTracker
        </div>
        <div className="footer-social">
          <a
            href="https://github.com/Dagmbisrat"
            target="_blank"
            rel="noreferrer"
            className="social-icon"
            aria-label="GitHub"
          >
            <Github size={18} />
          </a>
          <a
            href="https://www.linkedin.com/in/dagm-bisrat-482aa9250/"
            target="_blank"
            rel="noreferrer"
            className="social-icon"
            aria-label="LinkedIn"
          >
            <Linkedin size={18} />
          </a>
          <button
            onClick={toggleDark}
            className="footer-theme-toggle"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
