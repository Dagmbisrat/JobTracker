import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DB_API_ADDY } from "../Config.js";
import DarkModeToggle from "../LightDarkmodeButton/LightDarkmodeButton.jsx";
import { Loader2, ArrowUpDown, Filter } from "lucide-react";
import "./Dashboard.css";

const Dashboard = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [sortConfig, setSortConfig] = useState({
    key: "app_date",
    direction: "desc",
  });

  const statusOptions = [
    "All",
    "Pending Response",
    "Interview Scheduled",
    "Talk Scheduled",
    "Offer Received",
    "Rejected",
  ];

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
        navigate("/");
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

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedApplications = [...applications]
    .filter((app) =>
      selectedStatus === "All" ? true : app.status === selectedStatus,
    )
    .sort((a, b) => {
      if (sortConfig.key === "app_date") {
        const dateA = new Date(a[sortConfig.key]);
        const dateB = new Date(b[sortConfig.key]);
        return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA;
      }

      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });

  const getStatusClassName = (status) => {
    const baseClass = isDark ? "status-badge-dark" : "status-badge-light";
    return `status-badge ${baseClass} status-${status.toLowerCase().replace(/ /g, "-")}`;
  };

  const getSortIndicator = (columnKey) => {
    if (sortConfig.key === columnKey) {
      return (
        <span className={`sort-indicator ${sortConfig.direction}`}>
          <ArrowUpDown size={16} />
        </span>
      );
    }
    return <ArrowUpDown size={16} className="sort-indicator-inactive" />;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Loader2 className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="theme-toggle-container">
        <DarkModeToggle isDark={isDark} toggleDark={toggleDark} />
      </div>

      <div className="dashboard-content">
        <div className="dashboard-card">
          <div className="dashboard-header">
            <div className="header-top">
              <h1 className="dashboard-title">My Applications</h1>
            </div>
            <div className="filter-section">
              <div className="filter-container">
                <Filter size={16} className="filter-icon" />
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="status-filter"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="entries-count">
                {filteredAndSortedApplications.length} entries
              </div>
            </div>
          </div>

          <div className="table-container">
            <table className="applications-table">
              <thead>
                <tr>
                  <th
                    onClick={() => handleSort("company_name")}
                    className="sortable-header"
                  >
                    Company {getSortIndicator("company_name")}
                  </th>
                  <th
                    onClick={() => handleSort("job_title")}
                    className="sortable-header"
                  >
                    Position {getSortIndicator("job_title")}
                  </th>
                  <th>Status</th>
                  <th
                    onClick={() => handleSort("app_date")}
                    className="sortable-header"
                  >
                    Date Applied {getSortIndicator("app_date")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedApplications.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-message">
                      No applications found
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedApplications.map((app, index) => (
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
