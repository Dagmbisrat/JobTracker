import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DB_API_ADDY } from "../Config.js";
import DarkModeToggle from "../LightDarkmodeButton/LightDarkmodeButton.jsx";
import { Loader2 } from "lucide-react";
import "./Dashboard.css";

const Dashboard = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    return (
      savedTheme === "dark" ||
      (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    const fetchApplications = async () => {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user"));

      if (!token || !user) {
        navigate("/login");
        return;
      }

      try {
        const response = await fetch(
          `${DB_API_ADDY}/applications/user/${user.email}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch applications");
        }

        const data = await response.json();
        setApplications(data);
      } catch (error) {
        console.error("Error fetching applications:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, [navigate]);

  const toggleDark = () => {
    setIsDark(!isDark);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Loader2 className="loading-spinner" />
      </div>
    );
  }

  const getStatusClassName = (status) => {
    const baseClass = isDark ? "status-badge-dark" : "status-badge-light";
    return `status-badge ${baseClass} status-${status.toLowerCase().replace(/ /g, "-")}`;
  };

  return (
    <div className="dashboard-container">
      <div className="theme-toggle-container">
        <DarkModeToggle isDark={isDark} toggleDark={toggleDark} />
      </div>

      <div className="dashboard-content">
        <div className="dashboard-card">
          <div className="dashboard-header">
            <h1 className="dashboard-title">My Applications</h1>
          </div>

          <div className="table-container">
            <table className="applications-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th>Date Applied</th>
                </tr>
              </thead>
              <tbody>
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-message">
                      No applications found
                    </td>
                  </tr>
                ) : (
                  applications.map((app, index) => (
                    <tr key={index}>
                      <td>{app.company_name}</td>
                      <td>{app.job_title}</td>
                      <td>
                        <span className={getStatusClassName(app.status)}>
                          {app.status}
                        </span>
                      </td>
                      <td>{formatDate(app.app_date)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
