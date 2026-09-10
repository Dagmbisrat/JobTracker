import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DB_API_ADDY } from "../Config.js";
import {
  ArrowUpDown,
  Search,
  LogOut,
  Inbox,
  Briefcase,
  CalendarClock,
  Trophy,
  XCircle,
} from "lucide-react";
import "./Dashboard.css";
import Footer from "../Footer/Footer.jsx";
import StatusIndicator from "../StatusIndicator/StatusIndicator.jsx";

const Dashboard = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [search, setSearch] = useState("");
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
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) {
          // If response is unauthorized (401) or forbidden (403), redirect to login
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            navigate("/");
            return;
          }
          throw new Error("Failed to fetch applications");
        }

        const data = await response.json();
        setApplications(data);
      } catch (error) {
        console.error("Error fetching applications:", error);
        // On any error that might indicate invalid authentication, redirect to login
        if (
          error.message.includes("unauthorized") ||
          error.message.includes("forbidden")
        ) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, [navigate]);

  const toggleDark = () => {
    setIsDark(!isDark);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
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
    .filter((app) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (app.company_name || "").toLowerCase().includes(q) ||
        (app.job_title || "").toLowerCase().includes(q)
      );
    })
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

  const countByStatus = (status) =>
    applications.filter((app) => app.status === status).length;

  const stats = [
    {
      label: "Total",
      value: applications.length,
      icon: Briefcase,
      tone: "neutral",
    },
    {
      label: "Interviews",
      value: countByStatus("Interview Scheduled"),
      icon: CalendarClock,
      tone: "interview",
    },
    {
      label: "Offers",
      value: countByStatus("Offer Received"),
      icon: Trophy,
      tone: "offer",
    },
    {
      label: "Rejected",
      value: countByStatus("Rejected"),
      icon: XCircle,
      tone: "rejected",
    },
  ];

  const getStatusClassName = (status) => {
    return `status-badge status-${status.toLowerCase().replace(/ /g, "-")}`;
  };

  const getSortIndicator = (columnKey) => {
    const active = sortConfig.key === columnKey;
    return (
      <ArrowUpDown
        size={14}
        className={`sort-indicator ${active ? `active ${sortConfig.direction}` : ""}`}
      />
    );
  };

  const user =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("user") || "null")
      : null;

  return (
    <div className="dashboard-container">
      <header className="app-bar">
        <div className="app-bar-inner">
          <div className="app-brand">
            <img src="/Suitcase1.svg" alt="" className="app-logo" />
            <span className="app-wordmark">JobTracker</span>
          </div>
          <div className="app-bar-actions">
            <StatusIndicator isListening={user ? user.listening : false} />
            <button onClick={handleLogout} className="logout-button">
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-content">
        <div className="page-heading">
          <h1 className="dashboard-title">My Applications</h1>
          <p className="dashboard-subtitle">
            {user?.email ? user.email : "Your job search, tracked automatically."}
          </p>
        </div>

        <div className="stat-grid">
          {stats.map((s) => (
            <div key={s.label} className={`stat-card tone-${s.tone}`}>
              <div className="stat-icon">
                <s.icon size={18} />
              </div>
              <div className="stat-body">
                <span className="stat-value">{loading ? "—" : s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="toolbar">
            <div className="search-field">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company or position"
                className="search-input"
              />
            </div>
            <div className="toolbar-right">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="status-filter"
                aria-label="Filter by status"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <span className="entries-count">
                {filteredAndSortedApplications.length}
                {filteredAndSortedApplications.length === 1
                  ? " entry"
                  : " entries"}
              </span>
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
                    <span>Company {getSortIndicator("company_name")}</span>
                  </th>
                  <th
                    onClick={() => handleSort("job_title")}
                    className="sortable-header"
                  >
                    <span>Position {getSortIndicator("job_title")}</span>
                  </th>
                  <th>Status</th>
                  <th
                    onClick={() => handleSort("app_date")}
                    className="sortable-header"
                  >
                    <span>Date Applied {getSortIndicator("app_date")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="skeleton-row">
                      <td data-label="Company">
                        <span className="skeleton" style={{ width: "60%" }} />
                      </td>
                      <td data-label="Position">
                        <span className="skeleton" style={{ width: "80%" }} />
                      </td>
                      <td data-label="Status">
                        <span
                          className="skeleton"
                          style={{ width: "5.5rem", height: "1.4rem" }}
                        />
                      </td>
                      <td data-label="Date Applied">
                        <span className="skeleton" style={{ width: "4.5rem" }} />
                      </td>
                    </tr>
                  ))
                ) : filteredAndSortedApplications.length === 0 ? (
                  <tr>
                    <td colSpan="4">
                      <div className="empty-state">
                        <Inbox size={28} />
                        <p className="empty-title">No applications found</p>
                        <p className="empty-hint">
                          {applications.length === 0
                            ? "New applications will show up here as your inbox is scanned."
                            : "Try a different search or status filter."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedApplications.map((app, index) => (
                    <tr key={index}>
                      <td data-label="Company" className="cell-company">
                        {app.company_name}
                      </td>
                      <td data-label="Position">{app.job_title}</td>
                      <td data-label="Status">
                        <span className={getStatusClassName(app.status)}>
                          <span className="badge-dot" />
                          {app.status}
                        </span>
                      </td>
                      <td data-label="Date Applied" className="cell-date">
                        {formatDate(app.app_date)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer isDark={isDark} toggleDark={toggleDark} />
    </div>
  );
};

export default Dashboard;
