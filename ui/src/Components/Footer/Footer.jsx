import React from "react";
import { Github, Linkedin } from "lucide-react";
import "./Footer.css";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="dashboard-footer">
      <div className="footer-content">
        <div className="footer-copyright">© {currentYear} JobTracker</div>
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
        </div>
      </div>
    </footer>
  );
};

export default Footer;
